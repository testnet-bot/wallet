import { Request, Response } from 'express';

export function walletSummary(req: Request, res: Response) {
  res.json({ success: true, data: { wallet: 'sample summary' } });
}
