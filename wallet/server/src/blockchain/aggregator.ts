import { getAddress } from 'ethers';
import { logger } from '../utils/logger.js';

export interface AggregatedToken {
  type: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  logo: string | null;
  contract: string;
}

const COVALENT_BASE = 'https://api.covalenthq.com';
const MORALIS_BASE = 'https://deep-index.moralis.io';

/**
 * Covalent Fetcher
 * Optimized for high-speed balance aggregation and address normalization.
 */
export async function fetchFromCovalent(chainId: number, address: string): Promise<AggregatedToken[]> {
  try {
    const key = process.env.COVALENT_RPC_KEY;
    if (!key) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s Safety Timeout

    const res = await fetch(`${COVALENT_BASE}/${chainId}/address/${address}/balances_v2/?key=${key}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    const json = await res.json();

    return (json.data?.items || [])
      .filter((t: any) => t.balance !== "0" && t.contract_address)
      .map((t: any) => ({
        type: 'erc20',
        symbol: t.contract_ticker_symbol || '???',
        name: t.contract_name || 'Unknown',
        balance: t.balance,
        decimals: t.contract_decimals || 18,
        logo: t.logo_url || null,
        // NORMALIZATION: Ensure address is checksummed for Tier 1 deduplication
        contract: getAddress(t.contract_address) 
      }));
  } catch (err: any) {
    logger.warn(`[Aggregator] Covalent skip on chain ${chainId}: ${err.message}`);
    return []; 
  }
}

/**
 * Premium Moralis Fetcher
 * Features: Metadata enrichment and strict address standardization.
 */
export async function fetchFromMoralis(address: string, chain: string): Promise<AggregatedToken[]> {
  try {
    const key = process.env.MORALIS_RPC_KEY;
    if (!key) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${MORALIS_BASE}/${address}/erc20?chain=${chain}`, {
      headers: { 'X-API-Key': key },
      signal: controller.signal
    });

    clearTimeout(timeout);
    const json = await res.json();

    // Moralis sometimes returns an error object instead of an array
    if (!Array.isArray(json)) return [];

    return json.map((t: any) => ({
      type: 'erc20',
      symbol: t.symbol || '???',
      name: t.name || 'Unknown',
      balance: t.balance,
      decimals: parseInt(t.decimals) || 18,
      logo: t.thumbnail || t.logo || null,
      contract: getAddress(t.token_address)
    }));
  } catch (err: any) {
    logger.warn(`[Aggregator] Moralis skip for ${address}: ${err.message}`);
    return []; 
  }
}
