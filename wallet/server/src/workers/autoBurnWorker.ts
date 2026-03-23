import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { automationService } from '../modules/automation/automation.service.js';
import { logger } from '../utils/logger.js';
import { mutex } from '../utils/mutex.js';
import { helpers } from '../utils/helpers.js';

/**
 * UPGRADED: Production-grade Auto-Burn Worker.
 * Direct implementation of Atomic Locking for high-value asset protection.
 * Features: Global/Local Mutex, Batch Processing, and RPC Jitter.
 */
export const startAutoBurnWorker = () => {
  // Runs every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    const traceId = `WORKER-BURN-${Date.now()}`;
    
    // 1. GLOBAL LOCK: Prevents multiple server instances from running the same cron
    const globalOwnerId = await mutex.acquire('global:autoburn:cycle', 3600000); // 1hr TTL
    if (!globalOwnerId) {
      logger.warn(`[Worker: AutoBurn] Cycle already active on another instance. Skipping.`);
      return;
    }

    try {
      logger.info(`[Worker: AutoBurn][${traceId}] Starting high-priority automation cycle...`);

      // 2. BATCHED RETRIEVAL: Efficiently query only wallets needing attention
      const holders = await prisma.wallet.findMany({
        where: { healthScore: { lt: 100 } },
        select: { address: true }
      });

      logger.info(`[Worker: AutoBurn][${traceId}] Target Queue: ${holders.length} wallets.`);

      for (const holder of holders) {
        // 3. PER-WALLET LOCK: Prevents collisions with manual scans or other workers
        const walletOwnerId = await mutex.acquire(`burn:${holder.address}`, 120000); // 2min TTL
        if (!walletOwnerId) continue;

        try {
          // Execution of real-money automation tasks
          await automationService.processAutomatedTasks(holder.address);

          // 4. RATE-LIMIT JITTER: Prevents "429 Too Many Requests" on RPC providers
          await helpers.sleep(150); 
        } catch (walletErr: any) {
          logger.error(`[Worker: AutoBurn] Critical failure for ${holder.address}: ${walletErr.message}`);
        } finally {
          // Always release the wallet lock
          await mutex.release(`burn:${holder.address}`, walletOwnerId);
        }
      }

      logger.info(`[Worker: AutoBurn][${traceId}] Cycle completed successfully.`);
    } catch (err: any) {
      logger.error(`[Worker: AutoBurn][${traceId}] Global execution failure: ${err.stack}`);
    } finally {
      // 5. GLOBAL RELEASE: Free the worker lock for the next 6-hour cycle
      await mutex.release('global:autoburn:cycle', globalOwnerId);
    }
  });

  logger.info('[Worker] Auto-Burn Heartbeat Initialized with Direct Atomic Locking.');
};
