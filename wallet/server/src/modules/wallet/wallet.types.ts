/**
 * BRANDED TYPES: Prevents logic errors by ensuring strings are 
 * validated before being used as addresses or chain IDs.
 * Logic: A 'string' cannot be used where an 'EvmAddress' is required.
 */
export type EvmAddress = string & { readonly __brand: unique symbol };
export type HexString = string & { readonly __brand: unique symbol };
export type TxHash = string & { readonly __brand: unique symbol };

/**
 * SUPPORTED NETWORKS: Strict enum for "real money" handling.
 * Updated March 2026: Included World Chain and the Superchain ecosystem.
 */
export type SupportedChain = 

  | 'ethereum' 
  | 'polygon' 
  | 'bsc' 

  | 'arbitrum' 
  | 'optimism' 
  | 'base' 

  | 'avalanche'
  | 'mantle'     // 2026 Modular Leader
  | 'worldchain'  // Human-centric L2

  | 'zksync'      // ZK-Rollup standard
  | 'linea'
  | 'berachain'   // 2026 Proof-of-Liquidity Standard

  | 'unichain';   // DeFi-centric L2

/**
 * EIP-7702 Metadata: Tracks the account's delegation status.
 * In 2026, most "EOAs" are actually delegating to a smart contract.
 */
export interface AccountDelegation {
  isDelegated: boolean;
  implementationAddress?: EvmAddress;
  authorizedKeys?: EvmAddress[];
  capabilities: ('batch' | 'gas_sponsorship' | 'session_keys' | 'paymaster_enabled')[];
}

/**
 * ASSET ARCHITECTURE: High-fidelity financial metadata.
 */
export interface Asset {
  chain: SupportedChain;
  chainId: number;
  symbol: string;
  name: string;
  // 'balance' is for display (e.g. "1.5"), 'rawBalance' is for BigInt (e.g. "1500000...")
  balance: string;  
  rawBalance: string; 
  decimals: number;
  type: 'native' | 'erc20' | 'erc721' | 'erc1155' | 'erc4626' | 'erc7535'; // Added 2026 Vault & RWA Standards
  contract: EvmAddress | null;
  logo: string | null;
  usdValue: number;
  status: 'verified' | 'spam' | 'dust' | 'clean' | 'rwa' | 'malicious';
  
  // Financial Intelligence
  priceSource?: 'coingecko' | 'binance' | 'dex' | 'pyth' | 'chainlink_rwa';
  lastPriceUsd?: number;
  priceChange24h?: number;
  liquidityUsd?: number; // Crucial for detecting "Low Liquidity" scams

  // Security Forensics
  isPermit2Enabled: boolean; 
  hasTransferHook: boolean;  // Detects "Gas Trap" or "Blacklist" hooks
  isBlacklisted?: boolean;   // Source: GoPlus/ThreatIntel
  sellTax?: number;          // Tax-aware yield calculation
}

/**
 * WALLET SCAN RESULT: The "Financial Audit" report.
 */
export interface WalletScanResult {
  meta: {
    traceId: string;
    checksummedAddress: EvmAddress;
    timestamp: string;
    latencyMs: number;
    accountType: 'EOA' | 'EIP-7702-Delegated' | 'SmartContract';
    delegation?: AccountDelegation;
    syncStatus: 'SYNCHRONIZED' | 'STALE' | 'PARTIAL';
  };
  summary: {
    totalAssets: number;
    totalUsdValue: number;
    totalCleanValue: number; 
    liquidValue: number;      // Value that can be moved immediately (minus tax/gas)
    spamCount: number;
    dustCount: number;
    highRiskCount: number;
    
    // EIP-7706 Multi-Dimensional Gas Estimates
    estimatedGasReport: {
      executionUsd: string;
      blobUsd: string;       // L1 Data availability cost
      calldataUsd: string;   // Transaction size cost
      totalNative: string;
    };
  };
  groups: {
    clean: Asset[];
    dust: Asset[];
    spam: Asset[];
    rwa: Asset[]; // Real World Assets (Tokenized Gold, Treasury Bills, etc.)
    malicious: Asset[];
  };
  all: Asset[];
}

/**
 * Audit Log Interface
 * Used for "Real Money" auditing and compliance tracking.
 */
export interface ScanAuditEntry {
  id: string;
  wallet: EvmAddress;
  performedAt: Date;
  success: boolean;
  errorCode?: string;
  requestSource: 'manual' | 'automated_scheduler' | 'webhook' | 'butler_recovery';
  recoveryAttemptId?: string; // Links scan to a specific recovery action
}

export default Asset;
