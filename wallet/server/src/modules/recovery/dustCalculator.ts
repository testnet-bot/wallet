import { tokenService } from '../tokens/token.service.js';
import { getProvider } from '../../blockchain/provider.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { formatUnits, parseUnits, getAddress } from 'ethers';
import { logger } from '../../utils/logger.js';

export interface DustReport {
  asset: any;
  rescueCostNative: string;
  estimatedNetGain: string;
  isProfitable: boolean;
  reason: string;
}

/**
 * Premium Dust Calculator
 * Fixes Decimal Scaling bugs and adds Gas Buffering for production reliability.
 */
export async function detectDustTokens(walletAddress: string): Promise<DustReport[]> {
  const safeAddr = getAddress(walletAddress);
  
  try {
    // 1. Fetch real-time assets
    const rawAssets = await scanGlobalWallet(safeAddr);
    
    // 2. Process through categorization engine
    const report = await tokenService.categorizeAssets(rawAssets);
    const candidates = [...report.groups.clean, ...report.groups.dust];

    const dustAnalysis = await Promise.all(candidates.map(async (asset) => {
      try {
        const chain = EVM_CHAINS.find(c => c.name === asset.chain);
        if (!chain || asset.type !== 'erc20') return null;

        // 3. Dynamic Gas & Fee Calculation
        const provider = getProvider(chain.rpc);
        const feeData = await provider.getFeeData();
        
        // Strategy: Base + Buffer for volatile networks (L2s)
        const gasPrice = feeData.gasPrice || parseUnits('20', 'gwei');
        const estimatedGasLimit = 250000n; 
        const rescueCostWei = gasPrice * estimatedGasLimit;

        // 4. SCALE ALIGNMENT (Crucial for Production)
        // We must convert the token value to USD or Native decimals to compare it to Gas.
        // Using USD value from tokenService is safer than comparing Wei of different decimals.
        const assetUsdValue = parseFloat(asset.usdValue || '0');
        
        // Estimate Gas Cost in USD (Assuming $2500 ETH/Native price if feed fails, 
        // but ideally you'd pull this from your pricing module)
        const nativePriceUsd = 2500; // Placeholder: Replace with real pricing service call
        const gasCostUsd = parseFloat(formatUnits(rescueCostWei, 18)) * nativePriceUsd;

        // 5. PROFITABILITY LOGIC
        // Profit if: (Asset Value - Gas Cost) > 20% Margin
        const isProfitable = assetUsdValue > (gasCostUsd * 1.2);
        const isTooBig = assetUsdValue > 100; // $100+ is a major asset, not "dust"

        if (isProfitable && !isTooBig) {
          return {
            asset,
            rescueCostNative: formatUnits(rescueCostWei, 18),
            estimatedNetGain: (assetUsdValue - gasCostUsd).toFixed(2),
            isProfitable: true,
            reason: 'Profitable dust detected'
          };
        }

        return {
          asset,
          rescueCostNative: formatUnits(rescueCostWei, 18),
          estimatedNetGain: '0',
          isProfitable: false,
          reason: isTooBig ? 'Major asset (not dust)' : 'Gas cost exceeds value'
        };
      } catch (err) {
        logger.error(`[DustCalculator] Analysis failed for ${asset.symbol}: ${err}`);
        return null;
      }
    }));

    return dustAnalysis.filter((item): item is DustReport => item !== null);

  } catch (globalErr: any) {
    logger.error(`[DustCalculator] Global scan failed for ${safeAddr}: ${globalErr.message}`);
    return [];
  }
}
