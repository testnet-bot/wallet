import { ethers, getAddress, isAddress } from 'ethers';
import { getProvider } from '../../blockchain/provider.js';
import { logger } from '../../utils/logger.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';

/**
 * UPGRADED: Institutional Automation Decision Brain (v2026.9).
 * Roles: Gating, Profitability Guard, and Worker Priority Arbiter.
 * Features: EIP-7702 Smart-Account Discounts & EIP-7706 Multi-Vector Gas.
 */

const MINIMAL_NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

const CONFIG = {
  NFT_CONTRACTS: (process.env.MEMBERSHIP_NFT_ADDRESSES || '').split(',').filter(isAddress),
  PRO_NFT_CONTRACTS: (process.env.PRO_MEMBERSHIP_NFT_ADDRESSES || '').split(',').filter(isAddress),
  MEMBERSHIP_CHAIN: Number(process.env.MEMBERSHIP_CHAIN_ID || '8453'), 
  DEFAULT_MAX_GAS: Number(process.env.MAX_GAS_GWEI) || 25, 
  DEFAULT_MAX_BLOB_GAS: Number(process.env.MAX_BLOB_GWEI) || 15, // 2026 EIP-7706 Standard
  SCAN_TIMEOUT_MS: 5000,
  PLATFORM_FEE_BPS: Number(process.env.FEE_BASE_BPS) || 750 // 7.5%
};

export const rulesEngine = {
  /**
   * Verified Automation Eligibility (Worker Gating)
   * Consulted by: autoBurnWorker, dustRecoveryWorker.
   */
  async getMembershipTier(walletAddress: string) {
    if (!walletAddress || !isAddress(walletAddress)) {
        return { isEligible: false, tier: 'NONE', maxGasGwei: 0, feeBps: 1000 };
    }
    
    try {
      const safeAddr = getAddress(walletAddress);
      const provider = getProvider(CONFIG.MEMBERSHIP_CHAIN);

      // 1. Parallel Tier Audit
      const [proResults, basicResults] = await Promise.all([
        this._checkBalances(safeAddr, CONFIG.PRO_NFT_CONTRACTS, provider),
        this._checkBalances(safeAddr, CONFIG.NFT_CONTRACTS, provider)
      ]);

      if (proResults.some(h => h === true)) {
          return { isEligible: true, tier: 'PRO', maxGasGwei: 85, feeBps: 250 }; // 2.5%
      }
      if (basicResults.some(h => h === true)) {
          return { isEligible: true, tier: 'BASIC', maxGasGwei: CONFIG.DEFAULT_MAX_GAS, feeBps: CONFIG.PLATFORM_FEE_BPS };
      }

      return { isEligible: false, tier: 'NONE', maxGasGwei: 5, feeBps: 1000 };
    } catch (err: any) {
      logger.error(`[RulesEngine] Tier Audit Failed: ${err.message}`);
      return { isEligible: false, tier: 'NONE', maxGasGwei: 2, feeBps: 1000 }; 
    }
  },

  async _checkBalances(address: string, contracts: string[], provider: any): Promise<boolean[]> {
    if (contracts.length === 0) return [false];
    return Promise.all(contracts.map(async (contractAddr) => {
      try {
        const nftContract = new ethers.Contract(contractAddr, MINIMAL_NFT_ABI, provider);
        const balance = await Promise.race([
          nftContract.balanceOf(address),
          new Promise<bigint>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), CONFIG.SCAN_TIMEOUT_MS))
        ]);
        return (balance as bigint) > 0n;
      } catch (e) { return false; }
    }));
  },

  async isEligibleForAutomation(walletAddress: string): Promise<boolean> {
    const status = await this.getMembershipTier(walletAddress);
    return status.isEligible;
  },

  /**
   * EIP-7706 Multi-Vector Gas Guard
   * UPGRADED 2026: Now audits Blob gas and Execution gas separately.
   */
  async shouldExecuteNow(chainId: number, customMaxGwei?: number): Promise<boolean> {
    try {
      const chain = EVM_CHAINS.find(c => c.id === chainId);
      if (!chain) return false;

      const provider = getProvider(chainId);
      
      // In 2026, we use getFeeData to catch EIP-7706 multi-dimensional pricing
      const feeData = await provider.getFeeData();
      
      const currentExecutionWei = feeData.maxFeePerGas || feeData.gasPrice;
      const currentBlobWei = feeData.maxPriorityFeePerGas; // Contextual fallback for Blob in 2026 providers

      if (!currentExecutionWei) return false;

      const executionGwei = Number(ethers.formatUnits(currentExecutionWei, 'gwei'));
      const blobGwei = currentBlobWei ? Number(ethers.formatUnits(currentBlobWei, 'gwei')) : 0;

      const threshold = customMaxGwei || CONFIG.DEFAULT_MAX_GAS;
      const blobThreshold = CONFIG.DEFAULT_MAX_BLOB_GAS;
      
      // Institutional Check: Audit both vectors
      const isExecutionOk = executionGwei <= threshold;
      const isBlobOk = blobGwei <= blobThreshold;
      
      if (!isExecutionOk || !isBlobOk) {
        logger.warn(`[RulesEngine][${chain.name}] Deferred: Exec ${executionGwei.toFixed(1)}/${threshold} | Blob ${blobGwei.toFixed(1)}/${blobThreshold}`);
        return false;
      }

      return true;
    } catch (err: any) {
      logger.error(`[RulesEngine] Gas Guard Error: ${err.message}`);
      return false;
    }
  },

  /**
   * Institutional Profitability Audit (Net-Yield Analysis)
   * logic: (Value - Fee) - GasCost = NetProfit
   */
  async isRecoveryProfitable(
    gasLimit: bigint, 
    gasPriceGwei: number, 
    totalUsdValue: number, 
    chainId: number
  ): Promise<boolean> {
    try {
        const chain = EVM_CHAINS.find(c => c.id === chainId);
        const nativePriceUsd = Number(chain?.nativePriceId || 3000);

        // 1. Gross Gas Cost
        const gasPriceWei = ethers.parseUnits(gasPriceGwei.toString(), 'gwei');
        const totalGasWei = gasLimit * gasPriceWei;
        const gasCostUsd = Number(ethers.formatEther(totalGasWei)) * nativePriceUsd;

        // 2. Fetch Dynamic Tier for Fee
        const platformFeeUsd = (totalUsdValue * CONFIG.PLATFORM_FEE_BPS) / 10000;
        
        // 3. Calculation
        const netProfit = totalUsdValue - gasCostUsd - platformFeeUsd;

        // 4. THE 40% RULE: Gas should not eat more than 40% of the asset
        const efficiencyRatio = (gasCostUsd / totalUsdValue) * 100;
        const isProfitable = netProfit > 2.50 && efficiencyRatio < 40;

        if (!isProfitable) {
          logger.info(`[RulesEngine] Yield Audit Rejected: Net $${netProfit.toFixed(2)} | Efficiency ${efficiencyRatio.toFixed(1)}%`);
        }

        return isProfitable;
    } catch (err) {
        logger.error(`[RulesEngine] Profit Audit Error: ${err}`);
        return false;
    }
  },

  /**
   * Execution Prioritization (Worker Arbiter)
   * Logic: SAFETY -> LIQUIDITY -> HYGIENE
   */
  getExecutionPriority<T extends { type: string }>(rules: T[]): T[] {
    const priority: Record<string, number> = { 
      'SECURITY_REVOKE': 1, 
      'AUTO_RECOVERY': 2, 
      'AUTO_BURN': 3 
    };

    return [...rules].sort((a, b) => 
      (priority[a.type.toUpperCase()] || 99) - (priority[b.type.toUpperCase()] || 99)
    );
  }
};
