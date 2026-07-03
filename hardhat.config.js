require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const ALCHEMY_RPC_URL = process.env.ALCHEMY_RPC_URL || "";
const PRIVATE_KEY     = process.env.PRIVATE_KEY     || "";

if (!ALCHEMY_RPC_URL) console.warn("Warning: ALCHEMY_RPC_URL is not set in .env");
if (!PRIVATE_KEY)     console.warn("Warning: PRIVATE_KEY is not set in .env");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: ALCHEMY_RPC_URL,
      accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY.replace(/^0x/, "")}`] : [],
      chainId: 11155111,
    },
  },
};
