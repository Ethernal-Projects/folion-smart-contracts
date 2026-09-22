import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

async function main() {
  const filePath = path.resolve(__dirname, '../addresses-folion.json');
  const addresses = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  await verify([
    {
      address: addresses.countryPermitModule
    },
    {
      address: addresses.countryRestrictModule
    },
    {
      address: addresses.globalLockInTransferModule
    },
    {
      address: addresses.lockInTransferModule
    },
        {
      address: addresses.maxBalanceModule
    },
    {
      address: addresses.maxTotalSupplyModule
    },
    {
      address: addresses.minInvestmentModule
    },
    {
      address: addresses.transferPermitModule
    },    
  ]);
}

//@ts-ignore
async function verify(proxiesToVerify) {
  for (const proxy of proxiesToVerify) {
    console.log(`\n🔄 Verifying proxy at ${proxy.address}...`);

    const params = new URLSearchParams();
    params.append("module", "contract");
    params.append("action", "verifyproxycontract");
    params.append("address", proxy.address);

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
