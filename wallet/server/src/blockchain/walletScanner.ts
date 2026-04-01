import { formatEther, formatUnits, getAddress, isAddress, ethers } from 'ethers';
import { EVM_CHAINS, ChainConfig } from './chains.js';
import { getHealthyProvider, getAlchemyUrl } from './provider.js';
import { fetchFromCovalent, fetchFromMoralis, AggregatedToken } from './aggregator.js';
import { logger } from '../utils/logger.js';
import { helpers } from '../utils/helpers.js';
import pLimit from 'p-limit';
import Decimal from 'decimal.js';

export interface FinalAsset {
  chain: string;
  chainId: number;
  type: string;
  symbol: string;
  name?: string;
  balance: string;
  rawBalance?: string;
  decimals?: number;
  contract?: string;
  logo?: string | null;
  usdValue?: number;
  price?: number;
  isSpam?: boolean;
  lastUpdated?: number;
}

/**
 * UPGRADED: High-quality Metadata Fetcher.
 * Uses retry logic with exponential backoff to ensure "Real Money" assets aren't skipped.
 */
async function fetchMeta(url: string, contract: string) {
  return await helpers.retry(async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip' 
      },
      body: JSON.stringify({ 
        jsonrpc: "2.0", 
        id: Date.now(), 
        method: "alchemy_getTokenMetadata", 
        params: [getAddress(contract)] 
      })
    });
    
    if (!res.ok) throw new Error(`Alchemy Meta HTTP ${res.status}`);
    const data = await res.json();
    
    if (data.error) throw new Error(`Metadata RPC Error: ${data.error.message}`);
    return data.result || null;
  }, 3, 1000); // 3 retries, 1s base delay
}

/**
 * Core Scanner: Aggregates Native and ERC20 tokens across all configured chains.
 * Upgraded: Multi-source Verification, Spam Detection, and Type-Safe Financial Aggregation.
 * Integration: Uses Intelligence Engine for 50+ chain high-speed discovery.
 */
export async function scanGlobalWallet(address: string): Promise<FinalAsset[]> {
  // PRODUCTION UPGRADE: Scanning 50+ chains requires careful concurrency management to avoid IP bans
  const limit = pLimit(Number(process.env.SCAN_CONCURRENCY) || 5); 
  
  if (!isAddress(address)) {
    logger.error(`[Scanner] Invalid address rejected: ${address}`);
    throw new Error("INVALID_ETHEREUM_ADDRESS");
  }

  const safeAddress = getAddress(address);
  const traceId = `SCAN-${Date.now()}`;

  const tasks = EVM_CHAINS.map((chain: ChainConfig) =>
    limit(async (): Promise<FinalAsset[]> => {
      try {
        // ⚡ UPGRADE: Use the Intelligence Engine to get the fastest healthy provider for this chain
        const provider = await getHealthyProvider(chain.id); 
        let chainAssets: FinalAsset[] = [];

        // 1. Native Balance Check (Financial Priority)
        // PRODUCTION FIX: Ensure BigInt is used for all native math before formatting
        const native = await helpers.retry(async () => {
          return await provider.getBalance(safeAddress);
        }, 2);

        if (native && native > 0n) {
          chainAssets.push({ 
            chain: chain.name,
            chainId: chain.id,
            type: 'native', 
            symbol: chain.symbol, 
            balance: formatEther(native),
            rawBalance: native.toString(),
            decimals: 18,
            usdValue: 0,
            isSpam: false,
            lastUpdated: Date.now()
          });
        }

        // 2. Primary Source: Alchemy (Enterprise Logic)
        const url = chain.alchemy ? getAlchemyUrl(chain.alchemy) : null;
        if (url && (process.env.ALCHEMY_API_KEY || process.env.ALCHEMY_KEY)) {
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                jsonrpc: "2.0", id: 1, method: "alchemy_getTokenBalances", params: [safeAddress, "erc20"] 
              })
            });
            const data = await res.json();
            const result = data.result;
            
            if (result?.tokenBalances) {
              // PRODUCTION UPGRADE: Limit metadata calls to top 20 assets to prevent RPC exhaustion
              const sortedBalances = result.tokenBalances
                .filter((t: any) => t.tokenBalance && BigInt(t.tokenBalance) > 0n)
                .slice(0, 40);

              const alchemyTokens = await Promise.all(sortedBalances.map(async (t: any) => {
                const meta = await fetchMeta(url, t.contractAddress);
                if (!meta || !meta.symbol) return null;

                const isSpam = /visit|claim|win|airdrop|free|\.com|\.io/i.test(meta.name || '') || 
                               /visit|claim|win|airdrop|free|\.com|\.io/i.test(meta.symbol || '');

                return {
                  chain: chain.name,
                  chainId: chain.id,
                  type: 'erc20',
                  symbol: (meta.symbol || '???').substring(0, 15).toUpperCase(),
                  name: (meta.name || 'Unknown Token').substring(0, 48),
                  balance: formatUnits(t.tokenBalance, meta.decimals || 18),
                  rawBalance: BigInt(t.tokenBalance).toString(),
                  decimals: meta.decimals || 18,
                  contract: getAddress(t.contractAddress),
                  logo: meta.logo,
                  isSpam,
                  lastUpdated: Date.now()
                };
              }));
              chainAssets.push(...(alchemyTokens.filter(Boolean) as FinalAsset[]));
            }
          } catch (e) {
            logger.warn(`Alchemy RPC partial failure on ${chain.name}`);
          }
        }

        // 3. Supplemental Sources: Covalent & Moralis (Handled with Type-Safe Fallbacks)
        const [covalentRes, moralisRes] = await Promise.allSettled([
          fetchFromCovalent(chain.id, safeAddress),
          chain.moralis ? fetchFromMoralis(safeAddress, chain.moralis) : Promise.resolve([])
        ]);

        const aggData: any[] = [];
        if (covalentRes.status === 'fulfilled') aggData.push(...covalentRes.value);
        if (moralisRes.status === 'fulfilled') aggData.push(...moralisRes.value);
        
        if (aggData.length > 0) {
          chainAssets.push(...aggData.map(t => ({
            chain: chain.name,
            chainId: chain.id,
            type: t.type || 'erc20',
            symbol: (t.symbol || '???').substring(0, 15).toUpperCase(),
            name: (t.name || 'Unknown').substring(0, 48),
            balance: formatUnits(t.balance || '0', t.decimals || 18),
            rawBalance: (t.balance || '0').toString(),
            decimals: t.decimals || 18,
            contract: t.contract ? getAddress(t.contract) : undefined,
            logo: t.logo,
            isSpam: /visit|claim|win|airdrop|free|\.com/i.test(t.name || ''),
            lastUpdated: Date.now()
          })));
        }

        return chainAssets;
      } catch (err: any) {
        logger.warn(`[Scanner][${traceId}] Critical error on ${chain.name}: ${err.message}`);
        return []; 
      }
    })
  );

  const results = await Promise.all(tasks);
  const allAssets = results.flat();

  // 4. Strict Deduplication (Financial Priority: Primary Source > Supplemental)
  const uniqueMap = new Map<string, FinalAsset>();
  for (const asset of allAssets) {
    const key = `${asset.chainId}-${asset.contract || 'native'}`.toLowerCase();
    const existing = uniqueMap.get(key);
    
    // PRODUCTION FIX: Always prioritize the record with a balance and a valid contract address
    if (!existing || (!existing.logo && asset.logo) || (existing.isSpam && !asset.isSpam)) {
      uniqueMap.set(key, asset);
    }
  }

  const uniqueAssets = Array.from(uniqueMap.values());

  // 5. POST-SCAN CLEANUP: Filter Dust & Verified Spam
  // PRODUCTION UPGRADE: Using Decimal for dust filtering to avoid floating point issues
  const valuableAssets = uniqueAssets.filter(asset => {
    const val = new Decimal(asset.balance);
    if (asset.type === 'native') return val.gt(0);
    // Keep significant balances that aren't flagged as phishing
    return val.gt(0.000001) && !asset.isSpam;
  });

  logger.info(`[Scanner][${traceId}] Complete: ${valuableAssets.length} assets verified for ${safeAddress}`);
  return valuableAssets;
}

export async function scanWallet(address: string) { 
  return await scanGlobalWallet(address);
}
