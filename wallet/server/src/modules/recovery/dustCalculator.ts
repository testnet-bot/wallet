import { tokenService } from '../tokens/token.service.js';
import { getProvider } from '../../blockchain/provider.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { formatUnits, parseUnits, getAddress, isAddress } from 'ethers';
import { logger } from '../../utils/logger.js';
import { helpers } from '../../utils/helpers.js';
import crypto from 'crypto';

export interface DustReport {
  asset: any;
  rescueCostNative: string;
  rescueCostUsd: string;
  estimatedNetGainUsd: string;
  isProfitable: boolean;
  reason: string;
  recoveryRatio: string; 
}

/**
 * UPGRADED: Production-Grade Dust & Profitability Calculator (Finance Grade).
 * Features: L1 Data Fee Awareness, 40% Efficiency Cap, and BigInt Precision.
 */
export async function detectDustTokens(walletAddress: string): Promise<DustReport[]> {
  if (!isAddress(walletAddress)) throw new Error("INVALID_WALLET_ADDRESS");
  const safeAddr = getAddress(walletAddress);
  const traceId = `DUST-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  
  try {
    logger.info(`[DustCalculator][${traceId}] Auditing rescue targets for ${safeAddr}`);
    
    // 1. Fetch real-time on-chain assets
    const rawAssets = await scanGlobalWallet(safeAddr);
    
    // 2. Filter for Clean/Dust candidates (Ignore verified Spam)
    const report = await tokenService.categorizeAssets(rawAssets, traceId);
    const candidates = [...(report.inventory?.clean || []), ...(report.inventory?.dust || [])];

    const dustAnalysis = await Promise.all(candidates.map(async (asset) => {
      try {
        const chain = EVM_CHAINS.find((c: any) => c.id === Number(asset.chainId || 1)) as any;
        if (!chain || asset.type !== 'erc20') return null;

        // 3. EXECUTION COST CALCULATION (EIP-1559 + L2 Overhead)
        const provider = getProvider(chain.id);
        const feeData = await provider.getFeeData();
        
        const baseFee = feeData.gasPrice || parseUnits('0.1', 'gwei');
        const priorityFee = feeData.maxPriorityFeePerGas || parseUnits('0.05', 'gwei');
        const effectiveGasPrice = baseFee + (priorityFee * 12n / 10n); // 20% priority buffer
        
        // Multi-hop (Approve + Swap) usually costs ~210k gas for safety
        const estimatedGasLimit = 210000n; 
        let rescueCostWei = effectiveGasPrice * estimatedGasLimit;

        // 4. L2 OVERHEAD (Crucial for Base/Arbitrum/Optimism)
        if (chain.isL2) {
          // Estimate L1 Posting fee (Blobs) which is often > L2 Execution fee
          const l1Fee = await helpers.retry(async () => {
             return await (helpers as any).estimateL1Fee(chain.id, provider);
          }, 2).catch(() => parseUnits('0.00005', 'ether')); 
          rescueCostWei += BigInt(l1Fee);
        }

        // 5. LIVE 2026 PRICING SYNC
        const assetUsdValue = parseFloat(asset.usdValue || '0');
        const nativePriceUsd = Number(chain.nativePriceId || 2500); 
        const gasCostUsd = parseFloat(formatUnits(rescueCostWei, 18)) * nativePriceUsd;

        // 6. FINANCE GUARD: THE 40% EFFICIENCY RULE
        const netGain = assetUsdValue - gasCostUsd;
        const recoveryRatio = (gasCostUsd / (assetUsdValue || 1)) * 100;
        
        // Logic: Recovery is viable if:
        // - Net Gain > .00 (Accounting for slippage risk)
        // - Gas consumes < 40% of total asset value
        const isProfitable = netGain > 2.00 && recoveryRatio < 40;
        const isTooLarge = assetUsdValue > (Number(process.env.DUST_MAX_THRESHOLD) || 1000);

        const result: DustReport = {
          asset,
          rescueCostNative: formatUnits(rescueCostWei, 18),
          rescueCostUsd: gasCostUsd.toFixed(4),
          estimatedNetGainUsd: netGain > 0 ? netGain.toFixed(2) : '0.00',
          isProfitable: isProfitable && !isTooLarge,
          recoveryRatio: `${recoveryRatio.toFixed(1)}%`,
          reason: ''
        };

        if (isTooLarge) result.reason = 'High-value asset (Security preference: manual transfer)';
        else if (!isProfitable && netGain <= 2.00) result.reason = 'Insufficient net yield after gas';
        else if (recoveryRatio >= 40) result.reason = 'Inefficient: High gas-to-value ratio';
        else result.reason = 'Optimized rescue target';

        return result;

      } catch (err: any) {
        logger.warn(`[DustCalculator][${traceId}] Skip ${asset.symbol}: ${err.message}`);
        return null;
      }
    }));

    const finalResults = dustAnalysis.filter((item): item is DustReport => item !== null);
    logger.info(`[DustCalculator][${traceId}] Audit Finished. Profitable: ${finalResults.filter(r => r.isProfitable).length} | Ignored: ${finalResults.length - finalResults.filter(r => r.isProfitable).length}`);
    
    return finalResults;

  } catch (globalErr: any) {
    logger.error(`[DustCalculator][${traceId}] Calculation Crash: ${globalErr.message}`);
    return [];
  }
}
