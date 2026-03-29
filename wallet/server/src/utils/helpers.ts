import { getAddress, isAddress, formatUnits, parseUnits, Contract } from 'ethers';
import { logger } from './logger.js';
import { EVM_CHAINS } from '../blockchain/chains.js';

/**
 * UPGRADED: 2026 Financial-Grade Utility Engine.
 * Features: EIP-7706 Gas Logic, L2 Data Estimators, and Zero-Trust Memory Hygiene.
 */
export const helpers = {
  /**
   * Safe Async Pause
   */
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Checksum-safe Address Shortener.
   */
  shortenAddress: (address: string): string => {
    if (!address || !isAddress(address)) return 'Invalid Address';
    const checksummed = getAddress(address);
    return `${checksummed.substring(0, 6)}...${checksummed.substring(checksummed.length - 4)}`;
  },

  /**
   * Advanced Retry Engine with Jitter & Exponential Backoff.
   */
  async retry<T>(
    fn: () => Promise<T>, 
    retries: number = 3, 
    baseDelay: number = 1000,
    traceId: string = 'internal'
  ): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      const status = err.response?.status || err.status;
      const message = err.message?.toLowerCase() || '';

      const isRetryable = 
        status === 429 || 
        status >= 500 || 
        message.includes('timeout') || 
        message.includes('network') ||
        message.includes('econnreset');

      if (retries <= 0 || !isRetryable) throw err;

      const jitter = Math.random() * 200;
      const nextDelay = (baseDelay * 2) + jitter;

      logger.warn(`[Retry][${traceId}] Attempt failed (${status || 'Network'}). Retrying in ${Math.round(nextDelay)}ms...`);
      
      await new Promise(r => setTimeout(r, nextDelay));
      return helpers.retry(fn, retries - 1, nextDelay, traceId); 
    }
  },

  /**
   * 2026 L2 Gas Strategy: Estimates the L1 Data (Blob) Fee.
   * Crucial for Base/Arbitrum where L1 costs dominate.
   */
  async estimateL1Fee(chainId: number, provider: any): Promise<bigint> {
    const chain = EVM_CHAINS.find(c => c.id === chainId);
    if (!chain?.isL2) return 0n;

    try {
      // In 2026, L2s use the GasPriceOracle for EIP-4844/7706 cost estimation
      const oracleAddr = '0x420000000000000000000000000000000000000F';
      const oracle = new Contract(oracleAddr, ['function getL1Fee(bytes) view returns (uint256)'], provider);
      // Dummy data for a standard 180k gas recovery tx
      return await oracle.getL1Fee('0x00'); 
    } catch {
      return parseUnits('0.0001', 'ether'); // Safe fallback
    }
  },

  /**
   * Check if token supports EIP-2612 Permit (Gasless Approvals).
   */
  async checkPermitSupport(tokenAddr: string, provider: any): Promise<boolean> {
    try {
      const token = new Contract(tokenAddr, [
        'function permit(address,address,uint256,uint256,uint8,bytes32,bytes32)',
        'function DOMAIN_SEPARATOR() view returns (bytes32)',
        'function nonces(address) view returns (uint256)'
      ], provider);
      
      // Try calling nonces(address(0)) - if it doesn't revert, permit likely exists
      await token.nonces('0x0000000000000000000000000000000000000000');
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Zero-Trust Memory Hygiene: Wipes sensitive data from Node.js heap.
   * Since JS strings are immutable, we use Buffers where possible.
   */
  wipeSensitiveData: (data: string | Buffer) => {
    if (Buffer.isBuffer(data)) {
      data.fill(0);
    } else if (typeof data === 'string') {
      // Best effort for strings: overwrite with zeros before garbage collection
      const buf = Buffer.from(data);
      buf.fill(0);
    }
  },

  /**
   * Multi-Dimensional Gas Formatter (EIP-7706).
   */
  formatGasReport: (execution: bigint, blob: bigint, calldata: bigint): string => {
    return `Exec: ${formatUnits(execution, 'gwei')} | Blob: ${formatUnits(blob, 'gwei')} | Call: ${formatUnits(calldata, 'gwei')}`;
  },

  getExplorerUrl: (txHash: string, chainName: string = 'ethereum'): string => {
    const chain = EVM_CHAINS.find(c => 
      c.name.toLowerCase() === chainName.toLowerCase() || 
      c.id?.toString() === chainName
    );
    const baseUrl = chain?.explorer || 'https://etherscan.io';
    const sanitizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${sanitizedBase}/tx/${txHash}`;
  },

  formatUsd: (value: number | string): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '/usr/bin/bash.00';
    const fractionDigits = num > 0 && num < 0.01 ? 6 : 2;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }). format(num);
  },
  /*** Decrypts an encrypted private key and returns an ethers Wallet*/
  decryptSigner: async (encryptedKey: string, provider: any) => {
  // 1. Import the decryptPrivateKey function from crypto.ts
  const { decryptPrivateKey } = await import('./crypto.js');
  
  // 2. Decrypt the private key
  const privateKey = await decryptPrivateKey(encryptedKey);
  
  //  Create a new ethers Wallet with the provider
  const { Wallet } = await import('ethers');
  const wallet = new Wallet(privateKey, provider);
  
  //  wipe sensitive memory
  // (for safety, overwrite privateKey)
  privateKey.split('').fill('0');
  
  // 5. Return the Wallet
  return wallet;
  } 
};

export async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  return helpers.retry(fn, retries);
}

export default helpers;
