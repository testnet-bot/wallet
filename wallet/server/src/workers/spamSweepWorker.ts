import cron from 'node-cron';
import { scanGlobalWallet } from '../blockchain/walletScanner.js';
import { tokenService } from '../modules/tokens/token.service.js';
import { burnService } from '../modules/burn/burn.service.js';
import { rulesEngine } from '../modules/automation/rulesEngine.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { mutex } from '../utils/mutex.js';

/**
 * Tier 1 Global Spam Sweep & Auto-Burn Worker
 * Orchestrates: Malware Detection -> Gating -> Private Burn Execution.
 * Upgraded: Mutex-Protected to prevent double-signing & nonce collisions.
 */
export const startSpamWorker = () => {
  // Scheduled for 00:00 Daily
  cron.schedule('0 0 * * *', async () => {
    // 1. MUTEX ACQUIRE: Prevent overlapping executions
    const lockId = 'GLOBAL_SPAM_SWEEP';
    const hasLock = await mutex.acquire(lockId);
    
    if (!hasLock) {
      logger.warn(`[Worker: Spam] Cycle skipped: ${lockId} is currently locked by another process.`);
      return;
    }

    logger.info('[Worker: Spam] Lock acquired. Initiating Global Malware Sweep...');
    
    try {
      // 2. Fetch active 'AUTO_BURN' rules
      const activeRules = await prisma.automationRule.findMany({
        where: { type: 'AUTO_BURN', active: true }
      });

      if (activeRules.length === 0) {
        logger.info('[Worker: Spam] No active auto-burn rules. Standing by.');
        return;
      }

      for (const rule of activeRules) {
        const address = rule.walletAddress.toLowerCase();

        // 3. GATING: NFT Pass holder check
        const isEligible = await rulesEngine.isEligibleForAutomation(address);
        if (!isEligible) continue;

        // 4. SCAN: Deep-scan wallet
        const assets = await scanGlobalWallet(address);
        const categorized = await tokenService.categorizeAssets(assets);
        
        const spamCount = categorized.summary.spamCount;
        const spamTokens = categorized.groups.spam;

        if (spamCount > 0) {
          logger.info(`[Worker: Spam] Detected ${spamCount} malicious assets in ${address}.`);

          // 5. GAS GUARD
          const ruleData = rule as any;
          const chainId = Number(ruleData.chainId || ruleData.chain || 1);
          const canExecute = await rulesEngine.shouldExecuteNow(chainId, 25); 
          
          if (!canExecute) {
            logger.info(`[Worker: Spam] High gas on chain ${chainId}. Deferring burn for ${address}.`);
            continue;
          }

          // 6. EXECUTION: Trigger Flashbots-Protected Private Burn
          // uses rule.privateKey from our upgraded schema
          const result = await burnService.executeSpamBurn(address, rule.privateKey, spamTokens);

          if (result.success) {
            logger.info(`[Worker: Spam] SUCCESS: Sanitized ${spamCount} tokens for ${address}.`);
            
            await prisma.wallet.update({
              where: { address },
              data: { 
                lastSynced: new Date(),
                riskLevel: 'LOW' 
              }
            });
          } else {
            logger.error(`[Worker: Spam] FAILED: Auto-burn for ${address}: ${result.error}`);
          }
        }
      }
    } catch (err: any) {
      logger.error(`[Worker: Spam] Sweep Cycle Failed: ${err.message}`);
    } finally {
      // 7. MUTEX RELEASE: Always unlock so the next cycle can run
      await mutex.release(lockId);
      logger.info(`[Worker: Spam] Cycle finished. ${lockId} released.`);
    }
  });

  logger.info('[Worker] Spam Sweep Heartbeat Initialized (Daily 00:00).');
};
