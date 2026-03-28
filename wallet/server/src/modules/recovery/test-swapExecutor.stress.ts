import 'dotenv/config';
import swapExecutor from './swapExecutor.js';
import crypto from 'crypto';

const TEST_WALLET = '0x000000000000000000000000000000000000dead';

/**
 * Generate random fake assets to simulate real wallets
 */
function generateAssets(batchSize: number) {
  const chains = [1, 137, 8453, 42161]; // ETH, Polygon, Base, Arbitrum

  return Array.from({ length: batchSize }).map(() => {
    const chainId = chains[Math.floor(Math.random() * chains.length)];
    const value = Math.random() * 1200; // simulate up to $1200 tokens

    return {
      asset: {
        chainId,
        symbol: 'TKN',
        address: '0x' + crypto.randomBytes(20).toString('hex'),
        contract: '0x' + crypto.randomBytes(20).toString('hex'),
        decimals: 18,
        balance: (Math.random() * 1000).toFixed(4),
        rawBalance: BigInt(Math.floor(Math.random() * 1e18)).toString(),
        usdValue: value
      }
    };
  });
}

/**
 * Run one simulated wallet recovery
 */
async function simulateWalletRun(id: number) {
  const assetCount = Math.floor(Math.random() * 8) + 2;
  const assets = generateAssets(assetCount);

  const start = Date.now();

  try {
    const quotes = await swapExecutor.getSmartRescueQuote(
      TEST_WALLET,
      assets,
      Math.random() > 0.7 ? 'PRO' : 'BASIC'
    );

    const duration = Date.now() - start;

    return {
      id,
      success: true,
      quotes: quotes.length,
      duration
    };
  } catch (err: any) {
    return {
      id,
      success: false,
      error: err.message
    };
  }
}

/**
 * MAIN STRESS TEST
 */
async function runStressTest() {
  console.log('🚀 STARTING SWAP EXECUTOR STRESS TEST...\n');

  const CONCURRENT_USERS = 25; // simulate 25 wallets at once
  const ROUNDS = 4;            // repeat waves

  let totalSuccess = 0;
  let totalFail = 0;

  const globalStart = Date.now();

  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`⚡ ROUND ${round}: Simulating ${CONCURRENT_USERS} concurrent wallets...`);

    const promises = Array.from({ length: CONCURRENT_USERS }).map((_, i) =>
      simulateWalletRun(i)
    );

    const results = await Promise.all(promises);

    const success = results.filter(r => r.success).length;
    const fail = results.length - success;

    totalSuccess += success;
    totalFail += fail;

    const avgTime =
      results
        .filter(r => r.success)
        .reduce((sum, r) => sum + (r.duration || 0), 0) /
      Math.max(success, 1);

    console.log(`   ✅ Success: ${success}`);
    console.log(`   ❌ Failed: ${fail}`);
    console.log(`   ⏱️ Avg Execution Time: ${avgTime.toFixed(2)}ms\n`);
  }

  const totalTime = Date.now() - globalStart;

  console.log('📊 FINAL RESULTS:');
  console.log(`   🧠 Total Requests: ${CONCURRENT_USERS * ROUNDS}`);
  console.log(`   ✅ Total Success: ${totalSuccess}`);
  console.log(`   ❌ Total Failed: ${totalFail}`);
  console.log(`   ⏱️ Total Runtime: ${totalTime}ms`);

  if (totalFail > 0) {
    console.log('\n⚠️ Some failures detected — check logs for bottlenecks.');
  } else {
    console.log('\n🔥 SYSTEM PASSED: Ready for production-grade load.');
  }
}

runStressTest().catch(err => {
  console.error('💥 CRITICAL FAILURE:', err);
  process.exit(1);
});
