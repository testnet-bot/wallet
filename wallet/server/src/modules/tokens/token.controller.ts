import { Request, Response } from 'express';
import { fetchWalletTokens } from './token.service.js';

export async function scanTokens(req: Request, res: Response) {
  try {
    const address = req.query.address as string;

    if (!address || !address.startsWith('0x')) {
      return res.status(400).json({ 
        success: false, 
        error: 'A valid EVM wallet address is required' 
      });
    }

    const report = await fetchWalletTokens(address);

    res.status(200).json({
      success: true,
      wallet: address,
      ...report
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
