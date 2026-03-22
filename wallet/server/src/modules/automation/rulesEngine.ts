import { ethers, getAddress } from 'ethers';
import { getProvider } from '../../blockchain/provider.js';
import { logger } from '../../utils/logger.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';

/**
 * Standard ERC-721 ABI for membership verification
 */
const MINIMAL_NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function name() view returns (string)"
];

/**
 * PRODUCTION GATING CONFIG
 * Supports multiple tiers of membership (e.g., OG Pass, Alpha Pass).
 */
const MEMBERSHIP_NFT_ADDRESSES = [
  '0xYourBaseNftAddressHere', // Tier 1: Alpha
  '0xAnotherNftAddressHere'    // Tier 2: Beta
];

export const rulesEngine = {
  /**
   * Verified Automation Eligibility
   * Upgraded to check multiple collections with high-speed parallel RPC calls.
   */
  async isEligibleForAutomation(walletAddress: string): Promise<boolean> {
    try {
      const safeAddr = getAddress(walletAddress);
      
      // 1. Get Base Network Config dynamically
      const baseChain = EVM_CHAINS.find(c => c.name === 'Base');
      const provider = getProvider(baseChain?.rpc || 'https://mainnet.base.org');
      
      // 2. Parallel Membership Check (Faster than sequential)
      const membershipChecks = MEMBERSHIP_NFT_ADDRESSES.map(async (contractAddr) => {
        const nftContract = new ethers.Contract(contractAddr, MINIMAL_NFT_ABI, provider);
        
        // Heavy-Duty Check: 3s Timeout safety for production speed
        const balance = await Promise.race([
          nftContract.balanceOf(safeAddr),
          new Promise<bigint>((resolve) => setTimeout(() => resolve(0n), 3000))
        ]);
        
        return (balance as bigint) > 0n;
      });

      const results = await Promise.all(membershipChecks);
      const isHolder = results.some(held => held === true);

      if (isHolder) {
        logger.info(`[RulesEngine] Base Holder Confirmed: ${safeAddr}`);
      }
      
      return isHolder;
    } catch (err: any) {
      logger.error(`[RulesEngine] Gating Verification Failed: ${err.message}`);
      return false; 
    }
  },

  /**
   * NEW: Gas Price Guard
   * Intelligence: Tells the automation workers IF it is a good time to execute.
   * Prevents spending $5 in gas to recover $4 in dust.
   */
  async shouldExecuteNow(chainId: number, targetGasGwei: number = 30): Promise<boolean> {
    try {
      const chain = EVM_CHAINS.find(c => c.id === chainId);
      if (!chain) return false;

      const provider = getProvider(chain.rpc);
      const feeData = await provider.getFeeData();
      
      if (!feeData.gasPrice) return false;

      const currentGasGwei = Number(ethers.formatUnits(feeData.gasPrice, 'gwei'));
      
      const isCheap = currentGasGwei <= targetGasGwei;
      
      if (!isCheap) {
        logger.warn(`[RulesEngine] High Gas on ${chain.name}: ${currentGasGwei} Gwei (Target: ${targetGasGwei})`);
      }

      return isCheap;
    } catch (err: any) {
      logger.error(`[RulesEngine] Gas check failed: ${err.message}`);
      return false;
    }
  },

  /**
   * NEW: Rule Priority Logic
   * Determines which rule (Burn vs Recovery) should happen first to optimize state.
   */
  async getExecutionPriority(rules: any[]) {
    // Logic: Always Revoke/Security first, then Burn, then Recovery.
    return rules.sort((a, b) => {
      const order: Record<string, number> = { 'SECURITY': 1, 'AUTO_BURN': 2, 'AUTO_RECOVERY': 3 };
      return (order[a.type] || 99) - (order[b.type] || 99);
    });
  }
};
