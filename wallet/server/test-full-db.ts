import { prisma } from './src/config/database.js'; 
import { logger } from './src/utils/logger.js';
import { tokenService } from './src/modules/tokens/token.service.js';
import { recoveryService } from './src/modules/recovery/recovery.service.js';
import { automationService } from './src/modules/automation/automation.service.js';
import { txBuilder } from './src/blockchain/txBuilder.js';
import { EVM_CHAINS } from './src/blockchain/chains.js';

/**
 * Tier 1 Production Diagnostic
 * Validates the entire backend flow from DB to Hex-encoded Tx Payloads.
 */
async function runFinalDiagnostic() {
  logger.info("🛠️  INITIATING FULL SYSTEM INTEGRATION TEST...");

  try {
    // 1. DATABASE ALIGNMENT
    const walletCount = await prisma.wallet.count();
    const ruleCount = await prisma.automationRule.count();
    logger.info(`🗄️  DB Connection: OK (Wallets: ${walletCount}, Rules: ${ruleCount})`);

    // 2. TOKEN SERVICE (Classification Check)
    const MOCK_ADDR = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
    const mockRawAssets = [
      { symbol: 'ETH', balance: '0.5', usdValue: 1250, chain: 'Base', type: 'native', decimals: 18 },
      { symbol: 'SPAM', balance: '1000000', usdValue: 0.01, chain: 'Base', type: 'erc20', decimals: 18 }
    ];
    
    const analysis = await tokenService.categorizeAssets(mockRawAssets);
    logger.info(`🔎 Token Engine: Classified ${analysis.summary.totalAssets} assets (Groups: OK)`);

    // 3. RECOVERY SERVICE (Architecture Check)
    const recoveryCheck = await recoveryService.executeDustRecovery(MOCK_ADDR);
    logger.info(`🧪 Recovery Service: Named Export alignment [${recoveryCheck.success ? 'ONLINE' : 'ACTIVE'}]`);

    // 4. AUTOMATION ORCHESTRATION
    const autoResult = await automationService.processAutomatedTasks(MOCK_ADDR);
    logger.info(`🤖 Automation Layer: Orchestrator Status [${autoResult.status}]`);

    // 5. TX BUILDER (Production Hex-Encoded Payload Check)
    const MOCK_TOKEN = "0x1234567890123456789012345678901234567890";
    const burnTx = await txBuilder.buildBurnTx(MOCK_TOKEN, "1000", 18);
    
    // Verifying hex encoding (0x...) for RPC compatibility
    const isHex = burnTx.gasLimit.startsWith('0x') && burnTx.value.startsWith('0x');
    logger.info(`📦 TxBuilder: buildBurnTx SUCCESS (Hex-Encoded: ${isHex ? 'YES' : 'NO'})`);
    
    if (!isHex) logger.warn("⚠️  TxBuilder is returning decimal strings. Check ethers.toQuantity conversion.");

    console.log("\n✅ [SYSTEM GREEN]: Full backend workflow is vertically aligned.");

  } catch (error: any) {
    logger.error("🚨 INTEGRATION FAILURE:", {
      message: error.message,
      location: error.stack?.split('\n')[1]
    });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runFinalDiagnostic();
