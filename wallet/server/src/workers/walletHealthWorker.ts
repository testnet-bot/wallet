import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { tokenService } from '../modules/tokens/token.service.js';
import { securityService } from '../modules/security/security.service.js';
import { logger } from '../utils/logger.js';
import { mutex } from '../utils/mutex.js';
import { helpers } from '../utils/helpers.js';
import pLimit from 'p-limit';

/**
 * UPGRADED: Institutional Wallet Health Engine (v2026.17 Hardened).
 * Features: EIP-7702 Integrity Audits, EIP-7706 Gas Gating, and Delta-Based Sync.
 * Optimized for: RPC Provider Health and Precision Risk Scoring.
 */
export const startHealthWorker = () => {
  // Scheduled for hourly maintenance (Institutional Health Standard)
  cron.schedule('0 * * * *', async () => {
    const startTime = Date.now();
    const cycleId = (helpers as any).generateTraceId?.('CYCLE-HEALTH') || `CYCLE-HEALTH-${startTime}`;
    const globalLockId = 'GLOBAL_HEALTH_RECALC_CYCLE';
    
    // 1. ATOMIC GLOBAL LOCK: Distributed Mutex for Cluster/Node Safety
    const globalOwnerId = await mutex.acquire(globalLockId, 3500000); 
    if (!globalOwnerId) {
      logger.warn(`[Worker: Health][${cycleId}] Cycle active on another node. Standing down.`);
      return;
    }

    try {
      // 2. 2026 GAS GUARD: EIP-7706 Multi-Dimensional Awareness
      // Skip heavy background recalculations if the network is under extreme stress
      const gasStatus = await (helpers as any).getMultiDimGasStatus?.() || { isHigh: false };
      if (gasStatus.isHigh) {
        logger.info(`[Worker: Health][${cycleId}] High Network Friction (EIP-7706). Deferring health audit.`);
        return;
      }

      const wallets = await prisma.wallet.findMany({
        select: { address: true, healthScore: true, isDelegated: true }
      });

      if (wallets.length === 0) {
        logger.info(`[Worker: Health][${cycleId}] Inventory Clean. No wallets found for audit.`);
        return;
      }

      logger.info(`[Worker: Health][${cycleId}] Auditing ${wallets.length} wallets for risk deltas.`);

      // 3. CONCURRENT WORKER POOL: Protects RPC Quotas (5 Parallel Tasks)
      const limit = pLimit(5);
      
      const tasks = wallets.map((w) => 
        limit(async () => {
          const address = w.address.toLowerCase();
          const walletLockKey = `health:${address}`;
          const walletOwnerId = await mutex.acquire(walletLockKey, 120000);
          
          if (!walletOwnerId) {
            logger.debug(`[Worker: Health][${cycleId}] Skipping ${address}: Per-wallet lock active.`);
            return;
          }

          try {
            // 4. PARALLEL INTEL: Fetch Assets + Security + 7702 Delegation
            const [tokenData, securityData, delegation] = await Promise.all([
              tokenService.fetchWalletTokens(address) as any,
              securityService.scanApprovals(address) as any,
              (securityService as any).getDelegationStatus?.(address) || Promise.resolve({ isDelegated: false, isVerifiedProxy: false })
            ]);

            // 5. 2026 SCORING ENGINE: Weighted for Smart-EOA Risk Vectors
            let score = 100;
            
            // Vector A: Spam & Poison Token Deductions
            const spamCount = tokenData.summary?.spamCount || 0;
            score -= (spamCount * 5);
            
            // Vector B: High-Risk/Malicious Approvals
            const highRiskCount = (securityData || []).filter((a: any) => 
                a.riskLevel === 'HIGH' || a.riskLevel === 'CRITICAL' || a.isMalicious
            ).length;
            score -= (highRiskCount * 15);

            // Vector C: EIP-7702 Integrity (2026 Critical Vector)
            // Deduct heavily if the account is delegated to an unverified or unknown proxy
            if (delegation?.isDelegated && !delegation?.isVerifiedProxy) {
              score -= 45;
            }

            const finalScore = Math.max(0, Math.min(100, score));
            const risk = finalScore < 30 ? 'CRITICAL' : 
                         finalScore < 60 ? 'HIGH' : 
                         finalScore < 85 ? 'MEDIUM' : 'LOW';

            // 6. DELTA-BASED PERSISTENCE: Reduce DB I/O by only updating on significant changes
            const scoreDelta = Math.abs((w.healthScore || 0) - finalScore);
            const delegationChanged = w.isDelegated !== (delegation?.isDelegated || false);

            if (scoreDelta >= 2 || delegationChanged) {
              await prisma.wallet.update({
                where: { address: w.address },
                data: { 
                  healthScore: finalScore,
                  riskLevel: risk,
                  isDelegated: delegation?.isDelegated || false,
                  lastSynced: new Date(),
                  // Store indicators in metadata for institutional reporting
                  metadata: {
                    ...((w as any).metadata || {}),
                    lastAuditSource: 'HEALTH_WORKER_V2026',
                    integrityFailed: finalScore < 50
                  }
                }
              });
            }

            // 7. RPC ANTI-THROTTLE JITTER (Helper-Augmented)
            const jitterMs = Math.floor(Math.random() * 250) + 100;
            await helpers.sleep(jitterMs);

          } catch (err: any) {
            logger.warn(`[Worker: Health] Audit skipped for ${address}: ${err.message}`);
          } finally {
            await mutex.release(walletLockKey, walletOwnerId);
          }
        })
      );

      // Await all tasks via settled to prevent partial cycle crashes
      await Promise.allSettled(tasks);
      
      const duration = (Date.now() - startTime) / 1000;
      logger.info(`[Worker: Health][${cycleId}] Audit Cycle Finished in ${duration}s.`);

    } catch (err: any) {
      logger.error(`[Worker: Health][${cycleId}] Critical Global Engine Error: ${err.stack}`);
    } finally {
      // 8. RELEASE GLOBAL CYCLE LOCK
      await mutex.release(globalLockId, globalOwnerId);
    }
  });

  logger.info('[Worker] Wallet Health Engine Initialized (v2026.17).');
};

export default startHealthWorker;
