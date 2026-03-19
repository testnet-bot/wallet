import { Request, Response } from 'express';

export function getRules(req: Request, res: Response) {
  res.json({ success: true, rules: [] });
}

export function updateRule(req: Request, res: Response) {
  res.json({ success: true, updated: req.body });
}
