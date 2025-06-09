export const AMOY_CHAIN_ID = '0x13882'; // 80002
export const AMOY_CHAIN_NAME = 'Polygon Amoy Testnet';
export const AMOY_RPC_URL = 'https://rpc-amoy.polygon.technology/';
export const AMOY_EXPLORER_URL = 'https://amoy.polygonscan.com/';

export const AXP_TOKEN_SYMBOL = 'AXP';
export const AXP_TOKEN_DECIMALS = 18;

// Actual deployed contract addresses on Amoy Testnet
export const AXP_TOKEN_CONTRACT_ADDRESS = '0xa1edD20366dbAc7341DE5fdb9FE1711Fb9EAD4d4';
export const AXEP_ARTIST_NFT_CONTRACT_ADDRESS = '0x483eC66A0Ac12c985cbcad956996fEB40F020650';
export const AXEP_VOTING_CONTRACT_ADDRESS = "0x198ef3c55944603953A3993029bfeCc0322A42e1";

export const AXEP_VOTING_CONTRACT_ABI = [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_tokenAddress",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "artistId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "artistWallet",
          "type": "address"
        }
      ],
      "name": "ArtistRegistered",
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
          "name": "shareUrl",
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
          "internalType": "uint256",
          "name": "trackId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "voter",
          "type": "address"
        }
      ],
      "name": "Voted",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "allTrackIds",
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
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "artistIdByWallet",
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
      "name": "artists",
      "outputs": [
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
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "axpToken",
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
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_trackId",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "_recipients",
          "type": "address[]"
        }
      ],
      "name": "batchDistributeShareRewards",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
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
            },
            {
              "internalType": "uint256",
              "name": "votes",
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
          "internalType": "string",
          "name": "genre",
          "type": "string"
        }
      ],
      "name": "getTrackIdsByGenre",
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
          "name": "",
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
          "name": "_shareUrl",
          "type": "string"
        }
      ],
      "name": "recordShare",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "artistName",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "trackTitle",
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
        }
      ],
      "name": "registerArtistAndUploadFirstTrack",
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
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_newAmount",
          "type": "uint256"
        }
      ],
      "name": "setShareRewardAmount",
      "outputs": [],
      "stateMutability": "nonpayable",
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
        },
        {
          "internalType": "uint256",
          "name": "votes",
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
          "name": "trackId",
          "type": "uint256"
        }
      ],
      "name": "voteForTrack",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "withdraw",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
] as const;

export const APPROVED_SHARING_PLATFORMS = ['TikTok', 'Instagram', 'Meta (Facebook)', 'X'];
export const SHARING_HASHTAG = '#AXEP';
// @mention logic would require more specific handling based on platform

export const REWARD_AMOUNTS = {
  MAIN_WINNER_SHARE: 10, // AXP
  GENRE_WINNER_SHARE: 5,  // AXP
};

export const MAX_REWARD_PER_WEEK_PER_USER = 40; // AXP
export const MIN_SHARES_FOR_REWARD = 2;

export const MIN_AXP_FOR_VOTE = 1; // Minimum AXP balance required to be eligible to vote

// Voting Cycle: Monday to Sunday (ends 23:59 UTC for consistency)
// Sharing Window: 7 days after voting week ends.

// Tokenomics (for informational display, enforcement is on-chain/backend)
export const TOTAL_AXP_SUPPLY = '5,200,000,000';
export const FOUNDER_RESERVE_AXP = '200,000,000';
export const WEEKLY_EMISSION_LIMIT_AXP = '10,000,000';

export const IPFS_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs/";

export const PROJECT_ID = "336592d418298377a015e57ba5793019"; 