import cron from 'node-cron';
import { scanGlobalWallet } from '../blockchain/walletScanner.js';
import { tokenService } from '../modules/tokens/token.service.js';
import { burnService } from '../modules/burn/burn.service.js';
import { rulesEngine } from '../modules/automation/rulesEngine.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Tier 1 Global Spam Sweep & Auto-Burn Worker
 * Orchestrates: Malware Detection -> Gating -> Private Burn Execution.
 */
export const startSpamWorker = () => {
  // Scheduled for 00:00 Daily (Midnight Global Maintenance)
  cron.schedule('0 0 * * *', async () => {
    logger.info('[Worker: Spam] Initiating Global Malware & Phishing Sweep...');
    
    try {
      // 1. Fetch active 'AUTO_BURN' rules from the Intelligence DB
      const activeRules = await prisma.automationRule.findMany({
        where: { type: 'AUTO_BURN', active: true }
      });

      if (activeRules.length === 0) {
        logger.info('[Worker: Spam] No active auto-burn rules. Standing by.');
        return;
      }

      for (const rule of activeRules) {
        const address = rule.walletAddress.toLowerCase();

        // 2. GATING: Ensure user is eligible (NFT Pass holder)
        const isEligible = await rulesEngine.isEligibleForAutomation(address);
        if (!isEligible) continue;

        // 3. SCAN: Deep-scan wallet for new malicious signatures
        const assets = await scanGlobalWallet(address);
        const categorized = await tokenService.categorizeAssets(assets);
        
        const spamCount = categorized.summary.spamCount;
        const spamTokens = categorized.groups.spam;

        if (spamCount > 0) {
          logger.info(`[Worker: Spam] Detected ${spamCount} malicious assets in ${address}.`);

          // 4. GAS GUARD: Check if network fees allow for a batch burn
          const ruleData = rule as any;
          const chainId = Number(ruleData.chainId || ruleData.chain || 1);
          const canExecute = await rulesEngine.shouldExecuteNow(chainId, 25); // Target < 25 Gwei
          
          if (!canExecute) {
            logger.info(`[Worker: Spam] High gas on chain ${chainId}. Deferring burn for ${address}.`);
            continue;
          }

          // 5. EXECUTION: Trigger Flashbots-Protected Private Burn
          // This uses burnService to move tokens to the '0x00...dEaD' address privately
          const result = await burnService.executeSpamBurn(address, spamTokens);

          if (result.success) {
            logger.info(`[Worker: Spam] SUCCESS: Sanitized ${spamCount} tokens for ${address}.`);
            
            // Sync the wallet health score after cleaning
            await prisma.wallet.update({
              where: { address },
              data: { 
                lastSynced: new Date(),
                riskLevel: 'LOW' // Wallet is now clean
              }
            });
          } else {
            logger.error(`[Worker: Spam] FAILED: Auto-burn for ${address}: ${result.error}`);
          }
        }
      }
    } catch (err: any) {
      logger.error(`[Worker: Spam] Sweep Cycle Failed: ${err.message}`);
    }
  });

  logger.info('[Worker] Spam Sweep Heartbeat Initialized (Daily 00:00).');
};
