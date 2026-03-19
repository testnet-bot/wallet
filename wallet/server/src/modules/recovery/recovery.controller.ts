import { Request, Response } from 'express';

export function recoverDust(req: Request, res: Response) {
  res.json({ success: true, recovered: 0 });
}
