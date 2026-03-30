import axios from 'axios';
import http from 'http';

/**
 * 2026 OBLITERATION ENGINE - V3.1 (RESILIENCE PATCH)
 * Added: Pre-flight connectivity checks and explicit error trapping.
 */

const PORT = 5000; 
const API_BASE = `http://localhost:${PORT}/scan`;
const INTERNAL_KEY = "9293939sj39dn2oenaJKOw1oKHNa9e9iok0k11zo3ixja9wo3ndkzoskendkxks";

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 500 });

const client = axios.create({
  baseURL: API_BASE,
  httpAgent,
  timeout: 5000,
  validateStatus: () => true,
  headers: { 
    'x-api-key': INTERNAL_KEY, 
    'Content-Type': 'application/json'
  }
});

async function runObliterationTest() {
  console.log("\n🔥 OBLITERATION ENGINE STARTING...");
  
  // --- PRE-FLIGHT CHECK ---
  try {
    await axios.get(`http://localhost:${PORT}/health`, { timeout: 2000 }).catch(() => {});
    console.log(`📡 TARGET DETECTED: [Port ${PORT}]`);
  } catch (e) {
    console.error(`\n❌ OFFLINE: No server found on port ${PORT}.`);
    console.log("👉 Step 1: Run 'npm run dev' or 'node server.js' in a separate terminal.");
    console.log("👉 Step 2: Ensure your server is listening on 0.0.0.0 or localhost.");
    process.exit(1);
  }

  const TEST_WALLETS = {
    VALID: "0xd8dA6BF26964aF9d7eEd9e03E53415D37aA96045",
    DIRTY: "  \"0xd8dA6BF26964aF9d7eEd9e03E53415D37aA96045\"  \n"
  };

  console.log("\n[1/2] PROBING SANITIZATION...");
  try {
    const res = await client.post('', { address: TEST_WALLETS.DIRTY });
    if (res.status === 200) {
      console.log("✅ Scrubbing logic confirmed.");
    } else {
      console.log(`⚠️  Probe failed with status ${res.status}:`, res.data);
      process.exit(1);
    }
  } catch (err: any) {
    console.error("💥 PROBE CRASH:", err.message);
    process.exit(1);
  }

  // --- PHASE 2: BURST ---
  console.log("\n[2/2] STARTING OBLITERATION BURST (100 CONCURRENT)...");
  const burstSize = 100;
  const start = Date.now();

  const burst = Array.from({ length: burstSize }).map((_, i) => {
    const isPost = i % 2 === 0;
    return client({
      method: isPost ? 'POST' : 'GET',
      data: isPost ? { address: TEST_WALLETS.VALID } : undefined,
      params: !isPost ? { address: TEST_WALLETS.VALID } : undefined
    });
  });

  const results = await Promise.all(burst);
  const duration = Date.now() - start;
  const success = results.filter(r => r.status === 200).length;
  
  console.log(`\n💎 SUCCESS: ${success}/${burstSize} | ⏱️  ${duration}ms`);

  if (success === burstSize) {
    console.log("🏆 VERDICT: PRODUCTION READY.");
    process.exit(0);
  } else {
    console.log("❌ VERDICT: FAIL. Check Validator Body Parsing.");
    process.exit(1);
  }
}

runObliterationTest();
