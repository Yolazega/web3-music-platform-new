const { ethers } = require("hardhat");

async function main() {
  const AxepVotingSimple = await ethers.getContractFactory("AxepVoting_Simple");
  console.log("Deploying AxepVoting_Simple...");
  const contract = await AxepVotingSimple.deploy();

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("AxepVoting_Simple deployed to:", contractAddress);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 