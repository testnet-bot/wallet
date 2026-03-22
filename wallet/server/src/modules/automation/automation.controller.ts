import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { isAddress } from 'ethers';

/**
 * Premium Automation Controller
 * Manages user-defined rules stored securely in PostgreSQL (Prisma).
 */
export const automationController = {
  // GET all rules for a specific wallet
  async getRules(req: Request, res: Response) {
    try {
      const { address } = req.query;
      if (!address || !isAddress(address as string)) {
        return res.status(400).json({ success: false, error: 'Valid address required' });
      }

      const rules = await prisma.automationRule.findMany({
        where: { walletAddress: (address as string).toLowerCase() }
      });

      res.json({ success: true, rules });
    } catch (error: any) {
      logger.error(`[Automation] GetRules failed: ${error.message}`);
      res.status(500).json({ success: false, error: 'Failed to fetch rules' });
    }
  },

  // ADD a new rule to the DB
  async addRule(req: Request, res: Response) {
    try {
      const { address, chain, type, targetBalance } = req.body;

      if (!address || !chain || !type) {
        return res.status(400).json({ success: false, error: 'address, chain, and type required' });
      }

      const rule = await prisma.automationRule.create({
        data: {
          walletAddress: address.toLowerCase(),
          chain,
          type,
          active: true,
          targetBalance: targetBalance?.toString()
        }
      });

      logger.info(`[Automation] New rule added for ${address}: ${type} on ${chain}`);
      res.json({ success: true, rule });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // TOGGLE or UPDATE a rule
  async updateRule(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { active, targetBalance } = req.body;

      const updated = await prisma.automationRule.update({
        where: { id },
        data: { 
          active: typeof active === 'boolean' ? active : undefined,
          targetBalance: targetBalance?.toString()
        }
      });

      res.json({ success: true, updated });
    } catch (error: any) {
      res.status(404).json({ success: false, error: 'Rule not found or update failed' });
    }
  },

  // DELETE a rule
  async deleteRule(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await prisma.automationRule.delete({ where: { id } });
      res.json({ success: true, message: 'Rule deleted permanently' });
    } catch (error: any) {
      res.status(404).json({ success: false, error: 'Rule not found' });
    }
  }
};
