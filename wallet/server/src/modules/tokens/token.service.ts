import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { classifyToken } from './spamDetector.js';

export async function fetchWalletTokens(walletAddress: string) {
  // 1. Fetch raw data from the Multi-Chain Aggregator
  const rawAssets = await scanGlobalWallet(walletAddress);

  // 2. Enrich data with security & classification metadata
  const processedAssets = rawAssets.map(asset => {
    const classification = classifyToken(asset);
    
    return {
      ...asset,
      ...classification,
      isRecoverable: classification.status !== 'spam' && parseFloat(asset.balance) > 0
    };
  });

  return {
    totalAssets: processedAssets.length,
    assets: processedAssets,
    timestamp: new Date().toISOString()
  };
}
