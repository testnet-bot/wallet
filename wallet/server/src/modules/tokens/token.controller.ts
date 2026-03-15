import { Request, Response } from 'express'
import * as TokenService from './token.service'

export async function listTokens(req: Request, res: Response) {
  const walletAddress = req.query.walletAddress as string
  if (!walletAddress) return res.status(400).json({ error: "Missing walletAddress" })

  try {
    const tokens = await TokenService.fetchWalletTokens(walletAddress)
    res.json(tokens)
  } catch (err) {
    console.error("Fetch tokens failed:", err)
    res.status(500).json({ error: "Fetch tokens failed" })
  }
}
