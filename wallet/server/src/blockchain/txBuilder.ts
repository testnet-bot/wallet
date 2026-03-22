import { ethers, getAddress } from 'ethers';
import { logger } from '../utils/logger.js';

/**
 * Tier 1 Transaction Architect
 * Standardized payloads with Hex-encoding and MEV-Shielding properties.
 */
export const txBuilder = {
  /**
   * Prepares a standard ERC20 'Burn' by routing to the verified Dead address.
   */
  async buildBurnTx(tokenAddress: string, amount: string, decimals: number = 18) {
    const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
    const iface = new ethers.Interface(["function transfer(address to, uint256 value)"]);
    
    try {
      const data = iface.encodeFunctionData("transfer", [
        BURN_ADDRESS,
        ethers.parseUnits(amount, decimals)
      ]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(120000n), // Hex-encoded with buffer
        metadata: { type: 'BURN', symbol: 'SPAM' },
        canBundle: true
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode burn: ${err.message}`);
      throw err;
    }
  },

  /**
   * Prepares an Approval for Recovery (Uniswap/Pancake/1inch)
   */
  async buildApprovalTx(tokenAddress: string, spender: string, amount: string, decimals: number = 18) {
    const iface = new ethers.Interface(["function approve(address spender, uint256 value)"]);
    
    try {
      const data = iface.encodeFunctionData("approve", [
        getAddress(spender),
        ethers.parseUnits(amount, decimals)
      ]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(75000n), // Hex-encoded
        metadata: { type: 'APPROVAL', spender: getAddress(spender) },
        canBundle: true
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode approval: ${err.message}`);
      throw err;
    }
  },

  /**
   * NEW: Prepares a Revoke Transaction (The "Security Shield")
   */
  async buildRevokeTx(tokenAddress: string, spender: string) {
    const iface = new ethers.Interface(["function approve(address spender, uint256 value)"]);
    
    try {
      const data = iface.encodeFunctionData("approve", [
        getAddress(spender),
        0n 
      ]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(65000n),
        metadata: { type: 'REVOKE', targetSpender: getAddress(spender) },
        isSecurityAction: true
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode revoke: ${err.message}`);
      throw err;
    }
  },

  /**
   * NEW: Builds a Native Asset Transfer (ETH/POL/BNB)
   */
  async buildNativeTransfer(to: string, amount: string) {
    try {
      const weiValue = ethers.parseUnits(amount, 18);
      return {
        to: getAddress(to),
        value: ethers.toQuantity(weiValue), // Hex-encoded value
        data: "0x",
        gasLimit: ethers.toQuantity(21000n),
        metadata: { type: 'NATIVE_TRANSFER' }
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode native transfer: ${err.message}`);
      throw err;
    }
  },

  /**
   * INTELLIGENCE: Build Protocol Fee Deduction Tx
   * Dynamically calculates the 2.5%-7.5% cut for the platform.
   */
  async buildFeeTx(recipient: string, amountUsd: number, tokenPrice: number, tokenAddress: string) {
    try {
      const feeTokenAmount = (amountUsd / tokenPrice).toString();
      const iface = new ethers.Interface(["function transfer(address to, uint256 value)"]);
      
      const data = iface.encodeFunctionData("transfer", [
        getAddress(recipient),
        ethers.parseUnits(feeTokenAmount, 18)
      ]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(65000n),
        metadata: { type: 'PROTOCOL_FEE', usdValue: amountUsd }
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to build fee tx: ${err.message}`);
      throw err;
    }
  },

  /**
   * INTELLIGENCE: Build Atomic Flashbots Bundle
   * Chains multiple actions together to ensure safety and atomic execution.
   */
  formatBundle(transactions: any[]) {
    // Priority: Revokes -> Approvals -> Swaps -> Fees
    const sorted = [...transactions].sort((a, b) => {
      const priority: Record<string, number> = { 'REVOKE': 1, 'APPROVAL': 2, 'BURN': 3, 'PROTOCOL_FEE': 4 };
      return (priority[a.metadata.type] || 99) - (priority[b.metadata.type] || 99);
    });

    return sorted.map((tx, index) => ({
      ...tx,
      nonceOffset: index, // Used by the Relayer to chain nonces
    }));
  }
};
