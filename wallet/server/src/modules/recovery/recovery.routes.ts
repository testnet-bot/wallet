import express from 'express';
import { recoverDustController } from './recovery.controller.js';

const router = express.Router();

/**
 * @route   POST /api/v1/recovery/dust
 * @desc    Initialize a dust rescue mission
 */
router.post('/dust', recoverDustController);

export const routeConfig = {
  path: '/v1/recovery',
  router: router,
  isPublic: false
};
