import { prisma } from '../../config/database.js';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

/**
 * Premium API Key Service
 * Manages secure key generation, plan upgrades, and usage tracking.
 */
export const apiService = {
  /**
   * Generates or Upgrades an API Key for a specific wallet.
   * Logic: If key exists, upgrade the plan. If not, create a new one.
   */
  async generateKey(wallet: string, plan: string) {
    const safeAddr = wallet.toLowerCase();

    try {
      //  Check for existing key to handle "Upgrades" vs "New"
      const existing = await prisma.apiKey.findUnique({ 
        where: { wallet: safeAddr } 
      });

      if (existing) {
        // If already have this plan or better, just return it
        if (existing.plan === plan) return existing;

        logger.info(`[ApiService] Upgrading key for ${safeAddr} to ${plan}`);
        return await prisma.apiKey.update({
          where: { wallet: safeAddr },
          data: { plan } // Upgrade the tier (e.g., FREE -> PRO)
        });
      }

      // Generation: Create a high-entropy Secure Key
      // Prefix 'WIP_SK_' (Wallet inteligence Protocol
      const key = `WIP_SK_${crypto.randomBytes(24).toString('hex').toUpperCase()}`;

      logger.info(`[ApiService] Generating NEW ${plan} key for ${safeAddr}`);

      return await prisma.apiKey.create({
        data: { 
          key, 
          wallet: safeAddr, 
          plan,
          usage: 0 
        }
      });
    } catch (error: any) {
      logger.error(`[ApiService] Key generation failed: ${error.message}`);
      throw new Error("Critical error provisioning API access");
    }
  },

  /**
   * High-Performance Usage Tracking
   * Updates the counter in the DB. Sit inside the Validator middleware.
   */
  async validateAndIncrement(key: string) {
    try {
      return await prisma.apiKey.update({
        where: { key },
        data: { usage: { increment: 1 } }
      });
    } catch (err: any) {
      logger.warn(`[ApiService] Failed to increment usage for ${key}: ${err.message}`);
      return null;
    }
  },

  /**
   * Fetches the current status and limits for a wallet
   */
  async getStats(wallet: string) {
    const safeAddr = wallet.toLowerCase();
    const stats = await prisma.apiKey.findUnique({
      where: { wallet: safeAddr }
    });

    if (!stats) {
      return { wallet: safeAddr, hasActiveKey: false, plan: 'NONE', usage: 0 };
    }

    return { 
      ...stats, 
      hasActiveKey: true,
      // UI hint: 
      isPro: stats.plan === 'PRO_PLAN' 
    };
  }
};
