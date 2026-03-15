import { Request, Response } from 'express'
import * as BurnService from './burn.service'

export async function burnSpam(req: Request, res: Response) {
  const { walletAddress } = req.body
  if (!walletAddress) return res.status(400).json({ error: "Missing walletAddress" })

  try {
    const result = await BurnService.executeSpamBurn(walletAddress)
    res.json(result)
  } catch (err) {
    console.error("Burn failed:", err)
    res.status(500).json({ error: "Burn failed" })
  }
}
