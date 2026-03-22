import express from 'express';
import { scanWalletController } from './wallet.controller.js';

const router = express.Router();

/**
 * @route   GET /api/v1/wallet/scan
 * @desc    Quick scan for a single wallet
 */
router.get('/scan', scanWalletController);

/**
 * @route   POST /api/v1/wallet/scan-full
 * @desc    Deep multi-chain scan with classification
 */
router.post('/scan-full', scanWalletController);

export const routeConfig = {
  path: '/v1/wallet',
  router: router,
  isPublic: false 
};
