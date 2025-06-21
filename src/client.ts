import { createPublicClient, http, fallback } from 'viem';
import { defineChain } from 'viem';
import { AMOY_RPC_URLS } from './config';

// Define custom Amoy chain with multiple RPC endpoints for reliability
const polygonAmoy = defineChain({
  id: 80002,
  name: 'Polygon Amoy',
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  rpcUrls: {
    default: { 
      http: AMOY_RPC_URLS
    },
  },
  blockExplorers: {
    default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com' },
  },
  testnet: true,
});

export const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: fallback(
    AMOY_RPC_URLS.map(url => http(url)),
    { rank: false } // Don't rank by speed, just use in order
  )
}); 