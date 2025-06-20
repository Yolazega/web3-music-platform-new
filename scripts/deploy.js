const { ethers } = require("hardhat");
require('dotenv').config({ path: './.env' });

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  const tokenAddress = "0xa1edD20366dbAc7341DE5fdb9FE1711Fb9EAD4d4"; // AXPToken address on Amoy
  
  const AxepVoting = await ethers.getContractFactory("AxepVoting");
  console.log(`Deploying AxepVoting with token address: ${tokenAddress}`);

  const contract = await AxepVoting.deploy(tokenAddress);

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("AxepVoting deployed to:", contractAddress);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("An error occurred during deployment:", error);
    process.exit(1);
  }); 