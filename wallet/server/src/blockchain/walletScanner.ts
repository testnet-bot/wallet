import { formatEther, formatUnits, getAddress } from 'ethers';
import { EVM_CHAINS, ChainConfig } from './chains.js';
import { getProvider, getAlchemyUrl } from './provider.js';
import { fetchFromCovalent, fetchFromMoralis, AggregatedToken } from './aggregator.js';
import pLimit from 'p-limit';

export interface FinalAsset {
  chain: string;
  type: string;
  symbol: string;
  name?: string;
  balance: string;
  contract?: string;
  logo?: string | null;
}

/**
 * Fetches high-quality metadata with error handling
 */
async function fetchMeta(url: string, contract: string) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        jsonrpc: "2.0", 
        id: 1, 
        method: "alchemy_getTokenMetadata", 
        params: [contract] 
      })
    });
    const data = await res.json();
    return data.result || null;
  } catch { return null; }
}

/**
 * Core Scanner: Aggregates Native and ERC20 tokens across all configured chains
 * Optimized for high-concurrency and multi-source reliability.
 */
export async function scanGlobalWallet(address: string): Promise<FinalAsset[]> {
const limit = pLimit(5);
  // Standardize address to prevent checksum mismatches
  const safeAddress = getAddress(address);

  const tasks = EVM_CHAINS.map((chain: ChainConfig) =>
    limit(async (): Promise<FinalAsset[]> => {
    try {
      const provider = getProvider(chain.rpc);
      let chainAssets: FinalAsset[] = [];

      // 1. Native Balance Check (with safety timeout)
      const native = await Promise.race([
        provider.getBalance(safeAddress),
        new Promise<bigint>((_, r) => setTimeout(() => r(0n), 3500))
      ]);

      if (native && native > 0n) {
        chainAssets.push({ 
          chain: chain.name, 
          type: 'native', 
          symbol: chain.symbol, 
          balance: formatEther(native) 
        });
      }

      // 2. Primary Source: Alchemy (Enhanced with batch-like processing)
      const url = chain.alchemy ? getAlchemyUrl(chain.alchemy) : null;
      if (url && process.env.ALCHEMY_API_KEY) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            jsonrpc: "2.0", id: 1, method: "alchemy_getTokenBalances", params: [safeAddress, "erc20"] 
          })
        });
        const { result } = await res.json();
        
        if (result?.tokenBalances) {
          const alchemyTokens = await Promise.all(result.tokenBalances.map(async (t: any) => {
            if (t.tokenBalance === "0x" || t.tokenBalance === "0x0" || t.tokenBalance.length < 3) return null;
            
            const meta = await fetchMeta(url, t.contractAddress);
            return meta ? {
              chain: chain.name,
              type: 'erc20',
              symbol: meta.symbol || '?',
              name: meta.name || 'Unknown Token',
              balance: formatUnits(t.tokenBalance, meta.decimals || 18),
              contract: t.contractAddress.toLowerCase(),
              logo: meta.logo
            } : null;
          }));
          chainAssets.push(...(alchemyTokens.filter(Boolean) as FinalAsset[]));
        }
      }

      // 3. Supplemental Sources: Covalent & Moralis (Merging data)
      const [covalentRes, moralisRes] = await Promise.all([
        fetchFromCovalent(chain.id, safeAddress).catch(() => []),
        chain.moralis ? fetchFromMoralis(safeAddress, chain.moralis).catch(() => []) : Promise.resolve([])
      ]);

      const aggregatorTokens: AggregatedToken[] = [...covalentRes, ...moralisRes];
      
      if (aggregatorTokens.length > 0) {
        chainAssets.push(...aggregatorTokens.map(t => ({
          chain: chain.name,
          type: t.type || 'erc20',
          symbol: t.symbol || '?',
          name: t.name || 'Unknown',
          balance: formatUnits(t.balance, t.decimals || 18),
          contract: t.contract?.toLowerCase(),
          logo: t.logo
        })));
      }

      return chainAssets;
    } catch (err) {
      console.error(`[Scanner] Error on ${chain.name}:`, err);
      return []; 
    }
    })
    );

  const results = await Promise.all(tasks);
  const allAssets = results.flat();

  // 4. Heavy Deduplication (Key: Chain + Contract Address)
  // This ensures that if Alchemy, Covalent, and Moralis all find the same token, it only appears once.
  const uniqueAssets = Array.from(
    new Map(
      allAssets.map(asset => [
        `${asset.chain}-${asset.contract || 'native'}`.toLowerCase(), 
        asset
      ])
    ).values()
  );

  return uniqueAssets;
}

/**
 * Wrapper for single-chain or standard scans
 */
export async function scanWallet(address: string) { 
  return await scanGlobalWallet(address); 
}
