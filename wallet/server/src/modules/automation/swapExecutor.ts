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
 * BATTLE-STRESSED: Institutional Smart Rescue Executor (v2026.8 Hardened).
 * Upgrades: RPC URL Sanitization, Atomic Error Catching, and Precision Math Guard.
 * Note: All original logic, PnL tracking, and EIP-7702 awareness strictly preserved.
 */
export const swapExecutor = {
  /**
   * Helper: Prevents hanging RPC calls from bricking the quote engine.
   */
  async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`QUOTE_TIMEOUT: ${label} exceeded ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  },

  async getSmartRescueQuote(walletAddress: string, assets: any[], membershipTier: string = 'BASIC'): Promise<RescueQuote[]> {
    if (!isAddress(walletAddress)) throw new Error("INVALID_RECOVERY_ADDRESS");
    const safeAddr = getAddress(walletAddress);
    const traceId = `QUOTE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    // Group assets by chain
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
      
      if (!chain || !group.tokens || group.tokens.length === 0) return null;

      try {
        const provider = getProvider(chain.id);
        
        // 1. DATA SYNC (STRESS UPGRADE: 5s Hard Timeout + Connection Guard)
        const [nativeBalance, feeData] = await this.withTimeout(
          Promise.all([
            provider.getBalance(safeAddr),
            provider.getFeeData()
          ]),
          5000,
          `SYNC_${chain.name}`
        ).catch(e => {
            // FIX: Caught the Double-URL/404 error here to prevent total worker failure
            throw new Error(`RPC_CONNECT_FAIL: ${e.message}`);
        });

        // STRESS UPGRADE: Explicit fallback for price to prevent NaN in profitability math
        const nativePriceUsd = Number(chain.nativePriceUsd) || Number(process.env.DEFAULT_ETH_PRICE) || 2500;
        if (nativePriceUsd <= 0) {
          logger.warn(`[SwapExecutor][${traceId}] Invalid price for ${chain.name}. Check metadata.`);
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
        
        // 4. SECURITY & RISK ASSESSMENT (STRESS UPGRADE: Added safety timeout)
        const securityChecks = await this.withTimeout(
          Promise.all(
            group.tokens.map((t: any) => (securityService as any).assessSpenderRisk?.(t.contract || t.address, chain.name))
          ),
          4000,
          `SECURITY_CHECK_${chain.name}`
        ).catch(() => group.tokens.map(() => ({ riskScore: 0 })));

        const maxRiskFound = Math.max(...securityChecks.map((s: any) => s?.riskScore || 0));
        const isRisky = maxRiskFound > (chain.riskThreshold || 65);
        const slippage = isRisky ? (chain.slippageHigh || 5.0) : (chain.slippageStandard || 1.5);

        // 5. DYNAMIC FEE CALCULATION
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

        // 6. ATOMIC BUNDLE CONSTRUCTION (STRESS UPGRADE: Loop safety checks)
        for (const token of group.tokens) {
          try {
            const approval = await (txBuilder as any).buildApprovalTx(
              token.contract || token.address,
              RECOVERY_SPENDER,
              token.rawBalance || token.balance,
              token.decimals || 18
            );
            
            if (approval) {
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
          } catch (itemErr) {
            logger.error(`[SwapExecutor] Payload construction failed for ${token.symbol}: ${itemErr}`);
          }
        }

        // 7. PROFITABILITY AUDIT (Net-Yield Analysis)
        const gasUsd = parseFloat(formatUnits(estimatedGasCostWei, 18)) * nativePriceUsd;
        const l1FeeAdjustmentUsd = chain.isL2 ? (parseFloat(chain.l1FeeEstimate || '0.15') * group.tokens.length) : 0;
        
        const netReceiveUsd = totalValueUsd - (feeReport?.feeUsd || 0) - (strategy === 'DIRECT' ? gasUsd : 0) - l1FeeAdjustmentUsd;
        
        const minProfitThreshold = Number(process.env.MIN_RECOVERY_PROFIT || chain.minProfitThreshold || 2.50);
        
        // FINAL PROFITABILITY & NAN CHECK
        if (isNaN(netReceiveUsd) || netReceiveUsd < minProfitThreshold) {
            logger.info(`[SwapExecutor][${traceId}] Rejected: Net profit $${(netReceiveUsd || 0).toFixed(2)} below threshold $${minProfitThreshold}`);
            return null; 
        }

        // 8. LOG ANALYTICS
        (revenueTracker as any).trackPotentialRevenue(traceId, {
          wallet: safeAddr,
          grossUsd: totalValueUsd,
          platformFeeUsd: feeReport.feeUsd,
          strategy
        });

        const finalCost = await this.withTimeout(
          this.estimatedCostWithL2(estimatedGasCostWei, chain, provider),
          3000,
          `L2_FEE_CALC`
        ).catch(() => estimatedGasCostWei);

        return {
          chain: chain.name,
          chainId: chain.id,
          strategy,
          feeTier: String(feeReport.feeTierLabel || feeReport.tier),
          feeLabel: this.getLabel(strategy),
          gasEstimateNative: formatUnits(finalCost, 18),
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
    const l1Fee = await this.withTimeout(
       (helpers as any).estimateL1Fee?.(chain.id, provider),
       2000,
       'L1_FEE_FETCH'
    ).catch(() => parseUnits('0.0001', 18));
    
    return executionWei + BigInt(l1Fee);
  }
};

export default swapExecutor;
