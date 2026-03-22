import { logger } from './logger.js';
import { EVM_CHAINS } from '../blockchain/chains.js';

/**
 * Tier 1 Heavy Data Utility Belt
 * Features: Exponential Backoff, Address Normalization, and Explorer Routing.
 */
export const helpers = {
  /**
   * Pause execution (Async sleep)
   */
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Standardizes wallet addresses for UI display
   */
  shortenAddress: (address: string) => {
    if (!address || address.length < 10) return '0x000...000';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  },

  /**
   * Universal Retry Engine with Exponential Backoff
   * Prevents system crashes during RPC congestion or Rate Limits.
   */
  async retry<T>(
    fn: () => Promise<T>, 
    retries: number = 3, 
    delay: number = 1500
  ): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      // Logic: Don't retry if it's a code error (Syntax/Type)
      const isNetworkError = err.message?.includes('timeout') || 
                             err.message?.includes('429') || 
                             err.message?.includes('network');

      if (retries <= 0 || !isNetworkError) throw err;

      logger.warn(`[RetryEngine] Attempt failed. ${retries} left. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      
      // Exponential backoff: doubles the wait time each attempt
      return helpers.retry(fn, retries - 1, delay * 2); 
    }
  },

  /**
   * Generates a Block Explorer URL dynamically for any chain
   * Essential for the "View on Explorer" button in your UI
   */
  getExplorerUrl: (txHash: string, chainName: string): string => {
    const chain = EVM_CHAINS.find(c => c.name.toLowerCase() === chainName.toLowerCase());
    const base = chain?.explorer || 'https://etherscan.io';
    return `${base}/tx/${txHash}`;
  },

  /**
   * High-precision USD Formatter
   */
  formatUsd: (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(num || 0);
  }
};

export default helpers;
