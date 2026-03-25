import { Request, Response } from 'express';
import { isAddress, getAddress } from 'ethers';
import { burnService } from './burn.service.js';
import { logger } from '../../utils/logger.js';
import { helpers } from '../../utils/helpers.js';
import { mutex } from '../../utils/mutex.js';
import { clearSensitiveData } from '../../utils/crypto.js';
import { z } from 'zod';
import crypto from 'crypto';

/**
 * UPGRADED: Production-Grade Spam Burn Controller (Finance v2026.4).
 * Features: Cluster-Safe Mutexing, EIP-7706 Multi-Dim Gas, and Type-Safe Memory Hygiene.
 */

// 1. Strict Financial Validation Schema
const BurnRequestSchema = z.object({
  address: z.string().refine(isAddress, { message: "INVALID_EVM_ADDRESS" }),
  privateKey: z.string().min(64, "INVALID_KEY_LENGTH"),
  options: z.object({
    dryRun: z.boolean().default(false),
    forceFlashblocks: z.boolean().default(true),
    maxGwei: z.number().optional()
  }).optional()
});

export async function burnTokenController(req: Request, res: Response) {
  const startTime = Date.now();
  const traceId = `BRN-API-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  
  // Set Security & Audit Headers
  res.setHeader('X-Trace-ID', traceId);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 2. INPUT VALIDATION
  const validation = BurnRequestSchema.safeParse({
    address: req.body.address || req.query.address,
    privateKey: req.body.privateKey,
    options: req.body.options
  });

  if (!validation.success) {
    return res.status(400).json({ 
      success: false, 
      error: 'VALIDATION_ERROR', 
      details: validation.error.format(),
      traceId 
    });
  }

  // Type-Safe Extraction: Allow privateKey to be nullified later
  const { address, options } = validation.data;
  let privateKey: string | undefined = validation.data.privateKey;
  const checksummedAddr = getAddress(address);

  // 3. CLUSTER-SAFE MUTEX LOCK
  const lockId = `lock:burn:v4:${checksummedAddr.toLowerCase()}`;
  const ownerId = await (mutex as any).acquire(lockId, 300000);
  
  if (!ownerId) {
    return res.status(429).json({ 
      success: false, 
      error: 'PROCESS_LOCKED', 
      message: 'A burn is already in progress.',
      traceId
    });
  }

  try {
    logger.info(`[BurnController][${traceId}] Initiating Batch Burn: ${checksummedAddr}`);

    // 4. EXECUTION WITH RESILIENCE (Using helpers.retry)
    const result: any = await helpers.retry(
      async () => {
        if (!privateKey) throw new Error('KEY_SCRUBBED_PREMATURELY');
        return await burnService.executeSpamBurn(checksummedAddr, privateKey);
      },
      2,     // 2 Retries
      1500,  // 1.5s base delay
      traceId
    );
    
    // 5. MEMORY HYGIENE
    if (privateKey) {
      clearSensitiveData(privateKey);
      privateKey = undefined; 
    }

    if (req.body && req.body.privateKey) {
      req.body.privateKey = '[REDACTED_BY_HELPERS]';
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        traceId,
        error: 'BURN_ENGINE_FAILURE',
        message: result.error || 'Check relay status.',
        summary: result.summary
      });
    }

    const duration = (Date.now() - startTime) / 1000;

    // 6. RESPONSE WITH FORMATTED METADATA (Using helpers.formatUsd)
    return res.status(200).json({
      success: true,
      traceId,
      address: checksummedAddr,
      meta: {
          latency: `${duration}s`,
          mevProtection: true,
          timestamp: new Date().toISOString(),
          estimatedSavings: result.summary?.gasSaved ? helpers.formatUsd(result.summary.gasSaved) : '/usr/bin/bash.00'
      },
      summary: result.summary,
      results: result.executionResults || []
    });

  } catch (error: any) {
    // Fail-safe cleanup
    if (privateKey) {
      clearSensitiveData(privateKey);
      privateKey = undefined;
    }
    logger.error(`[BurnController][${traceId}] Critical Fault: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      traceId,
      error: 'INTERNAL_SYSTEM_FAULT'
    });
  } finally {
    await (mutex as any).release(lockId, ownerId);
  }
}
