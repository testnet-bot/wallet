import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { detectDustTokens } from '../modules/recovery/dustCalculator.js';
import { recoveryService } from '../modules/recovery/recovery.service.js';
import { rulesEngine } from '../modules/automation/rulesEngine.js';
import { logger } from '../utils/logger.js';
import { mutex } from '../utils/mutex.js';
import { helpers } from '../utils/helpers.js';

/**
 * UPGRADED: Production-grade Automated Recovery Worker.
 * Orchestrates: Atomic Mutex -> Batching -> Eligibility -> Gas Guard -> Execution.
 */
export const startDustWorker = () => {
  // Scheduled for 12h maintenance cycle
  cron.schedule('0 */12 * * *', async () => {
    const traceId = `DUST-WORKER-${Date.now()}`;
    const globalLockId = 'GLOBAL_DUST_RECOVERY';
    
    // 1. ATOMIC GLOBAL LOCK: Prevents overlapping cycles across server clusters
    const globalOwnerId = await mutex.acquire(globalLockId, 3600000); // 1hr TTL
    
    if (!globalOwnerId) {
      logger.warn(`[Worker: Dust][${traceId}] Cycle skipped: ${globalLockId} is active.`);
      return;
    }

    logger.info(`[Worker: Dust][${traceId}] Global lock acquired. Initiating cycle...`);
    
    try {
      // 2. BATCHED RETRIEVAL: Efficiently query only active recovery rules
      const activeRules = await prisma.automationRule.findMany({
        where: { type: 'AUTO_RECOVERY', active: true },
        include: { wallet: true }
      });

      if (activeRules.length === 0) {
        logger.info(`[Worker: Dust][${traceId}] No active rules found.`);
        return;
      }

      for (const rule of activeRules) {
        const address = rule.walletAddress.toLowerCase();
        
        // 3. PER-WALLET LOCK: Prevents collision with manual user recoveries or other workers
        const walletOwnerId = await mutex.acquire(`recovery:${address}`, 300000); // 5m TTL
        if (!walletOwnerId) continue;

        try {
          // 4. GATING & ELIGIBILITY (NFT/Membership check)
          const isEligible = await rulesEngine.isEligibleForAutomation(address);
          if (!isEligible) {
            logger.warn(`[Worker: Dust][${address}] Eligibility failed. Skipping.`);
            continue;
          }

          // 5. PRODUCTION GAS GUARD: Ensure tx remains profitable vs current network fees
          const chainId = Number(rule.chain || 1);
          const canExecute = await rulesEngine.shouldExecuteNow(chainId, 30);
          if (!canExecute) {
              logger.info(`[Worker: Dust][${address}] Gas too high on chain ${chainId}.`);
              continue;
          }

          // 6. SCAN: Identify profitable dust targets
          const profitable = await detectDustTokens(address);
          
          if (profitable && profitable.length > 0) {
            logger.info(`[Worker: Dust][${address}] Found ${profitable.length} rescue targets.`);
            
            // 7. EXECUTION: High-reliability service call with encrypted key
            const result = await recoveryService.executeDustRecovery(address, rule.privateKey);

            if (result.success) {
              logger.info(`[Worker: Dust][SUCCESS] Rescue completed for ${address} | TX: ${result.txHash || 'N/A'}`);
              
              await prisma.wallet.update({
                where: { address: rule.walletAddress },
                data: { lastSynced: new Date() }
              });
            } else {
              logger.error(`[Worker: Dust][FAILED] Rescue for ${address}: ${result.error}`);
            }
          }

          // 8. RATE-LIMIT JITTER: Avoid RPC 429 errors
          await helpers.sleep(200);

        } catch (walletErr: any) {
          logger.error(`[Worker: Dust] Fatal error for ${address}: ${walletErr.message}`);
        } finally {
          // RELEASE PER-WALLET LOCK
          await mutex.release(`recovery:${address}`, walletOwnerId);
        }
      }
    } catch (err: any) {
      logger.error(`[Worker: Dust][${traceId}] Fatal Cycle Failure: ${err.stack}`);
    } finally {
      // 9. RELEASE GLOBAL LOCK
      await mutex.release(globalLockId, globalOwnerId);
      logger.info(`[Worker: Dust][${traceId}] Cycle finished. Lock released.`);
    }
  });

  logger.info('[Worker] Dust Recovery Heartbeat Initialized (12h cycle).');
};
