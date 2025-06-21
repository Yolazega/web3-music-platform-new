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
import { ethers } from "ethers";

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

export const axepVotingAbi: Abi = [
  {
    "type": "constructor",
    "inputs": [
      { "name": "_tokenAddress", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "registerArtistAndUploadFirstTrack",
    "inputs": [
      { "name": "artistName", "type": "string", "internalType": "string" },
      { "name": "trackTitle", "type": "string", "internalType": "string" },
      { "name": "genre", "type": "string", "internalType": "string" },
      { "name": "videoUrl", "type": "string", "internalType": "string" },
      { "name": "coverImageUrl", "type": "string", "internalType": "string" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "voteForTrack",
    "inputs": [
      { "name": "trackId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getArtist",
    "inputs": [
      { "name": "artistId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { 
        "name": "", 
        "type": "tuple", 
        "internalType": "struct AxepVoting.Artist",
        "components": [
          { "name": "id", "type": "uint256", "internalType": "uint256" },
          { "name": "name", "type": "string", "internalType": "string" },
          { "name": "artistWallet", "type": "address", "internalType": "address payable" },
          { "name": "isRegistered", "type": "bool", "internalType": "bool" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTrack",
    "inputs": [
      { "name": "trackId", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct AxepVoting.Track",
        "components": [
          { "name": "id", "type": "uint256", "internalType": "uint256" },
          { "name": "artistId", "type": "uint256", "internalType": "uint256" },
          { "name": "title", "type": "string", "internalType": "string" },
          { "name": "genre", "type": "string", "internalType": "string" },
          { "name": "videoUrl", "type": "string", "internalType": "string" },
          { "name": "coverImageUrl", "type": "string", "internalType": "string" },
          { "name": "uploadTimestamp", "type": "uint256", "internalType": "uint256" },
          { "name": "votes", "type": "uint256", "internalType": "uint256" }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAllTrackIds",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "uint256[]", "internalType": "uint256[]" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTrackIdsByGenre",
    "inputs": [
      { "name": "genre", "type": "string", "internalType": "string" }
    ],
    "outputs": [
      { "name": "", "type": "uint256[]", "internalType": "uint256[]" }
    ],
    "stateMutability": "view"
  },
    {
    "type": "function",
    "name": "getOfficialGenres",
    "inputs": [],
    "outputs": [
      { "name": "", "type": "string[]", "internalType": "string[]" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "ArtistRegistered",
    "inputs": [
      { "name": "artistId", "type": "uint256", "indexed": true },
      { "name": "name", "type": "string", "indexed": false },
      { "name": "artistWallet", "type": "address", "indexed": true }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TrackUploaded",
    "inputs": [
      { "name": "trackId", "type": "uint256", "indexed": true },
      { "name": "artistId", "type": "uint256", "indexed": true },
      { "name": "title", "type": "string", "indexed": false },
      { "name": "genre", "type": "string", "indexed": false },
      { "name": "videoUrl", "type": "string", "indexed": false }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Voted",
    "inputs": [
      { "name": "trackId", "type": "uint256", "indexed": true },
      { "name": "voter", "type": "address", "indexed": true }
    ],
    "anonymous": false
  }
];

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