import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { QueryClient } from '@tanstack/react-query';
import { defineChain } from 'viem';

// Define custom Amoy chain with multiple RPC endpoints for reliability
const polygonAmoy = defineChain({
  id: 80002,
  name: 'Polygon Amoy',
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  rpcUrls: {
    default: { 
      http: [
        'https://rpc-amoy.polygon.technology/',
        'https://polygon-amoy.drpc.org',
        'https://polygon-amoy-bor-rpc.publicnode.com'
      ] 
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
  ssr: false, // Important for client-side rendering
});

export const queryClient = new QueryClient(); 