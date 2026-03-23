import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { logger } from '../utils/logger.js';

const connectionString = process.env.DATABASE_URL;

// 1. Create a high-performance connection pool
const pool = new pg.Pool({ 
  connectionString,
  max: 20, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error(`[Database] Unexpected pool error: ${err.message}`);
});

/**
 * DATABASE INITIALIZER
 * Verifies the connection before the server starts.
 */
export async function connectDB() {
  try {
    const client = await pool.connect();
    client.release();
    logger.info('[Database] Connection verified via PG Pool.');
  } catch (err: any) {
    logger.error(`[Database] Connection failed: ${err.message}`);
    process.exit(1);
  }
}

// 2. Initialize Prisma with the PG Adapter
// Fix: 'as any' is required to bypass the @types/pg version mismatch
const adapter = new PrismaPg(pool as any);
export const prisma = new PrismaClient({ adapter });

logger.info('[Database] Prisma Client with PG Adapter initialized.');
