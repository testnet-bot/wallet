import { batchBurnTokens } from './batchBurnEngine.js';
import { tokenService } from '../tokens/token.service.js';
import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { flashbotsExecution } from '../../blockchain/flashbotsExecution.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/database.js';
import { helpers } from '../../utils/helpers.js';
import crypto from 'crypto';

/**
 * UPGRADED: Institutional-Grade Burn Service (v2026.4).
 * Features: Flashblocks Streaming, EIP-7706 Multi-Dim Gas, and Helper-Augmented Resilience.
 */
export const burnService = {
  /**
   * Sanitizes wallets by burning malicious assets via private MEV-shielded RPCs.
   * Logic: Intelligence -> Batch Plan -> Private Execution -> Health Audit.
   */
  async executeSpamBurn(walletAddress: string, encryptedPrivateKey: string, preScannedTokens?: any[]) {
    const startTime = Date.now();
    const safeAddr = walletAddress.toLowerCase();
    const traceId = `BRN-SRV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    try {
      logger.info(`[BurnService][${traceId}] Initiating 2026-Spec Sanitization: ${safeAddr}`);

      let spamTokens = preScannedTokens;

      // 1. INTELLIGENCE: Auto-Categorize assets if not provided
      if (!spamTokens) {
        const rawAssets = await scanGlobalWallet(safeAddr);
        // Using categorization logic to group Spam vs Threats
        const report = await tokenService.categorizeAssets(rawAssets, traceId);
        spamTokens = [...(report.inventory?.spam || []), ...(report.inventory?.threats || [])];
      }

      if (!spamTokens || spamTokens.length === 0) {
        logger.info(`[BurnService][${traceId}] Wallet ${safeAddr} is already clean.`);
        return {
          success: true,
          message: 'Wallet integrity verified. No spam detected.',
          traceId,
          summary: { spamTokensFound: 0, successfulChains: 0 }
        };
      }

      // 2. BATCH PLANNING: Optimized for Multi-Dimensional Gas Vectors
      const burnPlans = await batchBurnTokens(safeAddr, spamTokens);
      const executionResults: any[] = [];

      // 3. SECURE BUNDLE EXECUTION (Resilient Private Routing)
      for (const plan of burnPlans) {
        const chain = EVM_CHAINS.find((c: any) => c.id === plan.chainId) as any;
        
        if (chain && plan.payloads.length > 0) {
          // Detect Flashblocks (sub-500ms pre-conf) support
          const useFlashblocks = chain.id === 8453 || (chain.features && chain.features.includes('FLASHBLOCKS'));
          
          logger.info(`[BurnService][${traceId}] Submitting ${plan.payloads.length} txs to ${chain.name} [${useFlashblocks ? 'FLASHBLOCKS' : 'PRIVATE_RELAY'}]`);
          
          // FINANCE UPGRADE: Use helpers.retry to survive RPC "socket hang ups" or 429s
          const result = await helpers.retry(
            async () => await (flashbotsExecution as any).executeBundle(
              encryptedPrivateKey,
              chain.rpc,
              plan.payloads,
              chain.id
            ),
            2, // 2 retries
            1000, // 1s base delay
            traceId
          );
          
          executionResults.push({
            chain: plan.chain,
            success: result.success,
            error: result.error,
            txHash: result.txHash,
            preconfirmed: !!(useFlashblocks && result.success),
            tokenCount: plan.tokenCount,
            explorer: result.txHash ? helpers.getExplorerUrl(result.txHash, chain.id) : null
          });

          if (result.success) {
            logger.info(`[BurnService][${traceId}] Sanitized ${plan.tokenCount} tokens on ${plan.chain} | Hash: ${result.txHash}`);
          }
        }
      }

      // 4. FINANCIAL PERSISTENCE & HEALTH RESTORATION
      const successfulExecutions = executionResults.filter(r => r.success);
      const hasSuccess = successfulExecutions.length > 0;
      const primaryTxHash = hasSuccess ? successfulExecutions[0].txHash : null;

      if (hasSuccess) {
        // Calculate restored health score based on sanitization depth
        const totalBurned = successfulExecutions.reduce((sum, r) => sum + r.tokenCount, 0);
        const restoredHealth = Math.min(100, 85 + Math.floor(totalBurned / 2));
        
        await prisma.wallet.update({
          where: { address: safeAddr },
          data: { 
            lastSynced: new Date(),
            healthScore: restoredHealth,
            riskLevel: restoredHealth >= 90 ? 'LOW' : 'MEDIUM'
          }
        }).catch((err: any) => logger.error(`[BurnService][${traceId}] Audit Persistence Error: ${err.message}`));
      }

      const duration = (Date.now() - startTime) / 1000;

      // 5. STRUCTURED AUDIT RESPONSE
      return {
        success: hasSuccess,
        txHash: primaryTxHash,
        traceId,
        wallet: safeAddr,
        latency: `${duration}s`,
        summary: {
          spamTokensFound: spamTokens.length,
          successfulChains: successfulExecutions.length,
          totalBurned: successfulExecutions.reduce((sum, r) => sum + r.tokenCount, 0),
          gasStandard: 'EIP-7706_READY'
        },
        executionResults,
        metadata: {
          finalityType: executionResults.some(r => r.preconfirmed) ? 'FLASHBLOCK_SUB_200MS' : 'MEV_SHARE_BUNDLE',
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      logger.error(`[BurnService][${traceId}] Engine Fatal: ${error.stack}`);
      return {
        success: false,
        traceId,
        error: 'BURN_ORCHESTRATION_FAILED',
        message: error.message || 'Critical failure in burn orchestration logic.'
      };
    }
  }
};
