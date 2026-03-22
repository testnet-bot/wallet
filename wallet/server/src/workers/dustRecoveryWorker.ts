import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { detectDustTokens } from '../modules/recovery/dustCalculator.js';
import { recoveryService } from '../modules/recovery/recovery.service.js';
import { rulesEngine } from '../modules/automation/rulesEngine.js';
import { logger } from '../utils/logger.js';

/**
 * Tier 1 Automated Recovery Worker
 * Orchestrates: Scan -> Rule Check -> Gas Guard -> Flashbots Execution.
 */
export const startDustWorker = () => {
  // Scheduled to run every 12 hours (Standard Maintenance Cycle)
  cron.schedule('0 */12 * * *', async () => {
    logger.info('[Worker: Dust] Initiating high-precision recovery cycle...');
    
    try {
      // 1. Fetch active automation rules from Prisma
      const activeRules = await prisma.automationRule.findMany({
        where: { type: 'AUTO_RECOVERY', active: true }
      });

      if (activeRules.length === 0) {
        logger.info('[Worker: Dust] No active auto-recovery rules found. Standing by.');
        return;
      }

      for (const rule of activeRules) {
        const address = rule.walletAddress.toLowerCase();

        // 2. GATING: Check NFT Membership Eligibility
        const isEligible = await rulesEngine.isEligibleForAutomation(address);
        if (!isEligible) {
          logger.warn(`[Worker: Dust] ${address} lacks NFT Pass. Skipping auto-cycle.`);
          continue;
        }

        // 3. GAS GUARD: Fixed chainId access using type casting
        // We cast to 'any' or a local interface to ensure the compiler accepts the DB field
        const ruleData = rule as any;
        const currentChainId = Number(ruleData.chainId || ruleData.chain || 1);
        
        const canExecute = await rulesEngine.shouldExecuteNow(currentChainId, 30);
        if (!canExecute) {
            logger.info(`[Worker: Dust] Gas too high for ${address} on chain ${currentChainId}. Postponing.`);
            continue;
        }

        // 4. SCAN: Identify profitable targets
        const profitable = await detectDustTokens(address);
        
        if (profitable.length > 0) {
          logger.info(`[Worker: Dust] Found ${profitable.length} rescue targets for ${address}.`);
          
          // 5. EXECUTION: Trigger the 7.5% Relayed + Flashbots Flow
          const result = await recoveryService.executeDustRecovery(address);

          if (result.success) {
            logger.info(`[Worker: Dust] SUCCESS: Automated rescue completed for ${address}`);
            
            await prisma.wallet.update({
              where: { address },
              data: { lastSynced: new Date() }
            });
          } else {
            logger.error(`[Worker: Dust] FAILED: Rescue for ${address}: ${result.error}`);
          }
        }
      }
    } catch (err: any) {
      logger.error(`[Worker: Dust] Cycle failed: ${err.message}`);
    }
  });

  logger.info('[Worker] Dust Recovery Heartbeat Initialized (12h cycle).');
};
