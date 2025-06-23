import { createPublicClient, createWalletClient, http, fallback } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { AMOY_RPC_URLS, GAS_CONFIG } from './config';

// ENHANCED RPC CONFIGURATION - Optimized to prevent JSON-RPC errors
// Uses professional RPC providers with enhanced error handling
const transports = AMOY_RPC_URLS.map((url, index) => 
    http(url, {
        timeout: 45000, // Increased timeout for better stability
        retryCount: 0, // No automatic retries - user handles manually
        retryDelay: 0,
        batch: false, // Disable batching to prevent JSON-RPC conflicts
        fetchOptions: {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        },
        key: `rpc-${index}`, // Unique key for each transport
    })
);

// Enhanced Public client with optimized RPC fallback chain
export const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: fallback(transports, {
        rank: false, // Don't rank by speed - use in order
        retryCount: 0, // No automatic retries at fallback level
        retryDelay: 0,
    }),
    // Additional options to prevent JSON-RPC errors
    cacheTime: 2000, // 2 second cache
});

// Wallet client factory - creates clients with professional RPC endpoints
export const createWalletClientWithTransport = (transport: any) => {
    return createWalletClient({
        chain: polygonAmoy,
        transport: fallback(transports, {
            rank: false, // Use professional RPCs in order
        }),
    });
};

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