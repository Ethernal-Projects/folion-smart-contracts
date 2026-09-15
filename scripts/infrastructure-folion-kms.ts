import { ethers } from "hardhat";
import OnchainID from "@onchain-id/solidity";
import TRex from "@tokenysolutions/t-rex";
import { writeFileSync } from "fs";
import { AwsKmsSigner } from "@cuonghx.gu-tech/ethers-aws-kms-signer";
import "dotenv/config";
import TransparentUpgradeableProxy from "@openzeppelin/contracts/build/contracts/TransparentUpgradeableProxy.json";
import CountryPermitModule from "../artifacts/contracts/compliance/CountryPermitModule.sol/CountryPermitModule.json";
import CountryRestrictModule from "../artifacts/contracts/compliance/CountryRestrictModule.sol/CountryRestrictModule.json";
import MaxBalanceModule from "../artifacts/contracts/compliance/MaxBalanceModule.sol/MaxBalanceModule.json";
import MaxTotalSupplyModule from "../artifacts/contracts/compliance/MaxTotalSupplyModule.sol/MaxTotalSupplyModule.json";
import MinInvestmentModule from "../artifacts/contracts/compliance/MinInvestmentModule.sol/MinInvestmentModule.json";
import LockInTransferModule from "../artifacts/contracts/compliance/LockInTransferModule.sol/LockInTransferModule.json";
import GlobalLockInTransferModule from "../artifacts/contracts/compliance/GlobalLockInTransferModule.sol/GlobalLockInTransferModule.json";
import TransferPermitModule from "../artifacts/contracts/compliance/TransferPermitModule.sol/TransferPermitModule.json";
import MarketplaceManager from "../artifacts/contracts/marketplace/MarketplaceManager.sol/MarketplaceManager.json";
import ERC3643Token from "../artifacts/contracts/token/ERC3643Token.sol/ERC3643Token.json";

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
  await identityImplementation.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const identityImplementationAuthority = await new ethers.ContractFactory(
    OnchainID.contracts.ImplementationAuthority.abi,
    OnchainID.contracts.ImplementationAuthority.bytecode,
    deployer
  ).deploy(await identityImplementation.getAddress());
  await identityImplementationAuthority.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const identityFactory = await new ethers.ContractFactory(
    OnchainID.contracts.Factory.abi,
    OnchainID.contracts.Factory.bytecode,
    deployer
  ).deploy(await identityImplementationAuthority.getAddress());
  await identityFactory.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const gateway = await new ethers.ContractFactory(
    OnchainID.contracts.Gateway.abi,
    OnchainID.contracts.Gateway.bytecode,
    deployer
  ).deploy(await identityFactory.getAddress(), [appAdmin]); // anyone can be signer
  await gateway.deploymentTransaction().wait(process.env.CONFIRMATIONS);
  // end of OnChainID deployment

  const trustedIssuersRegistryImplementation = await new ethers.ContractFactory(
    TRex.contracts.TrustedIssuersRegistry.abi,
    TRex.contracts.TrustedIssuersRegistry.bytecode,
    deployer
  ).deploy();
  await trustedIssuersRegistryImplementation.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const identityRegistryStorageImplementation =
    await new ethers.ContractFactory(
      TRex.contracts.IdentityRegistryStorage.abi,
      TRex.contracts.IdentityRegistryStorage.bytecode,
      deployer
    ).deploy();
  await identityRegistryStorageImplementation.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const identityRegistryImplementation = await new ethers.ContractFactory(
    TRex.contracts.IdentityRegistry.abi,
    TRex.contracts.IdentityRegistry.bytecode,
    deployer
  ).deploy();
  await identityRegistryImplementation.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const modularComplianceImplementation = await new ethers.ContractFactory(
    TRex.contracts.ModularCompliance.abi,
    TRex.contracts.ModularCompliance.bytecode,
    deployer
  ).deploy();
  await modularComplianceImplementation.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const tokenImplementation = await new ethers.ContractFactory(
    ERC3643Token.abi,
    ERC3643Token.bytecode,
    deployer
  ).deploy();
  await tokenImplementation.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const claimTopicsRegistryImplementation = await new ethers.ContractFactory(
    TRex.contracts.ClaimTopicsRegistry.abi,
    TRex.contracts.ClaimTopicsRegistry.bytecode,
    deployer
  ).deploy();
  await claimTopicsRegistryImplementation.deploymentTransaction().wait(process.env.CONFIRMATIONS);

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
  await trexImplementationAuthority.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const txAddTREX = await trexImplementationAuthority.connect(deployer).addAndUseTREXVersion(versionStruct, contractsStruct);
  await txAddTREX.wait(process.env.CONFIRMATIONS);

  const trexFactory = await new ethers.ContractFactory(
    TRex.contracts.TREXFactory.abi,
    TRex.contracts.TREXFactory.bytecode,
    deployer
  ).deploy(await trexImplementationAuthority.getAddress(), await identityFactory.getAddress());
  await trexFactory.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const txAddTokenFactory = await identityFactory.connect(deployer).addTokenFactory(await trexFactory.getAddress());
  await txAddTokenFactory.wait(process.env.CONFIRMATIONS);

  const trexGateway = await new ethers.ContractFactory(
    TRex.contracts.TREXGateway.abi,
    TRex.contracts.TREXGateway.bytecode,
    deployer
  ).deploy(await trexFactory.getAddress(), false);
  await trexGateway.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const txAddDeployer = await trexGateway.connect(deployer).addDeployer(appAdmin); // token deployer can be anyone
  await txAddDeployer.wait(process.env.CONFIRMATIONS);

  // transfer trexFactory ownership to trexGateway
  const trexGatewayOwnership = await trexFactory.connect(deployer).transferOwnership(await trexGateway.getAddress());
  await trexGatewayOwnership.wait(process.env.CONFIRMATIONS);

  // transfer identityFactory ownership to gateway in order to allow identity creation by users
  const txTransferOwnership = await identityFactory.connect(deployer).transferOwnership(await gateway.getAddress());
  await txTransferOwnership.wait(process.env.CONFIRMATIONS);

  console.log("TREXFactory address -> %s", (await trexFactory.getAddress()).toString());
  console.log("TREXGateway address -> %s", (await trexGateway.getAddress()).toString());
  console.log("IdFactory address -> %s", (await identityFactory.getAddress()).toString());
  console.log("Gateway address -> %s", (await gateway.getAddress()).toString());

  // TREXGateway contains trexFactory; trexFactory contains idFactory, token; token contains MC, IR; IR contains IRS, TIR, CTR
  // Gateway is for users identity creation

  const countryPermitModule = await new ethers.ContractFactory(
    CountryPermitModule.abi,
    CountryPermitModule.bytecode,
    deployer
  ).deploy();
  await countryPermitModule.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const countryPermitModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await countryPermitModule.getAddress(),
    countryPermitModule.interface.encodeFunctionData("initialize")
  );
  await countryPermitModuleProxy.deploymentTransaction().wait(process.env.CONFIRMATIONS);

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
  await countryRestrictModule.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const countryRestrictModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await countryRestrictModule.getAddress(),
    countryRestrictModule.interface.encodeFunctionData("initialize")
  );
  await countryRestrictModuleProxy.deploymentTransaction().wait(process.env.CONFIRMATIONS);

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
  await maxBalanceModule.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const maxBalanceModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await maxBalanceModule.getAddress(),
    maxBalanceModule.interface.encodeFunctionData("initialize")
  );
  await maxBalanceModuleProxy.deploymentTransaction().wait(process.env.CONFIRMATIONS);

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
  await maxTotalSupplyModule.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const maxTotalSupplyModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await maxTotalSupplyModule.getAddress(),
    maxTotalSupplyModule.interface.encodeFunctionData("initialize")
  );
  await maxTotalSupplyModuleProxy.deploymentTransaction().wait(process.env.CONFIRMATIONS);

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
  await minInvestmentModule.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const minInvestmentModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await minInvestmentModule.getAddress(),
    minInvestmentModule.interface.encodeFunctionData("initialize")
  );
  await minInvestmentModuleProxy.deploymentTransaction().wait(process.env.CONFIRMATIONS);

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
  await lockInTransferModule.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const lockInTransferModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await lockInTransferModule.getAddress(),
    lockInTransferModule.interface.encodeFunctionData("initialize")
  );
  await lockInTransferModuleProxy.deploymentTransaction().wait(process.env.CONFIRMATIONS);

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
  await globalLockInTransferModule.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const globalLockInTransferModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await globalLockInTransferModule.getAddress(),
    globalLockInTransferModule.interface.encodeFunctionData("initialize")
  );
  await globalLockInTransferModuleProxy.deploymentTransaction().wait(process.env.CONFIRMATIONS);

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
  await transferPermitModule.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const transferPermitModuleProxy = await new ethers.ContractFactory(
    TRex.contracts.ModuleProxy.abi,
    TRex.contracts.ModuleProxy.bytecode,
    deployer
  ).deploy(
    await transferPermitModule.getAddress(),
    transferPermitModule.interface.encodeFunctionData("initialize")
  );
  await transferPermitModuleProxy.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  console.log(
    "Transfer Permit Module Proxy ->",
    await transferPermitModuleProxy.getAddress()
  );

  // MarketplaceManager
  const marketplaceManager = await new ethers.ContractFactory(
    MarketplaceManager.abi,
    MarketplaceManager.bytecode,
    deployer
  ).deploy();
  await marketplaceManager.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  const marketplaceManagerProxy = await new ethers.ContractFactory(
    TransparentUpgradeableProxy.abi,
    TransparentUpgradeableProxy.bytecode,
    deployer
  ).deploy(
    await marketplaceManager.getAddress(),
    deployer.address,
    marketplaceManager.interface.encodeFunctionData("initialize")
  );
  await marketplaceManagerProxy.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  console.log(
    "Marketplace Manager Proxy ->",
    await marketplaceManagerProxy.getAddress()
  );

  const identityRegistryStorageProxy = await new ethers.ContractFactory(
    TRex.contracts.IdentityRegistryStorageProxy.abi,
    TRex.contracts.IdentityRegistryStorageProxy.bytecode,
    deployer
  ).deploy(await trexImplementationAuthority.getAddress());
  await identityRegistryStorageProxy.deploymentTransaction().wait(process.env.CONFIRMATIONS);

  console.log("Identity Registry Storage Proxy ->", await identityRegistryStorageProxy.getAddress());

  const irStorage = await ethers.getContractAt(
    TRex.contracts.IdentityRegistryStorage.abi,
    await identityRegistryStorageProxy.getAddress()
  );
  const txAddAgent = await irStorage.connect(deployer).addAgent(appAdmin);
  await txAddAgent.wait(process.env.CONFIRMATIONS);

  const transferOwnershipIRS = await irStorage.connect(deployer).transferOwnership(await trexFactory.getAddress());
  await transferOwnershipIRS.wait(process.env.CONFIRMATIONS);

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
    marketplaceManager: await marketplaceManagerProxy.getAddress(),
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
