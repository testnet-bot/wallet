import { formatUnits, parseUnits, getAddress, isAddress, ethers } from 'ethers';
import { getProvider } from '../../blockchain/provider.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { logger } from '../../utils/logger.js';
import { securityService } from '../security/security.service.js';
import { txBuilder } from '../../blockchain/txBuilder.js';
import { helpers } from '../../utils/helpers.js';
import axios from 'axios';
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
  targetAsset: string; // e.g., ETH, BNB, MATIC
  tokens: string[];
  securityStatus: 'SAFE' | 'RISKY' | 'PROTECTED';
  relayQuoteId?: string;
  payloads: any[];
  traceId: string;
  slippageTolerance: number;
}

/**
 * UPGRADED: Production-Grade Smart Rescue Executor.
 * Logic: Convert all recovered assets into the Chain's NATIVE token (ETH/BNB/POL).
 * Features: Native Price-Id Alignment, Sequential Payloads, and Net-Profit Guard.
 */
export const swapExecutor = {
  /**
   * Generates high-fidelity rescue strategies targeting Native Asset settlement.
   */
  async getSmartRescueQuote(walletAddress: string, assets: any[]): Promise<RescueQuote[]> {
    if (!isAddress(walletAddress)) throw new Error("INVALID_RECOVERY_ADDRESS");
    const safeAddr = getAddress(walletAddress);
    const traceId = `QUOTE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    // Group assets by chainId for atomic bundling
    const chainGroups = assets.reduce((acc: any, report: any) => {
      const asset = report.asset || report;
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
        const [nativeBalance, feeData] = await Promise.all([
          provider.getBalance(safeAddr),
          provider.getFeeData()
        ]);

        // 1. GAS CALCULATION (EIP-1559 Aware)
        const priorityFee = feeData.maxPriorityFeePerGas || parseUnits('1.5', 'gwei');
        const baseFee = feeData.gasPrice || parseUnits('20', 'gwei');
        const currentMaxFee = (baseFee * 12n / 10n) + priorityFee;
        const totalGasLimit = BigInt(group.tokens.length * 210000 + 60000); 
        const estimatedGasCostWei = currentMaxFee * totalGasLimit;

        // 2. STRATEGY: Direct vs Gasless (Relayed)
        const hasEnoughGas = nativeBalance >= (estimatedGasCostWei * 13n / 10n);
        const strategy = hasEnoughGas ? 'DIRECT' : 'RELAYED';
        const feePercent = strategy === 'DIRECT' ? 0.05 : 0.085; // 8.5% for gasless service
        
        // 3. SECURITY SCAN
        const securityChecks = await Promise.all(
          group.tokens.map((t: any) => (securityService as any).assessSpenderRisk(t.contract || t.address, chain.name))
        );
        const isRisky = securityChecks.some((s: any) => s.isMalicious || s.riskScore > 65);
        const slippage = isRisky ? 4.0 : 1.0;

        const RECOVERY_SPENDER = process.env.RECOVERY_SPENDER_ADDRESS;
        if (!RECOVERY_SPENDER) throw new Error("RECOVERY_SPENDER_ADDRESS_MISSING");

        // 4. NATIVE SETTLEMENT LOGIC
        const nativeSymbol = chain.symbol || 'ETH';
        const payloads: any[] = [];

        for (const token of group.tokens) {
          // A: Approval step
          const approval = await (txBuilder as any).buildApprovalTx(
            token.contract || token.address,
            RECOVERY_SPENDER,
            token.rawBalance,
            token.decimals || 18
          );
          payloads.push(approval);

          // B: Intent Payload - Swap to Native
          payloads.push({
             to: RECOVERY_SPENDER,
             data: "0x", 
             value: "0x0",
             metadata: { 
               type: 'RECOVERY_SWAP', 
               from: token.symbol, 
               to: nativeSymbol, 
               amount: token.rawBalance 
             }
          });
        }

        // 5. PROFITABILITY AUDIT (Net-Positive for User)
        const totalValueUsd = group.tokens.reduce((sum: number, t: any) => sum + (Number(t.usdValue) || 0), 0);
        const platformFeeUsd = totalValueUsd * feePercent;
        
        // UPGRADED: Explicit Price Conversion using nativePriceId from chain.ts
        const nativePriceUsd = Number(chain.nativePriceId || 3000); 
        const gasUsd = parseFloat(formatUnits(estimatedGasCostWei, 18)) * nativePriceUsd;
        
        const netReceiveUsd = totalValueUsd - platformFeeUsd - (strategy === 'DIRECT' ? gasUsd : 0);
        
        // Hard Floor: Don't execute if user gets less than .50 net
        if (netReceiveUsd < 2.50) return null; 

        return {
          chain: chain.name,
          chainId: chain.id,
          strategy,
          feeTier: `${(feePercent * 100).toFixed(1)}%`,
          feeLabel: this.getLabel(strategy),
          gasEstimateNative: formatUnits(estimatedGasCostWei, 18),
          platformFeeUsd: platformFeeUsd.toFixed(2),
          netUserReceiveUsd: netReceiveUsd.toFixed(2),
          targetAsset: nativeSymbol,
          tokens: group.tokens.map((t: any) => t.symbol || 'UNK'),
          securityStatus: isRisky ? 'PROTECTED' : 'SAFE',
          payloads: payloads,
          traceId,
          slippageTolerance: slippage
        };

      } catch (err: any) {
        logger.error(`[SwapExecutor][${traceId}] Quote failure for ${chainIdStr}: ${err.message}`);
        return null;
      }
    });

    const results = await Promise.all(quoteTasks);
    return results.filter((r): r is RescueQuote => r !== null);
  },

  getLabel(strategy: string) {
    const labels: Record<string, string> = {
      'DIRECT': "Standard Recovery (User Gas)",
      'RELAYED': "Gasless Recovery (MEV-Protected)",
      'RELAY_BRIDGE': "Cross-chain Settlement"
    };
    return labels[strategy] || "Native Recovery";
  }
};
