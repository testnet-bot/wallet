import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { ENV } from './config/env.js';
import { logger } from './utils/logger.js';
import { loadRoutes } from './core/routeLoader.js';

(async () => {
  const app = express();

  // ─── GLOBAL MIDDLEWARE ─────────────────────────
  app.use(cors());
  app.use(express.json());
  app.use(helmet());
  app.use(morgan('dev'));

  // ─── HEALTH CHECK ──────────────────────────────
  app.get('/', (_, res) => {
    res.send('WIP Backend Running');
  });

  // ─── DYNAMIC ROUTES ────────────────────────────
  await loadRoutes(app);

  // ─── GLOBAL ERROR HANDLER ──────────────────────
  app.use((err: any, _req: any, res: any, _next: any) => {
    logger.error(err.message);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  });

  // ─── START SERVER ──────────────────────────────
  app.listen(ENV.PORT, () => {
    logger.info(`Server running on port ${ENV.PORT}`);
  });
})();
