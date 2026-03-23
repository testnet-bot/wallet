import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { isAddress } from 'ethers';

/**
 * Premium Automation Controller
 * Manages user-defined rules stored securely in PostgreSQL (Prisma).
 * Upgraded: Handles PrivateKey and Wallet Relations for Flashbots Execution.
 */
export const automationController = {
  /**
   * GET all rules for a specific wallet
   */
  async getRules(req: Request, res: Response) {
    try {
      const { address } = req.query;
      if (!address || typeof address !== 'string' || !isAddress(address)) {
        return res.status(400).json({ success: false, error: 'Valid address required' });
      }

      const rules = await prisma.automationRule.findMany({
        where: { walletAddress: address.toLowerCase() }
      });

      res.json({ success: true, rules });
    } catch (error: any) {
      logger.error(`[Automation] GetRules failed: ${error.message}`);
      res.status(500).json({ success: false, error: 'Failed to fetch rules' });
    }
  },

  /**
   * ADD a new rule to the DB
   * Corrected: Uses 'connect' for the Wallet relation and includes 'privateKey'.
   */
  async addRule(req: Request, res: Response) {
    try {
      const { address, chain, type, targetBalance, privateKey } = req.body;

      if (!address || !chain || !type || !privateKey) {
        return res.status(400).json({ 
          success: false, 
          error: 'address, chain, type, and privateKey are required' 
        });
      }

      // We use 'connect' because AutomationRule has a @relation to Wallet
      const rule = await prisma.automationRule.create({
        data: {
          chain: chain.toString(),
          type: type.toString(),
          privateKey: privateKey.toString(),
          active: true,
          targetBalance: targetBalance?.toString() || null,
          wallet: {
            connect: { address: address.toLowerCase() }
          }
        }
      });

      logger.info(`[Automation] Rule added: ${type} for ${address}`);
      res.json({ success: true, rule });
    } catch (error: any) {
      logger.error(`[Automation] AddRule failed: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        message: 'Ensure the wallet address exists in the system before adding rules.'
      });
    }
  },

  /**
   * TOGGLE or UPDATE a rule
   */
  async updateRule(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

      const { active, targetBalance, privateKey } = req.body;

      const updated = await prisma.automationRule.update({
        where: { id },
        data: { 
          active: typeof active === 'boolean' ? active : undefined,
          targetBalance: targetBalance !== undefined ? targetBalance.toString() : undefined,
          privateKey: privateKey !== undefined ? privateKey.toString() : undefined
        }
      });

      res.json({ success: true, updated });
    } catch (error: any) {
      logger.error(`[Automation] UpdateRule failed for ID ${req.params.id}: ${error.message}`);
      res.status(404).json({ success: false, error: 'Rule not found' });
    }
  },

  /**
   * DELETE a rule
   */
  async deleteRule(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

      await prisma.automationRule.delete({ where: { id } });
      res.json({ success: true, message: 'Rule deleted permanently' });
    } catch (error: any) {
      logger.error(`[Automation] DeleteRule failed: ${error.message}`);
      res.status(404).json({ success: false, error: 'Rule not found' });
    }
  }
};
