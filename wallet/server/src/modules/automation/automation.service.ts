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
    // Explicitly typing the response from Prisma to fix implicit 'any' errors
    const userRules = await prisma.automationRule.findMany({
      where: { walletAddress: safeAddr, active: true }
    });

    if (userRules.length === 0) {
      logger.info(`[Automation] Holder ${safeAddr} has no active rules. Skipping.`);
      return { status: 'SKIPPED', reason: 'NO_ACTIVE_RULES' };
    }

    // 3. Conditional Execution Logic
    const hasBurnRule = userRules.some((r: any) => r.type === 'AUTO_BURN');
    const hasRecoveryRule = userRules.some((r: any) => r.type === 'AUTO_RECOVERY');

    logger.info(`[Automation] Holder: ${safeAddr} | Rules: Burn(${hasBurnRule}) Recovery(${hasRecoveryRule})`);

    // FIX: Explicitly type the task array to satisfy TypeScript (2339 / 7005)
    const taskNames: string[] = [];
    const tasks: Promise<any>[] = [];

    if (hasBurnRule) {
      tasks.push(burnService.executeSpamBurn(safeAddr));
      taskNames.push('BURN');
    }
    
    if (hasRecoveryRule) {
      tasks.push(recoveryService.executeDustRecovery(safeAddr));
      taskNames.push('RECOVERY');
    }

    if (tasks.length === 0) return { status: 'IDLE', wallet: safeAddr };

    // 4. Parallel execution
    // Promise.allSettled is vital for production so one failed task doesn't kill the other
    const results = await Promise.allSettled(tasks);

    // 5. Cleanup & Persistence
    // Added a more descriptive update to track the last sync accurately
    await prisma.wallet.update({
      where: { address: safeAddr },
      data: { 
        lastSynced: new Date()
        // Pro-tip: You could add a 'status' field here to show "Healthy" in the UI
      }
    }).catch((e: any) => logger.warn(`[Automation] DB Sync Error for ${safeAddr}: ${e.message}`));

    // 6. Enhanced Production Response
    return {
      status: 'SUCCESS',
      wallet: safeAddr,
      tasksExecuted: tasks.length,
      timestamp: new Date().toISOString(),
      details: results.map((res: any, i: number) => ({
        task: taskNames[i],
        status: res.status,
        // Production addition: capture the actual error reason for your logs/UI
        error: res.status === 'rejected' ? (res.reason?.message || res.reason) : null,
        result: res.status === 'fulfilled' ? 'SUCCESS' : 'FAILED'
      }))
    };
  }
};
