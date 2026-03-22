import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

/**
 * Environment Validator
 * Ensures all critical infrastructure keys are present before the index starts.
 */
const REQUIRED_VARS = [
  'DATABASE_URL',
  'ALCHEMY_API_KEY',
  'REVENUE_ADDRESS',
  'BASE_RPC_URL',
  'PORT'
];

/**
 * Validates the presence of required .env variables.
 * Stops the process if critical data is missing.
 */
export const validateEnv = () => {
  const missing = REQUIRED_VARS.filter(v => !process.env[v]);

  if (missing.length > 0) {
    logger.error(`[EnvConfig] CRITICAL: Missing required variables: ${missing.join(', ')}`);
    process.exit(1); 
  }

  logger.info('[EnvConfig] Infrastructure environment validated.');
};

export const env = {
  // Server Config
  port: Number(process.env.PORT) || 5000,
  isDev: process.env.NODE_ENV !== 'production',
  
  // Database & Security
  dbUrl: process.env.DATABASE_URL as string,
  apiSecret: process.env.API_SECRET || 'WIP_DEFAULT_SECRET_CHANGE_ME',

  // Blockchain Infrastructure
  alchemyKey: process.env.ALCHEMY_API_KEY as string,
  
  // Treasury (destination)
  revenueAddress: process.env.REVENUE_ADDRESS as string,

  // High-Reliability RPC Defaults
  rpc: {
    eth: process.env.ETH_RPC || 'https://eth.llamarpc.com',
    bsc: process.env.BSC_RPC || 'https://binance.llamarpc.com',
    polygon: process.env.POLYGON_RPC || 'https://polygon.llamarpc.com',
    base: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  }
};

// Also export as ENV for compatibility with my existing index.ts
export const ENV = env;
