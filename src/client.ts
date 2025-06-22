import { createPublicClient, http, fallback } from 'viem';
import { defineChain } from 'viem';
import { AMOY_RPC_URLS, GAS_CONFIG } from './config';

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

// Enhanced RPC configuration with improved timeout and retry settings
export const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: fallback(
    AMOY_RPC_URLS.map(url => http(url, {
      timeout: 15000, // Increased to 15 seconds per RPC for better stability
      retryCount: 3,  // Increased retry count per RPC
      retryDelay: 1500, // Slightly increased delay between retries
      batch: {
        wait: 16, // Batch requests every 16ms for better performance
      },
    })),
    { 
      rank: {
        interval: 60_000, // Re-rank RPC endpoints every minute
        sampleCount: 5,   // Use 5 samples for ranking
        timeout: 500,     // 500ms timeout for ranking requests
      },
      retryCount: GAS_CONFIG.STANDARD.MAX_RETRIES, // Use standard config retry count
      retryDelay: GAS_CONFIG.STANDARD.RETRY_DELAY, // Use standard config retry delay
    }
  ),
  // Enhanced caching for better performance
  cacheTime: 4_000, // Cache responses for 4 seconds
});

// Helper function to get current gas prices with fallback (uses standard config as default)
export const getOptimizedGasPrice = async () => {
  try {
    const gasPrice = await publicClient.getGasPrice();
    // Apply buffer to ensure transaction success
    const bufferedGasPrice = BigInt(Math.floor(Number(gasPrice) * GAS_CONFIG.GAS_PRICE_BUFFER));
    
    // Ensure we don't exceed our maximum configured gas price (use standard config as default)
    const finalGasPrice = bufferedGasPrice > GAS_CONFIG.STANDARD.MAX_FEE_PER_GAS 
      ? GAS_CONFIG.STANDARD.MAX_FEE_PER_GAS 
      : bufferedGasPrice;
    
    return {
      maxFeePerGas: finalGasPrice,
      maxPriorityFeePerGas: GAS_CONFIG.STANDARD.MAX_PRIORITY_FEE_PER_GAS,
    };
  } catch (error) {
    console.warn('Failed to fetch current gas price, using fallback:', error);
    // Return our conservative defaults if gas price fetching fails
    return {
      maxFeePerGas: GAS_CONFIG.STANDARD.MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: GAS_CONFIG.STANDARD.MAX_PRIORITY_FEE_PER_GAS,
    };
  }
}; 