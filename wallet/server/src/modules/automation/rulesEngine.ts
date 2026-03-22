import { ethers, getAddress } from 'ethers';
import { getProvider } from '../../blockchain/provider.js';
import { logger } from '../../utils/logger.js';

/**
 * Standard ERC-721 ABI for membership verification
 */
const MINIMAL_NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function name() view returns (string)"
];

/**
 * BASE MAINNET CONFIG
 * Specifically targets the Base network for NFT ownership checks.
 */
const MEMBERSHIP_NFT_ADDRESS = '0xYourBaseNftAddressHere'; 
const BASE_RPC_URL = 'https://mainnet.base.org'; // The string the provider needs

export const rulesEngine = {
  /**
   * Verified Automation Eligibility
   */
  async isEligibleForAutomation(walletAddress: string): Promise<boolean> {
    try {
      // 1. Standardize Address
      const safeAddr = getAddress(walletAddress);
      
      //  Fix: Pass the RPC URL string to getProvider
      const provider = getProvider(BASE_RPC_URL);
      
      // Initialize Contract Instance
      const nftContract = new ethers.Contract(
        MEMBERSHIP_NFT_ADDRESS, 
        MINIMAL_NFT_ABI, 
        provider
      );
      
      //  Heavy-Duty Check: 5s Timeout safety
      const balance = await Promise.race([
        nftContract.balanceOf(safeAddr),
        new Promise<bigint>((_, r) => {
           setTimeout(() => r(0n), 5000);
        })
      ]);

      const isHolder = (balance as bigint) > 0n;

      if (isHolder) {
        logger.info(`[RulesEngine] Base Holder Confirmed: ${safeAddr}`);
      }
      
      return isHolder;
    } catch (err: any) {
      logger.error(`[RulesEngine] Base Verification Failed: ${err.message}`);
      return false; 
    }
  }
};
