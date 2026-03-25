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
 * UPGRADED: Institutional-Grade Dust & Profitability Calculator (v2026.5 Hardened).
 * Features: EIP-4844 Blob Awareness, 40% Efficiency Threshold, and 5% Slippage Buffer.
 * Optimized for: Wallet Service Unified Groups (Groups/All mapping).
 */
export async function detectDustTokens(walletAddress: string): Promise<DustReport[]> {
  if (!isAddress(walletAddress)) throw new Error("INVALID_WALLET_ADDRESS");
  const safeAddr = getAddress(walletAddress);
  const traceId = `DUST-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  
  try {
    logger.info(`[DustCalculator][${traceId}] Auditing rescue targets for ${safeAddr}`);
    
    // 1. Fetch real-time on-chain assets
    const rawAssets = await scanGlobalWallet(safeAddr);
    
    // 2. Filter for Clean/Dust candidates (Unified Groups Access)
    const report = await tokenService.categorizeAssets(rawAssets, traceId) as any;
    
    // Fixed: Property access for the 2026.5 Unified Groups structure
    const candidates = [
      ...(report.groups?.clean || []), 
      ...(report.groups?.dust || [])
    ];

    const dustAnalysis = await Promise.all(candidates.map(async (asset) => {
      try {
        const chain = EVM_CHAINS.find((c: any) => c.id === Number(asset.chainId || 1)) as any;
        if (!chain || asset.type !== 'erc20') return null;

        // 3. EXECUTION COST CALCULATION (EIP-1559 + L2 Overhead)
        const provider = getProvider(chain.id);
        const feeData = await provider.getFeeData();
        
        // 2026 Standard: 25% Priority Buffer to guarantee MEV-shielded inclusion
        const baseFee = feeData.gasPrice || parseUnits('0.1', 'gwei');
        const priorityFee = feeData.maxPriorityFeePerGas || parseUnits('0.1', 'gwei');
        const effectiveGasPrice = baseFee + (priorityFee * 125n / 100n); 
        
        // 210k gas covers: 1x Approval + 1x High-efficiency Router Swap
        const estimatedGasLimit = 210000n; 
        let rescueCostWei = effectiveGasPrice * estimatedGasLimit;

        // 4. L2 BLOB-FEE OVERHEAD (Crucial for 2026 Rollups)
        if (chain.isL2) {
          const l1Fee = await (helpers as any).retry?.(async () => {
             return await (helpers as any).estimateL1Fee(chain.id, provider);
          }, 2).catch(() => parseUnits('0.0001', 'ether')) || parseUnits('0.0001', 'ether'); 
          
          rescueCostWei += BigInt(l1Fee);
        }

        // 5. LIVE 2026 PRICING & SLIPPAGE SYNC
        const assetUsdValue = parseFloat(asset.usdValue || '0');
        const nativePriceUsd = Number(chain.nativePriceUsd || 2500); 
        const gasCostUsd = parseFloat(formatUnits(rescueCostWei, 18)) * nativePriceUsd;

        // 6. FINANCE GUARD: THE 40% EFFICIENCY RULE
        // Logic: (Asset - Gas) - 5% Slippage Buffer
        const slippageAdjustment = assetUsdValue * 0.05;
        const netGain = assetUsdValue - gasCostUsd - slippageAdjustment;
        const recoveryRatio = (gasCostUsd / (assetUsdValue || 1)) * 100;
        
        // Viability Criteria:
        // - Net Gain > .50 (Covers protocol fee + volatility)
        // - Gas consumes < 40% of total asset value
        const isProfitable = netGain > 2.50 && recoveryRatio < 40;
        const maxThreshold = Number(process.env.DUST_MAX_THRESHOLD) || 1500;
        const isTooLarge = assetUsdValue > maxThreshold;

        const result: DustReport = {
          asset,
          rescueCostNative: formatUnits(rescueCostWei, 18),
          rescueCostUsd: gasCostUsd.toFixed(4),
          estimatedNetGainUsd: netGain > 0 ? netGain.toFixed(2) : '0.00',
          isProfitable: isProfitable && !isTooLarge,
          recoveryRatio: `${recoveryRatio.toFixed(1)}%`,
          reason: ''
        };

        if (isTooLarge) {
          result.reason = 'EXCEEDS_DUST_THRESHOLD: High-value asset (Requires manual handling)';
        } else if (!isProfitable) {
          result.reason = recoveryRatio >= 40 ? 'INEFFICIENT: High gas-to-value ratio' : 'UNPROFITABLE: Net gain below .50 threshold';
        } else {
          result.reason = 'OPTIMIZED_TARGET: High efficiency recovery candidate';
        }

        return result;

      } catch (err: any) {
        logger.warn(`[DustCalculator][${traceId}] Audit skipped for ${asset.symbol}: ${err.message}`);
        return null;
      }
    }));

    const finalResults = dustAnalysis.filter((item): item is DustReport => item !== null);
    
    logger.info(`[DustCalculator][${traceId}] Audit Finished. Profitable: ${finalResults.filter(r => r.isProfitable).length} / Total: ${finalResults.length}`);
    
    return finalResults;

  } catch (globalErr: any) {
    logger.error(`[DustCalculator][${traceId}] Engine Crash: ${globalErr.message}`);
    return [];
  }
}
