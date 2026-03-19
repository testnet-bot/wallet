import fs from 'fs';
import path from 'path';
import { Express } from 'express';
import { logger } from '../utils/logger';

export function loadRoutes(app: Express) {
  const modulesPath = path.join(__dirname, '../modules');

  const modules = fs.readdirSync(modulesPath);

  modules.forEach((moduleName) => {
    const routeFile = path.join(
      modulesPath,
      moduleName,
      `${moduleName}.routes.ts`
    );

    if (fs.existsSync(routeFile)) {
      try {
        const routeModule = require(routeFile);

        if (routeModule.routeConfig) {
          const { path: routePath, router } = routeModule.routeConfig;

          app.use(`/api${routePath}`, router);

          logger.info(`Loaded route: /api${routePath}`);
        }
      } catch (err: any) {
        logger.error(`Failed loading ${moduleName}: ${err.message}`);
      }
    }
  });
}
