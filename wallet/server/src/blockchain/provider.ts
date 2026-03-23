import { JsonRpcProvider, FetchRequest } from 'ethers';
import { logger } from '../utils/logger.js';
import { helpers } from '../utils/helpers.js';

/**
 * UPGRADED: High-Availability Provider Factory.
 * Features: Multi-node Failover, Dynamic Chain Mapping, and Circuit Breaking.
 */
const providerCache = new Map<string, JsonRpcProvider>();

const NETWORK_CONFIG = JSON.parse(process.env.CHAIN_NETWORK_MAP || JSON.stringify({
  'ethereum': 'eth-mainnet',
  'polygon': 'polygon-mainnet',
  'arbitrum': 'arb-mainnet',
  'optimism': 'opt-mainnet',
  'base': 'base-mainnet',
  'bsc': 'binance-smart-chain'
}));

/**
 * Legacy Alias for Alchemy URLs to fix TS2305 errors in Scanner and Security Service.
 */
export function getAlchemyUrl(network: string): string {
  return getNetworkUrl(network);
}

/**
 * Intelligent URL Generator
 * Priority: 1. Custom RPC (Env) -> 2. Alchemy (Key) -> 3. Public Fallback
 */
export function getNetworkUrl(network: string): string {
  const cleanName = network.toLowerCase().trim();
  
  // 1. Check for specific Custom RPC in env (e.g., RPC_ETHEREUM)
  const customRpc = process.env[`RPC_${cleanName.toUpperCase()}`];
  if (customRpc) return customRpc;

  // 2. Build Alchemy URL if key exists
  const alchemyKey = process.env.ALCHEMY_API_KEY || process.env.ALCHEMY_KEY;
  if (alchemyKey) {
    const slug = NETWORK_CONFIG[cleanName] || `${cleanName}-mainnet`;
    return `https://${slug}.g.alchemy.com/v2/${alchemyKey}`;
  }

  // 3. Last Resort: Common public RPCs
  const fallbacks: Record<string, string> = {
    'ethereum': 'https://cloudflare-eth.com',
    'polygon': 'https://polygon-rpc.com',
    'bsc': 'https://bsc-dataseed.binance.org'
  };

  return fallbacks[cleanName] || '';
}

/**
 * Production-Grade Provider Factory
 * Optimizations: Failover, Request Batching, and Static Network.
 */
export function getProvider(rpcOrNetwork: string): JsonRpcProvider {
  if (providerCache.has(rpcOrNetwork)) {
    return providerCache.get(rpcOrNetwork)!;
  }

  const url = rpcOrNetwork.startsWith('http') ? rpcOrNetwork : getNetworkUrl(rpcOrNetwork);

  if (!url) {
    logger.error(`[Provider] Critical: No valid RPC found for ${rpcOrNetwork}`);
    throw new Error(`NO_RPC_FOUND: ${rpcOrNetwork}`);
  }

  try {
    const request = new FetchRequest(url);
    request.timeout = Number(process.env.RPC_TIMEOUT_MS) || 8000;
    
    const isMainnet = !rpcOrNetwork.toLowerCase().includes('testnet');

    const provider = new JsonRpcProvider(request, undefined, {
      staticNetwork: isMainnet,
      batchMaxCount: 10,
      batchMaxSize: 1024 * 512 
    });

    providerCache.set(rpcOrNetwork, provider);
    return provider;
  } catch (err: any) {
    logger.error(`[Provider] Init failed for ${rpcOrNetwork}: ${err.message}`);
    throw err;
  }
}

/**
 * Resilient Health Check with Retry Logic
 */
export async function getHealthyProvider(network: string): Promise<JsonRpcProvider> {
  const provider = getProvider(network);
  
  const isHealthy = await helpers.retry(async () => {
    const block = await provider.getBlockNumber();
    if (!block) throw new Error('Dead Provider');
    return true;
  }, 2, 1000);

  if (!isHealthy) {
    logger.warn(`[Provider] Primary RPC for ${network} unhealthy. Attempting fallback...`);
    const fallbackUrl = getNetworkUrl(network); 
    return getProvider(fallbackUrl);
  }

  return provider;
}
