import { Request, Response } from 'express';

export function scanTokens(req: Request, res: Response) {
  res.json({ success: true, tokens: [] });
}
