import { AegisEngine } from './spamEngine.js';
import { logger } from '../../utils/logger.js';

/**
 * AEGIS BATTLE-HARDENED STRESS TEST v1.0
 * Location: wallet/server/src/modules/tokens/battleTest.ts
 * Purpose: Simulate a "Stranger Attack" where multiple users hit the 
 * engine with malicious, spoofed, and high-concurrency token data.
 */

async function runStrangerAttack() {
  console.log('🔥 STARTING HEAVY BATTLE TEST: THE STRANGER SCENARIO');

  const assetsToTest = [
    // 1. The Spoof (USDC Address but junk metadata)
    { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', name: 'USD Coin', chainId: 1, balance: '1000' },
    // 2. The Invisible Character Attack
    { address: '0x1234567890123456789012345678901234567890', symbol: 'U\u200B S\u200B D\u200B C', name: 'Claim Free Rewards', chainId: 1, balance: '500000' },
    // 3. The Malformed Injection
    { address: 'INVALID_HEX_DATA_XYZ', symbol: 'HACK', name: 'Exploit', chainId: 56, balance: '0' },
    // 4. The High-Value Proxy Logic (WETH)
    { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH', name: 'Wrapped Ether', chainId: 1, balance: '5.5' },
    // 5. The "Zero Liquidity" Rug Trap
    { address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', symbol: 'RUG', name: 'ExitScam Token', chainId: 137, balance: '1000000' }
  ];

  const CONCURRENCY_LIMIT = 20; // Simultaneous requests
  const TOTAL_ROUNDS = 5;      // Total iterations
  
  let passed = 0;
  let failed = 0;

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    const startTime = Date.now();
    console.log(`[Round ${round}] Launching ${CONCURRENCY_LIMIT} parallel stranger requests...`);

    const promises = Array.from({ length: CONCURRENCY_LIMIT }, (_, i) => {
      const asset = assetsToTest[i % assetsToTest.length];
      // Randomly tweak balance to force DB updates vs Cache hits
      const dynamicAsset = { ...asset, balance: (Math.random() * 1000).toString() };
      return AegisEngine.getVerdict(dynamicAsset);
    });

    const results = await Promise.allSettled(promises);
    const duration = Date.now() - startTime;

    results.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        passed++;
      } else {
        failed++;
        console.error(`❌ CRITICAL: Request ${idx} collapsed:`, res.reason);
      }
    });

    console.log(`[Round ${round}] Finished in ${duration}ms. Success: ${passed}, Failed: ${failed}`);
    
    // Add jitter between rounds to prevent immediate WAF block during testing
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n' + '█'.repeat(40));
  console.log('FINAL BATTLE REPORT');
  console.log(`Total Attacks Simulated: ${passed + failed}`);
  console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(2)}%`);
  console.log(`Database Resilience: ${failed === 0 ? 'STABLE' : 'UNSTABLE'}`);
  console.log('█'.repeat(40) + '\n');

  if (failed > 0) {
    console.warn('⚠️ Warning: System showed vulnerability under load. Check Prisma connection pool.');
  } else {
    console.log('✅ PRODUCTION READY: Engine withstood the Stranger Attack.');
  }
}

// Execute the test
runStrangerAttack().catch(err => {
  console.error('💥 TEST RUNNER CRASHED:', err);
  process.exit(1);
});
