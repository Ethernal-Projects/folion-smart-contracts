import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "./tasks/mint-token";
import "./tasks/kyc";
import "./tasks/transfer";

// Opt in on a dev machine: blocks arrive on a clock rather than one per tx, so the
// app sees pending states as it would on a real chain. Off by default, because
// tests and CI need a block per transaction.
const intervalMining = process.env.HARDHAT_INTERVAL_MINING === "true";

// Time in milliseconds (e.g., 3000ms = 3 seconds). A missing, unparseable or
// non-positive value falls back, so a typo cannot stop blocks arriving.
const parsedInterval = Number(process.env.HARDHAT_MINING_INTERVAL);
const miningInterval =
  Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 3000;

const config: HardhatUserConfig = {
  defaultNetwork: "folion",
  networks: {
    hh: {
      url: "http://localhost:8545",
      accounts: [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // deployer
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // claimIssuer
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // IrAgent
        "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"  // tokenAgent
      ],
    },
    folion: {
      url: "https://rpc.folion.ethernal.work",
      accounts: [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // deployer
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // claimIssuer
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // IrAgent
        "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"  // tokenAgent
      ],
    },
    hardhat: intervalMining
      ? {
          mining: {
            auto: false,
            interval: miningInterval
          }
        }
      : {},
  },
  solidity: {
    version: "0.8.17",
     settings: {
      optimizer: {
        enabled: true,
        runs: 1, // Lower runs (e.g., 1-200) prioritize smaller size over gas efficiency
      }
    }
  }
};

export default config;
