import { logger } from '../utils/logger.js';

/**
 * Tier 1 Heavy Data Fee Engine
 * Ensures protocol revenue is calculated with BigInt precision (BPS).
 */
export const feeCalculator = {
  /**
   * Logic: 500 BPS (5%) for users with gas | 750 BPS (7.5%) for gasless relay
   */
  calculateRescueFee(amountUsd: number, isGasless: boolean) {
    try {
      // 1. Scale to 6 decimals for integer math (Avoids 0.1 + 0.2 = 0.3000000004)
      const amountBig = BigInt(Math.floor(amountUsd * 1_000_000));
      
      const bps = isGasless ? 750n : 500n; 
      const feeBig = (amountBig * bps) / 10000n;
      
      // 2. Protocol Floor: If fee is less than $0.01, we set it to $0.01
      const minFee = BigInt(10000); // $0.01 in 6-decimal scale
      const finalFeeBig = feeBig < minFee && amountBig > minFee ? minFee : feeBig;
      
      const userShareBig = amountBig - finalFeeBig;

      return {
        feeUsd: Number(finalFeeBig) / 1_000_000,
        userShareUsd: Number(userShareBig) / 1_000_000,
        bps: Number(bps),
        tier: isGasless ? 'GASLESS_RELAY' : 'DIRECT_SWAP'
      };
    } catch (err: any) {
      logger.error(`[FeeCalculator] Precision Error: ${err.message}`);
      return { feeUsd: 0, userShareUsd: amountUsd, bps: 0, tier: 'ERROR' };
    }
  }
};
