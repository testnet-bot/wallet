import { detectDustTokens } from './dustCalculator'
import { swapDustToETH } from '../../transactions/swapExecutor'

export async function executeDustRecovery(walletAddress: string) {
  // 1. Detect dust
  const dustTokens = await detectDustTokens(walletAddress)
  if (!dustTokens.length) return { recovered: 0, message: "No dust tokens found" }

  // 2. Swap dust tokens
  const swapped = await swapDustToETH(walletAddress, dustTokens)

  // 3. Calculate fee
  const fee = swapped.total * 0.0125 // 1.25% for auto recovery
  return { recovered: swapped.total - fee, fee, tokens: dustTokens }
}
