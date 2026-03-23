import cron from 'node-cron';
import { scanGlobalWallet } from '../blockchain/walletScanner.js';
import { tokenService } from '../modules/tokens/token.service.js';
import { burnService } from '../modules/burn/burn.service.js';
import { rulesEngine } from '../modules/automation/rulesEngine.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { mutex } from '../utils/mutex.js';
import { helpers } from '../utils/helpers.js';

/**
 * UPGRADED: Production-grade Global Spam Sweep & Auto-Burn Worker.
 * Orchestrates: Malware Detection -> Multi-Layer Mutex -> Flashbots Execution.
 * Optimized for "Real Money" safety and high-reliability automation.
 */
export const startSpamWorker = () => {
  // Scheduled for 00:00 Daily (Standard Maintenance Window)
  cron.schedule('0 0 * * *', async () => {
    const traceId = `SPAM-SWEEP-${Date.now()}`;
    const globalLockId = 'GLOBAL_SPAM_SWEEP';
    
    // 1. ATOMIC GLOBAL LOCK: Prevents overlapping cycles across server clusters
    // We pass 4 hours TTL to allow for deep scans of many wallets
    const globalOwnerId = await mutex.acquire(globalLockId, 14400000);
    
    if (!globalOwnerId) {
      logger.warn(`[Worker: Spam][${traceId}] Cycle skipped: ${globalLockId} is active.`);
      return;
    }

    logger.info(`[Worker: Spam][${traceId}] Global lock acquired. Initiating Sweep...`);
    
    try {
      // 2. BATCHED RETRIEVAL: Fetch active 'AUTO_BURN' rules with related wallet data
      const activeRules = await prisma.automationRule.findMany({
        where: { type: 'AUTO_BURN', active: true },
        include: { wallet: true }
      });

      if (activeRules.length === 0) {
        logger.info(`[Worker: Spam][${traceId}] No active rules. Standing by.`);
        return;
      }

      for (const rule of activeRules) {
        const address = rule.walletAddress.toLowerCase();

        // 3. PER-WALLET LOCK: Prevents double-signing or nonce collisions
        const walletOwnerId = await mutex.acquire(`sweep:${address}`, 600000); // 10m TTL
        if (!walletOwnerId) continue;

        try {
          // 4. GATING: NFT Pass holder check (Eligibility logic)
          const isEligible = await rulesEngine.isEligibleForAutomation(address);
          if (!isEligible) {
            logger.warn(`[Worker: Spam][${address}] Eligibility check failed.`);
            continue;
          }

          // 5. DEEP SCAN: Identify malicious/high-risk assets
          // scanGlobalWallet uses multi-chain providers to find "malware" tokens
          const assets = await scanGlobalWallet(address);
          const categorized = await tokenService.categorizeAssets(assets);
          
          const spamTokens = categorized.groups.spam;

          if (spamTokens.length > 0) {
            logger.info(`[Worker: Spam][${address}] Detected ${spamTokens.length} malicious assets.`);

            // 6. GAS GUARD: Don't waste "Real Money" on high-fee network spikes
            const chainId = Number(rule.chain || 1);
            const canExecute = await rulesEngine.shouldExecuteNow(chainId, 25); 
            
            if (!canExecute) {
              logger.info(`[Worker: Spam][${address}] Gas too high on chain ${chainId}. Deferring.`);
              continue;
            }

            // 7. EXECUTION: Flashbots-Protected Private Burn
            // Uses rule.privateKey (Decrypted at service level)
            const result = await burnService.executeSpamBurn(address, rule.privateKey, spamTokens);

            if (result.success) {
              logger.info(`[Worker: Spam][SUCCESS] Sanitized ${address} | TX: ${result.txHash || 'N/A'}`);
              
              // 8. AUDIT LOG: Update state for UI and tracking
              await prisma.wallet.update({
                where: { address: rule.walletAddress },
                data: { 
                  lastSynced: new Date(),
                  riskLevel: 'LOW' 
                }
              });
            } else {
              logger.error(`[Worker: Spam][FAILED] Burn for ${address}: ${result.error}`);
            }
          }

          // 9. SAFETY JITTER: Small delay between wallets to prevent RPC 429 Rate Limits
          await helpers.sleep(250);

        } catch (walletErr: any) {
          logger.error(`[Worker: Spam] Error processing ${address}: ${walletErr.stack}`);
        } finally {
          // RELEASE PER-WALLET LOCK
          await mutex.release(`sweep:${address}`, walletOwnerId);
        }
      }
    } catch (err: any) {
      logger.error(`[Worker: Spam][${traceId}] Global Sweep Cycle Failure: ${err.stack}`);
    } finally {
      // 10. RELEASE GLOBAL LOCK
      await mutex.release(globalLockId, globalOwnerId);
      logger.info(`[Worker: Spam][${traceId}] Cycle finished. Lock released.`);
    }
  });

  logger.info('[Worker] Spam Sweep Heartbeat Initialized (Daily 00:00).');
};
