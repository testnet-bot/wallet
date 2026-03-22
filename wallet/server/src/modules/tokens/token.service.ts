import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { classifyToken } from './spamDetector.js';
import { logger } from '../../utils/logger.js';

/**
 * Production-grade Token Service
 * Handles on-chain scanning and asset classification/grouping.
 */
export const tokenService = {
  /**
   * High-Performance Pipeline: Scan -> Classify -> Group
   */
  async fetchWalletTokens(address: string) {
    try {
      // 1. Get raw on-chain data
      const rawAssets = await scanGlobalWallet(address);

      // 2. Perform categorization on the fetched assets
      return await this.categorizeAssets(rawAssets);
    } catch (err: any) {
      logger.error(`[TokenService] Fetch failed for ${address}: ${err.message}`);
      throw err;
    }
  },

  /**
   * Universal Categorization Engine
   * Fixes TS2339 by providing a public method for other services to classify raw assets.
   */
  async categorizeAssets(rawAssets: any[]) {
    // 1. Classify every asset in parallel (Real-time prices & metadata)
    const results = await Promise.all(
      rawAssets.map(async (asset) => {
        const analysis = await classifyToken(asset);
        return { ...asset, ...analysis };
      })
    );

    // 2. Structured Data Categorization
    return {
      summary: {
        totalAssets: results.length,
        totalUsdValue: results.reduce((sum, a) => sum + (a.usdValue || 0), 0),
        dustCount: results.filter(a => a.status === 'dust').length,
        spamCount: results.filter(a => a.status === 'spam').length
      },
      groups: {
        clean: results.filter(a => a.status === 'verified' || a.status === 'clean'),
        dust: results.filter(a => a.status === 'dust'),
        spam: results.filter(a => a.status === 'spam')
      },
      all: results
    };
  }
};
