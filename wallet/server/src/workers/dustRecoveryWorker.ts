import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { detectDustTokens } from '../modules/recovery/dustCalculator.js';
import { recoveryService } from '../modules/recovery/recovery.service.js';
import { rulesEngine } from '../modules/automation/rulesEngine.js';
import { logger } from '../utils/logger.js';
import { mutex } from '../utils/mutex.js';

/**
 * Tier 1 Automated Recovery Worker
 * Orchestrates: Mutex Lock -> Scan -> Rule Check -> Gas Guard -> Flashbots Execution.
 */
export const startDustWorker = () => {
  // Scheduled to run every 12 hours (Standard Maintenance Cycle)
  cron.schedule('0 */12 * * *', async () => {
    // 1. MUTEX ACQUIRE: Prevent overlapping 12h cycles
    const lockId = 'GLOBAL_DUST_RECOVERY';
    const hasLock = await mutex.acquire(lockId);
    
    if (!hasLock) {
      logger.warn(`[Worker: Dust] Cycle skipped: ${lockId} is already active.`);
      return;
    }

    logger.info('[Worker: Dust] Lock acquired. Initiating recovery cycle...');
    
    try {
      // 2. Fetch active automation rules from Prisma
      const activeRules = await prisma.automationRule.findMany({
        where: { type: 'AUTO_RECOVERY', active: true }
      });

      if (activeRules.length === 0) {
        logger.info('[Worker: Dust] No active auto-recovery rules found.');
        return;
      }

      for (const rule of activeRules) {
        const address = rule.walletAddress.toLowerCase();

        // 3. GATING: Check NFT Membership Eligibility
        const isEligible = await rulesEngine.isEligibleForAutomation(address);
        if (!isEligible) {
          logger.warn(`[Worker: Dust] ${address} lacks NFT Pass. Skipping.`);
          continue;
        }

        // 4. GAS GUARD
        const ruleData = rule as any;
        const currentChainId = Number(ruleData.chainId || ruleData.chain || 1);
        
        const canExecute = await rulesEngine.shouldExecuteNow(currentChainId, 30);
        if (!canExecute) {
            logger.info(`[Worker: Dust] Gas too high for ${address} on chain ${currentChainId}.`);
            continue;
        }

        // 5. SCAN: Identify profitable targets
        const profitable = await detectDustTokens(address);
        
        if (profitable.length > 0) {
          logger.info(`[Worker: Dust] Found ${profitable.length} rescue targets for ${address}.`);
          
          // 6. EXECUTION: Upgraded with privateKey from the DB rule
          const result = await recoveryService.executeDustRecovery(address, ruleData.privateKey);

          if (result.success) {
            logger.info(`[Worker: Dust] SUCCESS: Automated rescue completed for ${address}`);
            
            await prisma.wallet.update({
              where: { address },
              data: { lastSynced: new Date() }
            });
          } else {
            logger.error(`[Worker: Dust] FAILED: Rescue for ${address}: ${result.error || 'Unknown error'}`);
          }
        }
      }
    } catch (err: any) {
      logger.error(`[Worker: Dust] Fatal Cycle Failure: ${err.message}`);
    } finally {
      // 7. MUTEX RELEASE: Release lock for the next 12h window
      await mutex.release(lockId);
      logger.info(`[Worker: Dust] Cycle finished. ${lockId} released.`);
    }
  });

  logger.info('[Worker] Dust Recovery Heartbeat Initialized (12h cycle).');
};
