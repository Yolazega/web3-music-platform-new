import { createPublicClient, http, fallback } from 'viem';
import { defineChain } from 'viem';

// Use the updated RPC configuration
const AMOY_RPC_URLS = [
    'https://polygon-amoy.drpc.org',
    'https://rpc-amoy.polygon.technology',
    'https://polygon-amoy-bor-rpc.publicnode.com',
    'https://polygon-amoy.blockpi.network/v1/rpc/public',
];

const polygonAmoy = defineChain({
  id: 80002,
  name: 'Polygon Amoy',
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  rpcUrls: { default: { http: AMOY_RPC_URLS } },
  testnet: true,
});

const client = createPublicClient({
  chain: polygonAmoy,
  transport: fallback(
    AMOY_RPC_URLS.map(url => http(url, {
      timeout: 20000,
      retryCount: 2,
      retryDelay: 2000,
    })),
    { 
      rank: { interval: 120_000, sampleCount: 3, timeout: 1000 },
      retryCount: 1,
      retryDelay: 3000,
    }
  ),
  cacheTime: 2_000,
});

const CONTRACT_ADDRESS = '0x83072BC70659AB6aCcd0A46C05bF2748F2Cb2D8e';
const USER_ADDRESS = '0x711Ce52DdF79c2dbC278D356B8Fb2a1E96Ae4c35';

// Minimal ABI for testing
const ABI = [
  {
    "inputs": [
      {"internalType": "address[]", "name": "artistWallets", "type": "address[]"},
      {"internalType": "string[]", "name": "artistNames", "type": "string[]"},
      {"internalType": "string[]", "name": "trackTitles", "type": "string[]"},
      {"internalType": "string[]", "name": "genres", "type": "string[]"},
      {"internalType": "string[]", "name": "videoUrls", "type": "string[]"},
      {"internalType": "string[]", "name": "coverImageUrls", "type": "string[]"}
    ],
    "name": "batchRegisterAndUpload",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getOfficialGenres",
    "outputs": [{"internalType": "string[]", "name": "", "type": "string[]"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Test data from the error
const testData = {
  artistWallets: ["0x5a758cfEF3CE878Bb5FABA93D18781409938e8eB"],
  artistNames: ["AF"],
  trackTitles: ["Immer Weiter"],
  genres: ["RAP"],
  videoUrls: ["https://ipfs.io/ipfs/QmVigyQ2iaFzRtMUJP9ptyWQ5uTEtzvaJkHr6BwvGfQjjq"],
  coverImageUrls: ["https://ipfs.io/ipfs/QmdVPpByPLbhuPrrTPR6KyA99aBPUHZgouFoES4ek1HLGX"]
};

async function testContractCall() {
  try {
    console.log('🧪 Testing contract call simulation...');
    
    // First, check official genres
    console.log('📋 Getting official genres...');
    const officialGenres = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'getOfficialGenres'
    });
    console.log('✅ Official genres:', officialGenres);
    
    // Check if our genre is valid
    const isValidGenre = officialGenres.includes(testData.genres[0]);
    console.log(`🎵 Genre "${testData.genres[0]}" is valid:`, isValidGenre);
    
    // Try to simulate the contract call
    console.log('🔍 Simulating contract call...');
    
    try {
      const result = await client.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'batchRegisterAndUpload',
        args: [
          testData.artistWallets,
          testData.artistNames,
          testData.trackTitles,
          testData.genres,
          testData.videoUrls,
          testData.coverImageUrls,
        ],
        account: USER_ADDRESS,
        gas: BigInt(8000000), // 8M gas limit
      });
      
      console.log('✅ Simulation successful:', result);
      
    } catch (simError) {
      console.error('❌ Simulation failed:');
      console.error('Message:', simError.message);
      console.error('Short message:', simError.shortMessage);
      console.error('Details:', simError.details);
      console.error('Data:', simError.data);
      console.error('Cause:', simError.cause);
      
      // Try to get more detailed error info
      if (simError.data) {
        console.log('Raw error data:', simError.data);
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testContractCall().catch(console.error); 