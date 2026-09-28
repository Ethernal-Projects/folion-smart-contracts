import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

async function main() {
  const filePath = path.resolve(__dirname, '../addresses-folion.json');
  const addresses = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  await verify([
    {
      name: "contracts/Identity.sol:Identity",
      artifactPath: "./verification/onchain-id/Identity.json",
      address: addresses.identityImplementation
    },
    {
      name: "contracts/proxy/ImplementationAuthority.sol:ImplementationAuthority",
      artifactPath: "./verification/onchain-id/ImplementationAuthority.json",
      address: addresses.identityImplementationAuthority
    },
    {
      name: "contracts/factory/IdFactory.sol:IdFactory",
      artifactPath: "./verification/onchain-id/IdFactory.json",
      address: addresses.idFactory
    },
    {
      name: "contracts/gateway/Gateway.sol:Gateway",
      artifactPath: "./verification/onchain-id/Gateway.json",
      address: addresses.gateway
    },
    {
      name: "contracts/registry/implementation/TrustedIssuersRegistry.sol: TrustedIssuersRegistry",
      artifactPath: "./verification/t-rex/TrustedIssuersRegistry.json",
      address: addresses.trustedIssuersRegistryImplementation
    },
    {
      name: "contracts/registry/implementation/IdentityRegistryStorage.sol: IdentityRegistryStorage",
      artifactPath: "./verification/t-rex/IdentityRegistryStorage.json",
      address: addresses.identityRegistryStorageImplementation
    },
    {
      name: "contracts/registry/implementation/IdentityRegistry.sol: IdentityRegistry",
      artifactPath: "./verification/t-rex/IdentityRegistry.json",
      address: addresses.identityRegistryImplementation
    },
    {
      name: "contracts/registry/implementation/ClaimTopicsRegistry.sol: ClaimTopicsRegistry",
      artifactPath: "./verification/t-rex/ClaimTopicsRegistry.json",
      address: addresses.claimTopicsRegistryImplementation
    },
    {
      name: "contracts/modular/compliance/ModularCompliance.sol: ModularCompliance",
      artifactPath: "./verification/t-rex/ModularCompliance.json",
      address: addresses.modularComplianceImplementation
    },
    {
      name: "contracts/proxy/authority/TREXImplementationAuthority.sol:TREXImplementationAuthority",
      artifactPath: "./verification/t-rex/TREXImplementationAuthority.json",
      address: addresses.trexImplementationAuthority
    },
    {
      name: "contracts/factory/TREXFactory.sol:TREXFactory",
      artifactPath: "./verification/t-rex/TREXFactory.json",
      address: addresses.trexFactory
    },
    {
      name: "contracts/factory/TREXGateway.sol:TREXGateway",
      artifactPath: "./verification/t-rex/TREXGateway.json",
      address: addresses.trexGateway
    },
    {
      name: "contracts/token/ERC3643Token.sol: ERC3643Token",
      artifactPath: "./verification/folion/ERC3643Token.json",
      address: addresses.tokenImplementation
    },
    {
      name: "contracts/compliance/CountryPermitModule.sol: CountryPermitModule",
      artifactPath: "./verification/folion/CountryPermitModule.json",
      address: addresses.countryPermitModuleImplementation
    },
    {
      name: "contracts/compliance/CountryRestrictModule.sol: CountryRestrictModule",
      artifactPath: "./verification/folion/CountryRestrictModule.json",
      address: addresses.countryRestrictModuleImplementation
    },
    {
      name: "contracts/compliance/GlobalLockInTransferModule.sol: GlobalLockInTransferModule",
      artifactPath: "./verification/folion/GlobalLockInTransferModule.json",
      address: addresses.globalLockInTransferModuleImplementation
    },
    {
      name: "contracts/compliance/LockInTransferModule.sol: LockInTransferModule",
      artifactPath: "./verification/folion/LockInTransferModule.json",
      address: addresses.lockInTransferModuleImplementation
    },
    {
      name: "contracts/compliance/MaxBalanceModule.sol: MaxBalanceModule",
      artifactPath: "./verification/folion/MaxBalanceModule.json",
      address: addresses.maxBalanceModuleImplementation
    },
    {
      name: "contracts/compliance/MaxTotalSupplyModule.sol: MaxTotalSupplyModule",
      artifactPath: "./verification/folion/MaxTotalSupplyModule.json",
      address: addresses.maxTotalSupplyModuleImplementation
    },
    {
      name: "contracts/compliance/MinInvestmentModule.sol: MinInvestmentModule",
      artifactPath: "./verification/folion/MinInvestmentModule.json",
      address: addresses.minInvestmentModuleImplementation
    },
    {
      name: "contracts/compliance/TransferPermitModule.sol: TransferPermitModule",
      artifactPath: "./verification/folion/TransferPermitModule.json",
      address: addresses.transferPermitModuleImplementation
    },
    {
      name: "contracts/compliance/modular/modules/ModuleProxy.sol: ModuleProxy",
      artifactPath: "./verification/t-rex/ModuleProxy.json",
      address: addresses.countryPermitModule
    },
    {
      name: "contracts/compliance/modular/modules/ModuleProxy.sol: ModuleProxy",
      artifactPath: "./verification/t-rex/ModuleProxy.json",
      address: addresses.countryRestrictModule
    },
    {
      name: "contracts/compliance/modular/modules/ModuleProxy.sol: ModuleProxy",
      artifactPath: "./verification/t-rex/ModuleProxy.json",
      address: addresses.globalLockInTransferModule
    },
    {
      name: "contracts/compliance/modular/modules/ModuleProxy.sol: ModuleProxy",
      artifactPath: "./verification/t-rex/ModuleProxy.json",
      address: addresses.lockInTransferModule
    },
    {
      name: "contracts/compliance/modular/modules/ModuleProxy.sol: ModuleProxy",
      artifactPath: "./verification/t-rex/ModuleProxy.json",
      address: addresses.maxBalanceModule
    },
    {
      name: "contracts/compliance/modular/modules/ModuleProxy.sol: ModuleProxy",
      artifactPath: "./verification/t-rex/ModuleProxy.json",
      address: addresses.maxTotalSupplyModule
    },
    {
      name: "contracts/compliance/modular/modules/ModuleProxy.sol: ModuleProxy",
      artifactPath: "./verification/t-rex/ModuleProxy.json",
      address: addresses.minInvestmentModule
    },
    {
      name: "contracts/compliance/modular/modules/ModuleProxy.sol: ModuleProxy",
      artifactPath: "./verification/t-rex/ModuleProxy.json",
      address: addresses.transferPermitModule
    },
    {
      name: "contracts/proxy/IdentityRegistryStorageProxy.sol:IdentityRegistryStorageProxy",
      artifactPath: "./verification/t-rex/IdentityRegistryStorageProxy.json",
      address: addresses.identityRegistryStorage
    }
  ]);
}

//@ts-ignore
async function verify(contractsToVerify) {
  const COMPILER_VERSION = "v0.8.17+commit.8df45f5f"; // Must match exactly
  for (const contract of contractsToVerify) {
    console.log(`\n🔄 Verifying ${contract.name} at ${contract.address}...`);

    const artifact = fs.readFileSync(path.resolve(contract.artifactPath), "utf8");

    const params = new URLSearchParams();
    params.append("module", "contract");
    params.append("action", "verifysourcecode");
    params.append("contractaddress", contract.address);
    params.append("contractname", contract.name);
    params.append("compilerversion", COMPILER_VERSION);
    params.append("codeformat", "solidity-standard-json-input");
    params.append("sourceCode", artifact);
    params.append("licenseType", "5"); // Alternatively use "gnu_gpl_v3"
    if (contract.arguments !== undefined) params.append("constructorArguments", contract.arguments);

    try {
      const response = await axios.post(process.env.BLOCKSCOUT_API_URL!, params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      console.log(`✅ Result: ${response.data.message || response.data.result}`);
    } catch (error: any) {
      console.error(`❌ Failed:`, error.message);
    }
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
