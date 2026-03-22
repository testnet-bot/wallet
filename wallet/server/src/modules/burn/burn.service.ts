import { batchBurnTokens } from './batchBurnEngine.js';
import { tokenService } from '../tokens/token.service.js';
import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/database.js';

/**
 * Premium Burn Service
 * Automatically identifies spam tokens and prepares them for batch burning.
 */
export const burnService = {
  async executeSpamBurn(walletAddress: string) {
    const startTime = Date.now();
    const safeAddr = walletAddress.toLowerCase();

    try {
      logger.info(`[BurnService] Scanning for spam assets: ${safeAddr}`);

      //  DYNAMIC SCAN: Get real-time on-chain data
      const rawAssets = await scanGlobalWallet(safeAddr);

      // CLASSIFICATION: Use the tokenService to find the 'spam' group
      const categorized = await tokenService.categorizeAssets(rawAssets);
      const spamTokens = categorized.groups.spam;

      if (spamTokens.length === 0) {
        return {
          success: true,
          message: 'Wallet is clean! No spam tokens detected.',
          data: { burnedCount: 0, plans: [] }
        };
      }

      // EXECUTION PREP: Pass the real spam list to the Batch Engine
      const burnPlans = await batchBurnTokens(safeAddr, spamTokens);

      //  PERSISTENCE: Log the "Clean-up" action in the Database
      // Using the Wallet model we added to the schema earlier
      await prisma.wallet.update({
        where: { address: safeAddr },
        data: { lastSynced: new Date() }
      }).catch((err: any) => logger.warn(`[BurnService] DB Sync skipped: ${err.message}`));

      const duration = (Date.now() - startTime) / 1000;

      //  PREMIUM RESPONSE: Detailed report for the UI
      return {
        success: true,
        wallet: safeAddr,
        latency: `${duration}s`,
        summary: {
          spamTokensFound: spamTokens.length,
          totalChainsToClean: burnPlans.length,
          totalEstimatedGas: burnPlans.reduce((sum, p) => sum + parseFloat(p.estimatedGasNative), 0)
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
