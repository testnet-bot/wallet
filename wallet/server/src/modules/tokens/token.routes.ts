import express from 'express';
import { scanTokens } from './token.controller';

const tokensRouter = express.Router();

tokensRouter.get('/scan', scanTokens);

export const routeConfig = {
  path: '/tokens',
  router: tokensRouter,
};
