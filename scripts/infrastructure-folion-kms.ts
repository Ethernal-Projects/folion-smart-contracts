import { ethers } from "hardhat";
import OnchainID from "@onchain-id/solidity";
import TRex from "@tokenysolutions/t-rex";
import { writeFileSync } from "fs";
import { AwsKmsSigner } from "@cuonghx.gu-tech/ethers-aws-kms-signer";
import "dotenv/config";
import CountryPermitModule from "../artifacts/contracts/compliance/CountryPermitModule.sol/CountryPermitModule.json";
import CountryRestrictModule from "../artifacts/contracts/compliance/CountryRestrictModule.sol/CountryRestrictModule.json";
import MaxBalanceModule from "../artifacts/contracts/compliance/MaxBalanceModule.sol/MaxBalanceModule.json";
import MaxTotalSupplyModule from "../artifacts/contracts/compliance/MaxTotalSupplyModule.sol/MaxTotalSupplyModule.json";
import MinInvestmentModule from "../artifacts/contracts/compliance/MinInvestmentModule.sol/MinInvestmentModule.json";
import LockInTransferModule from "../artifacts/contracts/compliance/LockInTransferModule.sol/LockInTransferModule.json";
import GlobalLockInTransferModule from "../artifacts/contracts/compliance/GlobalLockInTransferModule.sol/GlobalLockInTransferModule.json";
import TransferPermitModule from "../artifacts/contracts/compliance/TransferPermitModule.sol/TransferPermitModule.json";
import ERC3643Token from "../artifacts/contracts/token/ERC3643Token.sol/ERC3643Token.json";

async function waitForSafeBlock(
  provider: ethers.JsonRpcProvider,
  txHash: string,
  timeoutMs = 60 * 60 * 1000 // 1 hour
) {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      console.log("⚠️ Transaction missing from canonical chain (possible reorg). Waiting...");
      await sleep(6000);
      continue;
    }

    if (receipt.status !== 1) {
      throw new Error(`Transaction ${txHash} reverted`);
    }

    const safeBlock = await provider.getBlock("safe");
    if (safeBlock && safeBlock.number >= receipt.blockNumber) {
      // Re-check to close the race between the two calls above
      const confirm = await provider.getTransactionReceipt(txHash);
      if (confirm && confirm.blockHash === receipt.blockHash) {
        return;
      }
      continue;
    }

    console.log(`Waiting for transaction ${txHash} to be safe...`);
    await sleep(6000);
  }

  throw new Error(`Timed out waiting for ${txHash} to reach a safe block`);
}

async function main() {
  const appAdmin = process.env.APP_ADMIN_ADDRESS!;
  console.log("App Admin Address -> %s", appAdmin);
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  console.log("RPC URL -> %s", process.env.RPC_URL);
  const deployer = new AwsKmsSigner(
    {
      keyId: process.env.KMS_KEY_ID!,
      region: process.env.AWS_REGION!,
    },
    provider
  );
  console.log("Deployer Address -> %s", await deployer.getAddress());

  // OnChainID deployment
  const identityImplementation = await new ethers.ContractFactory(
    OnchainID.contracts.Identity.abi,
    OnchainID.contracts.Identity.bytecode,
    deployer
  ).deploy(deployer.address, true);
  let receipt = await identityImplementation.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);
  console.log("IdentityImplementation address -> %s", (await identityImplementation.getAddress()).toString());

  const identityImplementationAuthority = await new ethers.ContractFactory(
    OnchainID.contracts.ImplementationAuthority.abi,
    OnchainID.contracts.ImplementationAuthority.bytecode,
    deployer
  ).deploy(await identityImplementation.getAddress());
  receipt = await identityImplementationAuthority.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);
  console.log("IdentityImplementationAuthority address -> %s", (await identityImplementationAuthority.getAddress()).toString());

  const identityFactory = await new ethers.ContractFactory(
    OnchainID.contracts.Factory.abi,
    OnchainID.contracts.Factory.bytecode,
    deployer
  ).deploy(await identityImplementationAuthority.getAddress());
  receipt = await identityFactory.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);
  console.log("IdFactory address -> %s", (await identityFactory.getAddress()).toString());

  const gateway = await new ethers.ContractFactory(
    OnchainID.contracts.Gateway.abi,
    OnchainID.contracts.Gateway.bytecode,
    deployer
  ).deploy(await identityFactory.getAddress(), [appAdmin]); // anyone can be signer
  receipt = await gateway.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);
  console.log("Gateway address -> %s", (await gateway.getAddress()).toString());
  // end of OnChainID deployment

  const trustedIssuersRegistryImplementation = await new ethers.ContractFactory(
    TRex.contracts.TrustedIssuersRegistry.abi,
    TRex.contracts.TrustedIssuersRegistry.bytecode,
    deployer
  ).deploy();
  receipt = await trustedIssuersRegistryImplementation.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);
  console.log("TrustedIssuersRegistryImplementation address -> %s", (await trustedIssuersRegistryImplementation.getAddress()).toString());

  const identityRegistryStorageImplementation =
    await new ethers.ContractFactory(
      TRex.contracts.IdentityRegistryStorage.abi,
      TRex.contracts.IdentityRegistryStorage.bytecode,
      deployer
    ).deploy();
  receipt = await identityRegistryStorageImplementation.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);
  console.log("IdentityRegistryStorageImplementation address -> %s", (await identityRegistryStorageImplementation.getAddress()).toString());

  const identityRegistryImplementation = await new ethers.ContractFactory(
    TRex.contracts.IdentityRegistry.abi,
    TRex.contracts.IdentityRegistry.bytecode,
    deployer
  ).deploy();
  receipt = await identityRegistryImplementation.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);
  console.log("IdentityRegistryImplementation address -> %s", (await identityRegistryImplementation.getAddress()).toString());

  const modularComplianceImplementation = await new ethers.ContractFactory(
    TRex.contracts.ModularCompliance.abi,
    TRex.contracts.ModularCompliance.bytecode,
    deployer
  ).deploy();
  receipt = await modularComplianceImplementation.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);
  console.log("ModularComplianceImplementation address -> %s", (await modularComplianceImplementation.getAddress()).toString());

  const tokenImplementation = await new ethers.ContractFactory(
    ERC3643Token.abi,
    ERC3643Token.bytecode,
    deployer
  ).deploy();
  receipt = await tokenImplementation.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);
  console.log("TokenImplementation address -> %s", (await tokenImplementation.getAddress()).toString());

  const claimTopicsRegistryImplementation = await new ethers.ContractFactory(
    TRex.contracts.ClaimTopicsRegistry.abi,
    TRex.contracts.ClaimTopicsRegistry.bytecode,
    deployer
  ).deploy();
  receipt = await claimTopicsRegistryImplementation.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);
  console.log("ClaimTopicsRegistryImplementation address -> %s", (await claimTopicsRegistryImplementation.getAddress()).toString());

  const versionStruct = {
    major: 4,
    minor: 0,
    patch: 0,
  };

  const contractsStruct = {
    tokenImplementation: await tokenImplementation.getAddress(),
    ctrImplementation: await claimTopicsRegistryImplementation.getAddress(),
    irImplementation: await identityRegistryImplementation.getAddress(),
    irsImplementation: await identityRegistryStorageImplementation.getAddress(),
    tirImplementation: await trustedIssuersRegistryImplementation.getAddress(),
    mcImplementation: await modularComplianceImplementation.getAddress(),
  };

  const trexImplementationAuthority = await new ethers.ContractFactory(
    TRex.contracts.TREXImplementationAuthority.abi,
    TRex.contracts.TREXImplementationAuthority.bytecode,
    deployer
  ).deploy(true, ethers.ZeroAddress, ethers.ZeroAddress);
  receipt = await trexImplementationAuthority.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);
  console.log("TREXImplementationAuthority address -> %s", (await trexImplementationAuthority.getAddress()).toString());

  const txAddTREX = await trexImplementationAuthority.connect(deployer).addAndUseTREXVersion(versionStruct, contractsStruct);
  receipt = await txAddTREX.wait();
  if (!receipt || receipt.status !== 1) throw new Error("txAddTREX transaction failed");
  await waitForSafeBlock(provider, receipt.hash);

  const trexFactory = await new ethers.ContractFactory(
    TRex.contracts.TREXFactory.abi,
    TRex.contracts.TREXFactory.bytecode,
    deployer
  ).deploy(await trexImplementationAuthority.getAddress(), await identityFactory.getAddress());
  receipt = await trexFactory.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);
  console.log("TREXFactory address -> %s", (await trexFactory.getAddress()).toString());

  const txAddTokenFactory = await identityFactory.connect(deployer).addTokenFactory(await trexFactory.getAddress());
  receipt = await txAddTokenFactory.wait();
  if (!receipt || receipt.status !== 1) throw new Error("txAddTokenFactory transaction failed");
  await waitForSafeBlock(provider, receipt.hash);

  const trexGateway = await new ethers.ContractFactory(
    TRex.contracts.TREXGateway.abi,
    TRex.contracts.TREXGateway.bytecode,
    deployer
  ).deploy(await trexFactory.getAddress(), false);
  receipt = await trexGateway.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);
  console.log("TREXGateway address -> %s", (await trexGateway.getAddress()).toString());

  const txAddDeployer = await trexGateway.connect(deployer).addDeployer(appAdmin); // token deployer can be anyone
  receipt = await txAddDeployer.wait();
  if (!receipt || receipt.status !== 1) throw new Error("txAddDeployer transaction failed");
  await waitForSafeBlock(provider, receipt.hash);

  // transfer trexFactory ownership to trexGateway
  const trexGatewayOwnership = await trexFactory.connect(deployer).transferOwnership(await trexGateway.getAddress());
  receipt = await trexGatewayOwnership.wait();
  if (!receipt || receipt.status !== 1) throw new Error("trexGatewayOwnership transaction failed");
  await waitForSafeBlock(provider, receipt.hash);

  // transfer identityFactory ownership to gateway in order to allow identity creation by users
  const txTransferOwnership = await identityFactory.connect(deployer).transferOwnership(await gateway.getAddress());
  receipt = await txTransferOwnership.wait();
  if (!receipt || receipt.status !== 1) throw new Error("txTransferOwnership transaction failed");
  await waitForSafeBlock(provider, receipt.hash);

  // TREXGateway contains trexFactory; trexFactory contains idFactory, token; token contains MC, IR; IR contains IRS, TIR, CTR
  // Gateway is for users identity creation

  const countryPermitModule = await new ethers.ContractFactory(
    CountryPermitModule.abi,
    CountryPermitModule.bytecode,
    deployer
  ).deploy();
  receipt = await countryPermitModule.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);
  
  console.log(
    "Country Permit Module Implementation ->",
    await countryPermitModule.getAddress()
  );

  const countryPermitModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await countryPermitModule.getAddress(),
    countryPermitModule.interface.encodeFunctionData("initialize")
  );
  receipt = await countryPermitModuleProxy.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Country Permit Module Proxy ->",
    await countryPermitModuleProxy.getAddress()
  );

  // CountryRestrictModule
  const countryRestrictModule = await new ethers.ContractFactory(
    CountryRestrictModule.abi,
    CountryRestrictModule.bytecode,
    deployer
  ).deploy();
  receipt = await countryRestrictModule.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Country Restrict Module Implementation ->",
    await countryRestrictModule.getAddress()
  );

  const countryRestrictModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await countryRestrictModule.getAddress(),
    countryRestrictModule.interface.encodeFunctionData("initialize")
  );
  receipt = await countryRestrictModuleProxy.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Country Restrict Module Proxy ->",
    await countryRestrictModuleProxy.getAddress()
  );

  // MaxBalanceModule
  const maxBalanceModule = await new ethers.ContractFactory(
    MaxBalanceModule.abi,
    MaxBalanceModule.bytecode,
    deployer
  ).deploy();
  receipt = await maxBalanceModule.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Max Balance Module Implementation ->",
    await maxBalanceModule.getAddress()
  );

  const maxBalanceModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await maxBalanceModule.getAddress(),
    maxBalanceModule.interface.encodeFunctionData("initialize")
  );
  receipt = await maxBalanceModuleProxy.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Max Balance Module Proxy ->",
    await maxBalanceModuleProxy.getAddress()
  );

  // MaxTotalSupplyModule
  const maxTotalSupplyModule = await new ethers.ContractFactory(
    MaxTotalSupplyModule.abi,
    MaxTotalSupplyModule.bytecode,
    deployer
  ).deploy();
  receipt = await maxTotalSupplyModule.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Max Total Supply Module Implementation ->",
    await maxTotalSupplyModule.getAddress()
  );

  const maxTotalSupplyModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await maxTotalSupplyModule.getAddress(),
    maxTotalSupplyModule.interface.encodeFunctionData("initialize")
  );
  receipt = await maxTotalSupplyModuleProxy.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Max Total Supply Module Proxy ->",
    await maxTotalSupplyModuleProxy.getAddress()
  );

  // MinInvestmentModule
  const minInvestmentModule = await new ethers.ContractFactory(
    MinInvestmentModule.abi,
    MinInvestmentModule.bytecode,
    deployer
  ).deploy();
  receipt = await minInvestmentModule.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Min Investment Module Implementation ->",
    await minInvestmentModule.getAddress()
  );

  const minInvestmentModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await minInvestmentModule.getAddress(),
    minInvestmentModule.interface.encodeFunctionData("initialize")
  );
  receipt = await minInvestmentModuleProxy.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Min Investment Module Proxy ->",
    await minInvestmentModuleProxy.getAddress()
  );

  // LockInTransferModule
  const lockInTransferModule = await new ethers.ContractFactory(
    LockInTransferModule.abi,
    LockInTransferModule.bytecode,
    deployer
  ).deploy();
  receipt = await lockInTransferModule.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Lock In Transfer Module Implementation ->",
    await lockInTransferModule.getAddress()
  );

  const lockInTransferModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await lockInTransferModule.getAddress(),
    lockInTransferModule.interface.encodeFunctionData("initialize")
  );
  receipt = await lockInTransferModuleProxy.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Lock In Transfer Module Proxy ->",
    await lockInTransferModuleProxy.getAddress()
  );

  // GlobalLockInTransferModule
  const globalLockInTransferModule = await new ethers.ContractFactory(
    GlobalLockInTransferModule.abi,
    GlobalLockInTransferModule.bytecode,
    deployer
  ).deploy();
  receipt = await globalLockInTransferModule.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Global Lock In Transfer Module Implementation ->",
    await globalLockInTransferModule.getAddress()
  );

  const globalLockInTransferModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await globalLockInTransferModule.getAddress(),
    globalLockInTransferModule.interface.encodeFunctionData("initialize")
  );
  receipt = await globalLockInTransferModuleProxy.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Global Lock In Transfer Module Proxy ->",
    await globalLockInTransferModuleProxy.getAddress()
  );

  // TransferPermitModule
  const transferPermitModule = await new ethers.ContractFactory(
    TransferPermitModule.abi,
    TransferPermitModule.bytecode,
    deployer
  ).deploy();
  receipt = await transferPermitModule.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Transfer Permit Module Implementation ->",
    await transferPermitModule.getAddress()
  );

  const transferPermitModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await transferPermitModule.getAddress(),
    transferPermitModule.interface.encodeFunctionData("initialize")
  );
  receipt = await transferPermitModuleProxy.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log(
    "Transfer Permit Module Proxy ->",
    await transferPermitModuleProxy.getAddress()
  );

  const identityRegistryStorageProxy = await new ethers.ContractFactory(
    TRex.contracts.IdentityRegistryStorageProxy.abi,
    TRex.contracts.IdentityRegistryStorageProxy.bytecode,
    deployer
  ).deploy(await trexImplementationAuthority.getAddress());
  receipt = await identityRegistryStorageProxy.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
  await waitForSafeBlock(provider, receipt.hash);

  console.log("Identity Registry Storage Proxy ->", await identityRegistryStorageProxy.getAddress());

  const irStorage = await ethers.getContractAt(
    TRex.contracts.IdentityRegistryStorage.abi,
    await identityRegistryStorageProxy.getAddress()
  );
  const txAddAgent = await irStorage.connect(deployer).addAgent(appAdmin);
  receipt = await txAddAgent.wait();
  if (!receipt || receipt.status !== 1) throw new Error("txAddAgent transaction failed");
  await waitForSafeBlock(provider, receipt.hash);

  const transferOwnershipIRS = await irStorage.connect(deployer).transferOwnership(await trexFactory.getAddress());
  receipt = await transferOwnershipIRS.wait();
  if (!receipt || receipt.status !== 1) throw new Error("transferOwnershipIRS transaction failed");
  await waitForSafeBlock(provider, receipt.hash);

  const addresses = {
    trexFactory: await trexFactory.getAddress(),
    trexGateway: await trexGateway.getAddress(),
    idFactory: await identityFactory.getAddress(),
    gateway: await gateway.getAddress(),
    identityRegistryStorage: await identityRegistryStorageProxy.getAddress(),
    countryPermitModule: await countryPermitModuleProxy.getAddress(),
    countryRestrictModule: await countryRestrictModuleProxy.getAddress(),
    maxBalanceModule: await maxBalanceModuleProxy.getAddress(),
    maxTotalSupplyModule: await maxTotalSupplyModuleProxy.getAddress(),
    minInvestmentModule: await minInvestmentModuleProxy.getAddress(),
    lockInTransferModule: await lockInTransferModuleProxy.getAddress(),
    globalLockInTransferModule: await globalLockInTransferModuleProxy.getAddress(),
    transferPermitModule: await transferPermitModuleProxy.getAddress(),
    // add remaining contracts for verification
    identityImplementation: await identityImplementation.getAddress(),
    identityImplementationAuthority: await identityImplementationAuthority.getAddress(),
    trustedIssuersRegistryImplementation: await trustedIssuersRegistryImplementation.getAddress(),
    identityRegistryStorageImplementation: await identityRegistryStorageImplementation.getAddress(),
    identityRegistryImplementation: await identityRegistryImplementation.getAddress(),
    claimTopicsRegistryImplementation: await claimTopicsRegistryImplementation.getAddress(),
    modularComplianceImplementation: await modularComplianceImplementation.getAddress(),
    trexImplementationAuthority: await trexImplementationAuthority.getAddress(),
    tokenImplementation: await tokenImplementation.getAddress(),
    countryPermitModuleImplementation: await countryPermitModule.getAddress(),
    countryRestrictModuleImplementation: await countryRestrictModule.getAddress(),
    globalLockInTransferModuleImplementation: await globalLockInTransferModule.getAddress(),
    lockInTransferModuleImplementation: await lockInTransferModule.getAddress(),
    maxBalanceModuleImplementation: await maxBalanceModule.getAddress(),
    maxTotalSupplyModuleImplementation: await maxTotalSupplyModule.getAddress(),
    minInvestmentModuleImplementation: await minInvestmentModule.getAddress(),
    transferPermitModuleImplementation: await transferPermitModule.getAddress()
  };

  writeFileSync("addresses-folion.json", JSON.stringify(addresses, null, 2));
  console.log("Addresses written to addresses-folion.json");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
