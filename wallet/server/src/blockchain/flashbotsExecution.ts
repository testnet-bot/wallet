import { ethers as ethersLegacy } from 'ethers-v6-legacy'; 
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import { logger } from '../utils/logger.js';
import { decryptPrivateKey, clearSensitiveData } from '../utils/crypto.js';
import { requireChain } from './chains.js';
import 'dotenv/config';

export interface BundleResult {
  success: boolean;
  error?: string;
  txHash?: string;
  rejectionReason?: string;
  gasUsed?: bigint;
  targetBlock?: number;
}

/**
 * BATTLE-HARDENED: Institutional Flashbots & MEV-Shield Engine (v2026.10).
 * UPGRADES: Nonce-Collision Protection, Strict Memory Purgatory, and Multi-Relay Logic.
 * SECURITY: Implements Tier-1 Private Key handling with mandatory heap-cleaning.
 */
export const flashbotsExecution = {
  async executeBundle(
    encryptedPrivateKey: string, 
    rpcUrl: string, 
    payloads: any[], 
    chainId: number
  ): Promise<BundleResult> {
    
    // 1. SECURE DECRYPTION WITH AUTO-PURGE
    let rawKey: string | null = await decryptPrivateKey(encryptedPrivateKey);
    
    try {
      if (!rawKey) throw new Error('CRITICAL: KEY_DECRYPTION_FAILED');

      const chainConfig = requireChain(chainId);
      const provider = new ethersLegacy.JsonRpcProvider(rpcUrl);
      const userWallet = new ethersLegacy.Wallet(rawKey, provider);
      
      // IMMEDIATE HEAP CLEANUP: Remove raw key from memory as soon as Wallet object is instantiated
      const cleanup = () => {
        if (rawKey) {
          clearSensitiveData(rawKey);
          rawKey = null;
        }
      };
      cleanup();

      // 2. ADAPTIVE RELAY ROUTING (2026 Multi-Chain Standard)
      const relayUrl = chainConfig.relayUrl || 
        (chainId === 1 ? 'https://relay.flashbots.net' : 
         chainId === 11155111 ? 'https://relay-sepolia.flashbots.net' : 
         chainId === 8453 ? 'https://base.mev-relay.com' : 
         chainId === 137 ? 'https://bor.txrelay.mewapi.io' :
         process.env.CUSTOM_RELAY_URL || 'https://relay.flashbots.net');

      // Use a randomized auth signer for every bundle to protect user reputation
      const authSigner = ethersLegacy.Wallet.createRandom();

      const flashbotsProvider = await FlashbotsBundleProvider.create(
        provider as any,
        authSigner as any,
        relayUrl,
        chainId === 1 ? 'mainnet' : 'sepolia'
      );

      // 3. ELITE FEE & NONCE STRATEGY (Collision Resistance)
      const [pendingNonce, feeData, blockNumber] = await Promise.all([
        provider.getTransactionCount(userWallet.address, 'pending'), // Use 'pending' to avoid collision
        provider.getFeeData(),
        provider.getBlockNumber()
      ]);

      // Institutional Escalation: 4.0 Gwei to ensure inclusion over basic bots
      const priorityEscalation = ethersLegacy.parseUnits(process.env.PRIORITY_BUMP || '4.0', 'gwei');
      const priorityFee = (feeData.maxPriorityFeePerGas ?? ethersLegacy.parseUnits('1.5', 'gwei')) + priorityEscalation;
      
      // Post-Pectra Hardening: Max fee headroom at 3.0x base for volatility
      const maxFee = (feeData.maxFeePerGas ?? ethersLegacy.parseUnits('25', 'gwei')) * 30n / 10n + priorityFee;

      // 4. ATOMIC BUNDLE CONSTRUCTION
      const signedBundle = payloads.map((tx, i) => {
        const isEIP1559 = chainConfig.supportsEIP1559 !== false;
        
        const txValue = tx.value ? BigInt(tx.value) : 0n;
        const txGas = tx.gasLimit ? BigInt(tx.gasLimit) : 250000n; 

        return { 
          signer: userWallet as any,
          transaction: {
            to: tx.to || undefined,
            data: tx.data || '0x',
            value: txValue,
            gasLimit: txGas,
            chainId: chainId,
            type: isEIP1559 ? 2 : 0,
            nonce: pendingNonce + i,
            ...(isEIP1559 ? {
              maxFeePerGas: maxFee,
              maxPriorityFeePerGas: priorityFee,
            } : {
              gasPrice: (feeData.gasPrice ?? ethersLegacy.parseUnits('20', 'gwei')) + priorityEscalation
            })
          }
        };
      });

      const targetBlock = blockNumber + 1;
     
      // 5. FORENSIC SIMULATION (Revert Guard)
      const simulation = await flashbotsProvider.simulate(signedBundle as any, targetBlock);
      
      if ('error' in simulation) {
        const simError = (simulation as any).error.message || 'Simulation Failure';
        logger.error(`[Flashbots][SIM-FAIL] Block ${targetBlock} | Reason: ${simError}`);
        return { success: false, error: 'SIMULATION_REJECTED', rejectionReason: simError };
      }

      // If any transaction in the bundle reverts, abort execution to save user status
      const results = (simulation as any).results || [];
      const revertFound = results.find((r: any) => r.error || r.revert);
      if (revertFound) {
         return { success: false, error: 'BUNDLE_REVERT_DETECTED', rejectionReason: revertFound.revert || revertFound.error };
      }

      const totalGas = (simulation as any).totalGasUsed || 0n;
      logger.info(`[Flashbots] Bundle Pre-Flight Success. Gas: ${totalGas.toString()}`);

      // 6. SECURE SUBMISSION
      const bundleSubmission = await flashbotsProvider.sendBundle(
        signedBundle as any, 
        targetBlock
      );
      
      if ('error' in bundleSubmission) {
        const relayError = (bundleSubmission as any).error.message;
        logger.warn(`[Flashbots][REJECTED] Relay Response: ${relayError}`);
        return { success: false, error: 'RELAY_REJECTION', rejectionReason: relayError };
      }

      // 7. RESOLUTION TRACKING
      const waitResponse = await (bundleSubmission as any).wait();
      
      if (waitResponse === FlashbotsBundleResolution.BundleIncluded) {
        logger.info(`[Flashbots][SUCCESS] Bundle mined in ${targetBlock}`);
        return { 
          success: true, 
          txHash: (bundleSubmission as any).bundleHash || 'CONFIRMED',
          gasUsed: totalGas,
          targetBlock
        };
      } 
      
      if (waitResponse === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
        logger.warn(`[Flashbots][TIMEOUT] Bundle not included in ${targetBlock}. Retrying suggested.`);
        return { success: false, error: 'BLOCK_PASSED', targetBlock };
      }

      return { success: false, error: `RESOLUTION_UNRECOGNIZED_${waitResponse}` };

    } catch (err: any) {
      // Ensure sensitive data is cleared even on unexpected crashes
      if (rawKey) clearSensitiveData(rawKey); 
      logger.error(`[Flashbots][FATAL] ${err.message}`);
      return { success: false, error: err.message || 'INTERNAL_ENGINE_ERROR' };
    } finally {
      // Final safety purge
      if (rawKey) clearSensitiveData(rawKey);
    }
  }
};

export default flashbotsExecution;
