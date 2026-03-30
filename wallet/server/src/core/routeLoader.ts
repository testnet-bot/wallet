import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Express } from 'express';
import { logger } from '../utils/logger.js';
import { validator } from '../utils/validator.js';

type RouteModule = {
  routeConfig?: {
    path: string;
    router: any;
    isPublic?: boolean;
    isCritical?: boolean; 
  };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * UPGRADED: Production-Grade Dynamic Route Loader.
 * Features: Security Gating, Critical Path Enforcement, and ESM Interop.
 */
export async function loadRoutes(app: Express) {
  const modulesPath = path.join(__dirname, '../modules');
  
  if (!fs.existsSync(modulesPath)) {
    logger.error(`[RouteLoader] FATAL: Modules directory missing at ${modulesPath}`);
    process.exit(1); // Real money safety: Cannot run without modules
  }

  // Use recursive scanning to find nested .routes files
  const getRouteFiles = (dir: string): string[] => {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getRouteFiles(filePath));
      } else if (file.match(/\.routes\.(ts|js)$/)) {
        results.push(filePath);
      }
    });
    return results;
  };

  const routeFiles = getRouteFiles(modulesPath);
  logger.info(`[RouteLoader] Found ${routeFiles.length} potential API modules.`);

  for (const filePath of routeFiles) {
    const fileName = path.basename(filePath);
    
    try {
      // 1. ESM Cross-Platform Import
      const moduleUrl = `${pathToFileURL(filePath).href}?update=${Date.now()}`;
      const mod: RouteModule = await import(moduleUrl);

      if (!mod || !mod.routeConfig) {
        logger.warn(`[RouteLoader] Skipping ${fileName}: No valid routeConfig exported.`);
        continue;
      }

      const { path: subPath, router, isPublic, isCritical } = mod.routeConfig;
      
      // 2026 UPGRADE: Path Normalization to prevent // slash collisions in high-traffic routing
      const normalizedSubPath = subPath.startsWith('/') ? subPath : `/${subPath}`;
      const apiPath = `/api${normalizedSubPath}`.replace(/\/+/g, '/');

      // 2. SECURITY GUARDIAN (Middleware Injection)
      // Every non-public route is automatically shielded by the API Key Validator
      if (isPublic) {
        app.use(apiPath, router);
      } else {
        // Enforce Authentication and Rate Limiting for high-value endpoints
        app.use(apiPath, validator.apiKeyAuth, router);
      }

      logger.info(`[RouteLoader] Mounted: ${apiPath} [${isPublic ? 'PUBLIC' : 'PROTECTED'}] [Critical: ${!!isCritical}]`);

    } catch (err: any) {
      const isCritical = filePath.includes('recovery') || filePath.includes('security');
      logger.error(`[RouteLoader] Failed to load ${fileName}: ${err.message}`);

      // 3. FAIL-SAFE: If a security/recovery route fails, shut down the engine
      if (isCritical) {
        logger.error(`[RouteLoader] CRITICAL MODULE FAILED. Emergency shutdown to prevent data leak.`);
        process.exit(1);
      }
    }
  }
}
