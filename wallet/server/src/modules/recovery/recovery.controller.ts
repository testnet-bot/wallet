import { Request, Response } from 'express';
import { recoveryService } from './recovery.service.js';
import { logger } from '../../utils/logger.js';
import { isAddress, getAddress } from 'ethers';
import { mutex } from '../../utils/mutex.js';
import { clearSensitiveData } from '../../utils/crypto.js';
import crypto from 'crypto';

/**
 * UPGRADED: Production-Grade Recovery Controller (Finance v2026.4).
 * Features: Cluster-Safe Mutexing, Zero-Trace Memory Hygiene, and Atomic Trace Auditing.
 */
export async function recoverDustController(req: Request, res: Response) {
  const startTime = Date.now();
  // High-entropy TraceID for audit logs
  const traceId = `REC-API-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  
  // Set Security Headers
  res.setHeader('X-Trace-ID', traceId);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 1. INPUT EXTRACTION & NORMALIZATION
  const rawAddress = (req.body.walletAddress || req.query.address) as string;
  let privateKey: string | undefined = req.body.privateKey as string;

  try {
    // 2. STRICT VALIDATION & CHECKSUMMING
    if (!rawAddress || !isAddress(rawAddress)) {
      logger.warn(`[RecoveryController][${traceId}] REJECTED_INVALID_ADDRESS: ${rawAddress}`);
      return res.status(400).json({ 
        success: false, 
        error: 'A valid EVM walletAddress is required.',
        traceId 
      });
    }

    const checksummedAddr = getAddress(rawAddress);
    // Unique lock key per wallet to prevent Nonce Collisions across the cluster
    const lockId = `lock:recovery:v4:${checksummedAddr.toLowerCase()}`;

    // 3. ATOMIC DISTRIBUTED LOCK (10-minute safety window)
    // The ownerId prevents one server from accidentally unlocking another's process
    const ownerId = await mutex.acquire(lockId, 600000); 
    
    if (!ownerId) {
      logger.warn(`[RecoveryController][${traceId}] CONFLICT: Recovery already active for ${checksummedAddr}`);
      return res.status(429).json({ 
        success: false, 
        error: 'RECOVERY_IN_PROGRESS', 
        message: 'A rescue mission is already active for this wallet. Please wait for completion.',
        traceId
      });
    }

    try {
      logger.info(`[RecoveryController][${traceId}] Initiating MEV-Shielded Rescue for: ${checksummedAddr}`);

      // 4. SERVICE EXECUTION (Finance-Grade Service)
      const result: any = await recoveryService.executeDustRecovery(checksummedAddr, privateKey);
      
      // 5. ZERO-TRACE MEMORY HYGIENE
      // We scrub the key as soon as the service returns to prevent memory dumps
      if (privateKey) {
        clearSensitiveData(privateKey);
        privateKey = undefined;
      }
      
      // Scrub the request object to prevent leaking PII into error middlewares
      if (req.body && req.body.privateKey) {
        req.body.privateKey = '[REDACTED_FINANCE_GRADE]';
        delete req.body.privateKey;
      }

      // Map results to proper Financial Status Codes
      let statusCode = 200;
      if (!result.success) {
        // 422 for logic failures (dust too small), 500 for engine crashes
        statusCode = result.error === 'INSUFFICIENT_VALUE' ? 422 : 500;
      }

      const duration = (Date.now() - startTime) / 1000;

      return res.status(statusCode).json({
        ...result,
        traceId,
        meta: {
          latency: `${duration}s`,
          protocol: 'Flashbots/MEV-Share',
          engine: 'Butler_V4',
          timestamp: new Date().toISOString()
        }
      });

    } finally {
      // 6. ATOMIC RELEASE: Only the owner who acquired the lock can release it
      await mutex.release(lockId, ownerId);
    }

  } catch (err: any) {
    logger.error(`[RecoveryController][${traceId}] Critical Fault: ${err.stack || err.message}`);
    
    return res.status(500).json({ 
      success: false, 
      error: 'CRITICAL_SYSTEM_FAULT', 
      message: 'The recovery engine encountered an unexpected internal failure.',
      traceId
    });
  }
}
