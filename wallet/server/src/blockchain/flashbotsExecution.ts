import { ethers as ethersLegacy } from 'ethers-v6-legacy'; 
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import { logger } from '../utils/logger.js';

export interface BundleResult {
  success: boolean;
  error?: string;
  txHash?: string;
}

/**
 * Tier 1 Private Execution Engine
 * Bridges modern app logic to the legacy Flashbots Relay.
 * Fixes: Runtime 404 by ensuring the Relay URL is strictly formatted.
 */
export const flashbotsExecution = {
  async executeBundle(
    userPrivateKey: string, 
    rpcUrl: string, 
    payloads: any[], 
    chainId: number
  ): Promise<BundleResult> {
    try {
      const provider = new ethersLegacy.JsonRpcProvider(rpcUrl);
      const userWallet = new ethersLegacy.Wallet(userPrivateKey, provider);
      const authSigner = ethersLegacy.Wallet.createRandom();

      // Official Relay Endpoints
      const relayUrl = chainId === 1 
        ? 'https://relay.flashbots.net' 
        : 'https://relay-sepolia.flashbots.net';

      const flashbotsProvider = await FlashbotsBundleProvider.create(
        provider as any,
        authSigner as any,
        relayUrl
      );

      const signedBundle: any[] = payloads.map((tx, i) => ({ 
        signer: userWallet,
        transaction: {
          to: tx.to,
          data: tx.data,
          value: tx.value || 0n,
          gasLimit: tx.gasLimit || 150000n,
          chainId: chainId,
          type: 2 ,
          nonce: baseNonce + i,
        }
      }));

      const baseNonce = await provider.getTransactionCount(userWallet.address);
      const targetBlock = (await provider.getBlockNumber()) + 1;
     
      // Note: Simulation often returns 404 on public RPCs. 
      // In production with Alchemy, this will resolve.
      const simulation = await flashbotsProvider.simulate(signedBundle, targetBlock);
      if ('error' in simulation) {
        throw new Error(`Simulation Failed: ${simulation.error.message}`);
      }

      const bundleSubmission = await flashbotsProvider.sendBundle(signedBundle, targetBlock);
      if ('error' in bundleSubmission) {
        throw new Error(bundleSubmission.error.message);
      }

      const waitResponse = await bundleSubmission.wait();
      
      if (waitResponse === (FlashbotsBundleResolution.BundleIncluded as any)) {
        return { success: true, txHash: 'Included' };
      } else {
        return { success: false, error: 'Bundle not included in block' };
      }

    } catch (err: any) {
      if (err.message.includes("404")) {
          logger.error(`[Flashbots] Relay 404: Chain ${chainId} requires a Flashbots-compatible RPC (Alchemy/Infura).`);
      }
      return { success: false, error: err.message };
    }
  }
};
