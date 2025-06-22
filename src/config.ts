export const AXEP_VOTING_CONTRACT_ADDRESS = "0x83072BC70659AB6aCcd0A46C05bF2748F2Cb2D8e";
export const AXP_TOKEN_CONTRACT_ADDRESS = '0xa1edD20366dbAc7341DE5fdb9FE1711Fb9EAD4d4';
export const AMOY_CHAIN_ID = '0x13882';

// Multiple RPC endpoints for better reliability - prioritized by performance
export const AMOY_RPC_URLS = [
    'https://rpc-amoy.polygon.technology', // Primary - most reliable
    'https://polygon-amoy.drpc.org',       // Secondary - good fallback
    'https://polygon-amoy-bor-rpc.publicnode.com', // Tertiary - additional fallback
];

export const AMOY_RPC_URL = AMOY_RPC_URLS[0]; // Keep for backward compatibility
export const AXP_TOKEN_DECIMALS = 18;
export const IPFS_GATEWAY_URL = 'https://gateway.pinata.cloud/ipfs/';

// Hardware wallet detection function
export const isHardwareWallet = (walletName?: string): boolean => {
    if (!walletName) return false;
    const hardwareWallets = ['ledger', 'trezor', 'lattice', 'keystone'];
    return hardwareWallets.some(hw => walletName.toLowerCase().includes(hw));
};

// Optimized gas configuration for Polygon Amoy
// Hardware wallet-friendly settings with longer timeouts and more conservative gas
export const GAS_CONFIG = {
    DEFAULT_GAS_LIMIT: BigInt(3000000),
    BATCH_OPERATION_GAS_LIMIT: BigInt(5000000), // Reduced from 8M - contract is simple
    
    // Standard gas prices for software wallets
    STANDARD: {
        MAX_FEE_PER_GAS: BigInt(1500000000), // 1.5 gwei
        MAX_PRIORITY_FEE_PER_GAS: BigInt(1000000000), // 1 gwei
        RETRY_DELAY: 3000, // 3 seconds between retries
        MAX_RETRIES: 5,
        RPC_TIMEOUT: 15000, // 15 seconds
    },
    
    // Hardware wallet optimized settings
    HARDWARE_WALLET: {
        MAX_FEE_PER_GAS: BigInt(2000000000), // 2 gwei - slightly higher for reliability
        MAX_PRIORITY_FEE_PER_GAS: BigInt(1200000000), // 1.2 gwei
        RETRY_DELAY: 8000, // 8 seconds between retries (hardware wallets are slower)
        MAX_RETRIES: 3, // Fewer retries to avoid user fatigue
        RPC_TIMEOUT: 30000, // 30 seconds - hardware wallets need more time
        CONFIRMATION_TIMEOUT: 120000, // 2 minutes for user to confirm on device
        GAS_BUFFER: 1.2, // 20% gas buffer for hardware wallet estimation issues
    },
    
    // Network reliability settings
    GAS_PRICE_BUFFER: 1.05, // 5% buffer
    RETRY_TIMEOUT: 5000, // 5 seconds between RPC retries
};

// Get gas config based on wallet type
export const getGasConfig = (walletName?: string) => {
    return isHardwareWallet(walletName) 
        ? GAS_CONFIG.HARDWARE_WALLET 
        : GAS_CONFIG.STANDARD;
};

export const AXEP_VOTING_CONTRACT_ABI = [
    {
      "inputs": [
        {
          "internalType": "address[]",
          "name": "artistWallets",
          "type": "address[]"
        },
        {
          "internalType": "string[]",
          "name": "artistNames",
          "type": "string[]"
        },
        {
          "internalType": "string[]",
          "name": "trackTitles",
          "type": "string[]"
        },
        {
          "internalType": "string[]",
          "name": "genres",
          "type": "string[]"
        },
        {
          "internalType": "string[]",
          "name": "videoUrls",
          "type": "string[]"
        },
        {
          "internalType": "string[]",
          "name": "coverImageUrls",
          "type": "string[]"
        }
      ],
      "name": "batchRegisterAndUpload",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256[]",
          "name": "_trackIds",
          "type": "uint256[]"
        },
        {
          "internalType": "uint256[]",
          "name": "_voteCounts",
          "type": "uint256[]"
        }
      ],
      "name": "adminBatchVote",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getOfficialGenres",
      "outputs": [
        {
          "internalType": "string[]",
          "name": "",
          "type": "string[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getAllTrackIds",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "trackId",
          "type": "uint256"
        }
      ],
      "name": "getTrack",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "id",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "artistId",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "title",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "genre",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "videoUrl",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "coverImageUrl",
              "type": "string"
            },
            {
              "internalType": "uint256",
              "name": "uploadTimestamp",
              "type": "uint256"
            }
          ],
          "internalType": "struct AxepVoting.Track",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "artistId",
          "type": "uint256"
        }
      ],
      "name": "getArtist",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "id",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "name",
              "type": "string"
            },
            {
              "internalType": "address payable",
              "name": "artistWallet",
              "type": "address"
            },
            {
              "internalType": "bool",
              "name": "isRegistered",
              "type": "bool"
            }
          ],
          "internalType": "struct AxepVoting.Artist",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "trackId",
          "type": "uint256"
        }
      ],
      "name": "getVoteCount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "trackId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "artistId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "title",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "genre",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "videoUrl",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "coverImageUrl",
          "type": "string"
        }
      ],
      "name": "TrackUploaded",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "previousOwner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "OwnershipTransferred",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "trackId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "sharer",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "shareUrl1",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "shareUrl2",
          "type": "string"
        }
      ],
      "name": "ShareRecorded",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "trackId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "distributor",
          "type": "address"
        }
      ],
      "name": "ShareRewardsDistributed",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "trackId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "voter",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "totalVotes",
          "type": "uint256"
        }
      ],
      "name": "Voted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint256[]",
          "name": "trackIds",
          "type": "uint256[]"
        },
        {
          "indexed": false,
          "internalType": "uint256[]",
          "name": "voteCounts",
          "type": "uint256[]"
        }
      ],
      "name": "VotesTallied",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "votingPeriod",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "trackId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "voteCount",
          "type": "uint256"
        }
      ],
      "name": "WinnerSelected",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "uint256[]",
          "name": "_trackIdsForPeriod",
          "type": "uint256[]"
        }
      ],
      "name": "finalizeVotingAndSelectWinner",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "currentVotingPeriod",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getWinningTrackDetails",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "id",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "artistId",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "title",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "genre",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "videoUrl",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "coverImageUrl",
              "type": "string"
            },
            {
              "internalType": "uint256",
              "name": "uploadTimestamp",
              "type": "uint256"
            }
          ],
          "internalType": "struct AxepVoting.Track",
          "name": "",
          "type": "tuple"
        },
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "id",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "name",
              "type": "string"
            },
            {
              "internalType": "address payable",
              "name": "artistWallet",
              "type": "address"
            },
            {
              "internalType": "bool",
              "name": "isRegistered",
              "type": "bool"
            }
          ],
          "internalType": "struct AxepVoting.Artist",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "historicalWinners",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "lastWinnerTimestamp",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "officialGenres",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "renounceOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "proofOfShares",
      "outputs": [
        {
          "internalType": "string",
          "name": "url1",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "url2",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_trackId",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "_shareUrl1",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_shareUrl2",
          "type": "string"
        }
      ],
      "name": "recordShare",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "renounceOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "rewardedShares",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "shareRewardAmount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "trackVotes",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "tracks",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "artistId",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "title",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "genre",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "videoUrl",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "coverImageUrl",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "uploadTimestamp",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "transferOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "winningTrackId",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]