import { batchBurnTokens } from './batchBurnEngine.js';
import { tokenService } from '../tokens/token.service.js';
import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { flashbotsExecution } from '../../blockchain/flashbotsExecution.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/database.js';
import crypto from 'crypto';

/**
 * UPGRADED: Financial-grade Burn Service.
 * Features: MEV-Shielding, Traceability, and strict Error-to-Hash mapping.
 */
export const burnService = {
  /**
   * Sanitizes wallets by burning malicious assets via private RPCs.
   */
  async executeSpamBurn(walletAddress: string, encryptedPrivateKey: string, preScannedTokens?: any[]) {
    const startTime = Date.now();
    const safeAddr = walletAddress.toLowerCase();
    const traceId = `BURN-${crypto.randomUUID?.() || Date.now()}`;

    try {
      logger.info(`[BurnService][${traceId}] Initiating Sanitization: ${safeAddr}`);

      let spamTokens = preScannedTokens;

      // 1. INTELLIGENCE: Scan if not provided
      if (!spamTokens) {
        const rawAssets = await scanGlobalWallet(safeAddr);
        const categorized = await tokenService.categorizeAssets(rawAssets);
        spamTokens = categorized.groups.spam;
      }

      if (!spamTokens || spamTokens.length === 0) {
        return {
          success: true,
          message: 'Wallet is clean!',
          traceId,
          data: { burnedCount: 0, plans: [] }
        };
      }

      // 2. BATCH PLANNING
      const burnPlans = await batchBurnTokens(safeAddr, spamTokens);
      const executionResults = [];

      // 3. DYNAMIC EXECUTION: Private Bundle Submission
      for (const plan of burnPlans) {
        const chain = EVM_CHAINS.find(c => c.name.toLowerCase() === plan.chain.toLowerCase());
        
        if (chain && plan.payloads.length > 0) {
          logger.info(`[BurnService][${traceId}] Sending ${plan.payloads.length} txs to ${plan.chain} via Flashbots...`);
          
          // FlashbotsExecution handles the internal decryption of the v2 key
          const result = await flashbotsExecution.executeBundle(
            encryptedPrivateKey,
            chain.rpc,
            plan.payloads,
            chain.id
          );
          
          executionResults.push({
            chain: plan.chain,
            success: result.success,
            error: result.error,
            txHash: result.txHash
          });

          if (result.success) {
            logger.info(`[BurnService][${traceId}] Cleared spam on ${plan.chain} | Hash: ${result.txHash}`);
          }
        }
      }

      // 4. PERSISTENCE & ANALYTICS
      const successfulExecutions = executionResults.filter(r => r.success);
      const hasSuccess = successfulExecutions.length > 0;
      
      // Capture the main txHash for the worker to log
      const primaryTxHash = hasSuccess ? successfulExecutions[0].txHash : null;

      if (hasSuccess) {
        await prisma.wallet.update({
          where: { address: safeAddr },
          data: { 
            lastSynced: new Date(),
            healthScore: 100,
            riskLevel: 'LOW'
          }
        }).catch((err: any) => logger.warn(`[BurnService][${traceId}] DB Sync failed: ${err.message}`));
      }

      const duration = (Date.now() - startTime) / 1000;

      // RETURN: Structured to match worker expectations (top-level txHash + success)
      return {
        success: hasSuccess,
        txHash: primaryTxHash, // REQUIRED for worker compatibility
        traceId,
        wallet: safeAddr,
        latency: `${duration}s`,
        summary: {
          spamTokensFound: spamTokens.length,
          successfulChains: successfulExecutions.length
        },
        data: {
          burnedCount: spamTokens.length,
          plans: executionResults
        },
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error(`[BurnService][${traceId}] Critical failure: ${error.stack}`);
      return {
        success: false,
        txHash: null,
        traceId,
        error: 'Spam Burn Engine encountered an internal error',
        message: error.message
      };
    }
  }
};
