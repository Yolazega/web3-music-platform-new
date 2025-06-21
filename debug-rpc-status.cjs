const { createPublicClient, http, parseEther, formatEther } = require('viem');
const { defineChain } = require('viem');

// RPC endpoints to test
const AMOY_RPC_URLS = [
    'https://rpc-amoy.polygon.technology/',
    'https://polygon-amoy.drpc.org',
    'https://polygon-amoy-bor-rpc.publicnode.com',
    'https://rpc.ankr.com/polygon_amoy',
    'https://polygon-amoy.blockpi.network/v1/rpc/public'
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

// Contract addresses
const VOTING_CONTRACT = '0x83072BC70659AB6aCcd0A46C05bF2748F2Cb2D8e';
const TOKEN_CONTRACT = '0xa1edD20366dbAc7341DE5fdb9FE1711Fb9EAD4d4';
const USER_ADDRESS = '0x5E8C7f64EDE23070deF65CcC8Ade56EA8dae5214';
const OWNER_ADDRESS = '0x711Ce52DdF79c2dbC278D356B8Fb2a1E96Ae4c35';

// Contract ABI (minimal)
const VOTING_ABI = [
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
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "axpToken",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }
];

async function testRPCEndpoint(url, index) {
    console.log(`\n🔍 Testing RPC ${index + 1}: ${url}`);
    
    try {
        const client = createPublicClient({
            chain: polygonAmoy,
            transport: http(url, { timeout: 10000 })
        });

        const startTime = Date.now();
        
        // Test basic connectivity
        const blockNumber = await client.getBlockNumber();
        const responseTime = Date.now() - startTime;
        
        console.log(`✅ Block Number: ${blockNumber} (${responseTime}ms)`);
        
        // Test balance
        const balance = await client.getBalance({ address: OWNER_ADDRESS });
        console.log(`💰 Owner Balance: ${formatEther(balance)} MATIC`);
        
        // Test contract calls
        const owner = await client.readContract({
            address: VOTING_CONTRACT,
            abi: VOTING_ABI,
            functionName: 'owner'
        });
        console.log(`👤 Contract Owner: ${owner}`);
        
        const tokenAddress = await client.readContract({
            address: VOTING_CONTRACT,
            abi: VOTING_ABI,
            functionName: 'axpToken'
        });
        console.log(`🪙 Token Address: ${tokenAddress}`);
        
        // Test simulation
        try {
            await client.simulateContract({
                address: VOTING_CONTRACT,
                abi: VOTING_ABI,
                functionName: 'batchRegisterAndUpload',
                args: [
                    [USER_ADDRESS],
                    ['Test Artist'],
                    ['Test Track'],
                    ['RAP'],
                    ['https://ipfs.io/ipfs/QmTest1'],
                    ['https://ipfs.io/ipfs/QmTest2']
                ],
                account: OWNER_ADDRESS,
            });
            console.log(`✅ Contract Simulation: SUCCESS`);
        } catch (simError) {
            console.log(`❌ Contract Simulation: ${simError.shortMessage || simError.message}`);
        }
        
        return {
            url,
            status: 'success',
            responseTime,
            blockNumber: Number(blockNumber)
        };
        
    } catch (error) {
        console.log(`❌ RPC Error: ${error.message}`);
        return {
            url,
            status: 'failed',
            error: error.message
        };
    }
}

async function main() {
    console.log('🚀 AXEP RPC Status Monitor');
    console.log('==========================');
    console.log(`Contract: ${VOTING_CONTRACT}`);
    console.log(`Token: ${TOKEN_CONTRACT}`);
    console.log(`Owner: ${OWNER_ADDRESS}`);
    console.log(`User: ${USER_ADDRESS}`);
    
    const results = [];
    
    // Test all RPC endpoints
    for (let i = 0; i < AMOY_RPC_URLS.length; i++) {
        const result = await testRPCEndpoint(AMOY_RPC_URLS[i], i);
        results.push(result);
        
        // Wait between tests to avoid rate limiting
        if (i < AMOY_RPC_URLS.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Summary
    console.log('\n📊 SUMMARY');
    console.log('===========');
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');
    
    console.log(`✅ Working RPCs: ${successful.length}/${results.length}`);
    console.log(`❌ Failed RPCs: ${failed.length}/${results.length}`);
    
    if (successful.length > 0) {
        const avgResponseTime = successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length;
        console.log(`⚡ Average Response Time: ${Math.round(avgResponseTime)}ms`);
        
        console.log('\n🏆 Best RPCs (by response time):');
        successful
            .sort((a, b) => a.responseTime - b.responseTime)
            .slice(0, 3)
            .forEach((rpc, i) => {
                console.log(`  ${i + 1}. ${rpc.url} (${rpc.responseTime}ms)`);
            });
    }
    
    if (failed.length > 0) {
        console.log('\n💥 Failed RPCs:');
        failed.forEach(rpc => {
            console.log(`  - ${rpc.url}: ${rpc.error}`);
        });
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('==================');
    
    if (successful.length === 0) {
        console.log('🚨 ALL RPCs FAILED! This indicates a network issue or Amoy testnet problems.');
        console.log('   - Check your internet connection');
        console.log('   - Try again in a few minutes');
        console.log('   - Consider using a VPN if geo-blocked');
    } else if (successful.length < 3) {
        console.log('⚠️  Limited RPC availability detected.');
        console.log('   - Transaction failures are likely due to RPC instability');
        console.log('   - Retry logic should help with intermittent failures');
    } else {
        console.log('✅ Good RPC availability! Transaction issues may be due to:');
        console.log('   - Gas estimation problems');
        console.log('   - Network congestion');
        console.log('   - Contract state issues');
    }
    
    console.log('\n🔧 TROUBLESHOOTING TIPS');
    console.log('=======================');
    console.log('1. Use the fastest RPC endpoints first');
    console.log('2. Increase gas limits for batch operations');
    console.log('3. Add retry logic with exponential backoff');
    console.log('4. Monitor Polygon Amoy network status');
    console.log('5. Check MetaMask network configuration');
    
    console.log('\n📱 MetaMask Configuration:');
    console.log('Network Name: Amoy');
    console.log('RPC URL: https://rpc-amoy.polygon.technology/');
    console.log('Chain ID: 80002');
    console.log('Currency Symbol: POL');
    console.log('Block Explorer: https://amoy.polygonscan.com');
}

main().catch(console.error); 