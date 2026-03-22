import { logger } from '../utils/logger.js';

export interface FeeContext {
  amountUsd: number;
  isGasless: boolean;
  isNftHolder: boolean;
  riskScore: number; // 0-100 from spamDetector
  networkCongestion?: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Tier 1 Intelligence Fee Engine
 * Dynamic BPS Scaling with BigInt Precision.
 */
export const feeCalculator = {
  /**
   * Dynamic BPS Strategy:
   * - Base: 500 (5%)
   * - Gasless/Relay Premium: +250 (+2.5%)
   * - High Risk Asset: +250 (+2.5%)
   * - NFT Holder Discount: -250 (-2.5%)
   */
  getDynamicBps(context: FeeContext): bigint {
    let bps = 500n; // Standard Protocol Base (5%)

    if (context.isGasless) bps += 250n; // Relayed convenience fee
    if (context.riskScore > 80) bps += 250n; // Complexity/Security premium
    if (context.isNftHolder) bps -= 250n; // Loyalty discount

    // Protocol Hard Floor: 2.5% | Hard Cap: 10%
    if (bps < 250n) bps = 250n;
    if (bps > 1000n) bps = 1000n;

    return bps;
  },

  /**
   * High-Precision Financial Calculation
   * Orchestrates the 2.5% to 7.5%+ dynamic range.
   */
  calculateRescueFee(context: FeeContext) {
    try {
      const { amountUsd } = context;
      
      // 1. Scale to 6 decimals to prevent floating point errors
      const amountBig = BigInt(Math.floor(amountUsd * 1_000_000));
      if (amountBig === 0n) return { feeUsd: 0, userShareUsd: 0, bps: 0 };

      // 2. Resolve Dynamic BPS based on real-time context
      const bps = this.getDynamicBps(context);
      
      // 3. Precision Math
      const feeBig = (amountBig * bps) / 10000n;
      
      // 4. Operational Floor: If Relayed, min fee covers gas ($1.50 scale)
      // Otherwise, standard $0.01 floor.
      const operationalFloor = context.isGasless ? 1_500_000n : 10_000n;
      const finalFeeBig = (feeBig < operationalFloor && amountBig > operationalFloor) 
        ? operationalFloor 
        : feeBig;
      
      const userShareBig = amountBig - finalFeeBig;

      // 5. Intelligence Metadata for UI
      const netProfitMargin = Number(bps) / 100;

      return {
        feeUsd: Number(finalFeeBig) / 1_000_000,
        userShareUsd: Number(userShareBig) / 1_000_000,
        bps: Number(bps),
        percentage: `${netProfitMargin.toFixed(2)}%`,
        tier: context.isNftHolder ? 'PREMIUM_HOLDER' : (context.isGasless ? 'GASLESS_RELAY' : 'STANDARD'),
        isProfitable: finalFeeBig >= operationalFloor
      };
    } catch (err: any) {
      logger.error(`[FeeCalculator] Precision Error: ${err.message}`);
      return { feeUsd: 0, userShareUsd: context.amountUsd, bps: 0, tier: 'ERROR' };
    }
  }
};
