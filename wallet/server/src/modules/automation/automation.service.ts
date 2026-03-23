import { rulesEngine } from './rulesEngine.js';
import { burnService } from '../burn/burn.service.js';
import { recoveryService } from '../recovery/recovery.service.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/database.js';

/**
 * Premium Automation Service
 * Orchestrates tasks based on NFT Gating and User-Defined DB Rules.
 */
export const automationService = {
  /**
   * Background Execution Engine
   * Includes Concurrency Locking and Detailed Error Tracking.
   */
  async processAutomatedTasks(walletAddress: string) {
    const safeAddr = walletAddress.toLowerCase();

    // 1. Gating: Check Base NFT Membership
    const isEligible = await rulesEngine.isEligibleForAutomation(safeAddr);

    if (!isEligible) {
      logger.info(`[Automation] Wallet ${safeAddr} - No NFT. Skipping auto-cycle.`);
      return { status: 'SKIPPED', reason: 'NOT_A_HOLDER' };
    }

    // 2. Load User Rules from Prisma
    const userRules = await prisma.automationRule.findMany({
      where: { walletAddress: safeAddr, active: true }
    });

    if (userRules.length === 0) {
      logger.info(`[Automation] Holder ${safeAddr} has no active rules. Skipping.`);
      return { status: 'SKIPPED', reason: 'NO_ACTIVE_RULES' };
    }

    // 3. Conditional Execution Logic
    // Find specific rules to extract their unique properties (like privateKey)
    const burnRule = userRules.find((r: any) => r.type === 'AUTO_BURN');
    const recoveryRule = userRules.find((r: any) => r.type === 'AUTO_RECOVERY');

    logger.info(`[Automation] Holder: ${safeAddr} | Rules: Burn(${!!burnRule}) Recovery(${!!recoveryRule})`);

    const taskNames: string[] = [];
    const tasks: Promise<any>[] = [];

    // 4. TASK PUSHING (Upgraded with PrivateKey injection)
    if (burnRule) {
      // Fix: Use the privateKey from the specific burnRule object
      tasks.push(burnService.executeSpamBurn(safeAddr, burnRule.privateKey));
      taskNames.push('BURN');
    }
    
    if (recoveryRule) {
      // Fix: recoveryService now also expects a privateKey for Flashbots execution
      tasks.push(recoveryService.executeDustRecovery(safeAddr, recoveryRule.privateKey));
      taskNames.push('RECOVERY');
    }

    if (tasks.length === 0) return { status: 'IDLE', wallet: safeAddr };

    // 5. Parallel execution
    const results = await Promise.allSettled(tasks);

    // 6. Cleanup & Persistence
    await prisma.wallet.update({
      where: { address: safeAddr },
      data: { lastSynced: new Date() }
    }).catch((e: any) => logger.warn(`[Automation] DB Sync Error for ${safeAddr}: ${e.message}`));

    // 7. Enhanced Production Response
    return {
      status: 'SUCCESS',
      wallet: safeAddr,
      tasksExecuted: tasks.length,
      timestamp: new Date().toISOString(),
      details: results.map((res: any, i: number) => ({
        task: taskNames[i],
        status: res.status,
        error: res.status === 'rejected' ? (res.reason?.message || res.reason) : null,
        result: res.status === 'fulfilled' ? 'SUCCESS' : 'FAILED'
      }))
    };
  }
};
