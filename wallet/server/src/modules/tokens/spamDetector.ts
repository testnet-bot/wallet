import { logger } from '../../utils/logger.js';

export interface TokenClassification {
  status: 'verified' | 'spam' | 'dust' | 'clean';
  securityNote: string | null;
  score: number;
  usdValue: number;
  isHoneypot?: boolean;
  isBlacklisted?: boolean;
}

const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

async function getCachedPrice(key: string, fetcher: () => Promise<number>): Promise<number> {
  const now = Date.now();
  const cached = priceCache.get(key);
  if (cached && (now - cached.timestamp < CACHE_DURATION)) return cached.price;
  try {
    const freshPrice = await fetcher();
    priceCache.set(key, { price: freshPrice, timestamp: now });
    return freshPrice;
  } catch (err) {
    logger.warn(`[PriceCache] Failed to fetch price for ${key}: ${err}`);
    return cached?.price || 0;
  }
}

/**
 * Tier 1 Spam & Threat Detector
 * Uses Heuristic Analysis + Real-time Security API (GoPlus)
 */
export async function classifyToken(asset: any): Promise<TokenClassification> {
  const name = (asset.name || '').toLowerCase();
  const symbol = (asset.symbol || '').toLowerCase();
  const address = asset.address || asset.contract;
  const balance = parseFloat(asset.balance) || 0;
  const chainName = (asset.chain || 'ethereum').toLowerCase();

  // 1. HEURISTIC SPAM DETECTION (Keyword Blacklist)
  const blacklist = ['visit', '.com', '.io', '.net', 'claim', 'free', 'reward', 'voucher', 'airdrop', 'ticket', 'yield'];
  if (blacklist.some(k => name.includes(k) || symbol.includes(k))) {
    return { status: 'spam', securityNote: 'Phishing: Metadata contains high-risk keywords', score: 0, usdValue: 0 };
  }

  // 2. REAL-TIME SECURITY SCAN (GoPlus API Integration)
  // This detects "Honeypots" that simple name filters miss.
  let isHoneypot = false;
  let isBlacklisted = false;

  if (address && asset.type !== 'native') {
    try {
      const chainIdMap: Record<string, string> = { 'ethereum': '1', 'base': '8453', 'polygon': '137', 'bsc': '56', 'arbitrum': '42161' };
      const chainId = chainIdMap[chainName] || '1';
      
      const goPlusRes = await fetch(`https://api.gopluslabs.io{chainId}?contract_addresses=${address}`);
      const data = await goPlusRes.json();
      const security = data.result?.[address.toLowerCase()];

      if (security) {
        isHoneypot = security.is_honeypot === "1";
        isBlacklisted = security.is_blacklisted === "1" || security.is_in_dex === "0";
        
        if (isHoneypot || isBlacklisted) {
          return { 
            status: 'spam', 
            securityNote: isHoneypot ? 'Security Alert: Honeypot contract detected' : 'Risk: Unlisted/Blacklisted token', 
            score: 0, 
            usdValue: 0 
          };
        }
      }
    } catch (err) {
      logger.error(`[SecurityScan] GoPlus check failed: ${err}`);
    }
  }

  // 3. MULTI-SOURCE PRICE DISCOVERY
  let usdValue = 0;
  try {
    if (asset.type === 'native') {
      usdValue = balance * await getCachedPrice('native-price', async () => {
        const res = await fetch('https://api.binance.com');
        const data = await res.json();
        return parseFloat(data.price) || 3000;
      });
    } else if (address) {
      const tokenPrice = await getCachedPrice(`price-${address}`, async () => {
        // Fallback to CoinGecko (using network mapping)
        const cgIdMap: Record<string, string> = { 'ethereum': 'ethereum', 'polygon': 'polygon-pos', 'base': 'base', 'bsc': 'binance-smart-chain' };
        const networkId = cgIdMap[chainName] || 'ethereum';
        
        const res = await fetch(`https://api.coingecko.com{networkId}?contract_addresses=${address}&vs_currencies=usd`);
        const data = await res.json();
        return data[address.toLowerCase()]?.usd || 0;
      });
      usdValue = balance * tokenPrice;
    }
  } catch (err) {
    logger.warn(`[PriceDiscovery] Failed for ${symbol}: ${err}`);
    usdValue = 0; 
  }

  // 4. FINAL STATUS CLASSIFICATION
  if (balance > 0 && usdValue > 0 && usdValue < 0.50) {
    return { status: 'dust', securityNote: `Dust: Value below gas threshold ($${usdValue.toFixed(4)})`, score: 40, usdValue };
  }

  const isVerified = (asset.logo && usdValue > 1) || usdValue > 25;
  
  return {
    status: isVerified ? 'verified' : 'clean',
    securityNote: usdValue > 500 ? '🐋 High Value Asset' : (isVerified ? 'Trusted Token' : 'Verified Metadata'),
    score: isVerified ? 100 : 70,
    usdValue: parseFloat(usdValue.toFixed(6))
  };
}
