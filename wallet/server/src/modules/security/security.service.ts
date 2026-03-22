import { getAddress, formatUnits } from 'ethers';
import { getAlchemyUrl, getProvider } from '../../blockchain/provider.js';
import { logger } from '../../utils/logger.js';

export interface Allowance {
  tokenAddress: string;
  spender: string;
  amount: string;
  isInfinite: boolean;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  spenderName?: string;
  isMalicious?: boolean;
  maliciousReason?: string;
}

/**
 * Tier 1 Security Intelligence Service
 * Powered by GoPlus Security & Alchemy Simulation Engines.
 */
export const securityService = {
  /**
   * Scans for open token approvals and validates spenders against live threat databases.
   */
  async scanApprovals(walletAddress: string, network: string = 'ethereum'): Promise<Allowance[]> {
    const url = getAlchemyUrl(network);
    if (!url) return [];

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getTokenAllowances",
          params: [{ owner: getAddress(walletAddress), pageKey: null }]
        })
      });

      const { result } = await res.json();
      if (!result?.tokenAllowances) return [];

      // Parallel Real-Time Intelligence Check
      const allowances: Allowance[] = await Promise.all(
        result.tokenAllowances.map(async (allowance: any) => {
          const rawAmount = allowance.allowance;
          const isInfinite = rawAmount.includes('f') || rawAmount.startsWith('0xffffff'); 
          const spenderAddr = getAddress(allowance.spender);
          const tokenAddr = getAddress(allowance.tokenAddress);

          // LIVE CHECK: Real-time risk assessment via GoPlus Security API
          const securityProfile = await this.assessSpenderRisk(spenderAddr, network);
          
          let riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
          if (securityProfile.isMalicious) {
            riskLevel = 'CRITICAL';
          } else if (isInfinite) {
            riskLevel = 'HIGH';
          } else if (parseFloat(rawAmount) > 0) {
            riskLevel = 'MEDIUM';
          }

          return {
            tokenAddress: tokenAddr,
            spender: spenderAddr,
            amount: isInfinite ? 'Infinite' : rawAmount,
            isInfinite,
            riskLevel,
            spenderName: securityProfile.name || 'Unknown Contract',
            isMalicious: securityProfile.isMalicious,
            maliciousReason: securityProfile.reason
          };
        })
      );

      return allowances.sort((a, b) => (a.isMalicious ? -1 : 1));
    } catch (err: any) {
      logger.error(`[SecurityService] Approval scan failed: ${err.message}`);
      return [];
    }
  },

  /**
   * REAL-TIME THREAT DETECTION
   * Integrates with GoPlus API to detect malicious spenders and drainers.
   */
  async assessSpenderRisk(spender: string, network: string) {
    try {
      // 1. Logic: Verify if it's a contract
      const provider = getProvider(network);
      const code = await provider.getCode(spender);
      if (code === '0x') return { name: 'External Wallet', isMalicious: false };

      // 2. REAL CALL: GoPlus Security API (Free Tier / No Auth for Public Queries)
      // Chain mappings: Ethereum=1, BNB=56, Polygon=137, Arbitrum=42161, Base=8453
      const chainIdMap: Record<string, string> = { 'ethereum': '1', 'base': '8453', 'polygon': '137', 'bsc': '56' };
      const chainId = chainIdMap[network.toLowerCase()] || '1';
      
      const goPlusRes = await fetch(`https://api.gopluslabs.io{spender}?chain_id=${chainId}`);
      const { result } = await goPlusRes.json();

      if (result) {
        const isMalicious = result.is_contract === "1" && (
          result.is_open_source === "0" || 
          result.is_honeypot === "1" || 
          result.is_malicious_contract === "1" ||
          result.is_proxy === "1" // Proxies without verified targets are risky
        );

        return {
          name: result.contract_name || 'Unlabeled Contract',
          isMalicious: !!isMalicious,
          reason: isMalicious ? 'Malicious properties detected by GoPlus' : undefined
        };
      }

      return { name: 'Unknown Contract', isMalicious: false };
    } catch (err: any) {
      logger.warn(`[SecurityService] Spender risk check failed for ${spender}: ${err.message}`);
      return { name: 'Check Failed', isMalicious: false };
    }
  },

  /**
   * REAL TRANSACTION SIMULATION (Alchemy Asset Changes API)
   * Shows the user exactly what will happen to their wallet before signing.
   */
  async simulateAction(walletAddress: string, tx: { to: string; data: string; value?: string }, network: string = 'ethereum') {
    const url = getAlchemyUrl(network);
    if (!url) throw new Error('Network not supported for simulation');

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_simulateAssetChanges",
          params: [{
            from: getAddress(walletAddress),
            to: getAddress(tx.to),
            value: tx.value || "0x0",
            data: tx.data
          }]
        })
      });

      const { result, error } = await res.json();
      if (error) throw new Error(error.message);

      return {
        status: 'SUCCESS',
        changes: result.changes, // Real array of token ins/outs
        gasUsed: result.gasUsed,
        safe: result.changes.every((c: any) => c.changeType !== 'TRANSFER' || c.from.toLowerCase() !== walletAddress.toLowerCase())
      };
    } catch (err: any) {
      logger.error(`[SecurityService] Simulation failed: ${err.message}`);
      return { status: 'FAILED', error: err.message, safe: false };
    }
  }
};
