import express from 'express';
import { scanSecurityController } from './security.controller.js';
import { validator } from '../../utils/validator.js';

const router = express.Router();

/**
 * 2026 PRODUCTION UPGRADE: 
 * Explicitly placing JSON parser at the Router level to ensure 
 * req.body is populated before the Validator runs during parallel bursts.
 */
router.use(express.json());

/**
 * @route   GET /api/v1/security/scan
 * @desc    Scans for risky contract approvals (URL-based lookup)
 */
router.get('/scan', validator.validateRequestBody, scanSecurityController);

/**
 * @route   POST /api/v1/security/scan
 * @desc    Institutional Security Audit (JSON-body based)
 */
router.post('/scan', validator.validateRequestBody, scanSecurityController);

export const routeConfig = {
  path: '/v1/security',
  router: router,
  isPublic: false,
  isCritical: true
};
