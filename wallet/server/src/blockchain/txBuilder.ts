import { ethers, getAddress } from 'ethers';
import { logger } from '../utils/logger.js';

/**
 * Tier 1 Transaction Architect
 * Builds standardized payloads for all on-chain interactions.
 */
export const txBuilder = {
  /**
   * Prepares a mass-burn payload.
   */
  async buildBurnTx(tokenAddress: string, amount: string, decimals: number) {
    const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
    const iface = new ethers.Interface(["function transfer(address to, uint256 value)"]);
    
    try {
      const data = iface.encodeFunctionData("transfer", [
        BURN_ADDRESS,
        ethers.parseUnits(amount, decimals)
      ]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: "100000", // Standard safety limit for spam tokens
        metadata: { type: 'BURN', symbol: 'SPAM' }
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode burn for ${tokenAddress}`);
      throw err;
    }
  },

  /**
   * Prepares Approval for Dust Recovery (Uniswap/Pancake/1inch)
   */
  async buildApprovalTx(tokenAddress: string, spender: string, amount: string, decimals: number) {
    const iface = new ethers.Interface(["function approve(address spender, uint256 value)"]);
    
    try {
      const data = iface.encodeFunctionData("approve", [
        getAddress(spender),
        ethers.parseUnits(amount, decimals)
      ]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: "60000",
        metadata: { type: 'APPROVAL', spender }
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode approval for ${tokenAddress}`);
      throw err;
    }
  }
};
