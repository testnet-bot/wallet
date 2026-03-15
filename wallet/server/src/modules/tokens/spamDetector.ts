export function markSpamTokens(tokens: any[]) {
  return tokens.map(t => ({
    ...t,
    type: t.symbol.startsWith('SPAM') ? 'spam' : t.symbol.startsWith('DUST') ? 'dust' : 'normal'
  }))
}
