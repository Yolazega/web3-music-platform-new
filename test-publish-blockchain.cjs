const { createPublicClient, createWalletClient, http, fallback } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { defineChain } = require('viem');

// Test configuration matching your production setup
const AXEP_VOTING_CONTRACT_ADDRESS = "0x83072BC70659AB6aCcd0A46C05bF2748F2Cb2D8e";
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
  rpcUrls: {
    default: { http: AMOY_RPC_URLS },
  },
  blockExplorers: {
    default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com' },
  },
  testnet: true,
});

// Simplified ABI for testing
const AXEP_VOTING_CONTRACT_ABI = [
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
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Create clients with the same configuration as your app
const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: fallback(
    AMOY_RPC_URLS.map(url => http(url, {
      timeout: 20000,
      retryCount: 2,
      retryDelay: 2000,
    })),
    { 
      rank: {
        interval: 120_000,
        sampleCount: 3,
        timeout: 1000,
      },
      retryCount: 1,
      retryDelay: 3000,
    }
  ),
  cacheTime: 2_000,
});

async function testBlockchainPublishing() {
  console.log('🔍 TESTING BLOCKCHAIN PUBLISHING - JSON-RPC ERROR REPRODUCTION');
  console.log('='.repeat(70));
  
  try {
    // Step 1: Test basic RPC connectivity
    console.log('1️⃣ Testing RPC connectivity...');
    const chainId = await publicClient.getChainId();
    console.log('✅ Chain ID:', chainId);
    
    // Step 2: Test contract owner verification
    console.log('\\n2️⃣ Testing contract owner...');
    const owner = await publicClient.readContract({
      address: AXEP_VOTING_CONTRACT_ADDRESS,
      abi: AXEP_VOTING_CONTRACT_ABI,
      functionName: 'owner',
    });
    console.log('✅ Contract owner:', owner);
    console.log('   Expected owner: 0x711Ce52DdF79c2dbC278D356B8Fb2a1E96Ae4c35');
    console.log('   Owner match:', owner.toLowerCase() === '0x711Ce52DdF79c2dbC278D356B8Fb2a1E96Ae4c35'.toLowerCase());
    
    // Step 3: Test genre validation
    console.log('\\n3️⃣ Testing official genres...');
    const officialGenres = await publicClient.readContract({
      address: AXEP_VOTING_CONTRACT_ADDRESS,
      abi: AXEP_VOTING_CONTRACT_ABI,
      functionName: 'getOfficialGenres',
    });
    console.log('✅ Official genres:', officialGenres);
    console.log('   RAP valid:', officialGenres.includes('RAP'));
    
    // Step 4: Simulate the exact transaction that's failing
    console.log('\\n4️⃣ Testing contract simulation (the critical step)...');
    
    // Use the exact same data structure as your failed transaction
    const testData = {
      artistWallets: ['0x5a758cfEF3CE878Bb5FABA93D18781409938e8eB'],
      artistNames: ['AF'],
      trackTitles: ['Immer Weiter'],
      genres: ['RAP'],
      videoUrls: ['https://gateway.pinata.cloud/ipfs/QmTestVideo123'],
      coverImageUrls: ['https://gateway.pinata.cloud/ipfs/QmTestImage456'],
    };
    
    console.log('📋 Test data:', JSON.stringify(testData, null, 2));
    
    // This is where the JSON-RPC error typically occurs
    console.log('⚠️  Attempting contract simulation (this is where JSON-RPC errors happen)...');
    
    try {
      const simulationResult = await publicClient.simulateContract({
        address: AXEP_VOTING_CONTRACT_ADDRESS,
        abi: AXEP_VOTING_CONTRACT_ABI,
        functionName: 'batchRegisterAndUpload',
        args: [
          testData.artistWallets,
          testData.artistNames,
          testData.trackTitles,
          testData.genres,
          testData.videoUrls,
          testData.coverImageUrls,
        ],
        account: '0x711Ce52DdF79c2dbC278D356B8Fb2a1E96Ae4c35', // Your owner address
      });
      
      console.log('✅ CONTRACT SIMULATION SUCCESSFUL!');
      console.log('   Gas estimate:', simulationResult.request.gas?.toString());
      console.log('   This means the contract call should work in production.');
      
    } catch (simulationError) {
      console.log('❌ CONTRACT SIMULATION FAILED - THIS IS THE ROOT CAUSE!');
      console.log('   Error type:', simulationError.name);
      console.log('   Error message:', simulationError.message);
      console.log('   Short message:', simulationError.shortMessage);
      
      if (simulationError.cause) {
        console.log('   Underlying cause:', simulationError.cause.message);
      }
      
      if (simulationError.details) {
        console.log('   Error details:', simulationError.details);
      }
      
      // Check for specific JSON-RPC error patterns
      if (simulationError.message.includes('JSON-RPC') || simulationError.message.includes('Internal JSON-RPC error')) {
        console.log('\\n🔍 JSON-RPC ERROR DETECTED:');
        console.log('   This indicates a network-level issue with Polygon Amoy RPC endpoints');
        console.log('   The contract logic is likely correct, but RPC communication is failing');
        
        // Test individual RPC endpoints
        console.log('\\n🔧 Testing individual RPC endpoints...');
        for (let i = 0; i < AMOY_RPC_URLS.length; i++) {
          const url = AMOY_RPC_URLS[i];
          console.log(`   Testing RPC ${i + 1}: ${url}`);
          
          try {
            const singleClient = createPublicClient({
              chain: polygonAmoy,
              transport: http(url, { timeout: 10000 }),
            });
            
            const testChainId = await singleClient.getChainId();
            console.log(`   ✅ RPC ${i + 1} responsive (Chain ID: ${testChainId})`);
            
            // Test the simulation on this specific RPC
            try {
              await singleClient.simulateContract({
                address: AXEP_VOTING_CONTRACT_ADDRESS,
                abi: AXEP_VOTING_CONTRACT_ABI,
                functionName: 'batchRegisterAndUpload',
                args: [
                  testData.artistWallets,
                  testData.artistNames,
                  testData.trackTitles,
                  testData.genres,
                  testData.videoUrls,
                  testData.coverImageUrls,
                ],
                account: '0x711Ce52DdF79c2dbC278D356B8Fb2a1E96Ae4c35',
              });
              console.log(`   ✅ RPC ${i + 1} simulation SUCCESSFUL`);
            } catch (rpcError) {
              console.log(`   ❌ RPC ${i + 1} simulation failed:`, rpcError.shortMessage || rpcError.message);
            }
            
          } catch (rpcConnectionError) {
            console.log(`   ❌ RPC ${i + 1} connection failed:`, rpcConnectionError.message);
          }
        }
      }
      
      throw simulationError;
    }
    
    console.log('\\n🎉 ALL TESTS PASSED - BLOCKCHAIN PUBLISHING SHOULD WORK!');
    
  } catch (error) {
    console.log('\\n💥 TEST FAILED - ROOT CAUSE IDENTIFIED:');
    console.log('   Error:', error.message);
    console.log('\\n🔧 RECOMMENDED ACTIONS:');
    console.log('   1. Try a different RPC endpoint');
    console.log('   2. Check Polygon Amoy network status');
    console.log('   3. Verify contract parameters');
    console.log('   4. Test with a smaller batch size');
    
    return false;
  }
  
  return true;
}

// Run the test
testBlockchainPublishing()
  .then(success => {
    if (success) {
      console.log('\\n✅ CONCLUSION: Publishing should work - issue may be intermittent network problems');
    } else {
      console.log('\\n❌ CONCLUSION: Publishing has fundamental issues that need fixing');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\\n💥 UNEXPECTED ERROR:', error);
    process.exit(1);
  }); 