import { prisma } from '../config/database.js';
import { logger } from './logger.js';

export const mutex = {
  async acquire(lockId: string): Promise<boolean> {
    try {
      // Find or create the lock record
      const lock = await prisma.systemLock.upsert({
        where: { id: lockId },
        update: {},
        create: { id: lockId, isLocked: false }
      });

      if (lock.isLocked) {
        // Optional: Check if the lock is "stale" (older than 15 mins) and force release
        const isStale = (Date.now() - new Date(lock.updatedAt).getTime()) > 15 * 60 * 1000;
        if (!isStale) return false;
      }

      // Atomically set the lock
      await prisma.systemLock.update({
        where: { id: lockId },
        data: { isLocked: true }
      });

      return true;
    } catch (err) {
      return false;
    }
  },

  async release(lockId: string) {
    try {
      await prisma.systemLock.update({
        where: { id: lockId },
        data: { isLocked: false }
      });
    } catch (err: any) {
      logger.error(`[Mutex] Failed to release lock ${lockId}: ${err.message}`);
    }
  }
};
