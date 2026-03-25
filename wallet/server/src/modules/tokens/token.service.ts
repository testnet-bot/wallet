import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { classifyToken } from './spamDetector.js';
import { logger } from '../../utils/logger.js';
import crypto from 'crypto';
import pLimit from 'p-limit';

/**
 * UPGRADED: Institutional Token Intelligence Engine (v2026.5).
 * Optimized for: Wallet Service Compatibility and Strict Type Safety.
 */
export const tokenService = {
  cache: new Map<string, { data: any, timestamp: number }>(),
  locks: new Set<string>(), 
  CACHE_TTL: Number(process.env.TOKEN_CACHE_TTL) || 1000 * 60 * 10, 
  MAX_CACHE_SIZE: 2000, 

  async fetchWalletTokens(address: string, forceRefresh = false) {
    const safeAddr = address.toLowerCase();
    const traceId = `TS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    if (this.locks.has(safeAddr)) {
      logger.warn(`[TokenService][${traceId}] Scan in progress for ${safeAddr}`);
      await new Promise(r => setTimeout(r, 1500));
    }

    if (!forceRefresh && this.cache.has(safeAddr)) {
      const cached = this.cache.get(safeAddr)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return { ...cached.data, cached: true, traceId };
      }
      this.cache.delete(safeAddr);
    }

    try {
      this.locks.add(safeAddr);
      const rawAssets = await scanGlobalWallet(safeAddr);
      const categorized = await this.categorizeAssets(rawAssets, traceId);

      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) this.cache.delete(oldestKey);
      }

      this.cache.set(safeAddr, { data: categorized, timestamp: Date.now() });
      return { ...categorized, cached: false, traceId };

    } catch (err: any) {
      logger.error(`[TokenService][${traceId}] Asset Audit Failed: ${err.message}`);
      throw err;
    } finally {
      this.locks.delete(safeAddr);
    }
  },

  async categorizeAssets(rawAssets: any[], traceId: string = 'INTERNAL') {
    const limit = pLimit(20); 
    
    const results = await Promise.allSettled(
      rawAssets.map((asset) => 
        limit(async () => {
          try {
            const analysis = await classifyToken(asset) as any;
            
            const isSuspicious = analysis.status === 'spam' || 
                                analysis.isHoneypot || 
                                (parseFloat(asset.balance) > 0 && !analysis.usdValue && !asset.logo);
            
            return { 
              ...asset, 
              ...analysis,
              isSuspicious,
              // Fixed: Dynamic property check to satisfy TypeScript
              hasTransferHook: !!(analysis.hasHooks || analysis.hasTransferHook),
              lastAudit: new Date().toISOString(),
              isRecoverable: analysis.canRecover && !isSuspicious && !analysis.isBlacklisted
            };
          } catch (e: any) {
            return { ...asset, status: 'audit_failed', usdValue: 0, isRecoverable: false };
          }
        })
      )
    );

    const audited = results
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter(Boolean) as any[];

    const totalValue = audited.reduce((sum, a) => sum + (Number(a.usdValue) || 0), 0);
    const recoverable = audited.filter(a => a.isRecoverable);
    const recoverableValue = recoverable.reduce((sum, a) => sum + (Number(a.usdValue) || 0), 0);

    const riskRatio = totalValue > 0 ? (recoverableValue / totalValue) : 1;
    const healthStatus = riskRatio < 0.3 ? 'CRITICAL_EXPOSURE' : riskRatio < 0.7 ? 'DEGRADED' : 'OPTIMAL';

    return {
      summary: {
        totalAssets: audited.length,
        totalUsdValue: Number(totalValue.toFixed(2)),
        recoverableCount: recoverable.length,
        recoverableValue: Number(recoverableValue.toFixed(2)),
        auditTimestamp: Date.now(),
        healthStatus,
        riskScore: Number((riskRatio * 100).toFixed(0)),
        spamCount: audited.filter(a => a.status === 'spam').length,
        dustCount: audited.filter(a => a.status === 'dust').length
      },
      groups: {
        liquid: recoverable.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0)),
        clean: audited.filter(a => !a.isSuspicious && a.status !== 'dust' && a.status !== 'spam'),
        dust: audited.filter(a => a.status === 'dust'),
        threats: audited.filter(a => a.status === 'malicious' || a.isHoneypot || a.isBlacklisted),
        spam: audited.filter(a => a.status === 'spam' || (a.isSuspicious && a.status !== 'malicious'))
      },
      all: audited,
      inventory: audited 
    };
  }
};
