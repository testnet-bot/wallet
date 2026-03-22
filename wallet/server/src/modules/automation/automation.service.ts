import { rulesEngine } from './rulesEngine.js';
import { burnService } from '../burn/burn.service.js';
import { recoveryService } from '../recovery/recovery.service.js';
import { logger } from '../../utils/logger.js';

export const automationService = {
  /**
   * Main entry point for the background cron/worker
   */
  async processAutomatedTasks(walletAddress: string) {
    const isEligible = await rulesEngine.isEligibleForAutomation(walletAddress);

    if (!isEligible) {
      logger.warn(`[Automation] ${walletAddress} is not an NFT holder. Skipping auto-tasks.`);
      return { status: 'MANUAL_ONLY', reason: 'No WIP NFT detected' };
    }

    logger.info(`[Automation] Executing automated tasks for holder: ${walletAddress}`);

    // Run tasks in parallel to save time
    const [burnResult, recoveryResult] = await Promise.allSettled([
      burnService.executeSpamBurn(walletAddress),
      recoveryService.executeDustRecovery(walletAddress)
    ]);

    return {
      status: 'AUTOMATED_SUCCESS',
      burn: burnResult.status === 'fulfilled' ? burnResult.value : 'FAILED',
      recovery: recoveryResult.status === 'fulfilled' ? recoveryResult.value : 'FAILED'
    };
  }
};
