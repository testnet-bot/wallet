import { formatUnits, parseUnits, getAddress, isAddress } from 'ethers';
import { getProvider } from '../../blockchain/provider.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { logger } from '../../utils/logger.js';
import { securityService } from '../security/security.service.js';
import { txBuilder } from '../../blockchain/txBuilder.js';
import { helpers } from '../../utils/helpers.js';
import { feeCalculator } from '../../pricing/feeCalculator.js';
import { revenueTracker } from '../../pricing/revenueTracker.js';
import crypto from 'crypto';

export interface RescueQuote {
  chain: string;
  chainId: number;
  strategy: 'DIRECT' | 'RELAYED' | 'RELAY_BRIDGE';
  feeTier: string;
  feeLabel: string;
  gasEstimateNative: string;
  platformFeeUsd: string;
  netUserReceiveUsd: string;
  targetAsset: string; 
  tokens: string[];
  securityStatus: 'SAFE' | 'RISKY' | 'PROTECTED';
  payloads: any[];
  traceId: string;
  slippageTolerance: number;
}

/**
 * UPGRADED: Institutional Smart Rescue Executor (v2026.8 Dynamic-Metadata).
 * Logic: Removed pricingService dependency. Prices are pulled from EVM_CHAINS metadata.
 * Integration: Uses FeeCalculator & RevenueTracker for institutional PnL.
 */
export const swapExecutor = {
  async getSmartRescueQuote(walletAddress: string, assets: any[], membershipTier: string = 'BASIC'): Promise<RescueQuote[]> {
    if (!isAddress(walletAddress)) throw new Error("INVALID_RECOVERY_ADDRESS");
    const safeAddr = getAddress(walletAddress);
    const traceId = `QUOTE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    const chainGroups = assets.reduce((acc: any, item: any) => {
      const asset = item.asset || item;
      const chainId = asset.chainId || 1;
      if (!acc[chainId]) acc[chainId] = { tokens: [] };
      acc[chainId].tokens.push(asset);
      return acc;
    }, {});

    const quoteTasks = Object.keys(chainGroups).map(async (chainIdStr): Promise<RescueQuote | null> => {
      const chainId = Number(chainIdStr);
      const group = chainGroups[chainIdStr];
      const chain = EVM_CHAINS.find((c: any) => c.id === chainId) as any;
      
      if (!chain || group.tokens.length === 0) return null;

      try {
        const provider = getProvider(chain.id);
        
        // 1. DATA SYNC: Pull Native Price from Chain Metadata (Populated by scanners/oracles)
        const [nativeBalance, feeData] = await Promise.all([
          provider.getBalance(safeAddr),
          provider.getFeeData()
        ]);

        const nativePriceUsd = Number(chain.nativePriceUsd || 0);
        if (nativePriceUsd <= 0) {
          logger.warn(`[SwapExecutor][${traceId}] Missing price for ${chain.name}. Update chain metadata.`);
          return null;
        }

        // 2. DYNAMIC GAS CALCULATION
        const baseFee = feeData.maxFeePerGas || feeData.gasPrice || parseUnits('20', 'gwei');
        const gasMultiplier = BigInt(Math.floor((chain.gasBuffer || 1.25) * 100));
        const currentMaxFee = (baseFee * gasMultiplier) / 100n;
        
        const totalGasLimit = BigInt(group.tokens.length * (chain.gasPerSwap || 210000) + 60000); 
        const estimatedGasCostWei = currentMaxFee * totalGasLimit;

        // 3. STRATEGY SELECTION
        const hasEnoughGas = nativeBalance >= (estimatedGasCostWei * 11n / 10n);
        const strategy = hasEnoughGas ? 'DIRECT' : 'RELAYED';
        
        // 4. SECURITY & RISK ASSESSMENT
        const securityChecks = await Promise.all(
          group.tokens.map((t: any) => (securityService as any).assessSpenderRisk?.(t.contract || t.address, chain.name))
        );
        const maxRiskFound = Math.max(...securityChecks.map((s: any) => s?.riskScore || 0));
        const isRisky = maxRiskFound > (chain.riskThreshold || 65);
        const slippage = isRisky ? (chain.slippageHigh || 5.0) : (chain.slippageStandard || 1.5);

        // 5. DYNAMIC FEE CALCULATION (via local FeeCalculator)
        const totalValueUsd = group.tokens.reduce((sum: number, t: any) => sum + (Number(t.usdValue) || 0), 0);
        const feeReport = (feeCalculator as any).calculateRescueFee({
          amountUsd: totalValueUsd,
          isGasless: strategy === 'RELAYED',
          tier: membershipTier,
          riskScore: maxRiskFound
        });

        const RECOVERY_SPENDER = process.env.RECOVERY_SPENDER_ADDRESS;
        if (!RECOVERY_SPENDER) throw new Error("RECOVERY_SPENDER_ADDRESS_MISSING");

        const nativeSymbol = chain.symbol || 'ETH';
        const payloads: any[] = [];

        // 6. ATOMIC BUNDLE CONSTRUCTION
        for (const token of group.tokens) {
          const approval = await (txBuilder as any).buildApprovalTx(
            token.contract || token.address,
            RECOVERY_SPENDER,
            token.rawBalance || token.balance,
            token.decimals || 18
          );
          payloads.push(approval);

          payloads.push({
             to: getAddress(RECOVERY_SPENDER),
             data: "0x", 
             value: "0x0",
             gasLimit: (BigInt(approval.gasLimit || 100000) * 15n / 10n).toString(),
             metadata: { 
               type: 'RECOVERY_SWAP', 
               from: token.symbol, 
               to: nativeSymbol, 
               amount: token.rawBalance || token.balance,
               chainId: chain.id
             }
          });
        }

        // 7. PROFITABILITY AUDIT (Dynamic Multi-Layer)
        const gasUsd = parseFloat(formatUnits(estimatedGasCostWei, 18)) * nativePriceUsd;
        const l1FeeAdjustmentUsd = chain.isL2 ? (parseFloat(chain.l1FeeEstimate || '0.15') * group.tokens.length) : 0;
        
        const netReceiveUsd = totalValueUsd - feeReport.feeUsd - (strategy === 'DIRECT' ? gasUsd : 0) - l1FeeAdjustmentUsd;
        
        const minProfitThreshold = Number(process.env.MIN_RECOVERY_PROFIT || chain.minProfitThreshold || 2.50);
        if (netReceiveUsd < minProfitThreshold) {
            logger.info(`[SwapExecutor][${traceId}] Rejected: Net profit $${netReceiveUsd.toFixed(2)} below threshold $${minProfitThreshold}`);
            return null; 
        }

        // 8. LOG ANALYTICS
        (revenueTracker as any).trackPotentialRevenue(traceId, {
          wallet: safeAddr,
          grossUsd: totalValueUsd,
          platformFeeUsd: feeReport.feeUsd,
          strategy
        });

        return {
          chain: chain.name,
          chainId: chain.id,
          strategy,
          feeTier: feeReport.feeTierLabel || feeReport.tier,
          feeLabel: this.getLabel(strategy),
          gasEstimateNative: formatUnits(await this.estimatedCostWithL2(estimatedGasCostWei, chain, provider), 18),
          platformFeeUsd: feeReport.feeUsd.toFixed(2),
          netUserReceiveUsd: netReceiveUsd.toFixed(2),
          targetAsset: nativeSymbol,
          tokens: group.tokens.map((t: any) => t.symbol || 'UNK'),
          securityStatus: isRisky ? 'RISKY' : 'SAFE',
          payloads,
          traceId,
          slippageTolerance: slippage
        };

      } catch (err: any) {
        logger.error(`[SwapExecutor][${traceId}] Quote error for chain ${chainIdStr}: ${err.message}`);
        return null;
      }
    });

    const results = await Promise.all(quoteTasks);
    return results.filter((r): r is RescueQuote => r !== null);
  },

  getLabel(strategy: string) {
    const labels: Record<string, string> = {
      'DIRECT': "Standard Recovery",
      'RELAYED': "Institutional Gasless (MEV-Shielded)",
      'RELAY_BRIDGE': "Cross-chain Settlement"
    };
    return labels[strategy] || "Native Recovery";
  },

  async estimatedCostWithL2(executionWei: bigint, chain: any, provider: any): Promise<bigint> {
    if (!chain.isL2) return executionWei;
    const l1Fee = await (helpers as any).estimateL1Fee?.(chain.id, provider) || parseUnits('0.0001', 18);
    return executionWei + BigInt(l1Fee);
  }
};

export default swapExecutor;
