import { getAddress, parseUnits, formatUnits } from 'ethers';
import { getProvider } from '../../blockchain/provider.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { logger } from '../../utils/logger.js';

export interface BurnReport {
  chain: string;
  tokenCount: number;
  status: 'READY' | 'FAILED';
  estimatedGasNative: string;
  burnAddress: string;
  tokens: string[];
}

/**
 * Premium Batch Burn Engine
 * Prepares tokens for mass-deletion by routing them to the verified Dead Address.
 */
export async function batchBurnTokens(walletAddress: string, tokens: any[]): Promise<BurnReport[]> {
  const safeAddr = getAddress(walletAddress);
  const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

  // 1. Group spam tokens by chain for batching
  const chainGroups = tokens.reduce((acc: any, token: any) => {
    const chainName = token.chain;
    if (!acc[chainName]) acc[chainName] = [];
    acc[chainName].push(token);
    return acc;
  }, {});

  const burnTasks = Object.keys(chainGroups).map(async (chainName): Promise<BurnReport | null> => {
    const group = chainGroups[chainName];
    const chain = EVM_CHAINS.find(c => c.name === chainName);
    
    if (!chain) return null;

    try {
      const provider = getProvider(chain.rpc);
      const feeData = await provider.getFeeData();
      
      // Heavy Gas Estimation
      // Transferring to a dead address is cheaper than a swap, but spam contracts 
      // can be "heavy". We allocate 100k gas per token for safety.
      const currentGasPrice = feeData.gasPrice || parseUnits('20', 'gwei');
      const totalGasLimit = BigInt(group.length) * 100000n;
      const estimatedCostWei = currentGasPrice * totalGasLimit;

      logger.info(`[BurnEngine] Prepared ${group.length} tokens on ${chainName} for ${safeAddr}`);

      return {
        chain: chainName,
        tokenCount: group.length,
        status: 'READY',
        estimatedGasNative: formatUnits(estimatedCostWei, 18),
        burnAddress: BURN_ADDRESS,
        tokens: group.map((t: any) => t.symbol)
      };

    } catch (err: any) {
      logger.error(`[BurnEngine] Failed to prepare burn for ${chainName}: ${err.message}`);
      return {
        chain: chainName,
        tokenCount: group.length,
        status: 'FAILED',
        estimatedGasNative: '0',
        burnAddress: BURN_ADDRESS,
        tokens: group.map((t: any) => t.symbol)
      };
    }
  });

  const results = await Promise.all(burnTasks);
  return results.filter((r): r is BurnReport => r !== null);
}
