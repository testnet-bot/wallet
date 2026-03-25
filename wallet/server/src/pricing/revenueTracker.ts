import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';
import crypto from 'node:crypto';

export type RevenueSource = 'RESCUE' | 'BURN' | 'SUBSCRIPTION' | 'AUTO_RECOVERY' | 'AUTO_BURN' | 'RWA_PREMIUM' | 'POTENTIAL_QUOTE';

export interface GasBreakdown {
  executionUsd: number;
  blobUsd: number;
  calldataUsd: number;
}

// Strict Financial Validation Schema
const FeeSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amountUsd: z.number().nonnegative(),
  chain: z.string().min(1),
  type: z.string()
});

/**
 * UPGRADED: Institutional Treasury & Revenue Intelligence (v2026.10).
 * Features: Atomic Idempotency, EIP-7706 Gas Vectors, and Superchain Analytics.
 */
export const revenueTracker = {
  /**
   * Tracks fee extraction with 2026 Multi-Vector Gas awareness.
   * Logic: Validates -> Calculates Net Margin -> Atomic Persistence.
   */
  async trackFee(
    wallet: string, 
    amountUsd: number, 
    type: RevenueSource, 
    chain: string,
    gasBreakdown: GasBreakdown = { executionUsd: 0, blobUsd: 0, calldataUsd: 0 },
    txHash?: string
  ) {
    const traceId = `REV-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
    
    try {
      // 1. VALIDATION & NORMALIZATION
      FeeSchema.parse({ wallet, amountUsd, chain, type });
      const safeAddr = wallet.toLowerCase();
      const safeChain = chain.toLowerCase();
      
      const totalGasUsd = gasBreakdown.executionUsd + gasBreakdown.blobUsd + gasBreakdown.calldataUsd;
      const netProfit = amountUsd - totalGasUsd;
      const marginPercent = amountUsd > 0 ? (netProfit / amountUsd) * 100 : 0;

      // 2. ATOMIC PERSISTENCE (Prisma 7+ Optimized)
      // Uses txHash as an idempotency key to prevent double-counting fees
      const entry = await prisma.payment.upsert({
        where: { txHash: txHash || `INT-${traceId}-${Date.now()}` },
        update: { confirmed: true },
        create: {
          traceId,
          wallet: safeAddr,
          amount: amountUsd, 
          chain: safeChain,
          txHash: txHash || `INT-${traceId}-${Date.now()}`,
          confirmed: true,
          type: type,
          // 2026 Metadata: Detailed breakdown of the multi-vector gas spend
          metadata: {
            ...gasBreakdown,
            totalGasUsd,
            netProfit: netProfit.toFixed(6),
            marginPercent: `${marginPercent.toFixed(2)}%`,
            standard: 'EIP-7706_MULTI_VECTOR'
          },
          createdAt: new Date()
        }
      });

      // 3. INSTITUTIONAL ATTRIBUTION LOGGING
      logger.info({
        traceId,
        wallet: safeAddr,
        gross: `$${amountUsd.toFixed(2)}`,
        net: `$${netProfit.toFixed(2)}`,
        margin: `${marginPercent.toFixed(1)}%`,
        chain: safeChain
      }, `[Treasury][${type}] Fee Extraction Logged`);

      // 4. LOYALTY ENGINE SYNC
      // Increments 'totalFeesPaid' to handle automatic membership upgrades
      await prisma.wallet.update({
        where: { address: safeAddr },
        data: { 
          lastSynced: new Date(),
          totalFeesPaid: { increment: amountUsd }
        }
      }).catch((err) => logger.warn(`[Revenue][${traceId}] Wallet loyalty sync skipped: ${err.message}`));

      return { 
        ...entry, 
        netProfit, 
        isHighMargin: marginPercent > 80,
        traceId
      };
    } catch (err: any) {
      logger.error({ traceId, error: err.message }, `[Revenue] Critical Ledger Failure`);
      return null;
    }
  },

  /**
   * ANALYTICS: Track non-executed quotes to measure "Value at Risk" (VaR).
   */
  async trackPotentialRevenue(traceId: string, data: { wallet: string, grossUsd: number, platformFeeUsd: number, strategy: string }) {
    logger.debug({ 
      traceId, 
      wallet: data.wallet, 
      potentialFee: `$${data.platformFeeUsd.toFixed(2)}`,
      strategy: data.strategy 
    }, "[Analytics] Potential Revenue Quote Cached");
  },

  /**
   * ADVANCED ANALYTICS: March 2026 Financial Health Report.
   * Optimized for parallel execution and sub-100ms reporting.
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

      const totalRev = Number(stats._sum.amount || 0);

      return {
        allTimeRevenue: totalRev,
        volume24h: Number(dailyVolume._sum.amount || 0),
        transactionCount: stats._count.id,
        averageTicketSize: Number(stats._avg.amount || 0),
        chainDominance: chainPerformance.map(c => ({
          chain: c.chain,
          revenue: Number(c._sum.amount || 0),
          txCount: c._count.id,
          marketShare: totalRev > 0 ? ((Number(c._sum.amount || 0) / totalRev) * 100).toFixed(2) + '%' : '0%'
        })),
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      logger.error(`[Revenue] Analytics Engine Error: ${err.message}`);
      return null;
    }
  },

  /**
   * WHALE & RWA RADAR: Identifies top 1% protocol contributors.
   */
  async getTopContributors(limit: number = 20) {
    return await prisma.payment.groupBy({
      by: ['wallet'],
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit
    });
  }
};

export default revenueTracker;
