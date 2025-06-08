import { createPublicClient, http } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { AMOY_RPC_URL } from './config';

export const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(AMOY_RPC_URL)
}); 