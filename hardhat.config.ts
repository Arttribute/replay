import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require("dotenv").config({ path: __dirname + "/.env" });
require("@nomicfoundation/hardhat-verify");

const privateKey = process.env.PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      chainId: 1337,
    },
    calibration: {
      chainId: 314159,
      url: "https://api.calibration.node.glif.io/rpc/v1",
      accounts: [privateKey],
    },
    "base-sepolia": {
      url: "https://sepolia.base.org",
      accounts: [privateKey],
      gasPrice: 1000000000,
    },
    "op-sepolia": {
      chainId: 11155420,
      url: `https://optimism-sepolia.blockpi.network/v1/rpc/public`,
      accounts: [privateKey],
    },
  },
  etherscan: {
    apiKey: {
      "base-sepolia": "empty",
    },
    customChains: [
      {
        network: "base-sepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://base-sepolia.blockscout.com/api",
          browserURL: "https://base-sepolia.blockscout.com",
        },
      },
    ],
  },
};

export default config;
