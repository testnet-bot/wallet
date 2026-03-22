import 'dotenv/config';

export interface ChainConfig {
  id: number;
  name: string;
  symbol: string;
  rpc: string;
  alchemy?: string;
  moralis?: string | null;
  explorer: string;
}

/**
 * Production-Grade Blockchain Configuration
 * Upgraded with Dynamic Provider Routing and Fixed RPC Suffixes.
 */
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || '';

const getDynamicRpc = (publicRpc: string, alchemyAlias?: string): string => {
  if (ALCHEMY_KEY && alchemyAlias) {
    return `https://${alchemyAlias}://{ALCHEMY_KEY}`;
  }
  return publicRpc;
};

export const EVM_CHAINS: ChainConfig[] = [
  { id: 1, name: 'Ethereum', symbol: 'ETH', rpc: getDynamicRpc('https://eth.drpc.org', 'eth-mainnet'), alchemy: 'eth-mainnet', explorer: 'https://etherscan.io' },
  { id: 56, name: 'BNB Smart Chain', symbol: 'BNB', rpc: 'https://binance.drpc.org', explorer: 'https://bscscan.com' },
  { id: 137, name: 'Polygon', symbol: 'POL', rpc: getDynamicRpc('https://polygon-rpc.com', 'polygon-mainnet'), alchemy: 'polygon-mainnet', explorer: 'https://polygonscan.com' },
  { id: 8453, name: 'Base', symbol: 'ETH', rpc: getDynamicRpc('https://mainnet.base.org', 'base-mainnet'), alchemy: 'base-mainnet', explorer: 'https://basescan.org' },
  { id: 42161, name: 'Arbitrum One', symbol: 'ETH', rpc: getDynamicRpc('https://arb1.arbitrum.io', 'arb-mainnet'), alchemy: 'arb-mainnet', explorer: 'https://arbiscan.io' },
  { id: 10, name: 'Optimism', symbol: 'ETH', rpc: getDynamicRpc('https://mainnet.optimism.io', 'opt-mainnet'), alchemy: 'opt-mainnet', explorer: 'https://optimistic.etherscan.io' },
  { id: 43114, name: 'Avalanche', symbol: 'AVAX', rpc: 'https://api.avax.network', explorer: 'https://snowtrace.io' },
  { id: 81457, name: 'Blast', symbol: 'ETH', rpc: 'https://rpc.blast.io', explorer: 'https://blastscan.io' },
  { id: 59144, name: 'Linea', symbol: 'ETH', rpc: 'https://rpc.linea.build', explorer: 'https://lineascan.build' },
  { id: 534352, name: 'Scroll', symbol: 'ETH', rpc: 'https://rpc.scroll.io', explorer: 'https://scrollscan.com' },
  { id: 100, name: 'Gnosis', symbol: 'xDAI', rpc: 'https://rpc.gnosischain.com', explorer: 'https://gnosisscan.io' },
  { id: 250, name: 'Fantom', symbol: 'FTM', rpc: 'https://rpc.ftm.tools', explorer: 'https://ftmscan.com' },
  { id: 324, name: 'zkSync Era', symbol: 'ETH', rpc: 'https://mainnet.era.zksync.io', explorer: 'https://explorer.zksync.io' },
  { id: 1101, name: 'Polygon zkEVM', symbol: 'ETH', rpc: 'https://zkevm-rpc.com', explorer: 'https://zkevm.polygonscan.com' },
  { id: 42220, name: 'Celo', symbol: 'CELO', rpc: 'https://forno.celo.org', explorer: 'https://celoscan.io' },
  { id: 1284, name: 'Moonbeam', symbol: 'GLMR', rpc: 'https://rpc.api.moonbeam.network', explorer: 'https://moonscan.io' },
  { id: 1285, name: 'Moonriver', symbol: 'MOVR', rpc: 'https://rpc.api.moonriver.moonbeam.network', explorer: 'https://moonriver.moonscan.io' },
  { id: 5000, name: 'Mantle', symbol: 'MNT', rpc: 'https://rpc.mantle.xyz', explorer: 'https://explorer.mantle.xyz' },
  { id: 204, name: 'opBNB', symbol: 'BNB', rpc: 'https://opbnb-mainnet-rpc.bnbchain.org', explorer: 'https://opbnbscan.com' },
  { id: 146, name: 'Sonic', symbol: 'S', rpc: 'https://rpc.soniclabs.com', explorer: 'https://sonicscan.org' },
  { id: 1329, name: 'Sei', symbol: 'SEI', rpc: 'https://evm-rpc.sei.io', explorer: 'https://seitrace.com' },
  { id: 25, name: 'Cronos', symbol: 'CRO', rpc: 'https://evm.cronos.org', explorer: 'https://cronoscan.com' },
  { id: 42170, name: 'Arbitrum Nova', symbol: 'ETH', rpc: 'https://nova.arbitrum.io', explorer: 'https://nova.arbiscan.io' },
  { id: 1088, name: 'Metis', symbol: 'METIS', rpc: 'https://andromeda.metis.io', explorer: 'https://andromeda-explorer.metis.io' },
  { id: 2222, name: 'Kava', symbol: 'KAVA', rpc: 'https://evm.kava.io', explorer: 'https://kavascan.com' },
  { id: 34443, name: 'Mode', symbol: 'ETH', rpc: 'https://mainnet.mode.network', explorer: 'https://modescan.io' },
  { id: 167000, name: 'Taiko', symbol: 'ETH', rpc: 'https://rpc.mainnet.taiko.xyz', explorer: 'https://taikoscan.io' },
  { id: 55, name: 'Zircuit', symbol: 'ETH', rpc: 'https://zircuit-mainnet.drpc.org', explorer: 'https://explorer.zircuit.com' },
  { id: 7777777, name: 'Zora', symbol: 'ETH', rpc: 'https://rpc.zora.energy', explorer: 'https://explorer.zora.energy' },
  { id: 480, name: 'World Chain', symbol: 'ETH', rpc: getDynamicRpc('https://worldchain-mainnet.g.alchemy.com', 'worldchain-mainnet'), explorer: 'https://worldscan.org' },
  { id: 660279, name: 'Xai', symbol: 'XAI', rpc: 'https://xai-chain.net', explorer: 'https://xaiscan.io' },
  { id: 4200, name: 'Merlin', symbol: 'BTC', rpc: 'https://rpc.merlinchain.io', explorer: 'https://scan.merlinchain.io' },
  { id: 57073, name: 'BeraChain', symbol: 'BERA', rpc: 'https://rpc.berachain.com', explorer: 'https://berascan.com' },
  { id: 8888, name: 'Chiliz', symbol: 'CHZ', rpc: 'https://rpc.chiliz.com', explorer: 'https://chiliscan.com' },
  { id: 30, name: 'Rootstock', symbol: 'RBTC', rpc: 'https://public-node.rsk.co', explorer: 'https://explorer.rsk.co' },
  { id: 57, name: 'Syscoin', symbol: 'SYS', rpc: 'https://rpc.syscoin.org', explorer: 'https://explorer.syscoin.org' },
  { id: 106, name: 'Velas', symbol: 'VLX', rpc: 'https://evmexplorer.velas.com', explorer: 'https://velascan.org' },
  { id: 40, name: 'Telos', symbol: 'TLOS', rpc: 'https://mainnet.telos.net', explorer: 'https://teloscan.io' },
  { id: 122, name: 'Fuse', symbol: 'FUSE', rpc: 'https://rpc.fuse.io', explorer: 'https://explorer.fuse.io' },
  { id: 2000, name: 'Dogechain', symbol: 'DOGE', rpc: 'https://rpc.dogechain.dog', explorer: 'https://explorer.dogechain.dog' },
  { id: 82, name: 'Meter', symbol: 'MTRG', rpc: 'https://rpc.meter.io', explorer: 'https://scan.meter.io' },
  { id: 361, name: 'Theta', symbol: 'TFUEL', rpc: 'https://eth-rpc-api.thetatoken.org', explorer: 'https://explorer.thetatoken.org' },
  { id: 4689, name: 'IoTeX', symbol: 'IOTX', rpc: 'https://babel-api.mainnet.iotex.io', explorer: 'https://iotexscan.io' },
  { id: 199, name: 'BitTorrent', symbol: 'BTT', rpc: 'https://rpc.bittorrentchain.io', explorer: 'https://bttcscan.com' },
  { id: 1030, name: 'Conflux eSpace', symbol: 'CFX', rpc: 'https://evm.confluxrpc.com', explorer: 'https://evm.confluxscan.io' },
  { id: 1116, name: 'Core', symbol: 'CORE', rpc: 'https://rpc.coredao.org', explorer: 'https://scan.coredao.org' },
  { id: 2020, name: 'Ronin', symbol: 'RON', rpc: 'https://api.roninchain.com', explorer: 'https://app.roninchain.com' },
  { id: 88, name: 'Viction', symbol: 'VIC', rpc: 'https://rpc.viction.xyz', explorer: 'https://vicscan.xyz' },
  { id: 53935, name: 'DFK Chain', symbol: 'JEWEL', rpc: 'https://subnets.avax.network', explorer: 'https://subnets.avax.network' },
  { id: 2001, name: 'Milkomeda C1', symbol: 'mADA', rpc: 'https://rpc-mainnet-cardano-evm.milkomeda.com', explorer: 'https://explorer-mainnet-cardano-evm.milkomeda.com' },
  { id: 311, name: 'Omax', symbol: 'OMAX', rpc: 'https://mainnet-rpc.omaxray.com', explorer: 'https://omaxray.com' },
  { id: 1234, name: 'Step Network', symbol: 'FITFI', rpc: 'https://rpc.step.network', explorer: 'https://stepscan.io' }
];
