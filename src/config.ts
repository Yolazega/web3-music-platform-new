import axepVotingAbi from '../artifacts/contracts/AxepVoting_Simple.sol/AxepVoting.json' assert { type: 'json' };
import { Abi } from 'viem';

export const AMOY_CHAIN_ID = '0x13882'; // 80002
export const AMOY_CHAIN_NAME = 'Polygon Amoy Testnet';
export const AMOY_RPC_URL = 'https://rpc-amoy.polygon.technology/';
export const AMOY_EXPLORER_URL = 'https://amoy.polygonscan.com/';

export const AXP_TOKEN_SYMBOL = 'AXP';
export const AXP_TOKEN_DECIMALS = 18;

// Updated contract addresses on Amoy Testnet
export const AXP_TOKEN_CONTRACT_ADDRESS = '0xa1edD20366dbAc7341DE5fdb9FE1711Fb9EAD4d4';
export const AXEP_ARTIST_NFT_CONTRACT_ADDRESS = '0x483eC66A0Ac12c985cbcad956996fEB40F020650';
export const AXEP_VOTING_CONTRACT_ADDRESS = "0xD1ae6f716fE48feCF1D728112379a6708B943181";

// The new, updated ABI from our compiled contract
export const AXEP_VOTING_CONTRACT_ABI = axepVotingAbi.abi as Abi;

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