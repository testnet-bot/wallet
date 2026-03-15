import { Request, Response } from 'express'
import * as RecoveryService from './recovery.service'

export async function recoverDust(req: Request, res: Response) {
  const { walletAddress } = req.body
  if (!walletAddress) return res.status(400).json({ error: "Missing walletAddress" })

  try {
    const result = await RecoveryService.executeDustRecovery(walletAddress)
    res.json(result)
  } catch (err) {
    console.error("Recovery failed:", err)
    res.status(500).json({ error: "Recovery failed" })
  }
}
