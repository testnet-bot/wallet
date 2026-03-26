import { rulesEngine } from './rulesEngine.js';
import { burnService } from '../burn/burn.service.js';
import { recoveryService } from '../recovery/recovery.service.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/database.js';
import { getAddress } from 'ethers';

/**
 * UPGRADED: Production-Grade Automation Orchestrator (The Butler).
 * Features: Sequential Nonce Safety, Auto-Circuit Breaking, and Tiered Gating.
 * FIX: Atomic Locking moved to top-level to prevent race conditions during membership checks.
 */
export const automationService = {
  // Prevent parallel execution on the same wallet (Strict Nonce Protection)
  activeLocks: new Set<string>(),
  // Tracking last execution to prevent RPC/Gas Spam
  lastProcessTime: new Map<string, number>(),

  /**
   * Background Execution Engine
   * Logic: Guard -> Gate -> Load -> Serial Execute -> Cleanup.
   */
  async processAutomatedTasks(walletAddress: string) {
    const safeAddr = getAddress(walletAddress).toLowerCase();
    const now = Date.now();

    // 1. CONCURRENCY LOCK (UPGRADED: Moved to absolute top to be truly atomic)
    if (this.activeLocks.has(safeAddr)) {
      logger.warn(`[Automation] Wallet ${safeAddr} is locked. Skipping to prevent nonce collision.`);
      return { status: 'LOCKED', reason: 'ALREADY_PROCESSING', wallet: safeAddr };
    }

    // Set the lock IMMEDIATELY before any async calls (membership/db)
    this.activeLocks.add(safeAddr);

    try {
      // 2. RATE LIMIT GUARD: 60s Cooldown for Finance Stability
      const lastRun = this.lastProcessTime.get(safeAddr) || 0;
      if (now - lastRun < 60000) {
         return { status: 'SKIPPED', reason: 'RATE_LIMIT_COOLDOWN', wallet: safeAddr };
      }
      this.lastProcessTime.set(safeAddr, now);

      // 3. GATING: Tiered Membership Check
      const membership = await rulesEngine.getMembershipTier(safeAddr);
      if (!membership.isEligible) {
        logger.info(`[Automation] Wallet ${safeAddr} - No Membership Found.`);
        return { status: 'SKIPPED', reason: 'NOT_A_HOLDER', wallet: safeAddr };
      }

      // 4. LOAD ACTIVE RULES
      const userRules = await prisma.automationRule.findMany({
        where: { walletAddress: safeAddr, active: true },
        orderBy: { createdAt: 'asc' }
      });

      if (userRules.length === 0) {
        return { status: 'SKIPPED', reason: 'NO_ACTIVE_RULES', wallet: safeAddr };
      }

      logger.info(`[Automation] Executing Butler for ${safeAddr} | Tier: ${membership.tier}`);

      const executionResults = [];

      // 5. SERIAL EXECUTION (CRITICAL UPGRADE)
      const recoveryRule = userRules.find((r: any) => r.type === 'AUTO_RECOVERY');
      if (recoveryRule) {
        try {
          const result = await recoveryService.executeDustRecovery(safeAddr, recoveryRule.privateKey);
          executionResults.push({ task: 'RECOVERY', status: 'SUCCESS', data: result });
        } catch (err: any) {
          executionResults.push({ task: 'RECOVERY', status: 'FAILED', error: err.message });
          await this.handleRuleFailure(recoveryRule.id, err.message, safeAddr);
        }
      }

      const burnRule = userRules.find((r: any) => r.type === 'AUTO_BURN');
      if (burnRule) {
        try {
          const result = await burnService.executeSpamBurn(safeAddr, burnRule.privateKey);
          executionResults.push({ task: 'BURN', status: 'SUCCESS', data: result });
        } catch (err: any) {
          executionResults.push({ task: 'BURN', status: 'FAILED', error: err.message });
          await this.handleRuleFailure(burnRule.id, err.message, safeAddr);
        }
      }

      // 6. DB PERSISTENCE & AUDIT
      await prisma.wallet.update({
        where: { address: safeAddr },
        data: { lastSynced: new Date() }
      }).catch((e: any) => logger.error(`[Automation] Sync Persistence Fail: ${e.message}`));

      return {
        status: 'COMPLETE',
        wallet: safeAddr,
        tier: membership.tier,
        results: executionResults,
        timestamp: new Date().toISOString()
      };
      
    } catch (globalErr: any) {
      logger.error(`[Automation] Fatal Orchestration Error for ${safeAddr}: ${globalErr.message}`);
      throw globalErr;
    } finally {
      // 7. RELEASE LOCK (Always occurs regardless of outcome)
      this.activeLocks.delete(safeAddr);
    }
  },

  /**
   * INTERNAL: Circuit Breaker
   * UPGRADED: Handles both Number and String IDs safely.
   */
  async handleRuleFailure(ruleId: any, errorMessage: string, address: string) {
    const criticalErrors = ['invalid hex string', 'wrong password', 'insufficient funds', 'invalid private key'];
    const isCritical = criticalErrors.some(e => errorMessage.toLowerCase().includes(e));

    if (isCritical) {
      logger.error(`[Automation] Circuit Breaker: Disabling Rule ${ruleId} for ${address} due to: ${errorMessage}`);
      
      // Ensure we only try to update if the record exists to prevent Prisma errors
      try {
        await prisma.automationRule.update({
          where: { id: ruleId },
          data: { active: false }
        });
      } catch (err) {
        logger.warn(`[Automation] Breaker failed to update DB for rule ${ruleId}`);
      }
    }
  }
};
