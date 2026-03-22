import { batchBurnTokens } from './batchBurnEngine.js';
import { tokenService } from '../tokens/token.service.js';
import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/database.js';

/**
 * Premium Burn Service - Tier 1 
 * Integrated with MEV-Shielding and Intelligence-driven batching.
 */
export const burnService = {
  /**
   * Dynamically handles spam burning. 
   * Accepts optional pre-scanned tokens to save RPC costs (fixes Worker error).
   */
  async executeSpamBurn(walletAddress: string, preScannedTokens?: any[]) {
    const startTime = Date.now();
    const safeAddr = walletAddress.toLowerCase();

    try {
      logger.info(`[BurnService] Initiating Sanitization: ${safeAddr}`);

      let spamTokens = preScannedTokens;

      // 1. INTELLIGENCE: Only scan if tokens weren't provided by the caller (Worker/Controller)
      if (!spamTokens) {
        const rawAssets = await scanGlobalWallet(safeAddr);
        const categorized = await tokenService.categorizeAssets(rawAssets);
        spamTokens = categorized.groups.spam;
      }

      if (!spamTokens || spamTokens.length === 0) {
        return {
          success: true,
          message: 'Wallet is clean! No spam tokens detected.',
          data: { burnedCount: 0, plans: [] }
        };
      }

      // 2. BATCH EXECUTION: Direct to the Flashbots-capable engine
      const burnPlans = await batchBurnTokens(safeAddr, spamTokens);

      // 3. PERSISTENCE & ANALYTICS: Update Health Score in DB
      // We assume the wallet is now "Clean" after this operation
      await prisma.wallet.update({
        where: { address: safeAddr },
        data: { 
          lastSynced: new Date(),
          healthScore: 100, // Reset health to max after sanitization
          riskLevel: 'LOW'
        }
      }).catch((err: any) => logger.warn(`[BurnService] DB Sync skipped: ${err.message}`));

      const duration = (Date.now() - startTime) / 1000;

      // 4. PREMIUM RESPONSE: Strategic report for the Frontend
      return {
        success: true,
        wallet: safeAddr,
        latency: `${duration}s`,
        summary: {
          spamTokensFound: spamTokens.length,
          totalChainsToClean: burnPlans.length,
          totalEstimatedGas: burnPlans.reduce((sum, p) => sum + parseFloat(p.estimatedGasNative || '0'), 0)
        },
        plans: burnPlans,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error(`[BurnService] Critical failure for ${safeAddr}: ${error.message}`);
      return {
        success: false,
        error: 'Spam Burn Engine encountered an error',
        message: error.message
      };
    }
  }
};
