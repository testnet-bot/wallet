import express from 'express';
import { scanTokens } from './token.controller.js';

const tokensRouter = express.Router();

// GET /api/v1/tokens/scan?address=0x...
tokensRouter.get('/scan', scanTokens);

export const tokenRoutes = {
  path: '/tokens',
  router: tokensRouter,
};
