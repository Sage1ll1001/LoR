const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const LetterOfRecommendation = await hre.ethers.getContractFactory("LetterOfRecommendation");
  const contract = await LetterOfRecommendation.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("LetterOfRecommendation deployed to:", address);

  // Path to save deployment details for the frontend
  const frontendDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  const contractArtifact = hre.artifacts.readArtifactSync("LetterOfRecommendation");
  
  const contractInfo = {
    address: address,
    abi: contractArtifact.abi
  };

  fs.writeFileSync(
    path.join(frontendDir, "LetterOfRecommendation.json"),
    JSON.stringify(contractInfo, null, 2)
  );

  console.log("Saved contract details to frontend/src/contracts/LetterOfRecommendation.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
