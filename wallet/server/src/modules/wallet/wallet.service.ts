import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { tokenService } from '../tokens/token.service.js';
import { prisma } from '../../config/database.js';

export const walletService = {
  /**
   * Performs a full cross-chain scan, categorizes assets, and updates the database.
   * High-performance implementation with parallel classification and sync.
   */
  async scanFull(address: string) {
    const walletAddress = address.toLowerCase();

    // 1. Get raw on-chain data from all providers
    const rawAssets = await scanGlobalWallet(walletAddress);

    // 2. Process through the heavy-duty classification engine
    // This uses the method we just added to tokenService
    const categorizedData = await tokenService.categorizeAssets(rawAssets);

    // 3. Dynamic Database Sync
    // Upserting the wallet summary to avoid redundant DB records
    await prisma.wallet.upsert({
      where: { address: walletAddress },
      update: { 
        lastSynced: new Date(),
        balance: categorizedData.summary.totalUsdValue.toString() 
      },
      create: { 
        address: walletAddress,
        balance: categorizedData.summary.totalUsdValue.toString()
      }
    });

    // 4. Return the "Premium" structure the controller expects
    // Note: 'all' contains the full classified list from tokenService
    return {
      wallet: walletAddress,
      summary: categorizedData.summary,
      groups: categorizedData.groups,
      all: categorizedData.all
    };
  }
};
