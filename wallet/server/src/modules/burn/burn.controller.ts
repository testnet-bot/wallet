import { Request, Response } from 'express';
import { isAddress } from 'ethers';
import { burnService } from './burn.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Global Spam Burn Controller
 * Triggers the scanning, classification, and preparation of burn transactions.
 */
export async function burnTokenController(req: Request, res: Response) {
  const startTime = Date.now();
  // Support address from Query (GET) or Body (POST)
  const address = (req.query.address || req.body.address) as string;

  try {
    // INPUT VALIDATION: Reject bad addresses before hitting APIs
    if (!address || !isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'A valid EVM wallet address is required to initiate burn.',
      });
    }

    logger.info(`[BurnController] Received burn request for: ${address}`);

    // EXECUTION: Trigger the heavy-duty burn service
    const result = await burnService.executeSpamBurn(address);

    if (!result.success) {
      return res.status(500).json(result);
    }

    // METADATA: Track latency for premium UX
    const duration = (Date.now() - startTime) / 1000;

    // PREMIUM RESPONSE: Structured for your frontend hooks
    return res.status(200).json({
      success: true,
      address: address.toLowerCase(),
      latency: `${duration}s`,
      summary: result.summary,
      plans: result.plans,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error(`[BurnController] Critical failure for ${address}: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: 'The Spam Burn engine encountered a critical error.',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error'
    });
  }
}
