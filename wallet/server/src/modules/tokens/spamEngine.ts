import { prisma } from '../../config/database.js';
import { runSecurityScan, runPriceScan, calculateVerdict } from './spamDetector.js';
import { logger } from '../../utils/logger.js';
import { getBestRpc, refreshRpc } from '../../blockchain/chains.js';
import { ethers, isAddress, keccak256, solidityPacked, zeroPadValue } from 'ethers';

/**
 * Spam-ENGINE v1.1
 * Core Logic: Autonomous Orchestration, Fingerprint Drift, and Intelligence Lifecycle.
 * Philosophy: Trust the Ledger, Verify the Bytecode, Minimize the Waterfall.
 * Features: Adaptive TTL Scaling, Proxy Evolution Tracking, SaaS Sync.
 * Alignment: Integrated with Object-based Pricing Waterfall & multi-RPC Resolver.
 */
const RPC_CONCURRENCY = 5; 
let activeRpcCalls = 0;
const rpcQueue: (() => void)[] = [];

async function acquireRpcSlot() {
if (activeRpcCalls >= RPC_CONCURRENCY) {
await new Promise<void>(resolve => rpcQueue.push(resolve));
}
activeRpcCalls++;
}
function releaseRpcSlot() {
activeRpcCalls--;
if (rpcQueue.length > 0) {
const next = rpcQueue.shift();
if (next) next();
}
}

const IMPLEMENTATION_SLOT = "0x3608944802909281900310020130310202202202202202202202202202202202";

export class AegisEngine {
  /**
   * The "Grand Orchestrator": Processes assets with JIT (Just-In-Time) Verification.
   * Adapts re-scan frequency based on asset risk, code stability, and logic volatility.
   */
  static async getVerdict(asset: any) { 
    const address = String(asset.address || '').toLowerCase().trim();
    const chainId = Number(asset.chainId) || 1;
    const id = `${chainId}-${address}`;

    // Validates address format using Ethers v6 native method
    if (!address || !isAddress(address)) {
      return { status: 'spam', securityNote: 'Invalid Contract Address', usdValue: 0, canRecover: false };
    }

    try {
      // 1. DATABASE MEMORY RETRIEVAL (Table 2: LiveRegistry)
      // Fetches the current 'known' state from the Mesh.
      const live = await prisma.securityLiveRegistry.findUnique({ where: { id } });
  
      /**
       * UPGRADE: PERFORMANCE OPTIMIZATION
       * If record exists and is fresh (within base TTL), skip RPC calls.
       */
      const now = Date.now();
      if (live) {
        const lastScannedMs = new Date(live.lastScanned).getTime();
        const baseTTL = live.status === 'malicious' ? 86400000 : 1800000; 
        if (now - lastScannedMs < baseTTL && live.status === 'malicious') {
          return live; // Instant return for known malicious assets
        }
      }

      // 2. BLOCKCHAIN REALITY CHECK (RPC Fingerprinting)
      // Production Upgrade: Relying on getBestRpc for latency-optimized provider resolution
      const rpcUrl = await getBestRpc(chainId);
      
      /**
       * UPGRADE: PRODUCTION STATIC NETWORK HANDSHAKE
       * Explicitly passing chainId and staticNetwork: true prevents 'eth_chainId' 
       * round-trips that cause 403/Unauthorized errors under heavy load.
       */
      const provider = new ethers.JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });

      // We hash the bytecode + proxy implementation to detect logic shifts instantly.
      // PRODUCTION FIX: Logic remains, but note that for massive scale, Multicall batching is recommended here.
      let onChainCode: string | null;
      let rawProxy: string | null;

      try {
        await acquireRpcSlot();
        [onChainCode, rawProxy] = await Promise.all([
          provider.getCode(address).catch(() => '0x'),
          provider.getStorage(address, IMPLEMENTATION_SLOT).catch(() => '0x00')
        ]);
      } catch (rpcErr) {
        // If the specific provider fails, trigger a refresh for the next iteration
        await refreshRpc(chainId);
        throw rpcErr;
      } finally {
          releaseRpcSlot(); 
          }
      
      // UPGRADE: GATEKEEPER - Verify if address is a Contract or a regular Wallet (EOA)
      const isContract = onChainCode !== '0x' && onChainCode !== '0x0' && onChainCode !== null;

      // Upgrade: Standardize hex length to 32-bytes to prevent Ethers v6 "invalid BytesLike" errors
      const onChainProxy = (rawProxy === '0x' || rawProxy === '0x0' || !rawProxy) 
        ? zeroPadValue('0x00', 32) 
        : (rawProxy.length % 2 !== 0 ? zeroPadValue(rawProxy.replace('0x', '0x0'), 32) : zeroPadValue(rawProxy, 32));
      
      const safeCode = (onChainCode === '0x' || !onChainCode) ? '0x' : onChainCode;

      // Check if it's a proxy: If the implementation slot is not empty, it's a proxy.
      const isProxyContract = onChainProxy !== zeroPadValue('0x00', 32);
      
      // Ethers v6: Deterministic fingerprinting of the contract logic state
      // Upgrade: Using safeCode and padded onChainProxy to ensure valid solidityPacked execution
      const currentFingerprint = keccak256(solidityPacked(['bytes', 'bytes'], [safeCode, onChainProxy]));

      // 3. ADAPTIVE DECISION MATRIX (The Learning Layer)
      if (live) {
        const isMalicious = live.status === 'malicious';
        const codeIntact = live.fingerprint === currentFingerprint;
        
        /**
         * EVOLUTION: Trust Multiplier
         * If a token has been scanned many times without a code change, we extend its trust window.
         */
        const trustMultiplier = Math.min((live.timesScanned || 1) / 5, 10); 
        const baseTTL = isMalicious ? 86400000 : 1800000; 
        const adaptiveTTL = baseTTL * (codeIntact ? trustMultiplier : 1);
        
        const lastScannedMs = new Date(live.lastScanned).getTime();
        const isStale = (now - lastScannedMs) > adaptiveTTL;

        // If Malicious: Permanent Block.
        // If Clean & Intact & Not Stale: Instant return from database.
        if (isMalicious || (codeIntact && !isStale)) {
          return live;
        }

        logger.info(`[Aegis-Engine] Re-Evaluating ${asset.symbol}: ${codeIntact ? 'Adaptive TTL Expiry' : 'Logic Drift Detected'}`);
      }

      // 4. INTELLIGENCE WATERFALL (URL Pings - Only triggered when necessary)
      // Aligned: runPriceScan now returns { price, liquidity }
      // UPGRADE: Integrated Weighted Consensus via runSecurityScan multi-provider support
      const [security, priceData] = await Promise.all([
        runSecurityScan(address, chainId),
        runPriceScan(address, asset.symbol || '', chainId)
      ]);

      const verdict = calculateVerdict(asset, security, priceData);

      // UPGRADE: BYPASS PERSISTENCE for non-contract addresses to prevent DB bloat
      if (!isContract) {
        return { ...verdict, isProxy: false, fingerprint: currentFingerprint };
      }

      // 5. ATOMIC SYNC (Live Registry + Master Archive)
      // UPGRADED: Added Recursive Retry Loop with Randomized Jitter for high-concurrency stability
      let attempts = 0;
      const maxAttempts = 5; 

      while (attempts < maxAttempts) {
        try {
          // PRODUCTION UPGRADE: Decoupled Archive creation to prevent deadlock during high-contention upserts
          const hasChanged = live && live.fingerprint !== currentFingerprint;
          
          const result = await prisma.securityLiveRegistry.upsert({
            where: { id },
            update: { 
              ...verdict, 
              fingerprint: currentFingerprint, 
              lastScanned: new Date(),
              timesScanned: { increment: 1 },
              isProxy: isProxyContract,
              isVerifiedSource: verdict.isVerifiedSource || false,
              upgradeCount: hasChanged ? { increment: 1 } : undefined,
              lastChangeFound: hasChanged ? new Date() : live?.lastChangeFound
            },
            create: { 
              id, 
              address, 
              chainId, 
              ...verdict, 
              fingerprint: currentFingerprint,
              initialFingerprint: currentFingerprint,
              isProxy: isProxyContract,
              isVerifiedSource: verdict.isVerifiedSource || false,
              upgradeCount: 0,
              timesScanned: 1
            }
          });

          // PRODUCTION FIX: Archive entry is now handled outside the main lock to maximize throughput
          prisma.securityMasterArchive.create({
            data: {
              address,
              chainId,
              previousStatus: live?.status || 'NONE',
              newStatus: verdict.status,
              fingerprint: currentFingerprint,
              changeType: !live ? 'NEW_DISCOVERY' : (hasChanged ? 'PROXY_UPGRADE' : 'RE_VERIFICATION')
            }
          }).catch(e => logger.error(`[Aegis-Engine] Archive Write Failed: ${e.message}`));

          return result;
        } catch (dbError: any) {
          attempts++;
          const isRetryable = dbError.code === 'P2002' || 
                            dbError.message?.includes('aborted') || 
                            dbError.message?.includes('conflict') ||
                            dbError.message?.includes('deadlock');

          if (isRetryable && attempts < maxAttempts) {
            const jitter = Math.floor(Math.random() * 150) + (attempts * 100);
            await new Promise(res => setTimeout(res, jitter));
            continue;
          }
          throw dbError;
        }
      }

    } catch (error) {
      logger.error(`[Aegis-Engine] Logic Failure for ${address}:`, error instanceof Error ? error.stack : error);
      
      // PRODUCTION UPGRADE: Fail-Caution (Restricted Mode)
      // This protects the user by returning a restricted status if the database or scanners fail.
      return { 
        status: 'dust', 
        securityNote: 'Verification Deferred (Sync Conflict)', 
        usdValue: 0,
        score: 0, 
        canRecover: false // FIX: Default to false during failure for safety
      };
    }
  }
}
