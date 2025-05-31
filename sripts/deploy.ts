const hre = require("hardhat");

async function main() {
  const Replay = await hre.ethers.getContractFactory("Replay");
  const contract = await Replay.deploy();
  await contract.waitForDeployment();
  console.log("Replay contract deployed to:", await contract.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
