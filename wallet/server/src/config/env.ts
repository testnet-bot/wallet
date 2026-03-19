import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
PORT: process.env.PORT || 5000,
RPC: {
ETH: process.env.ETH_RPC!,
BSC: process.env.BSC_RPC!,
POLYGON: process.env.POLYGON_RPC!,
BASE: process.env.BASE_RPC!,
},
PROTOCOL_WALLET: process.env.PROTOCOL_WALLET!,
API_SECRET: process.env.API_SECRET!,
};