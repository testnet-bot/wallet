import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

export type RevenueSource = 'RESCUE' | 'BURN' | 'SUBSCRIPTION' | 'AUTO_RECOVERY' | 'AUTO_BURN';

/**
 * Tier 1 Revenue & Treasury Intelligence
 * Handles real-time PnL (Profit & Loss) by tracking fees vs gas overhead.
 */
export const revenueTracker = {
  /**
   * Tracks a successful fee extraction with Gas Overhead awareness.
   */
  async trackFee(
    wallet: string, 
    amountUsd: number, 
    type: RevenueSource, 
    chain: string,
    gasSpentUsd: number = 0,
    txHash?: string
  ) {
    const safeAddr = wallet.toLowerCase();
    
    try {
      // 1. PERSISTENCE: Log into the Payment Ledger
      const netProfit = amountUsd - gasSpentUsd;

      const entry = await prisma.payment.create({
        data: {
          wallet: safeAddr,
          amount: amountUsd, // Gross Fee
          chain: chain,
          txHash: txHash || `INTERNAL_${Date.now()}`,
          confirmed: true,
          createdAt: new Date()
        }
      });

      // 2. INTELLIGENCE: Attribution Logging
      // We log the operational overhead to calculate true Protocol ROI
      logger.info(`[Treasury] Fee: $${amountUsd.toFixed(2)} | Gas Cost: $${gasSpentUsd.toFixed(2)} | Net: $${netProfit.toFixed(2)}`);

      // 3. USER METRICS: Close the loop on Wallet Intelligence
      await prisma.wallet.update({
        where: { address: safeAddr },
        data: { lastSynced: new Date() }
      }).catch(() => logger.warn(`[Revenue] Wallet sync skipped for ${safeAddr}`));

      return { ...entry, netProfit };
    } catch (err: any) {
      logger.error(`[Revenue] Critical Failure: ${err.message}`);
      return null;
    }
  },

  /**
   * ADVANCED ANALYTICS: Full Financial Health Report
   * Includes Volume, Average Ticket Size, and Chain Dominance.
   */
  async getFullProtocolStats() {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [stats, dailyVolume, chainPerformance] = await Promise.all([
        prisma.payment.aggregate({
          where: { confirmed: true },
          _sum: { amount: true },
          _count: { id: true },
          _avg: { amount: true }
        }),
        prisma.payment.aggregate({
          where: { confirmed: true, createdAt: { gte: last24h } },
          _sum: { amount: true }
        }),
        prisma.payment.groupBy({
          by: ['chain'],
          where: { confirmed: true },
          _sum: { amount: true },
          _count: { id: true },
          orderBy: { _sum: { amount: 'desc' } }
        })
      ]);

      return {
        allTimeRevenue: stats._sum.amount || 0,
        volume24h: dailyVolume._sum.amount || 0,
        transactionCount: stats._count.id,
        averageFeePerTx: stats._avg.amount || 0,
        performanceByChain: chainPerformance.map(c => ({
          chain: c.chain,
          revenue: c._sum.amount,
          txCount: c._count.id,
          marketShare: ((c._sum.amount || 0) / (stats._sum.amount || 1) * 100).toFixed(2) + '%'
        }))
      };
    } catch (err: any) {
      logger.error(`[Revenue] Analytics failed: ${err.message}`);
      return null;
    }
  },

  /**
   * WHALE RADAR: Identifies top 1% of protocol contributors
   */
  async getTopContributors(limit: number = 10) {
    return await prisma.payment.groupBy({
      by: ['wallet'],
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit
    });
  }
};
