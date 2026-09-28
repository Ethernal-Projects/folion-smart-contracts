import { ethers } from "hardhat";
import { AwsKmsSigner } from "@cuonghx.gu-tech/ethers-aws-kms-signer";
import "dotenv/config";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  console.log("RPC URL -> %s", process.env.RPC_URL);
  const account = new AwsKmsSigner(
    {
      keyId: process.env.KMS_KEY_ID!,
      region: process.env.AWS_REGION!,
    },
    provider
  );
  console.log("Account Address -> %s", await account.getAddress());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
