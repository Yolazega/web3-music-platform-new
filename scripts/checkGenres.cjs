const { ethers } = require("ethers");

// The ABI for the getOfficialGenres function
const abi = [
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
  }
];

async function main() {
  const contractAddress = "0x83072BC70659AB6aCcd0A46C05bF2748F2Cb2D8e";
  const rpcUrl = "https://rpc-amoy.polygon.technology";
  
  console.log(`Checking genres for contract at: ${contractAddress} using RPC: ${rpcUrl}`);

  // Create a provider to connect to the Amoy network
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Create a contract instance
  const contract = new ethers.Contract(contractAddress, abi, provider);

  try {
    const officialGenres = await contract.getOfficialGenres();
    console.log("Successfully retrieved official genres from the contract:");
    console.log(officialGenres);
  } catch (error) {
    console.error("Failed to call getOfficialGenres():", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 