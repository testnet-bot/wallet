import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env, validateEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { loadRoutes } from './core/routeLoader.js';
import { prisma, connectDB } from './config/database.js';

// ─── WORKER & OBSERVER IMPORTS ─────────────────
import { startAutoBurnWorker } from './workers/autoBurnWorker.js';
import { startDustWorker } from './workers/dustRecoveryWorker.js';
import { startSpamWorker } from './workers/spamSweepWorker.js';
import { startHealthWorker } from './workers/walletHealthWorker.js';

/**
 * UPGRADED: Production-Grade Bootstrap.
 * Features: Graceful Shutdown, Payload Security, and Worker Orchestration.
 */
(async () => {
  try {
    // 1. PRE-FLIGHT CHECKS
    // Fail fast if environment variables are missing
    validateEnv();
    await connectDB();

    const app = express();

    //  SECURITY MIDDLEWARE
    // Restrict CORS to production domains to prevent unauthorized API calls
    app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }));

    app.use(helmet());
    
    // Limit JSON size to prevent "Body Bloat" attacks on the recovery engine
    app.use(express.json({ limit: '1mb' })); 
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));  
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

    // 3. HEARTBEATS & OBSERVERS (The "Live" Engine)
    // Delayed start to ensure DB connections are saturated before workers pull tasks
    setTimeout(() => {
      startAutoBurnWorker();
      startDustWorker();
      startSpamWorker();
      startHealthWorker();
      logger.info(`[System] All Automation Workers Initialized.`);
    }, 5000);

    // 4. DYNAMIC ROUTE LOADING
    await loadRoutes(app);

    // 5. ROOT HEALTH CHECK (Internal Audit)
    app.get('/', (_, res) => {
      res.json({ 
        status: 'ONLINE', 
        version: '1.2.0-PROD',
        engine: 'FLASHBOTS_SHIELDED',
        uptime: process.uptime(),
        timestamp: new Date().toISOString() 
      });
    });

    // 6. GLOBAL ERROR BOUNDARY (Safe Masking)
    app.use((err: any, _req: any, res: any, _next: any) => {
      logger.error(`[Fatal Server Error] ${err.stack || err.message}`);
      
      // Never leak internal database or RPC errors to the public in production
      res.status(err.status || 500).json({ 
        success: false, 
        error: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred.'
      });
    });

    // 7. FINAL BOOT & GRACEFUL SHUTDOWN
    const server = app.listen(env.port, () => {
      logger.info(`[System] WIP Backend Live on Port ${env.port}`);
      logger.info(`[System] MEV-Shielding Active | Production Mode: ${process.env.NODE_ENV}`);
      
      // 2026 DIAGNOSTIC: Log all registered routes to verify 'v1/security/scan' mapping
      if (process.env.NODE_ENV !== 'production') {
          const registeredPaths = app._router.stack
            .filter((r: any) => r.route)
            .map((r: any) => `${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`);
          logger.info(`[Debug] Active Endpoints: ${JSON.stringify(registeredPaths)}`);
      }
    });

    // Handle "Real Money" Safety: Clean up connections when the server stops
    const shutdown = async () => {
      logger.warn('[System] Shutdown signal received. Closing resources...');
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('[System] Prisma disconnected. Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (err: any) {
    logger.error(`[System] Bootstrap Failed: ${err.stack || err.message}`);
    process.exit(1);
  }
})();
