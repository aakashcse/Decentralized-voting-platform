import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying DecentralizedVotingPlatform to ${network.name} from ${deployer.address}`);

  const factory = await ethers.getContractFactory("DecentralizedVotingPlatform");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`DecentralizedVotingPlatform deployed at ${address}`);

  // Copy the ABI to the frontend so it always matches the deployed contract.
  const artifact = await import("../artifacts/contracts/DecentralizedVotingPlatform.sol/DecentralizedVotingPlatform.json");
  const outFile = path.join(__dirname, "..", "..", "frontend", "src", "lib", "abi", "DecentralizedVotingPlatform.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ abi: artifact.abi }, null, 2));
  console.log(`ABI written to ${outFile}`);
  console.log(`Set NEXT_PUBLIC_CONTRACT_ADDRESS=${address} in frontend/.env.local`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
