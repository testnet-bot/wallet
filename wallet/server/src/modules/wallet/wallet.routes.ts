import express from 'express';
import { walletSummary } from './wallet.controller';

const walletRouter = express.Router();

walletRouter.get('/summary', walletSummary);

export const routeConfig = {
  path: '/wallet',
  router: walletRouter,
};
