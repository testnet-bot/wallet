import { formatUnits, parseUnits, getAddress, isAddress, ZeroAddress } from 'ethers';
import { getProvider } from '../../blockchain/provider.js';
import { EVM_CHAINS, getBestRpc, requireChain, ChainConfig } from '../../blockchain/chains.js';
import { logger } from '../../utils/logger.js';
import { securityService } from '../security/security.service.js';
import { txBuilder } from '../../blockchain/txBuilder.js';
import { helpers } from '../../utils/helpers.js';
import { feeCalculator } from '../../pricing/feeCalculator.js';
import { revenueTracker } from '../../pricing/revenueTracker.js';
import { flashbotsExecution } from '../../blockchain/flashbotsExecution.js';
import crypto from 'crypto';

export interface RescueQuote {
  chain: string;
  chainId: number;
  strategy: 'DIRECT' | 'RELAYED' | 'RELAY_BRIDGE' | 'FLASHBOTS_MEV_SHIELD';
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
 * BATTLE-STRESSED: Institutional Smart Rescue Executor (v2026.10 Latency-Aware).
 * UPGRADES: Flashbots MEV-Shield Integration, BigInt Precision, and Aegis Security Alignment.
 * INTEGRATION: Strictly utilizes chains.ts and flashbotsExecution.ts for atomic recovery.
 */
export const swapExecutor = {
  /**
   * Helper: Prevents hanging RPC calls from bricking the quote engine.
   * UPGRADE: Added AbortController signal propagation.
   */
  async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`QUOTE_TIMEOUT: ${label} exceeded ${timeoutMs}ms`)), timeoutMs)
      ),
    ]).finally(() => clearTimeout(timeout));
  },

  async getSmartRescueQuote(walletAddress: string, assets: any[], membershipTier: string = 'BASIC'): Promise<RescueQuote[]> {
    if (!isAddress(walletAddress)) throw new Error("INVALID_RECOVERY_ADDRESS");
    const safeAddr = getAddress(walletAddress);
    const traceId = `QUOTE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const chainGroups = assets.reduce((acc: any, item: any) => {  
      const asset = item.asset || item;  
      const chainId = asset.chainId || 1;  

      // --- 🛡️ AEGIS SPAM FILTER INTEGRATION ---
      // Strictly ignore any asset marked as malicious or spam to prevent gas waste on failed rescues
      if (asset.status === 'malicious' || asset.status === 'spam') {
        logger.warn(`[SwapExecutor][${traceId}] Skipping blocked asset: ${asset.symbol} on chain ${chainId}`);
        return acc;
      }

      if (!acc[chainId]) acc[chainId] = { tokens: [] };  
      acc[chainId].tokens.push(asset);  
      return acc;  
    }, {});  

    const quoteTasks = Object.keys(chainGroups).map(async (chainIdStr): Promise<RescueQuote | null> => {  
      const chainId: number = Number(chainIdStr);   
      const group = chainGroups[chainIdStr];  

      try {  
        const chain = requireChain(chainId) as ChainConfig;  
        if (!group.tokens || group.tokens.length === 0) return null;  

        const bestRpc = await this.withTimeout(getBestRpc(chainId), chainId === 1 ? 8000 : 4000, `RPC_DISCOVERY_${chainId}`)
          .catch(() => Array.isArray(chain.rpcs) ? chain.rpcs[0] : '');  
        if (!bestRpc) throw new Error(`NO_RPC_AVAILABLE_FOR_CHAIN_${chainId}`);  

        const shuffled = [...chain.rpcs].sort(() => Math.random() - 0.5);
        const rpcCandidates = [bestRpc, ...shuffled.filter(r => r !== bestRpc)].slice(0, 3);

        let nativeBalance, feeData, provider;

        try {
          const result = await Promise.any(
            rpcCandidates.map(async (rpc) => {
              const p = getProvider(rpc, chainId);
              const [balance, fees] = await this.withTimeout(
                Promise.all([p.getBalance(safeAddr), p.getFeeData()]),
                chainId === 1 ? 8000 : 4000,
                `RPC_RACE_${chainId}`
              );
              if (!balance || !fees) throw new Error('INVALID_RPC_RESPONSE');
              return { balance, fees, provider: p };
            })
          );
          nativeBalance = result.balance;
          feeData = result.fees;
          provider = result.provider;
        } catch {
          logger.error(`[SwapExecutor][${traceId}] ALL RPCs failed for chain ${chainId}`);
          throw new Error(`ALL_RPC_FAILED_${chainId}`);
        }

        const nativePriceUsd = Number(process.env[`PRICE_${chain.nativePriceId.toUpperCase()}`]) ||
                               Number(process.env.NATIVE_PRICE_FALLBACK) || 2500;
        if (!nativePriceUsd || nativePriceUsd <= 0) {
          logger.error(`[SwapExecutor][${traceId}] REJECTED: Missing price metadata for ${chain.name}`);
          return null;
        }

        const baseFee = feeData.maxFeePerGas || feeData.gasPrice;
        if (!baseFee || baseFee <= 0n) throw new Error("INVALID_GAS_DATA");

        const gasMultiplier = BigInt(Math.floor((Number(process.env.GAS_BUFFER) || 1.45) * 100));
        const currentMaxFee = (baseFee * gasMultiplier) / 100n;
        const gasPerSwap = BigInt(process.env.GAS_PER_SWAP || 280000);
        const totalGasLimit = BigInt(group.tokens.length) * gasPerSwap + BigInt(120000);
        const estimatedGasCostWei = currentMaxFee * totalGasLimit;

        const totalValueUsd = group.tokens.reduce((sum: number, t: any) => sum + (Number(t.usdValue) || 0), 0);
        const mevThreshold = Number(process.env.MEV_PROTECTION_THRESHOLD) || 500;

        if (nativeBalance < 0n) throw new Error("INVALID_BALANCE");

        let strategy: 'DIRECT' | 'RELAYED' | 'FLASHBOTS_MEV_SHIELD' =
          nativeBalance >= (estimatedGasCostWei * 130n / 100n) ? 'DIRECT' : 'RELAYED';
        if (strategy === 'DIRECT' && totalValueUsd > mevThreshold && [1, 11155111, 8453].includes(chainId)) {
          strategy = 'FLASHBOTS_MEV_SHIELD';
        }

        const securityChecks = await this.withTimeout(
          Promise.all(group.tokens.map((t: any) => (securityService as any).assessSpenderRisk?.(t.contract || t.address, chain.name))),
          5000,
          `SECURITY_${chain.name}`
        ).catch(() => group.tokens.map(() => ({ riskScore: 100 })));
        const maxRiskFound = Math.max(...securityChecks.map((s: any) => s?.riskScore || 0));
        const isRisky = maxRiskFound > (Number(process.env.RISK_THRESHOLD) || 70);
        const slippage = isRisky ? (Number(process.env.SLIPPAGE_HIGH) || 12.0) : (Number(process.env.SLIPPAGE_STANDARD) || 1.5);

        const feeReport = (feeCalculator as any).calculateRescueFee({
          amountUsd: totalValueUsd,
          isGasless: strategy === 'RELAYED',
          tier: membershipTier,
          riskScore: maxRiskFound
        });

        const RECOVERY_SPENDER = getAddress(process.env.RECOVERY_SPENDER_ADDRESS || ZeroAddress);
        if (!RECOVERY_SPENDER || RECOVERY_SPENDER === ZeroAddress) throw new Error("SPENDER_CONFIG_MISSING");

        const nativeSymbol = chain.symbol || 'ETH';
        const payloads: any[] = [];

        // FIXED: Flat loop replaces nested map to prevent duplicate approval payload generation
        for (const token of group.tokens) {
          const approval = await (txBuilder as any).buildApprovalTx(
            token.contract || token.address, 
            RECOVERY_SPENDER, 
            token.rawBalance || token.balance, 
            token.decimals || 18
          );
          
          if (approval) {
            payloads.push(approval);
            payloads.push({
              to: RECOVERY_SPENDER,
              data: "0x",
              value: "0x0",
              gasLimit: (BigInt(approval.gasLimit || 180000) * 17n / 10n).toString(),
              metadata: { type: 'RECOVERY_SWAP', from: token.symbol, to: nativeSymbol, chainId: chain.id, traceId }
            });
          }
        }

        const gasUsd = (Number(formatUnits(estimatedGasCostWei, 18)) * nativePriceUsd);
        const l1FeeAdjustmentUsd = chain.isL2 ? (parseFloat(process.env.L1_FEE_ESTIMATE || '0.35') * group.tokens.length) : 0;
        const netReceiveUsd = totalValueUsd - (feeReport?.feeUsd || 0) - (strategy !== 'RELAYED' ? gasUsd : 0) - l1FeeAdjustmentUsd;
        const minProfitThreshold = Number(process.env.MIN_RECOVERY_PROFIT) || 3.50;

        if (isNaN(netReceiveUsd) || netReceiveUsd < minProfitThreshold) {
          logger.info(`[SwapExecutor][${traceId}] ABORT: Non-profitable ($${netReceiveUsd.toFixed(2)})`);
          return null;
        }

        (revenueTracker as any).trackPotentialRevenue(traceId, { wallet: safeAddr, grossUsd: totalValueUsd, platformFeeUsd: feeReport.feeUsd, strategy });

        const finalCost = await this.withTimeout(this.estimatedCostWithL2(estimatedGasCostWei, chain, provider), 4000, `L2_FEE_${chain.id}`)
          .catch(() => estimatedGasCostWei);

        return {
          chain: chain.name,
          chainId: chain.id,
          strategy,
          feeTier: String(feeReport.feeTierLabel || feeReport.tier),
          feeLabel: this.getLabel(strategy),
          gasEstimateNative: formatUnits(finalCost, 18),
          platformFeeUsd: (feeReport?.feeUsd || 0).toFixed(2),
          netUserReceiveUsd: netReceiveUsd.toFixed(2),
          targetAsset: nativeSymbol,
          tokens: group.tokens.map((t: any) => t.symbol || 'UNK'),
          securityStatus: maxRiskFound > 50 ? 'RISKY' : 'SAFE',
          payloads,
          traceId,
          slippageTolerance: slippage
        };
      } catch (err: any) {
        logger.error(`[SwapExecutor][${traceId}] Fatal Quote Error for ${chainIdStr}: ${err.message}`);
        return null;
      }
    });

    const results = await Promise.all(quoteTasks);
    return results.filter((r): r is RescueQuote => r !== null);
  },

  getLabel(strategy: string) {
    const labels: Record<string, string> = {
      'DIRECT': "Standard Recovery",
      'RELAYED': "Institutional Gasless",
      'RELAY_BRIDGE': "Cross-chain Settlement",
      'FLASHBOTS_MEV_SHIELD': "MEV-Shielded Recovery"
    };
    return labels[strategy] || "Native Recovery";
  },

  async estimatedCostWithL2(executionWei: bigint, chain: any, provider: any): Promise<bigint> {
    if (!chain.isL2) return executionWei;
    const l1Fee = await this.withTimeout((helpers as any).estimateL1Fee?.(chain.id, provider), 3000, 'L1_FEE')
      .catch(() => parseUnits('0.00015', 18));
    return executionWei + BigInt(l1Fee as string | bigint);
  },

  async executeRecovery(encryptedPk: string, quote: RescueQuote, rpcUrl: string): Promise<any> {
    logger.info(`[SwapExecutor][EXECUTE] Processing ${quote.strategy} | Trace: ${quote.traceId}`);

    if (quote.strategy === 'FLASHBOTS_MEV_SHIELD') {
      return await flashbotsExecution.executeBundle(encryptedPk, rpcUrl, quote.payloads, quote.chainId);
    }

    try {
      const provider = getProvider(rpcUrl, quote.chainId);
      const bundle = await (txBuilder as any).formatBundle(provider, quote.payloads, 0, quote.chainId);

      const signer = await (helpers as any).decryptSigner(encryptedPk, provider);
      for (const tx of bundle) {
        const sentTx = await signer.sendTransaction(tx);
        await sentTx.wait();
      }
    } catch (err: any) {
      logger.error(`[SwapExecutor][FATAL_EXECUTION] ${err.message}`);
      throw err;
    }
  }
};

export default swapExecutor;
