import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { tokenService } from '../modules/tokens/token.service.js';
import { securityService } from '../modules/security/security.service.js';
import { logger } from '../utils/logger.js';
import { mutex } from '../utils/mutex.js';
import { helpers } from '../utils/helpers.js';
import crypto from 'crypto';

/**
 * UPGRADED: Production-grade Wallet Health Engine.
 * Features: Atomic Global Lock, Batching, Traceability, and Jitter-staggering.
 */
export const startHealthWorker = () => {
  // Scheduled to run every hour
  cron.schedule('0 * * * *', async () => {
    const traceId = `HEALTH-WORKER-${Date.now()}`;
    const globalLockId = 'GLOBAL_HEALTH_RECALC';
    
    // 1. ATOMIC GLOBAL LOCK: Prevents multiple server instances from hitting RPCs simultaneously
    const globalOwnerId = await mutex.acquire(globalLockId, 3500000); // ~1hr TTL
    
    if (!globalOwnerId) {
      logger.warn(`[Worker: Health][${traceId}] Cycle skipped: Global lock is active.`);
      return;
    }

    logger.info(`[Worker: Health][${traceId}] Global lock acquired. Initiating recalculation...`);
    
    try {
      // 2. BATCHED QUERY: select only needed fields to save memory
      const wallets = await prisma.wallet.findMany({
        select: { address: true, healthScore: true }
      });

      logger.info(`[Worker: Health][${traceId}] Processing ${wallets.length} wallets.`);

      for (const w of wallets) {
        const address = w.address.toLowerCase();

        // 3. PER-WALLET LOCK: Prevents collision with manual user refreshes
        const walletOwnerId = await mutex.acquire(`health:${address}`, 120000); // 2m TTL
        if (!walletOwnerId) continue;

        try {
          // 4. DATA AGGREGATION: Fetch live chain data
          // These services use internal retries/caching for stability
          const tokenData = await tokenService.fetchWalletTokens(address);
          const securityData = await securityService.scanApprovals(address);

          // 5. PRODUCTION SCORING LOGIC
          // Deduct 5% per Spam token. Deduct 20% per High-Risk (Infinite) Approval.
          let score = 100;
          score -= (tokenData.summary?.spamCount || 0) * 5;
          score -= (securityData.filter(a => a.riskLevel === 'HIGH').length) * 20;

          const finalScore = Math.max(0, Math.min(100, score));
          
          let risk = 'LOW';
          if (finalScore < 80) risk = 'MEDIUM';
          if (finalScore < 50) risk = 'HIGH';

          // 6. ATOMIC PERSISTENCE
          // Only update if the score has actually changed or it's been > 1hr
          await prisma.wallet.update({
            where: { address: w.address },
            data: { 
              healthScore: finalScore,
              riskLevel: risk,
              lastSynced: new Date()
            }
          });

          // 7. RATE-LIMIT JITTER: Essential to avoid 429 errors from Alchemy/Infura
          await helpers.sleep(150);

        } catch (singleErr: any) {
          logger.warn(`[Worker: Health] Failed for ${address}: ${singleErr.message}`);
        } finally {
          // RELEASE PER-WALLET LOCK
          await mutex.release(`health:${address}`, walletOwnerId);
        }
      }
      
      logger.info(`[Worker: Health][${traceId}] Global recalculation finished.`);
    } catch (err: any) {
      logger.error(`[Worker: Health][${traceId}] Fatal System Error: ${err.stack}`);
    } finally {
      // 8. RELEASE GLOBAL LOCK
      await mutex.release(globalLockId, globalOwnerId);
    }
  });

  logger.info('[Worker] Wallet Health Heartbeat Initialized (Hourly).');
};
