import {
    parseUnits,
    type WalletClient,
    type Hash,
    type Chain,
    createPublicClient,
    http,
    fallback,
    type PublicClient,
    formatUnits,
    type Abi
} from 'viem';
import {
    AXP_TOKEN_CONTRACT_ADDRESS,
    AXEP_VOTING_CONTRACT_ADDRESS,
    AXP_TOKEN_DECIMALS,
    AMOY_RPC_URL,
    AXEP_VOTING_CONTRACT_ABI
} from '../config';
import { polygonAmoy } from 'viem/chains';
import { publicClient } from '../client';
import { type Track, type Genre } from '../types';

export type { Track, Genre };

const amoy = {
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
} as const satisfies Chain;

export const axpTokenAbi: Abi = [
    {
        "constant": true,
        "inputs": [
            { "name": "_owner", "type": "address" }
        ],
        "name": "balanceOf",
        "outputs": [
            { "name": "balance", "type": "uint256" }
        ],
        "type": "function",
        "stateMutability": "view"
    },
    {
        "constant": false,
        "inputs": [
            { "name": "amount", "type": "uint256" }
        ],
        "name": "burn",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

// Import the correct ABI from config
export const axepVotingAbi = AXEP_VOTING_CONTRACT_ABI;

export const getClient = (rpcUrl?: string): PublicClient => {
    if (rpcUrl) {
        return createPublicClient({
            chain: amoy,
            transport: http(rpcUrl)
        });
    }
    
    // Use fallback with multiple RPC URLs for reliability
    return createPublicClient({
        chain: amoy,
        transport: fallback(
            amoy.rpcUrls.default.http.map(url => http(url)),
            { rank: false }
        )
    });
};

export const approveAxpTokens = async (
    walletClient: WalletClient,
    amount: string
): Promise<Hash> => {
    const account = walletClient.account;
    if (!account) {
        throw new Error('Wallet client is not connected.');
    }
    const { request } = await publicClient.simulateContract({
        account,
        address: AXP_TOKEN_CONTRACT_ADDRESS as `0x${string}`,
        abi: axpTokenAbi,
        functionName: 'approve',
        args: [AXEP_VOTING_CONTRACT_ADDRESS, parseUnits(amount, AXP_TOKEN_DECIMALS)]
    });

    return await walletClient.writeContract(request);
};

export const burnAxpTokens = async (
    walletClient: WalletClient,
    amount: string
): Promise<Hash> => {
    const account = walletClient.account;
    if (!account) {
        throw new Error('Wallet client is not connected.');
    }
    const { request } = await publicClient.simulateContract({
        account,
        address: AXP_TOKEN_CONTRACT_ADDRESS as `0x${string}`,
        abi: axpTokenAbi,
        functionName: 'burn',
        args: [parseUnits(amount, AXP_TOKEN_DECIMALS)]
    });
    return await walletClient.writeContract(request);
};


export const getAxpBalance = async (address: `0x${string}`): Promise<string> => {
    try {
        const balance = await publicClient.readContract({
            address: AXP_TOKEN_CONTRACT_ADDRESS as `0x${string}`,
            abi: axpTokenAbi,
            functionName: 'balanceOf',
            args: [address]
        });
        return formatUnits(balance as bigint, AXP_TOKEN_DECIMALS);
    } catch (error) {
        console.error("Error fetching AXP balance:", error);
        return "0";
    }
};

// Re-export for convenience elsewhere in the app
export { AXEP_VOTING_CONTRACT_ABI, AXEP_VOTING_CONTRACT_ADDRESS };