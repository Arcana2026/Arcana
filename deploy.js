import hre from "hardhat";

async function main() {
  // L'adresse de ton jeton Arcana (1 milliard) trouvée sur Polygon
  const arcanaTokenAddress = "0x5b16E755bFF0F20E822761320851D203ddDf6d56"; 

  // Ton adresse de portefeuille Account 2 (le signataire)
  const signerAddress = "0x1990fd46a1ad0344751be45d6779b8c1f827076d"; 

  console.log("------------------------------------------");
  console.log("Début du déploiement du coffre-fort Arcana...");
  console.log("Jeton associé :", arcanaTokenAddress);
  console.log("Signataire autorisé :", signerAddress);
  console.log("------------------------------------------");

  // On récupère le contrat ArcanaVault.sol
  const Vault = await hre.ethers.getContractFactory("ArcanaVault");
  
  // On déploie avec les deux adresses nécessaires
  const vault = await Vault.deploy(arcanaTokenAddress, signerAddress);

  // Attente que la transaction soit validée sur Polygon (Ethers v6)
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();

  console.log("SUCCÈS !");
  console.log("ArcanaVault est déployé à l'adresse :", vaultAddress);
  console.log("------------------------------------------");
  console.log("Gardez bien cette adresse pour votre site web.");
}

main().catch((error) => {
  console.error("Erreur lors du déploiement :", error);
  process.exitCode = 1;
});

