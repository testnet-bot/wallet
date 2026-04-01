import { EVM_CHAINS } from './chains.js';
import fs from 'fs';
import path from 'path';

const RPC_TIMEOUT = 5000;
const outputFile = path.resolve(process.cwd(), 'wallet/server/src/blockchain/rpc-test-results.txt');

// Prepare output file
fs.writeFileSync(outputFile, `🌐 RPC Test Results - ${new Date().toISOString()}\n\n`, 'utf8');

// Helper to log to both console and file
const log = (msg: string) => {
  console.log(msg);
  fs.appendFileSync(outputFile, msg + '\n', 'utf8');
};

const pingRpc = async (url: string) => {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, latency: Date.now() - start, data };
  } catch (err: any) {
    return { success: false, latency: Infinity, error: err.message };
  }
};

async function testAllChains() {
  log(`🌐 Testing all EVM chains (${EVM_CHAINS.length})...\n`);
  
  for (const chain of EVM_CHAINS) {
    log(`🔗 ${chain.name} (ID: ${chain.id})`);
    for (const rpc of chain.rpcs) {
      const result = await pingRpc(rpc);
      if (result.success) {
        log(`  ✅ ${rpc} | latency: ${result.latency}ms | block: ${result.data.result}`);
      } else {
        log(`  ❌ ${rpc} | error: ${result.error}`);
      }
    }
    log('');
  }
  log('✅ All chains tested.');
  log(`\nResults saved to: ${outputFile}`);
}

testAllChains();
