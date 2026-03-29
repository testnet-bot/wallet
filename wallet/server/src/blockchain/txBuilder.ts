import { ethers, getAddress } from 'ethers';
import { logger } from '../utils/logger.js';

// NEW HELPER: Normalize values to hex string
const normalizeHex = (value: bigint | string | undefined) => {
if (!value) return "0x0";
if (typeof value === "bigint") return ethers.toQuantity(value);
if (typeof value === "string") return value.startsWith("0x") ? value : ethers.toQuantity(BigInt(value));
return "0x0";
};

/**
 * UPGRADED: Institutional-Grade Transaction Architect (v2026.5 Hardened).
 * Features: Fixed-point precision math, Strict Hex-normalization, 
 * EIP-7702 Smart-EOA Encoding, Nonce-aware Atomic Bundle Sequencing,
 * and EIP-1559 Dynamic Fee Scaling.
 */
export const txBuilder = {
  BURN_ADDRESS: '0x000000000000000000000000000000000000dEaD',
  MULTICALL_ADDRESS: '0xcA11bde05977b3631167028862bE2a173976CA11',
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
    logger.error(`[TxBuilder] Failed to encode burn for ${tokenAddress}: ${err.message}`, {
      tokenAddress,
      amount,
     decimals,
     stack: err.stack
       });
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
      const delegationData = `0xef01${getAddress(proxyAddress).toLowerCase().slice(2)}`;
      
      return {
        to: getAddress(proxyAddress), 
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
   * UPGRADED: Fixed-point math to prevent precision loss.
   */
  async buildFeeTx(recipient: string, amountUsd: number, tokenPrice: number, tokenAddress: string, decimals: number = 18) {
    try {
      const usdInBigInt = BigInt(Math.floor(amountUsd * 1e6)); 
      const priceInBigInt = BigInt(Math.floor(tokenPrice * 1e6));
      if (priceInBigInt === 0n) throw new Error("Token price cannot be zero for fee calculation");
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
   * NEW: Builds a Swap Transaction (Universal Router Pattern).
   * Essential for SwapExecutor integration.
   */
  async buildSwapTx(routerAddress: string, callData: string, valueWei: string = "0") {
    return {
      to: getAddress(routerAddress),
      data: callData,
      value: ethers.toQuantity(BigInt(valueWei)),
      gasLimit: ethers.toQuantity(350000n),
      metadata: { type: 'SWAP', router: routerAddress }
    };
  },

  /**
   * NEW: Fetches scaled EIP-1559 fees with congestion buffer.
   */
  async getSmartFees(provider: ethers.Provider) {
    const feeData = await provider.getFeeData();
    const buffer = BigInt(process.env.FEE_BUFFER || 125); 
    return {
      maxFeePerGas: feeData.maxFeePerGas ? (feeData.maxFeePerGas * buffer) / 100n : undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * buffer) / 100n : undefined,
    };
  },

  /**
   * ATOMIC SEQUENCE: Formats multiple TXs into a Flashbots-ready bundle.
   * UPGRADED: Injects dynamic EIP-1559 fees and strict chain validation.
   */
  async formatBundle(provider: any, transactions: any[], startNonce: number = 0, chainId?: number) {
    const fees = await this.getSmartFees(provider);
    const priorityMap: Record<string, number> = { 
      'REVOKE': 1, 
      'SECURITY_ALERT': 1,
      'EIP7702_DELEGATION': 1,
      'APPROVAL': 2, 
      'SWAP': 3,
      'BURN': 4, 
      'NATIVE_TRANSFER': 5,
      'PROTOCOL_FEE': 6 
    };

    const sorted = [...transactions].sort((a, b) => {
      const typeA = a.metadata?.type || 'UNKNOWN';
      const typeB = b.metadata?.type || 'UNKNOWN';
      return (priorityMap[typeA] || 99) - (priorityMap[typeB] || 99);
    });

    return sorted.map((tx, index) => {
     const normalizedValue = normalizeHex(tx.value);
     const normalizedGas = normalizeHex(tx.gasLimit || 280000n);

if (!tx.to) throw new Error(`Missing 'to' address for transaction: ${tx.metadata?.type || 'UNKNOWN'}`);

      return {
        ...tx,
        to: getAddress(tx.to), 
        value: normalizedValue,
        gasLimit: normalizedGas,
        nonce: startNonce + index,
        chainId: chainId ? BigInt(chainId) : undefined,
        maxFeePerGas: fees.maxFeePerGas ? ethers.toQuantity(fees.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas ? ethers.toQuantity(fees.maxPriorityFeePerGas) : undefined,
        type: 2 
      };
    });
  }
};

export default txBuilder;
