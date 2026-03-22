import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';
import { logger } from '../utils/logger.js';

/**
 * Prisma 7 Connection Architect
 * Required for Rust-free runtime. Uses native pg pool and Prisma driver adapter.
 */
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// 1. Setup the native Postgres pool
const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// 2. Initialize the Prisma Adapter (Mandatory for Prisma 7+)
const adapter = new PrismaPg(pool);

// 3. Create the Client using the adapter
export const prisma = globalForPrisma.prisma || new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Verifies the DB connection on boot
 */
export async function connectDB() {
  try {
    // Prisma 7 uses the adapter to verify connectivity
    await prisma.$connect();
    logger.info('[Database] PostgreSQL Connection Verified via Driver Adapter.');
  } catch (err: any) {
    logger.error(`[Database] Connection Failed: ${err.message}`);
    // In production, we don't always want to exit, but for diagnostics we do
    if (process.env.NODE_ENV === 'test') process.exit(1);
  }
}
