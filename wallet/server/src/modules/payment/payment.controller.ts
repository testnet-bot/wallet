import { Request, Response } from 'express';

export function processPayment(req: Request, res: Response) {
  res.json({ success: true, status: 'processed' });
}
