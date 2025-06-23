import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygonAmoy } from 'wagmi/chains';
import { QueryClient } from '@tanstack/react-query';
import { http, fallback } from 'wagmi';
import { AMOY_RPC_URLS } from './config';

// ENHANCED wagmi configuration with optimized RPC fallback for JSON-RPC error prevention
export const wagmiConfig = getDefaultConfig({
  appName: 'AXEP Music Platform',
  projectId: 'b0cb00f45bfb6c5e8db8bac7e4e7b073', // Updated with actual project ID
  chains: [polygonAmoy],
  transports: {
    [polygonAmoy.id]: fallback(
      AMOY_RPC_URLS.map((url, index) => http(url, {
        timeout: 45000, // Increased timeout for better reliability
        retryCount: 0,  // No automatic retries as requested
        retryDelay: 0,
        batch: false,   // Disable batching to prevent JSON-RPC conflicts
        fetchOptions: {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      })),
      {
        rank: false, // Use in order, don't rank by speed
        retryCount: 0, // No automatic retries at transport level
        retryDelay: 0,
      }
    ),
  },
  ssr: false,
  // Additional options to prevent JSON-RPC errors
  multiInjectedProviderDiscovery: false,
  syncConnectedChain: true,
});

// Enhanced Query client for React Query with optimized settings
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on JSON-RPC errors - let user handle manually
        if (error?.message?.includes('JSON-RPC') || error?.code === -32603) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 10000, // 10 seconds
      gcTime: 300000, // 5 minutes (fixed property name)
    },
    mutations: {
      retry: false, // Never retry mutations automatically
    },
  },
}); 