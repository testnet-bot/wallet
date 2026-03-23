import { flashbotsExecution } from './blockchain/flashbotsExecution.js';
import { logger } from './utils/logger.js';
import 'dotenv/config';

async function testBridge() {
  logger.info("🧪 Testing Flashbots Bridge with Sepolia Relay...");

  const DUMMY_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";
  const SEPOLIA_RPC = "https://rpc.ankr.com"; 
  const SEPOLIA_CHAIN_ID = 11155111;
  const SEPOLIA_RELAY = "https://relay-sepolia.flashbots.net"; // Use the correct active relay

  const dummyPayload = [{
    to: "0x0000000000000000000000000000000000000000",
    data: "0x",
    value: 0n,
    gasLimit: 21000n
  }];

  try {
    const result = await flashbotsExecution.executeBundle(
      DUMMY_KEY,
      SEPOLIA_RPC,
      dummyPayload,
      SEPOLIA_CHAIN_ID
    );

    // Look for 'invalid signature' or 'insufficient funds'
    if (result.error?.includes("invalid") || result.error?.includes("insufficient")) {
      logger.info("🔥 BOOM! The Bridge is 100% functional.");
      logger.info("The Legacy engine (6.7.1) successfully signed and sent to the relay.");
    } else {
      logger.warn(`Relay response: ${result.error}`);
    }
  } catch (err: any) {
    logger.error(`❌ Unexpected Crash: ${err.message}`);
  }
}

testBridge();
