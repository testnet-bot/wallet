import { ethers, getAddress, isAddress } from 'ethers';
import { getProvider } from '../../blockchain/provider.js';
import { logger } from '../../utils/logger.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';

/**
 * UPGRADED: Production-Grade Automation Rules & Gating (Finance Grade).
 * Features: Tiered NFT Membership, Live Gas-Aware Profitability, 
 * and Net-Yield Auditing (After Fees & Gas).
 */
const MINIMAL_NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

// Configuration from Environment
const CONFIG = {
  NFT_CONTRACTS: (process.env.MEMBERSHIP_NFT_ADDRESSES || '').split(',').filter(isAddress),
  PRO_NFT_CONTRACTS: (process.env.PRO_MEMBERSHIP_NFT_ADDRESSES || '').split(',').filter(isAddress),
  MEMBERSHIP_CHAIN: Number(process.env.MEMBERSHIP_CHAIN_ID || '8453'), // Default: Base
  DEFAULT_MAX_GAS: Number(process.env.MAX_GAS_GWEI) || 25, // Lowered for 2026 low-gas market
  SCAN_TIMEOUT_MS: 5000,
  PLATFORM_FEE_BPS: 750 // 7.5%
};

export const rulesEngine = {
  /**
   * Verified Automation Eligibility (Tiered Gating)
   * Ensures the user holds the required NFTs to access automated features.
   */
  async getMembershipTier(walletAddress: string) {
    if (!walletAddress || !isAddress(walletAddress)) {
        return { isEligible: false, tier: 'NONE', maxGasGwei: 0 };
    }
    
    try {
      const safeAddr = getAddress(walletAddress);
      const provider = getProvider(CONFIG.MEMBERSHIP_CHAIN);

      // 1. Parallel Check for Pro vs Basic Tiers
      const [proResults, basicResults] = await Promise.all([
        this._checkBalances(safeAddr, CONFIG.PRO_NFT_CONTRACTS, provider),
        this._checkBalances(safeAddr, CONFIG.NFT_CONTRACTS, provider)
      ]);

      if (proResults.some(h => h === true)) {
          return { isEligible: true, tier: 'PRO', maxGasGwei: 10 };
      }
      if (basicResults.some(h => h === true)) {
          return { isEligible: true, tier: 'BASIC', maxGasGwei: CONFIG.DEFAULT_MAX_GAS };
      }

      // Default: Public/Free tier might have restricted or no automation
      return { isEligible: false, tier: 'NONE', maxGasGwei: 2 };
    } catch (err: any) {
      logger.error(`[RulesEngine] Membership Audit Failed: ${err.message}`);
      return { isEligible: false, tier: 'NONE', maxGasGwei: 2 }; 
    }
  },

  /**
   * Internal balance checker with strict timeout protection
   */
  async _checkBalances(address: string, contracts: string[], provider: any): Promise<boolean[]> {
    if (contracts.length === 0) return [false];
    
    return Promise.all(contracts.map(async (contractAddr) => {
      try {
        const nftContract = new ethers.Contract(contractAddr, MINIMAL_NFT_ABI, provider);
        // Race against a timeout to prevent hanging the automation butler
        const balance = await Promise.race([
          nftContract.balanceOf(address),
          new Promise<bigint>((_, reject) => 
            setTimeout(() => reject(new Error('RPC_TIMEOUT')), CONFIG.SCAN_TIMEOUT_MS)
          )
        ]);
        return (balance as bigint) > 0n;
      } catch (e) { 
        return false; 
      }
    }));
  },

  /**
   * Standard eligibility check (Backward compatible)
   */
  async isEligibleForAutomation(walletAddress: string): Promise<boolean> {
    const status = await this.getMembershipTier(walletAddress);
    return status.isEligible;
  },

  /**
   * Production Gas Price Guard (EIP-1559 Aware)
   * Prevents automated tasks from executing during volatile gas spikes.
   */
  async shouldExecuteNow(chainId: number, customMaxGwei?: number): Promise<boolean> {
    try {
      const chain = EVM_CHAINS.find(c => c.id === chainId);
      if (!chain) return false;

      const provider = getProvider(chainId);
      const feeData = await provider.getFeeData();
      
      const currentWei = feeData.maxFeePerGas || feeData.gasPrice;
      if (!currentWei) return false;

      const currentGwei = Number(ethers.formatUnits(currentWei, 'gwei'));
      const threshold = customMaxGwei || CONFIG.DEFAULT_MAX_GAS;
      
      const isAcceptable = currentGwei <= threshold;
      
      if (!isAcceptable) {
        logger.warn(`[RulesEngine][${chain.name}] Gas Spike Detected: ${currentGwei.toFixed(2)} Gwei > Limit ${threshold}`);
      }

      return isAcceptable;
    } catch (err: any) {
      logger.error(`[RulesEngine] Gas Guard Failure: ${err.message}`);
      return false;
    }
  },

  /**
   * High-Precision Profitability Audit (Net Yield Calculation)
   * logic: TotalValue - GasCost - PlatformFee = NetUserProfit
   */
  async isRecoveryProfitable(
    gasLimit: bigint, 
    gasPriceGwei: number, 
    totalUsdValue: number, 
    nativeTokenPriceUsd: number = 3500 
  ): Promise<boolean> {
    try {
        // 1. Calculate Gross Gas Cost in USD
        const gasPriceWei = ethers.parseUnits(gasPriceGwei.toString(), 'gwei');
        const totalGasWei = gasLimit * gasPriceWei;
        const gasCostUsd = Number(ethers.formatEther(totalGasWei)) * nativeTokenPriceUsd;

        // 2. Calculate Platform Fee (e.g., 7.5%)
        const platformFeeUsd = (totalUsdValue * CONFIG.PLATFORM_FEE_BPS) / 10000;
        
        // 3. Calculate Net Profit for User
        const netProfit = totalUsdValue - gasCostUsd - platformFeeUsd;

        // 4. FINANCIAL GUARD:
        // - User must clear at least .00 profit.
        // - Gas cost must not exceed 50% of the total value.
        const isProfitable = netProfit > 2.00 && (gasCostUsd < (totalUsdValue * 0.5));

        if (!isProfitable) {
          logger.info(`[RulesEngine] Yield Audit: REJECTED (Net Profit: $${netProfit.toFixed(2)} | Gas: $${gasCostUsd.toFixed(2)})`);
        }

        return isProfitable;
    } catch (err) {
        logger.error(`[RulesEngine] Profitability calculation error: ${err}`);
        return false;
    }
  },

  /**
   * Execution Prioritization
   * Priority: SECURITY (Revokes) -> RECOVERY (Funds) -> BURN (Spam)
   */
  async getExecutionPriority<T extends { type: string }>(rules: T[]): Promise<T[]> {
    const priority: Record<string, number> = { 
      'SECURITY': 1, 
      'AUTO_RECOVERY': 2, 
      'AUTO_BURN': 3 
    };

    return [...rules].sort((a, b) => 
      (priority[a.type.toUpperCase()] || 99) - (priority[b.type.toUpperCase()] || 99)
    );
  }
};
