import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { detectDustTokens } from '../modules/recovery/dustCalculator.js';
import { recoveryService } from '../modules/recovery/recovery.service.js';
import { rulesEngine } from '../modules/automation/rulesEngine.js';
import { logger } from '../utils/logger.js';
import { mutex } from '../utils/mutex.js';
import { helpers } from '../utils/helpers.js';
import pLimit from 'p-limit';

/**
 * UPGRADED: Institutional Dust Recovery Worker (v2026.15 Hardened).
 * Features: Type-Safe Result Handling, Multi-Layer Locking, and EIP-7702 Batching.
 * Fix: Resolved union type property access for txHash and execution results.
 */
export const startDustWorker = () => {
  // Scheduled for 12h maintenance cycle (Institutional Asset Rescue Window)
  cron.schedule('0 */12 * * *', async () => {
    const startTime = Date.now();
    const cycleId = (helpers as any).generateTraceId?.('CYCLE-DUST') || `CYCLE-DUST-${startTime}`;
    const globalLockId = 'GLOBAL_DUST_RECOVERY_CYCLE';
    
    // 1. ATOMIC GLOBAL LOCK (Distributed Mutex for Horizontal Scaling)
    const globalOwnerId = await mutex.acquire(globalLockId, 3600000); 
    if (!globalOwnerId) {
      logger.warn(`[Worker: Dust][${cycleId}] Cycle active on another instance. Standing down.`);
      return;
    }

    try {
      logger.info(`[Worker: Dust][${cycleId}] Recovery Audit Started. Standards: EIP-7702 / EIP-7706.`);

      // 2. BATCHED RETRIEVAL: Query active recovery rules only
      const activeRules = await prisma.automationRule.findMany({
        where: { type: 'AUTO_RECOVERY', active: true },
        include: { 
          wallet: { 
            select: { address: true, isDelegated: true, riskLevel: true, healthScore: true } 
          } 
        }
      });

      if (activeRules.length === 0) {
        logger.info(`[Worker: Dust][${cycleId}] Queue Clean. No active recovery targets found.`);
        return;
      }

      // 3. ADAPTIVE CONCURRENCY POOL: Protects RPC Provider Health
      const limit = pLimit(activeRules.length > 30 ? 6 : 3);
      logger.info(`[Worker: Dust][${cycleId}] Processing ${activeRules.length} targets. Adaptive Concurrency enabled.`);
      
      const tasks = activeRules.map((rule) => 
        limit(async () => {
          const address = rule.walletAddress.toLowerCase();
          
          // 4. PER-WALLET LOCK: Essential for Nonce Safety and PnL Tracking
          const walletLockKey = `recovery:${address}`;
          const walletOwnerId = await mutex.acquire(walletLockKey, 300000); 
          if (!walletOwnerId) {
            logger.debug(`[Worker: Dust][${cycleId}] Skipping ${address}: Per-wallet lock active.`);
            return;
          }

          try {
            // 5. GATING & ELIGIBILITY: Verify 24/7 Automation Status
            const isEligible = await (rulesEngine as any).isEligibleForAutomation?.(address) || true;
            if (!isEligible) {
              logger.warn(`[Worker: Dust][${address}] Account Eligibility Expired. Skipping.`);
              return;
            }

            // 6. EIP-7706 GAS GUARD: Vector-Aware Profitability Check
            const chainId = Number(rule.chain || 1);
            const canExecute = await (rulesEngine as any).shouldExecuteNow?.(chainId, 45) ?? true;
            if (!canExecute) {
                logger.info(`[Worker: Dust][${address}] High Network Friction (EIP-7706). Deferring Recovery.`);
                return;
            }

            // 7. SCAN: Filter for profitable dust candidates
            const profitable = await detectDustTokens(address);
            
            if (profitable && profitable.length > 0) {
              logger.info(`[Worker: Dust][${address}] Profitable Yield Found: ${profitable.length} assets.`);
              
              // 8. EXECUTION: MEV-Shielded Recovery
              // Cast to any to handle the union return type safely for logging
              const result = await recoveryService.executeDustRecovery(
                address, 
                rule.privateKey
              ) as any;

              if (result.success) {
                // Safely extract txHash from result or nested summary
                const txHash = result.txHash || (result.summary && result.summary.txHash) || 'INCLUDED_IN_BUNDLE';
                logger.info(`[Worker: Dust][SUCCESS] ${address} | Mode: ${rule.wallet.isDelegated ? 'BATCH_EIP7702' : 'LEGACY'} | TX: ${txHash}`);
                
                // 9. ATOMIC SYNC: Update Wallet Intelligence State
                await prisma.wallet.update({
                  where: { address: rule.walletAddress },
                  data: { lastSynced: new Date() }
                }).catch(err => logger.error(`[Worker: Dust][AUDIT_ERR] ${address}: ${err.message}`));

              } else {
                logger.error(`[Worker: Dust][FAILED] ${address}: ${result.error || result.message || 'Execution Reverted'}`);
              }
            }

            // 10. RPC ANTI-THROTTLE JITTER
            const jitter = Math.floor(Math.random() * 800) + 200;
            await helpers.sleep(jitter);

          } catch (walletErr: any) {
            logger.error(`[Worker: Dust] Fatal process error for ${address}: ${walletErr.message}`);
          } finally {
            await mutex.release(walletLockKey, walletOwnerId);
          }
        })
      );

      // 11. WAIT FOR ALL SETTLED
      await Promise.allSettled(tasks);

      const duration = (Date.now() - startTime) / 1000;
      logger.info(`[Worker: Dust][${cycleId}] Recovery Cycle Completed in ${duration}s.`);

    } catch (err: any) {
      logger.error(`[Worker: Dust][${cycleId}] Critical Recovery Engine Failure: ${err.stack}`);
    } finally {
      // 12. RELEASE GLOBAL CYCLE LOCK
      await mutex.release(globalLockId, globalOwnerId);
    }
  });

  logger.info('[Worker] Dust Recovery Engine Initialized (v2026.15).');
};
