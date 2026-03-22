import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { tokenService } from '../tokens/token.service.js';
import { securityService } from '../security/security.service.js';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

/**
 * Tier 1 Wallet Intelligence Service
 * The "Brain" that connects Scanning, Security, and Database Persistence.
 */
export const walletService = {
  /**
   * Performs a full cross-chain intelligence scan.
   * Orchestrates Token Discovery + Security Risk Assessment + DB Sync.
   */
  async scanFull(address: string) {
    const walletAddress = address.toLowerCase();

    try {
      // 1. Parallel Intelligence Gathering (Speed Optimized)
      const [rawAssets, securityAllowances] = await Promise.all([
        scanGlobalWallet(walletAddress),
        securityService.scanApprovals(walletAddress)
      ]);

      // 2. Heavy-Duty Classification & Risk Scoring
      const categorizedData = await tokenService.categorizeAssets(rawAssets);
      
      // Calculate Wallet Health Score (0-100)
      // Deducts points for Critical Risks, High Allowances, and Spam count
      const healthScore = this.calculateHealthScore(categorizedData, securityAllowances);
      const riskLevel = healthScore < 40 ? 'CRITICAL' : healthScore < 75 ? 'MEDIUM' : 'LOW';

      // 3. Dynamic Database Sync (Persistence Layer)
      const wallet = await prisma.wallet.upsert({
        where: { address: walletAddress },
        update: { 
          lastSynced: new Date(),
          balance: categorizedData.summary.totalUsdValue.toString(),
          healthScore: healthScore,
          riskLevel: riskLevel
        },
        create: { 
          address: walletAddress,
          balance: categorizedData.summary.totalUsdValue.toString(),
          healthScore: healthScore,
          riskLevel: riskLevel
        }
      });

      // 4. Premium Intelligence Payload
      return {
        wallet: walletAddress,
        intelligence: {
          healthScore,
          riskLevel,
          lastSynced: wallet.lastSynced
        },
        summary: {
          ...categorizedData.summary,
          openApprovals: securityAllowances.length,
          criticalRisks: securityAllowances.filter(a => a.riskLevel === 'CRITICAL').length
        },
        groups: categorizedData.groups,
        security: securityAllowances,
        all: categorizedData.all
      };
    } catch (err: any) {
      logger.error(`[WalletService] Critical scan failure for ${walletAddress}: ${err.message}`);
      throw err;
    }
  },

  /**
   * INTELLIGENCE: Proactive Health Scoring Algorithm
   * Deducts for: Malicious Spenders (-50), Infinite Approvals (-10), High Spam Count (-5)
   */
  calculateHealthScore(data: any, allowances: any[]): number {
    let score = 100;

    // Penalty: Malicious Spenders found by SecurityService
    const maliciousCount = allowances.filter(a => a.isMalicious).length;
    score -= (maliciousCount * 50);

    // Penalty: High-Risk (Infinite) Approvals
    const highRiskApprovals = allowances.filter(a => a.riskLevel === 'HIGH').length;
    score -= (highRiskApprovals * 10);

    // Penalty: High Spam/Dust volume
    if (data.summary.spamCount > 10) score -= 10;
    if (data.summary.dustCount > 20) score -= 5;

    return Math.max(0, score);
  },

  /**
   * INTELLIGENCE: Quick Cache Check
   * Returns stored data if last synced within 5 minutes to save RPC costs.
   */
  async getCachedWallet(address: string) {
    const wallet = await prisma.wallet.findUnique({ where: { address: address.toLowerCase() } });
    if (!wallet) return null;

    const cacheLimit = 5 * 60 * 1000; // 5 Minutes
    const isFresh = (Date.now() - new Date(wallet.lastSynced).getTime()) < cacheLimit;
    
    return { wallet, isFresh };
  }
};
