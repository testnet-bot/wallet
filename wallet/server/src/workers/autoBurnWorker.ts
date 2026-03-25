import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { automationService } from '../modules/automation/automation.service.js';
import { logger } from '../utils/logger.js';
import { mutex } from '../utils/mutex.js';
import { helpers } from '../utils/helpers.js';
import pLimit from 'p-limit';

/**
 * UPGRADED: Institutional Auto-Burn Worker (v2026.13 Hardened).
 * Features: Helpers-Augmented Jitter, Distributed Mutex, and Unified Trace IDs.
 * Optimized for: EIP-7702 Batching and RPC Anti-Throttle Jitter.
 */
export const startAutoBurnWorker = () => {
  // Runs every 6 hours (Institutional standard for periodic sanitization)
  cron.schedule('0 */6 * * *', async () => {
    const startTime = Date.now();
    // Using unified helper for trace/cycle IDs
    const cycleId = (helpers as any).generateTraceId?.('CYCLE-BURN') || `CYCLE-BURN-${startTime}`;
    
    // 1. GLOBAL INSTANCE LOCK (Distributed Mutex)
    const globalOwnerId = await mutex.acquire('global:autoburn:cycle', 3600000); 
    if (!globalOwnerId) {
      logger.warn(`[Worker: AutoBurn][${cycleId}] Cycle already active on concurrent instance.`);
      return;
    }

    try {
      logger.info(`[Worker: AutoBurn][${cycleId}] Sanitization Cycle Started. Standards: EIP-7702 / MEV-Protected.`);

      // 2. INTELLIGENT QUEUEING: Prioritize CRITICAL risk wallets first
      const holders = await prisma.wallet.findMany({
        where: { 
          healthScore: { lt: 90 },
          rules: { some: { active: true, type: 'AUTO_BURN' } } 
        },
        orderBy: [
          { riskLevel: 'asc' }, // Process CRITICAL first
          { healthScore: 'asc' }
        ],
        select: { address: true, riskLevel: true }
      });

      if (holders.length === 0) {
        logger.info(`[Worker: AutoBurn][${cycleId}] Queue Clean. All opted-in wallets healthy.`);
        return;
      }

      // 3. ADAPTIVE CONCURRENCY (Limit parallel tasks to protect RPC health)
      const limit = pLimit(holders.length > 50 ? 8 : 4);
      logger.info(`[Worker: AutoBurn][${cycleId}] Processing ${holders.length} targets. Adaptive Concurrency enabled.`);

      const tasks = holders.map((holder) => 
        limit(async () => {
          const walletLockKey = `burn:${holder.address.toLowerCase()}`;
          const walletOwnerId = await mutex.acquire(walletLockKey, 300000); // 5m safety lock
          
          if (!walletOwnerId) {
            logger.debug(`[Worker: AutoBurn][${cycleId}] Skipping ${holder.address}: Instance lock held.`);
            return;
          }

          try {
            // Logic: Delegate sanitization to the automation service
            await automationService.processAutomatedTasks(holder.address);
            
            // 4. RPC ANTI-THROTTLE JITTER (Helper-Augmented)
            // Randomized delay to prevent synchronized burst signatures
            const jitterMs = Math.floor(Math.random() * 1200) + 300;
            await helpers.sleep(jitterMs); 
            
          } catch (err: any) {
            logger.error(`[Worker: AutoBurn][${cycleId}] Task Failed [${holder.address}]: ${err.message}`);
          } finally {
            await mutex.release(walletLockKey, walletOwnerId);
          }
        })
      );

      // 5. ATOMIC COMPLETION (Ensures all parallel work finishes)
      await Promise.allSettled(tasks);

      const duration = (Date.now() - startTime) / 1000;
      logger.info(`[Worker: AutoBurn][${cycleId}] Cycle Completed in ${duration}s. Targets Scanned: ${holders.length}`);

    } catch (err: any) {
      logger.error(`[Worker: AutoBurn][${cycleId}] Critical Worker Crash: ${err.stack}`);
    } finally {
      // 6. RELEASE GLOBAL CYCLE LOCK
      await mutex.release('global:autoburn:cycle', globalOwnerId);
    }
  });

  logger.info('[Worker] Institutional Auto-Burn Engine Initialized (v2026.13).');
};
