import { markSpamTokens } from './spamDetector'

export async function fetchWalletTokens(walletAddress: string) {
  // Stub: simulate fetching tokens
  const tokens = [
    { symbol: 'ETH', balance: 1 },
    { symbol: 'DUST1', balance: 0.01 },
    { symbol: 'SPAM1', balance: 0.02 },
  ]

  // Mark spam tokens
  return markSpamTokens(tokens)
}
