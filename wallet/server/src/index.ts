import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env, validateEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { loadRoutes } from './core/routeLoader.js';
import { connectDB } from './config/database.js';

// ─── WORKER & OBSERVER IMPORTS ─────────────────
import { startAutoBurnWorker } from './workers/autoBurnWorker.js';
import { startDustWorker } from './workers/dustRecoveryWorker.js';
import { startSpamWorker } from './workers/spamSweepWorker.js';
import { startHealthWorker } from './workers/walletHealthWorker.js';
import { startPaymentListener } from './modules/payment/payment.listener.js';

/**
 * CORE RECOVERY ENGINE BOOTSTRAP
 */
(async () => {
  try {
    // 1. Pre-flight Checks (Fail fast if config is missing)
    validateEnv();
    await connectDB();

    const app = express();

    // 2. Global Middleware
    app.use(cors());
    app.use(helmet());
    app.use(express.json());
    app.use(morgan('dev'));

    // 3. Heartbeats & Observers (The "Live" Engine)
    // These now use the upgraded services with privateKey support
    startAutoBurnWorker();
    startDustWorker();
    startSpamWorker();
    startHealthWorker();
    startPaymentListener();

    // 4. Dynamic Route Loading
    await loadRoutes(app);

    // 5. Root Health Check
    app.get('/', (_, res) => {
      res.json({ 
        status: 'ONLINE', 
        version: '1.1.1-HEAVY',
        engine: 'FLASHBOTS_SHIELDED',
        timestamp: new Date().toISOString() 
      });
    });

    // 6. Global Error Boundary
    app.use((err: any, _req: any, res: any, _next: any) => {
      logger.error(`[Fatal Server Error] ${err.message}`);
      res.status(500).json({ 
        success: false, 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });

    // 7. Final Boot
    app.listen(env.port, () => {
      logger.info(`[System] WIP Backend Live on Port ${env.port}`);
      logger.info(`[System] MEV-Shielding Active on Mainnet`);
    });

  } catch (err: any) {
    console.error(`[System] Bootstrap Failed: ${err.message}`);
    process.exit(1);
  }
})();
