import { Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { isAddress, getAddress, Wallet } from 'ethers';
import crypto from 'crypto';

/**
 * UPGRADED: Production-Grade Automation Controller (Custodian Grade).
 * Features: Zero-Leak Data Redaction, Key-to-Address Ownership Validation, 
 * Idempotency Guards, and Audit Trailing.
 * INTEGRATION: Fully aligned with chainId and chain schema updates.
 */
export const automationController = {
  /**
   * GET all rules for a specific wallet.
   * Upgraded: Strict redaction and sorting by activity/recency.
   */
  async getRules(req: Request, res: Response) {
    const traceId = `GET-RULES-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    try {
      const { address } = req.query;
      if (!address || typeof address !== 'string' || !isAddress(address)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Valid EVM address required for lookup.', 
          traceId,
          code: 'INVALID_ADDRESS'
        });
      }

      const safeAddress = getAddress(address);

      const rules = await prisma.automationRule.findMany({
        where: { walletAddress: safeAddress },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          walletAddress: true,
          chain: true,
          chainId: true, 
          type: true,
          active: true,
          targetBalance: true,
          createdAt: true,
          updatedAt: true,
          // SECURITY: privateKey is physically excluded from the projection
        }
      });

      res.status(200).json({ 
        success: true, 
        meta: { count: rules.length, traceId, timestamp: new Date().toISOString() },
        rules 
      });
    } catch (error: any) {
      logger.error(`[Automation][${traceId}] GetRules Failure: ${error.message}`);
      res.status(500).json({ success: false, error: 'Failed to retrieve automation registry', traceId });
    }
  },

  /**
   * ADD a new rule to the DB.
   * UPGRADED: Validates Key ownership and prevents duplicate active rule injection.
   * COMPLIANCE: Handles both chain (String) and chainId (Int) for schema alignment.
   */
  async addRule(req: Request, res: Response) {
    const traceId = `ADD-RULE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    try {
      const { address, chain, chainId, type, targetBalance, privateKey } = req.body;

      // 1. STRICT INPUT VALIDATION
      // UPGRADED: Now accepts chainId as a valid chain identifier
      if (!address || (!chain && !chainId) || !type || !privateKey) {
        return res.status(400).json({ success: false, error: 'Required fields (address, chain/chainId, type, privateKey) are missing.', traceId });
      }

      const safeAddress = getAddress(address);
      const cleanChain = (chain || chainId).toString().toUpperCase();
      const safeChainId = chainId ? parseInt(chainId.toString()) : 1; 
      const ruleType = type.toString().toUpperCase();

      // 2. CRYPTOGRAPHIC OWNERSHIP VALIDATION
      try {
        const validationWallet = new Wallet(privateKey.toString());
        if (getAddress(validationWallet.address) !== safeAddress) {
          throw new Error('Key does not match the provided wallet address');
        }
      } catch (e: any) {
        logger.warn(`[Automation][${traceId}] SECURITY_ALERT: Key mismatch for ${safeAddress}`);
        return res.status(401).json({ 
          success: false, 
          error: 'Unauthorized: The private key provided does not control this wallet address.', 
          traceId 
        });
      }

      // 3. IDEMPOTENCY GUARD
      const existing = await prisma.automationRule.findFirst({
        where: { 
          walletAddress: safeAddress, 
          chainId: safeChainId, 
          type: ruleType, 
          active: true 
        }
      });

      if (existing) {
        return res.status(409).json({ 
          success: false, 
          error: `An active ${ruleType} rule already exists for chain ${safeChainId}.`, 
          traceId 
        });
      }

      // 4. PERSISTENCE (Encrypted at Rest via Prisma Middleware)
      const rule = await prisma.automationRule.create({
        data: {
          chain: cleanChain,
          chainId: safeChainId, // UPGRADED: Added required Int field
          type: ruleType,
          privateKey: privateKey.toString(), 
          active: true,
          targetBalance: targetBalance?.toString() || '0',
          wallet: {
            connect: { address: safeAddress }
          }
        }
      });

      // 5. POST-WRITE REDACTION
      const { privateKey: _, ...safeRule } = rule;

      logger.info(`[Automation][${traceId}] RULE_CREATED: ${ruleType} for ${safeAddress} on ${cleanChain}`);
      res.status(201).json({ success: true, rule: safeRule, traceId });

    } catch (error: any) {
      logger.error(`[Automation][${traceId}] AddRule Fatal: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: 'Critical error while registering automation rule.',
        detail: error.message,
        traceId
      });
    }
  },

  /**
   * TOGGLE or UPDATE a rule.
   * Upgraded: Atomic updates with Key-Validation on change.
   */
  async updateRule(req: Request, res: Response) {
    const traceId = `UPD-RULE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Valid Rule ID required.', traceId });

      const { active, targetBalance, privateKey, chainId } = req.body;

      // 1. RE-VALIDATE KEY IF PROVIDED
      let updateData: any = {};
      if (active !== undefined) updateData.active = !!active;
      if (targetBalance !== undefined) updateData.targetBalance = targetBalance.toString();
      if (chainId !== undefined) updateData.chainId = parseInt(chainId.toString());

      if (privateKey) {
        const existing = await prisma.automationRule.findUnique({ where: { id } });
        if (!existing) throw new Error('Rule not found');

        const validationWallet = new Wallet(privateKey.toString());
        if (getAddress(validationWallet.address) !== getAddress(existing.walletAddress)) {
          return res.status(401).json({ success: false, error: 'New key does not match rule address.', traceId });
        }
        updateData.privateKey = privateKey.toString();
      }

      // 2. ATOMIC UPDATE
      const updated = await prisma.automationRule.update({
        where: { id },
        data: updateData
      });

      const { privateKey: _, ...safeUpdated } = updated;
      logger.info(`[Automation][${traceId}] RULE_UPDATED: ID ${id} | Active: ${updated.active}`);

      res.status(200).json({ success: true, rule: safeUpdated, traceId });
    } catch (error: any) {
      logger.error(`[Automation][${traceId}] UpdateRule Error: ${error.message}`);
      res.status(404).json({ success: false, error: 'Automation rule not found or update invalid.', traceId });
    }
  },

  /**
   * DELETE a rule.
   * Upgraded: Forensic logging of manual intervention.
   */
  async deleteRule(req: Request, res: Response) {
    const traceId = `DEL-RULE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid Rule ID.', traceId });

      const rule = await prisma.automationRule.findUnique({ where: { id } });
      if (!rule) {
        return res.status(404).json({ success: false, error: 'Rule does not exist.', traceId });
      }

      await prisma.automationRule.delete({ where: { id } });
      
      logger.warn(`[Automation][${traceId}] RULE_DELETED: ID ${id} for ${rule.walletAddress}`);
      res.json({ success: true, message: 'Automation rule successfully decommissioned.', traceId });
    } catch (error: any) {
      logger.error(`[Automation][${traceId}] DeleteRule Failure: ${error.message}`);
      res.status(500).json({ success: false, error: 'Internal system error during deletion.', traceId });
    }
  }
};
