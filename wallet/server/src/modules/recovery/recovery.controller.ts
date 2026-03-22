import { Request, Response } from 'express';
import { executeDustRecovery } from './recovery.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Premium Recovery Controller
 * Connects the API request to the heavy-duty execution service.
 */
export async function recoverDustController(req: Request, res: Response) {
  try {
    const address = req.body.walletAddress || req.query.address;

    if (!address || !address.startsWith('0x')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid EVM walletAddress required' 
      });
    }

    logger.info(`[RecoveryController] Triggering scan for: ${address}`);
    const data = await executeDustRecovery(address as string);
    
    res.status(200).json(data);
  } catch (err: any) {
    logger.error(`[RecoveryController] Error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
}
