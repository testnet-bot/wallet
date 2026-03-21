export interface TokenClassification {
  status: 'verified' | 'spam' | 'dust';
  securityNote: string | null;
}

export function classifyToken(asset: any): TokenClassification {
  const name = (asset.name || '').toLowerCase();
  const symbol = (asset.symbol || '').toLowerCase();

  // 1. Check for Phishing/Scam Heuristics
  const scamKeywords = ['visit', '.com', '.io', '.net', 'claim', 'free', 'reward'];
  const isScamLink = scamKeywords.some(keyword => name.includes(keyword) || symbol.includes(keyword));

  if (isScamLink || (asset.type === 'erc20' && !asset.logo)) {
    return { 
      status: 'spam', 
      securityNote: 'Unverified contract or potential phishing link' 
    };
  }

  // 2. Check for Dust (Native or Token with extremely low balance)
  const val = parseFloat(asset.balance);
  if (val > 0 && val < 0.005) {
    return { 
      status: 'dust', 
      securityNote: 'Low balance: Suitable for Rescue Mission' 
    };
  }

  // 3. Default Verified
  return { 
    status: 'verified', 
    securityNote: null 
  };
}
