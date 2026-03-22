import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env, validateEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { loadRoutes } from './core/routeLoader.js';

// ─── WORKER IMPORTS ────────────────────────────
import { startAutoBurnWorker } from './workers/autoBurnWorker.js';
import { startDustWorker } from './workers/dustRecoveryWorker.js';
import { startSpamWorker } from './workers/spamSweepWorker.js';
import { startHealthWorker } from './workers/walletHealthWorker.js';

(async () => {
  // 1. Validate Environment before anything else
  validateEnv();

  const app = express();

  // 2. Global Middleware
  app.use(cors());
  app.use(helmet());
  app.use(express.json());
  app.use(morgan('dev'));

  // 3. System Heartbeats (The "Live" Engine)
  startAutoBurnWorker();
  startDustWorker();
  startSpamWorker();
  startHealthWorker();

  // 4. Health Check
  app.get('/', (_, res) => {
    res.json({ 
      status: 'ONLINE', 
      engine: 'WIP-Tier-1', 
      timestamp: new Date().toISOString() 
    });
  });

  // 5. Dynamic Route Loading
  await loadRoutes(app);

  // 6. Global Error Boundary
  app.use((err: any, _req: any, res: any, _next: any) => {
    logger.error(`[Fatal] ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: env.isDev ? err.message : undefined
    });
  });

  // 7. Start Server
  app.listen(env.port, () => {
    logger.info(`🚀 WIP Backend Live on Port ${env.port}`);
    logger.info(`Network: ${env.isDev ? 'Development' : 'Production'}`);
  });
})();
