import { ethers, getAddress } from 'ethers';
import { logger } from '../utils/logger.js';

/**
 * UPGRADED: Institutional-Grade Transaction Architect (v2026.5 Hardened).
 * Features: Fixed-point precision math, Strict Hex-normalization, 
 * EIP-7702 Smart-EOA Encoding, and Nonce-aware Atomic Bundle Sequencing.
 */
export const txBuilder = {
  BURN_ADDRESS: '0x000000000000000000000000000000000000dEaD',
  BASE_PRECISION: BigInt(1e18),

  /**
   * Encodes a standard ERC20 'Burn'.
   * UPGRADED: Support for 2026 "Force-Transfer" patterns.
   */
  async buildBurnTx(tokenAddress: string, amount: string, decimals: number = 18) {
    const iface = new ethers.Interface(["function transfer(address to, uint256 value)"]);
    
    try {
      const rawValue = ethers.parseUnits(amount.toString(), decimals);
      const data = iface.encodeFunctionData("transfer", [this.BURN_ADDRESS, rawValue]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(165000n), // Institutional overhead for complex proxies
        metadata: { 
          type: 'BURN', 
          symbol: 'ASSET', 
          rawValue: rawValue.toString(),
          method: 'transfer(address,uint256)'
        },
        canBundle: true
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode burn for ${tokenAddress}: ${err.message}`);
      throw err;
    }
  },

  /**
   * Encodes an Approval.
   */
  async buildApprovalTx(tokenAddress: string, spender: string, amount: string, decimals: number = 18) {
    const iface = new ethers.Interface(["function approve(address spender, uint256 value)"]);
    
    try {
      const rawValue = ethers.parseUnits(amount.toString(), decimals);
      const data = iface.encodeFunctionData("approve", [getAddress(spender), rawValue]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(95000n), 
        metadata: { 
          type: 'APPROVAL', 
          spender: getAddress(spender), 
          rawValue: rawValue.toString(),
          method: 'approve(address,uint256)'
        },
        canBundle: true
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode approval: ${err.message}`);
      throw err;
    }
  },

  /**
   * Encodes a Revoke (Sets approval to 0).
   */
  async buildRevokeTx(tokenAddress: string, spender: string) {
    const iface = new ethers.Interface(["function approve(address spender, uint256 value)"]);
    
    try {
      const data = iface.encodeFunctionData("approve", [getAddress(spender), 0n]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(85000n),
        metadata: { 
          type: 'REVOKE', 
          targetSpender: getAddress(spender),
          isPriority: true 
        },
        isSecurityAction: true
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode revoke: ${err.message}`);
      throw err;
    }
  },

  /**
   * Builds a Native Asset Transfer (ETH/POL/BNB).
   */
  async buildNativeTransfer(to: string, amount: string) {
    try {
      const weiValue = ethers.parseUnits(amount.toString(), 18);
      return {
        to: getAddress(to),
        value: ethers.toQuantity(weiValue),
        data: "0x",
        gasLimit: ethers.toQuantity(21000n),
        metadata: { 
          type: 'NATIVE_TRANSFER', 
          rawValue: weiValue.toString(),
          isEther: true 
        }
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode native transfer: ${err.message}`);
      throw err;
    }
  },

  /**
   * EIP-7702: Encodes Account Delegation.
   * Allows an EOA to run smart-contract code (2026 Standard).
   */
  async buildDelegationTx(proxyAddress: string) {
    try {
      // 0xef01 is the EIP-7702 prefix for delegation designators
      const delegationData = `0xef01${getAddress(proxyAddress).toLowerCase().slice(2)}`;
      
      return {
        to: null, // Self-delegation target
        data: delegationData,
        value: "0x0",
        gasLimit: ethers.toQuantity(100000n),
        metadata: { 
          type: 'EIP7702_DELEGATION', 
          delegate: proxyAddress 
        }
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to build EIP-7702 delegation: ${err.message}`);
      throw err;
    }
  },

  /**
   * Dynamic Fee Deduction Builder.
   * UPGRADED: Fixed-point math to prevent precision loss during high-volatility pricing.
   */
  async buildFeeTx(recipient: string, amountUsd: number, tokenPrice: number, tokenAddress: string, decimals: number = 18) {
    try {
      // Logic: (USD_AMT * 10^18) / PRICE_USD = TOKEN_AMT (in wei-precision)
      const usdInBigInt = BigInt(Math.floor(amountUsd * 1e6)); 
      const priceInBigInt = BigInt(Math.floor(tokenPrice * 1e6));
      
      const rawValue = (usdInBigInt * ethers.parseUnits('1', decimals)) / priceInBigInt;
      
      const iface = new ethers.Interface(["function transfer(address to, uint256 value)"]);
      const data = iface.encodeFunctionData("transfer", [getAddress(recipient), rawValue]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(95000n),
        metadata: { 
          type: 'PROTOCOL_FEE', 
          usdValue: amountUsd, 
          rawValue: rawValue.toString(),
          tokenPrice
        }
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to build fee tx: ${err.message}`);
      throw err;
    }
  },

  /**
   * ATOMIC SEQUENCE: Formats multiple TXs into a Flashbots-ready bundle.
   * Logic: Sorts by priority (Revokes first), normalizes hex, and injects nonce offsets.
   */
  formatBundle(transactions: any[], startNonce: number = 0) {
    const priorityMap: Record<string, number> = { 
      'REVOKE': 1, 
      'SECURITY_ALERT': 1,
      'EIP7702_DELEGATION': 1,
      'APPROVAL': 2, 
      'BURN': 3, 
      'RECOVERY': 3,
      'NATIVE_TRANSFER': 4,
      'PROTOCOL_FEE': 5 
    };

    const sorted = [...transactions].sort((a, b) => {
      const typeA = a.metadata?.type || 'UNKNOWN';
      const typeB = b.metadata?.type || 'UNKNOWN';
      return (priorityMap[typeA] || 99) - (priorityMap[typeB] || 99);
    });

    return sorted.map((tx, index) => {
      // Strict BigInt-to-Hex normalization for Ethers v6/v7 compliance
      const normalizedValue = tx.value && (typeof tx.value === 'bigint' || !tx.value.toString().startsWith('0x'))
        ? ethers.toQuantity(BigInt(tx.value))
        : (tx.value || "0x0");

      const normalizedGas = tx.gasLimit && (typeof tx.gasLimit === 'bigint' || !tx.gasLimit.toString().startsWith('0x'))
        ? ethers.toQuantity(BigInt(tx.gasLimit))
        : (tx.gasLimit || ethers.toQuantity(200000n));

      return {
        ...tx,
        to: tx.to ? getAddress(tx.to) : null,
        value: normalizedValue,
        gasLimit: normalizedGas,
        nonce: startNonce + index,
        chainId: tx.chainId ? BigInt(tx.chainId) : undefined
      };
    });
  }
};

export default txBuilder;
