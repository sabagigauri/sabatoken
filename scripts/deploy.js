// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contract with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Mint 1,000,000 KIRO tokens to the deployer
  const initialSupply = 1_000_000;

  const MyToken = await ethers.getContractFactory("MyToken");
  const token = await MyToken.deploy(initialSupply);

  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("--------------------------------------------------");
  console.log("MyToken (KIRO) deployed to:", address);
  console.log("Total supply:", initialSupply.toLocaleString(), "KIRO");
  console.log("--------------------------------------------------");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
