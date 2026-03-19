import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Express } from 'express';

type RouteModule = {
  routeConfig?: {
    path: string;
    router: any;
  };
};

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadRoutes(app: Express) {
  const modulesPath = path.join(__dirname, '../modules');
  const moduleFolders = fs.readdirSync(modulesPath);

  for (const folder of moduleFolders) {
    const fullPath = path.join(modulesPath, folder);
    if (!fs.statSync(fullPath).isDirectory()) continue;

    const files = fs.readdirSync(fullPath);

    for (const file of files) {
      if (!file.endsWith('.routes.js') && !file.endsWith('.routes.ts')) continue;
      const filePath = path.join(fullPath, file);

      try {
        // Dynamic import for ESM
        const mod: RouteModule = await import(filePath);
        if (mod.routeConfig) {
          app.use('/api' + mod.routeConfig.path, mod.routeConfig.router);
          console.log(`Loaded route: /api${mod.routeConfig.path}`);
        }
      } catch (err) {
        console.error(`Failed loading ${filePath}`, err);
      }
    }
  }
}
