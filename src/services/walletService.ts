import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { QueryClient } from '@tanstack/react-query';
import { defineChain } from 'viem';
import { http, fallback } from 'viem';
import { AMOY_RPC_URLS } from '../config';

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

export const wagmiConfig = getDefaultConfig({
  appName: 'Web3 Music Platform',
  projectId: '71c23f5b5f6d09f86ec684747eca45cb',
  chains: [polygonAmoy],
  transports: {
    [polygonAmoy.id]: fallback(
      AMOY_RPC_URLS.map(url => http(url, {
        timeout: 10000, // 10 second timeout per RPC
        retryCount: 2,  // Retry each RPC 2 times before moving to next
        retryDelay: 1000, // 1 second delay between retries
      })),
      { 
        rank: false, // Don't rank by speed, just use in order
        retryCount: 3, // Retry the entire fallback chain 3 times
        retryDelay: 2000, // 2 second delay between fallback attempts
      }
    ),
  },
  ssr: false, // Important for client-side rendering
});

export const queryClient = new QueryClient(); 