import { Request, Response } from 'express';
import { isAddress } from 'ethers';
import { paymentService } from './payment.service.js';
import { apiService } from './api.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Premium Payment Controller
 * Handles the lifecycle of a payment from intent to API key delivery.
 */
export async function startPayment(req: Request, res: Response) {
  try {
    const { wallet, amount, chain } = req.body;

    // 1. Validation
    if (!wallet || !isAddress(wallet)) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid payment amount required' });
    }

    // 2. Create Payment Intent in DB
    const intent = await paymentService.createIntent(wallet, amount, chain || 'BASE');
    
    logger.info(`[Payment] Intent created: ${intent.id} for ${wallet}`);

    res.json({ 
      success: true, 
      paymentId: intent.id,
      amount: intent.amount,
      status: 'AWAITING_PAYMENT' 
    });
  } catch (err: any) {
    logger.error(`[Payment] Start failed: ${err.message}`);
    res.status(500).json({ success: false, error: 'Could not initialize payment' });
  }
}

/**
 * Confirms on-chain transaction and delivers the "PRO_PLAN" API Key.
 */
export async function confirmPayment(req: Request, res: Response) {
  try {
    const { paymentId, txHash } = req.body;

    if (!paymentId || !txHash) {
      return res.status(400).json({ success: false, error: 'paymentId and txHash are required' });
    }

    logger.info(`[Payment] Verifying transaction: ${txHash}`);

    // 1. Verify the On-Chain Transaction (Heavy-Duty check)
    const confirmedPayment = await paymentService.verifyTransaction(paymentId, txHash);
    
    // 2. Provisioning: Auto-generate/Upgrade API key for the wallet
    // This is where we deliver the value for the payment
    const apiKeyData = await apiService.generateKey(confirmedPayment.wallet, "PRO_PLAN");

    logger.info(`[Payment] Success! Pro Key generated for ${confirmedPayment.wallet}`);

    res.json({ 
      success: true, 
      status: 'confirmed', 
      data: {
        payment: confirmedPayment,
        apiKey: apiKeyData.key,
        plan: apiKeyData.plan
      }
    });

  } catch (err: any) {
    logger.warn(`[Payment] Confirmation failed: ${err.message}`);
    res.status(400).json({ 
      success: false, 
      error: err.message || 'Transaction verification failed' 
    });
  }
}
