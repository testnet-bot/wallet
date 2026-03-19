import { Request, Response } from 'express';

export function burnToken(req: Request, res: Response) {
  res.json({ success: true, burned: req.body.token });
}
