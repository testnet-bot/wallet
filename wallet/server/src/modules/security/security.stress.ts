import axios from 'axios';
import 'dotenv/config';

// 2026 PROD CONFIG: Targeting the live v1 gateway on Port 5000
const API_BASE = "http://localhost:5000/api/v1/security/scan";
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "your_dev_key_if_env_fails";

async function battleTestSecurity() {
  console.log('🛡️ STARTING 2026 SECURITY GATEWAY STRESS TEST...');
  console.log(`📍 Targeting: ${API_BASE}`);

  const testCases = [
    {
      name: "VALID_SECURE_WALLET",
      address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
      network: "ethereum",
      expectedLevel: "SECURE"
    },
    {
      name: "INVALID_ADDRESS_FORMAT",
      address: "0xInvalidAddress123",
      network: "base",
      expectedStatus: 422
    },
    {
      name: "SUPERCHAIN_AGGREGATION",
      address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      network: "superchain",
      refresh: "true"
    }
  ];

  for (const test of testCases) {
    console.log(`\n🚀 Testing: ${test.name}`);
    try {
      const response = await axios.post(API_BASE, {
        address: test.address,
        network: test.network
      }, {
        params: { refresh: test.refresh || 'false' },
        headers: { 
          'x-trace-id': `BATTLE-${Date.now()}`,
          'x-api-key': INTERNAL_KEY
        },
        timeout: 20000 
      });

      const { data, meta } = response.data;
      
      console.log(`✅ Success [${meta.latencyMs}ms]`);
      console.log(`📊 Health Score: ${data.healthScore}/100`);
      console.log(`⚠️ Risk Level: ${data.riskLevel}`);
      console.log(`🛡️ Integrity Status: ${data.integrity.status}`);
      console.log(`🔗 TraceID: ${meta.traceId}`);
      
    } catch (err: any) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error || err.message;
      
      if (status === test.expectedStatus) {
        console.log(`✅ Correctly Blocked with expected status ${status}`);
      } else {
        console.error(`❌ Unexpected Error [${status || 'TIMEOUT'}]: ${errorMsg}`);
        if (err.response?.data?.traceId) {
            console.log(`🔍 Server TraceID: ${err.response.data.traceId}`);
        }
      }
    }
  }

  console.log('\n--- BATTLE TEST COMPLETE ---');
}

battleTestSecurity();
