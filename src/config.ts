import { sepolia, polygon } from 'wagmi/chains';
import VotingContractAbi from '../contracts/AxepVoting.json';

export const AXEP_VOTING_CONTRACT_ADDRESS = "0xBaA01D1E504383da28368DfbeE84C2195Ab937EF";
export const AXP_TOKEN_CONTRACT_ADDRESS = '0xa1edD20366dbAc7341DE5fdb9FE1711Fb9EAD4d4';
export const AMOY_CHAIN_ID = '0x13882';

export const AMOY_RPC_URL = 'https://rpc-amoy.polygon.technology/';
export const AXP_TOKEN_DECIMALS = 18;
export const IPFS_GATEWAY_URL = 'https://gateway.pinata.cloud/ipfs/';

// This now correctly imports the ABI from the JSON file.
// The 'abi' property is accessed from the imported JSON object.
export const AXEP_VOTING_CONTRACT_ABI = VotingContractAbi.abi;