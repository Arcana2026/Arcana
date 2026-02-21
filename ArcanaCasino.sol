// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ArcanaCasino {
    IERC20 public arcanaToken;
    address public owner;
    address public lpAddress; 
    address public vaultAddress; 

    uint256 public houseEdge = 10; // 10% au LP

    event GameResult(address player, uint256 betAmount, uint256 winAmount, bool won);

    modifier onlyOwner() {
        require(msg.sender == owner, "Pas l'owner");
        _;
    }

    constructor(address _token, address _lp, address _vault) {
        arcanaToken = IERC20(_token);
        owner = msg.sender;
        lpAddress = _lp;
        vaultAddress = _vault;
    }

    function playSlots(uint256 betAmount) external {
        require(betAmount > 0, "Mise invalide");
        require(arcanaToken.balanceOf(msg.sender) >= betAmount, "Solde insuffisant");
        
        // 1. On encaisse la mise (L'utilisateur doit avoir fait 'Approve' avant)
        arcanaToken.transferFrom(msg.sender, address(this), betAmount);

        // 2. Génération d'un nombre "pseudo-aléatoire" (0 à 99)
        // Note: Pour un gros casino, on utiliserait Chainlink VRF
        uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao))) % 100;

        uint256 winAmount = 0;
        bool won = false;

        // 3. Logique de gain (Exemple : 5% de chance de faire x10)
        if (random < 5) { 
            winAmount = betAmount * 10;
            won = true;
        } 
        // 15% de chance de faire x2
        else if (random < 20) {
            winAmount = betAmount * 2;
            won = true;
        }

        if (won) {
            require(arcanaToken.balanceOf(address(this)) >= winAmount, "Reserve Casino insuffisante");
            arcanaToken.transfer(msg.sender, winAmount);
        } else {
            // PERDU : Répartition 10% LP / 90% Vault
            uint256 toLP = (betAmount * houseEdge) / 100;
            uint256 toVault = betAmount - toLP;
            arcanaToken.transfer(lpAddress, toLP);
            arcanaToken.transfer(vaultAddress, toVault);
        }

        emit GameResult(msg.sender, betAmount, winAmount, won);
    }

    // Permet à l'owner de retirer les jetons si besoin (maintenance)
    function withdrawTokens(uint256 amount) external onlyOwner {
        arcanaToken.transfer(owner, amount);
    }
}