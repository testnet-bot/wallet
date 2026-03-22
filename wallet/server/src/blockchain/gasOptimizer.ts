import { getProvider } from './provider.js';
import { logger } from '../utils/logger.js';

/**
 *  Gas Optimizer
 * Fetches EIP-1559 fee data to prevent stuck transactions.
 */
export const gasOptimizer = {
  async getOptimalFees(chainId: number | string) {
    try {
      const provider = getProvider(chainId.toString());
      const feeData = await provider.getFeeData();

      // i add a 10% "Aggressive" buffer to the priority fee for automation
      const priorityFee = feeData.maxPriorityFeePerGas 
        ? (feeData.maxPriorityFeePerGas * 110n) / 100n 
        : null;

      return {
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: priorityFee,
        gasPrice: feeData.gasPrice,
        timestamp: Date.now()
      };
    } catch (err: any) {
      logger.error(`[GasOptimizer] Failed to fetch fees for ${chainId}: ${err.message}`);
      return null;
    }
  }
};
