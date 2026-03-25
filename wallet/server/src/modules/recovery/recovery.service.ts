import { detectDustTokens } from './dustCalculator.js';
import { swapExecutor } from './swapExecutor.js';
import { rulesEngine } from '../automation/rulesEngine.js';
import { feeCalculator } from '../../pricing/feeCalculator.js';
import { flashbotsExecution } from '../../blockchain/flashbotsExecution.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { getProvider } from '../../blockchain/provider.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/database.js';
import { getAddress, ethers } from 'ethers';
import crypto from 'crypto';

/**
 * UPGRADED: Production-Grade Recovery Intelligence Service (Finance Grade).
 * Features: Nonce-Safe Sequencing, Multi-Chain MEV Protection, and Revenue Attribution.
 */
export const recoveryService = {
  /**
   * Orchestrates the migration of profitable "dust" assets to safety.
   * Logic: Identify -> Audit -> Sequence -> Private Execution.
   */
  async executeDustRecovery(walletAddress: string, encryptedPrivateKey?: string) {
    if (!walletAddress) throw new Error('VALID_WALLET_REQUIRED');
    
    const startTime = Date.now();
    const safeAddr = getAddress(walletAddress).toLowerCase();
    const traceId = `REC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    try {
      logger.info(`[Recovery][${traceId}] Initiating high-value rescue for ${safeAddr}`);

      // 1. INTELLIGENCE GATHERING & ELIGIBILITY
      const [dustReports, membership] = await Promise.all([
        detectDustTokens(safeAddr),
        rulesEngine.getMembershipTier(safeAddr)
      ]);

      const profitableTokens = (dustReports as any[]).filter(t => t.isProfitable);

      if (profitableTokens.length === 0) {
        logger.info(`[Recovery][${traceId}] No profitable recovery targets found for ${safeAddr}`);
        return { 
          success: true, 
          traceId,
          message: 'No profitable recovery targets found.', 
          data: { tokensFound: 0, plans: [] } 
        };
      }

      // 2. FINANCIAL PROFILING & RISK ASSESSMENT
      const totalGrossUsd = profitableTokens.reduce((sum, t) => sum + (Number(t.asset?.usdValue) || 0), 0);
      const avgRiskScore = profitableTokens.reduce((sum, t) => sum + (Number(t.asset?.score) || 100), 0) / profitableTokens.length;

      // 3. DYNAMIC FEE ENGINE
      const feeContext = {
        amountUsd: totalGrossUsd,
        isGasless: true, 
        isNftHolder: membership.isEligible,
        tier: membership.tier,
        riskScore: 100 - avgRiskScore 
      };

      const feeReport = (feeCalculator as any).calculateRescueFee(feeContext);

      // REAL MONEY GUARD: Profitability Audit
      const isViable = await rulesEngine.isRecoveryProfitable(250000n, 35, totalGrossUsd);

      if (!isViable && !membership.isEligible) {
        logger.warn(`[Recovery][${traceId}] Rescue aborted: Unprofitable for ${safeAddr}`);
        return { success: false, traceId, error: 'INSUFFICIENT_VALUE', message: 'Dust value below profitable threshold.' };
      }

      // 4. STRATEGY ORCHESTRATION
      const rescuePlans = await (swapExecutor as any).getSmartRescueQuote(safeAddr, profitableTokens);
      const executionResults: any[] = [];

      // 5. ATOMIC EXECUTION (Serial & Private)
      if (encryptedPrivateKey && rescuePlans.length > 0) {
        const chainGroups = rescuePlans.reduce((acc: any, plan: any) => {
          acc[plan.chain] = acc[plan.chain] || [];
          acc[plan.chain].push(plan);
          return acc;
        }, {});

        for (const chainName of Object.keys(chainGroups)) {
          const chain = EVM_CHAINS.find(c => c.name.toLowerCase() === chainName.toLowerCase());
          if (!chain) continue;

          const provider = getProvider(chain.id);
          let currentNonce = await provider.getTransactionCount(safeAddr, 'latest');

          for (const plan of chainGroups[chainName]) {
             logger.info(`[Recovery][${traceId}] Private Bundle | ${chainName} | Nonce: ${currentNonce}`);
             
             const payloadWithNonces = plan.payloads.map((tx: any, idx: number) => ({
               ...tx,
               nonce: currentNonce + idx,
               chainId: chain.id
             }));

             const result = await (flashbotsExecution as any).executeBundle(
               encryptedPrivateKey,
               chain.rpc,
               payloadWithNonces,
               chain.id
             );
             
             if (result.success) {
               currentNonce += payloadWithNonces.length;
             }

             executionResults.push({
               chain: plan.chain,
               success: result.success,
               txHash: result.txHash,
               error: result.error,
               tokens: plan.tokens?.map((t: any) => t.symbol)
             });
          }
        }
      }

      // 6. PERSISTENCE & AUDIT
      const hasSuccess = executionResults.some(r => r.success);
      const successfulTokens = executionResults.filter(r => r.success).flatMap(r => r.tokens || []);

      await prisma.recoveryAttempt.create({
        data: {
          traceId,
          walletAddress: safeAddr,
          tokenCount: profitableTokens.length,
          estimatedTotalUsd: totalGrossUsd.toFixed(2),
          status: hasSuccess ? 'COMPLETED' : 'FAILED'
        }
      }).catch((err: any) => logger.error(`[Recovery][${traceId}] Audit Log Failed: ${err.message}`));

      const duration = (Date.now() - startTime) / 1000;

      return {
        success: hasSuccess,
        traceId,
        wallet: safeAddr,
        latency: `${duration}s`,
        tier: membership.tier,
        pricing: {
          grossValue: `$${totalGrossUsd.toFixed(2)}`,
          fee: `$${feeReport.feeUsd.toFixed(2)}`,
          net: `$${feeReport.userShareUsd.toFixed(2)}`
        },
        summary: {
          totalTokens: profitableTokens.length,
          recoveredTokens: successfulTokens,
          successRate: `${((successfulTokens.length / (profitableTokens.length || 1)) * 100).toFixed(0)}%`
        },
        executionDetails: executionResults,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error(`[Recovery][${traceId}] Engine Fatal: ${error.stack}`);
      return { 
        success: false, 
        traceId,
        error: 'RECOVERY_ENGINE_CRASH', 
        message: error.message 
      };
    }
  }
};
