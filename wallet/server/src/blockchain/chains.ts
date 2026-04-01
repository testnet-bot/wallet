import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({
path: resolve(process.cwd(), '.env')
});

export interface ChainConfig {
  id: number;
  name: string;
  symbol: string;
  rpcs: string[];
  relayUrl?: string;
  alchemy?: string;
  moralis?: string; 
  explorer: string;
  isL2?: boolean;
  blockTimeSec: number;
  nativePriceId: string;
  supportsEIP1559: boolean;
}

const ALCHEMY_KEY: string = process.env.ALCHEMY_KEY || process.env.ALCHEMY_API_KEY || '';

/**
 * multi-RPC Resolver
 * [User Override] -> [Alchemy Premium] -> [High-Availability Public Cluster]
 */
const getRpcs = (chainId: number, fallbacks: string[], alchemyAlias?: string): string[] => {
  const rpcs = [...fallbacks];
  const envOverride = process.env[`RPC_${chainId}`];
  if (envOverride) rpcs.unshift(envOverride); 
  if (ALCHEMY_KEY && alchemyAlias) {
  rpcs.unshift(`https://${alchemyAlias}.g.alchemy.com/v2/${ALCHEMY_KEY}`);
  }
  return [...new Set(rpcs)];
};

/* ====== */

export const EVM_CHAINS: ChainConfig[] = [
 
  { id: 1, name: 'Ethereum', symbol: 'ETH', rpcs: getRpcs(1, ['https://eth.drpc.org', 'https://rpc.ankr.com/eth'], 'eth-mainnet'), relayUrl: 'https://relay.flashbots.net', explorer: 'https://etherscan.io', isL2: false, blockTimeSec: 12, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 56, name: 'BNB Smart Chain', symbol: 'BNB', rpcs: getRpcs(56, ['https://bsc.drpc.org', 'https://bsc-dataseed.binance.org']), explorer: 'https://bscscan.com', isL2: false, blockTimeSec: 3, nativePriceId: 'binancecoin', supportsEIP1559: false },
  { id: 137, name: 'Polygon', symbol: 'POL', rpcs: getRpcs(137, ['https://polygon.drpc.org', 'https://rpc.ankr.com/polygon'], 'polygon-mainnet'), explorer: 'https://polygonscan.com', isL2: false, blockTimeSec: 2, nativePriceId: 'matic-network', supportsEIP1559: true },
  { id: 8453, name: 'Base', symbol: 'ETH', rpcs: getRpcs(8453, ['https://base.drpc.org', 'https://mainnet.base.org'], 'base-mainnet'), explorer: 'https://basescan.org', isL2: true, blockTimeSec: 2, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 42161, name: 'Arbitrum One', symbol: 'ETH', rpcs: getRpcs(42161, ['https://arbitrum.drpc.org', 'https://arb1.arbitrum.io/rpc'], 'arb-mainnet'), explorer: 'https://arbiscan.io', isL2: true, blockTimeSec: 0.3, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 10, name: 'Optimism', symbol: 'ETH', rpcs: getRpcs(10, ['https://optimism.drpc.org', 'https://mainnet.optimism.io'], 'opt-mainnet'), explorer: 'https://optimistic.etherscan.io', isL2: true, blockTimeSec: 2, nativePriceId: 'ethereum', supportsEIP1559: true },

  { id: 43114, name: 'Avalanche', symbol: 'AVAX', rpcs: getRpcs(43114, ['https://avalanche.drpc.org', 'https://rpc.ankr.com/avalanche'], 'avax-mainnet'), explorer: 'https://snowtrace.io', isL2: false, blockTimeSec: 2, nativePriceId: 'avalanche-2', supportsEIP1559: true },
  { id: 324, name: 'zkSync Era', symbol: 'ETH', rpcs: getRpcs(324, ['https://mainnet.era.zksync.io', 'https://zksync.drpc.org'], 'zksync-mainnet'), explorer: 'https://explorer.zksync.io', isL2: true, blockTimeSec: 1, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 146, name: 'Sonic', symbol: 'S', rpcs: ['https://sonic.drpc.org', 'https://rpc.soniclabs.com'], explorer: 'https://sonicscan.org', blockTimeSec: 0.4, nativePriceId: 'fantom', supportsEIP1559: true },
  { id: 1329, name: 'Sei Network', symbol: 'SEI', rpcs: ['https://sei.drpc.org', 'https://sei-rpc.publicnode.com'], explorer: 'https://seitrace.com', blockTimeSec: 0.4, nativePriceId: 'sei-network', supportsEIP1559: false },
  { id: 59144, name: 'Linea', symbol: 'ETH', rpcs: getRpcs(59144, ['https://linea.drpc.org', 'https://rpc.linea.build'], 'linea-mainnet'), explorer: 'https://lineascan.build', isL2: true, blockTimeSec: 12, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 81457, name: 'Blast', symbol: 'ETH', rpcs: ['https://blast.drpc.org', 'https://rpc.blast.io'], explorer: 'https://blastscan.io', isL2: true, blockTimeSec: 2, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 534352, name: 'Scroll', symbol: 'ETH', rpcs: ['https://scroll.drpc.org', 'https://rpc.scroll.io'], explorer: 'https://scrollscan.com', isL2: true, blockTimeSec: 3, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 5000, name: 'Mantle', symbol: 'MNT', rpcs: ['https://mantle.drpc.org', 'https://rpc.mantle.xyz'], explorer: 'https://explorer.mantle.xyz', isL2: true, blockTimeSec: 2, nativePriceId: 'mantle', supportsEIP1559: false },
  { id: 1101, name: 'Polygon zkEVM', symbol: 'ETH', rpcs: ['https://zkevm-rpc.com'], explorer: 'https://zkevm.polygonscan.com', isL2: true, blockTimeSec: 2, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 42220, name: 'Celo', symbol: 'CELO', rpcs: ['https://celo.drpc.org', 'https://forno.celo.org'], explorer: 'https://celoscan.io', blockTimeSec: 5, nativePriceId: 'celo', supportsEIP1559: true },
  { id: 100, name: 'Gnosis', symbol: 'xDAI', rpcs: ['https://gnosis.drpc.org', 'https://rpc.gnosischain.com'], explorer: 'https://gnosisscan.io', blockTimeSec: 5, nativePriceId: 'xdai', supportsEIP1559: true },
  { id: 250, name: 'Fantom', symbol: 'FTM', rpcs: ['https://fantom.drpc.org', 'https://rpc.ankr.com/fantom'], explorer: 'https://ftmscan.com', blockTimeSec: 1, nativePriceId: 'fantom', supportsEIP1559: false },
  { id: 1284, name: 'Moonbeam', symbol: 'GLMR', rpcs: ['https://moonbeam.drpc.org', 'https://rpc.api.moonbeam.network'], explorer: 'https://moonscan.io', blockTimeSec: 12, nativePriceId: 'moonbeam', supportsEIP1559: true },
  { id: 1285, name: 'Moonriver', symbol: 'MOVR', rpcs: ['https://moonriver.publicnode.com'], explorer: 'https://moonriver.moonscan.io', blockTimeSec: 12, nativePriceId: 'moonriver', supportsEIP1559: true },
  { id: 25, name: 'Cronos', symbol: 'CRO', rpcs: ['https://cronos.drpc.org', 'https://evm.cronos.org'], explorer: 'https://cronoscan.com', blockTimeSec: 6, nativePriceId: 'crypto-com-chain', supportsEIP1559: true },
  { id: 196, name: 'X Layer', symbol: 'OKB', rpcs: ['https://xlayer.drpc.org', 'https://rpc.xlayer.tech'], explorer: 'https://www.okx.com', isL2: true, blockTimeSec: 2, nativePriceId: 'okb', supportsEIP1559: true },
  { id: 167000, name: 'Taiko', symbol: 'ETH', rpcs: ['https://taiko.drpc.org', 'https://rpc.mainnet.taiko.xyz'], explorer: 'https://taikoscan.io', isL2: true, blockTimeSec: 12, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 204, name: 'opBNB', symbol: 'BNB', rpcs: ['https://opbnb.drpc.org', 'https://opbnb-mainnet-rpc.bnbchain.org'], explorer: 'https://opbnb.bscscan.com', isL2: true, blockTimeSec: 1, nativePriceId: 'binancecoin', supportsEIP1559: false },
  { id: 1088, name: 'Metis', symbol: 'METIS', rpcs: ['https://metis.drpc.org', 'https://andromeda.metis.io'], explorer: 'https://andromeda-explorer.metis.io', isL2: true, blockTimeSec: 2, nativePriceId: 'metis-token', supportsEIP1559: false },
  { id: 88888, name: 'Chiliz', symbol: 'CHZ', rpcs: ['https://chiliz.drpc.org', 'https://rpc.chiliz.com'], explorer: 'https://chiliscan.com', blockTimeSec: 3, nativePriceId: 'chiliz', supportsEIP1559: true },
  { id: 1116, name: 'Core', symbol: 'CORE', rpcs: ['https://core.drpc.org', 'https://rpc.coredao.org'], explorer: 'https://scan.coredao.org', blockTimeSec: 3, nativePriceId: 'coredaoorg', supportsEIP1559: true },
  { id: 480, name: 'World Chain', symbol: 'ETH', rpcs: ['https://worldchain.drpc.org'], explorer: 'https://worldscan.org', isL2: true, blockTimeSec: 2, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 9001, name: 'Evmos', symbol: 'EVMOS', rpcs: ['https://evmos.drpc.org', 'https://evmos-evm-rpc.publicnode.com'], explorer: 'https://escan.live', blockTimeSec: 2, nativePriceId: 'evmos', supportsEIP1559: true },
  { id: 7700, name: 'Canto', symbol: 'CANTO', rpcs: ['https://canto.drpc.org', 'https://mainnet.canto.io'], explorer: 'https://cantoscan.com', blockTimeSec: 6, nativePriceId: 'canto', supportsEIP1559: true },
  { id: 2222, name: 'Kava EVM', symbol: 'KAVA', rpcs: ['https://kava.drpc.org', 'https://evm.kava.io'], explorer: 'https://kavascan.com', blockTimeSec: 6, nativePriceId: 'kava', supportsEIP1559: true },
  { id: 122, name: 'Fuse', symbol: 'FUSE', rpcs: ['https://fuse.drpc.org', 'https://rpc.fuse.io'], explorer: 'https://explorer.fuse.io', blockTimeSec: 5, nativePriceId: 'fuse-network-token', supportsEIP1559: false },
  { id: 40, name: 'Telos EVM', symbol: 'TLOS', rpcs: ['https://telos.drpc.org', 'https://mainnet.telos.net'], explorer: 'https://teloscan.io', blockTimeSec: 0.5, nativePriceId: 'telos', supportsEIP1559: true },
  { id: 30, name: 'Rootstock', symbol: 'RBTC', rpcs: ['https://rootstock.drpc.org', 'https://public-node.rsk.co'], explorer: 'https://explorer.rsk.co', blockTimeSec: 30, nativePriceId: 'rootstock', supportsEIP1559: false },
  { id: 61, name: 'Ethereum Classic', symbol: 'ETC', rpcs: ['https://etc.drpc.org', 'https://etc.rivet.link'], explorer: 'https://etcscan.org', blockTimeSec: 13, nativePriceId: 'ethereum-classic', supportsEIP1559: false },
  { id: 106, name: 'Velas', symbol: 'VLX', rpcs: ['https://velas-evm.publicnode.com'], explorer: 'https://evmexplorer.velas.com', blockTimeSec: 2, nativePriceId: 'velas', supportsEIP1559: true },
  { id: 57, name: 'Syscoin', symbol: 'SYS', rpcs: ['https://syscoin.drpc.org', 'https://rpc.syscoin.org'], explorer: 'https://explorer.syscoin.org', blockTimeSec: 150, nativePriceId: 'syscoin', supportsEIP1559: true },
  { id: 2020, name: 'Ronin', symbol: 'RON', rpcs: ['https://ronin.drpc.org', 'https://api.roninchain.com/rpc'], explorer: 'https://app.roninchain.com', blockTimeSec: 3, nativePriceId: 'ronin', supportsEIP1559: true },
  { id: 288, name: 'Boba Network', symbol: 'ETH', rpcs: ['https://boba.drpc.org', 'https://mainnet.boba.network'], explorer: 'https://bobascan.com', isL2: true, blockTimeSec: 2, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 1024, name: 'CLV', symbol: 'CLV', rpcs: ['https://iris-evm-rpc.publicnode.com'], explorer: 'https://clvscan.com', blockTimeSec: 12, nativePriceId: 'clv', supportsEIP1559: true },
  { id: 4689, name: 'IoTeX', symbol: 'IOTX', rpcs: ['https://iotex.drpc.org', 'https://babel-api.mainnet.iotex.io'], explorer: 'https://iotexscan.io', blockTimeSec: 5, nativePriceId: 'iotex', supportsEIP1559: true },
  { id: 2000, name: 'Dogechain', symbol: 'DOGE', rpcs: ['https://dogechain.drpc.org', 'https://rpc.dogechain.dog'], explorer: 'https://explorer.dogechain.dog', blockTimeSec: 2, nativePriceId: 'dogechain', supportsEIP1559: true },
  { id: 42170, name: 'Arbitrum Nova', symbol: 'ETH', rpcs: ['https://nova.drpc.org', 'https://nova.arbitrum.io/rpc'], explorer: 'https://nova.arbiscan.io', isL2: true, blockTimeSec: 0.3, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 55, name: 'Zilliqa EVM', symbol: 'ZIL', rpcs: ['https://zilliqa.drpc.org', 'https://api.zilliqa.com'], explorer: 'https://viewblock.io', blockTimeSec: 45, nativePriceId: 'zilliqa', supportsEIP1559: false },
  { id: 14, name: 'Flare', symbol: 'FLR', rpcs: ['https://flare.drpc.org', 'https://rpc.ankr.com/flare'], explorer: 'https://flare-explorer.flare.network', blockTimeSec: 2, nativePriceId: 'flare-networks', supportsEIP1559: true },
  { id: 19, name: 'Songbird', symbol: 'SGB', rpcs: ['https://songbird.drpc.org', 'https://rpc.ankr.com/songbird'], explorer: 'https://songbird-explorer.flare.network', blockTimeSec: 2, nativePriceId: 'songbird', supportsEIP1559: true },
  { id: 5, name: 'Goerli', symbol: 'ETH', rpcs: ['https://rpc.ankr.com/eth_goerli'], explorer: 'https://goerli.etherscan.io', blockTimeSec: 12, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 11155111, name: 'Sepolia', symbol: 'ETH', rpcs: ['https://sepolia.drpc.org', 'https://rpc.ankr.com/eth_sepolia'], explorer: 'https://sepolia.etherscan.io', blockTimeSec: 12, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 84532, name: 'Base Sepolia', symbol: 'ETH', rpcs: ['https://sepolia.base.org', 'https://base-sepolia.drpc.org'], explorer: 'https://sepolia.basescan.org', isL2: true, blockTimeSec: 2, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 421614, name: 'Arbitrum Sepolia', symbol: 'ETH', rpcs: ['https://arbitrum-sepolia.drpc.org', 'https://sepolia-rollup.arbitrum.io/rpc'], explorer: 'https://sepolia.arbiscan.io', isL2: true, blockTimeSec: 0.3, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 11155420, name: 'OP Sepolia', symbol: 'ETH', rpcs: ['https://optimism-sepolia.drpc.org', 'https://sepolia.optimism.io'], explorer: 'https://sepolia-optimism.etherscan.io', isL2: true, blockTimeSec: 2, nativePriceId: 'ethereum', supportsEIP1559: true },
  { id: 80002, name: 'Polygon Amoy', symbol: 'POL', rpcs: ['https://polygon-amoy.drpc.org', 'https://rpc-amoy.polygon.technology'], explorer: 'https://amoy.polygonscan.com', blockTimeSec: 2, nativePriceId: 'matic-network', supportsEIP1559: true },
  { id: 97, name: 'BNB Testnet', symbol: 'tBNB', rpcs: ['https://bsc-testnet.drpc.org'], explorer: 'https://testnet.bscscan.com', blockTimeSec: 3, nativePriceId: 'binancecoin', supportsEIP1559: false },
  { id: 1337, name: 'Localhost', symbol: 'ETH', rpcs: ['http://127.0.0.1:8545'], explorer: '', blockTimeSec: 1, nativePriceId: 'ethereum', supportsEIP1559: true },

];

/* ======= */

type RpcScore = { url: string; latency: number; success: boolean };
const RPC_CACHE = new Map<number, { url: string; timestamp: number }>();
const RPC_TIMEOUT = 2500;
const CACHE_TTL = 1000 * 60 * 5; 

const pingRpc = async (url: string): Promise<RpcScore> => {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT);
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] })
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('Offline');
    return { url, latency: Date.now() - start, success: true };
  } catch {
    return { url, latency: Infinity, success: false };
  }
};

export const getBestRpc = async (chainId: number): Promise<string> => {
  const cached = RPC_CACHE.get(chainId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) return cached.url;

  const chain = requireChain(chainId);
  const results = await Promise.all(chain.rpcs.map(pingRpc));
  const valid = results.filter(r => r.success).sort((a, b) => a.latency - b.latency);

  if (!valid.length) throw new Error(`No working RPC for ${chain.name}`);
  
  const best = valid[0].url;
  RPC_CACHE.set(chainId, { url: best, timestamp: Date.now() });
  return best;
};

export const refreshRpc = async (chainId: number): Promise<string> => {
  RPC_CACHE.delete(chainId);
  return getBestRpc(chainId);
};

/* ====== */

export const getChainById = (chainId: number) => EVM_CHAINS.find(c => c.id === chainId);
export const requireChain = (chainId: number) => {
  const c = getChainById(chainId);
  if (!c) throw new Error(`Unsupported Chain ID: ${chainId}`);
  return c;
};

export const validateChainConfig = () => {
  const ids = EVM_CHAINS.map(c => c.id);
  const duplicates = ids.filter((item, index) => ids.indexOf(item) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate Chain IDs: ${[...new Set(duplicates)].join(', ')}`);
  }
};

validateChainConfig();
