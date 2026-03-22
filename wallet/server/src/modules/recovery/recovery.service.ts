import { detectDustTokens, DustReport } from './dustCalculator.js';
import { getSmartRescueQuote } from './swapExecutor.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/database.js';

/**
 * Recovery Service: High-performance engine for dust/spam rescue.
 * Named export 'recoveryService' to fix TS2305 in automation.service.ts.
 */
export const recoveryService = {
  /**
   * Heavy-Duty Recovery Logic
   * Orchestrates scanning, profitability analysis, and rescue quoting.
   */
  async executeDustRecovery(walletAddress: string) {
    if (!walletAddress) throw new Error('Wallet address is required');
    
    const startTime = Date.now();
    const safeAddr = walletAddress.toLowerCase();

    try {
      logger.info(`[Recovery] Starting smart rescue scan: ${safeAddr}`);

      // 1. Identify dust across chains
      const dustReports: DustReport[] = await detectDustTokens(safeAddr);
      const profitableTokens = dustReports.filter(t => t.isProfitable);

      // 2. Handle empty results gracefully
      if (profitableTokens.length === 0) {
        return { 
          success: true, 
          message: 'No profitable dust found', 
          data: { tokensFound: 0, plans: [] } 
        };
      }

      // 3. Generate rescue strategy & quotes
      const rescuePlans = await getSmartRescueQuote(safeAddr, profitableTokens);

      // 4. Async DB Logging (Non-blocking)
      const totalPotentialGain = profitableTokens.reduce(
        (sum, t) => sum + parseFloat(t.estimatedNetGain || '0'), 
        0
      );

      prisma.recoveryAttempt.create({
        data: {
          walletAddress: safeAddr,
          tokenCount: profitableTokens.length,
          estimatedTotalUsd: totalPotentialGain.toFixed(2),
          status: 'PENDING'
        }
      }).catch((err: any) => logger.warn(`[Recovery DB] Log skipped: ${err.message}`));

      const duration = (Date.now() - startTime) / 1000;

      // 5. Production-grade response structure
      return {
        success: true,
        wallet: safeAddr,
        latency: `${duration}s`,
        summary: {
          totalTokensFound: profitableTokens.length,
          activeChains: [...new Set(profitableTokens.map(t => t.asset.chain))],
          totalPotentialGain: parseFloat(totalPotentialGain.toFixed(2))
        },
        plans: rescuePlans,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error(`[Recovery] Critical failure for ${safeAddr}: ${error.message}`);
      return { 
        success: false, 
        error: 'Recovery engine failed', 
        message: error.message 
      };
    }
  }
};
