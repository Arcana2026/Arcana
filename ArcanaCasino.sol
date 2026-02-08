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
    address public lpAddress; // Adresse pour l'injection de liquidité
    address public vaultAddress; // Réserve du casino

    uint256 public houseEdge = 10; // 10% vont au LP

    constructor(address _token, address _lp, address _vault) {
        arcanaToken = IERC20(_token);
        owner = msg.sender;
        lpAddress = _lp;
        vaultAddress = _vault;
    }

    // Fonction pour jouer aux Slots
    function playSlots(uint256 betAmount, uint256 multiplier) external {
        require(arcanaToken.balanceOf(msg.sender) >= betAmount, "Solde insuffisant");
        
        // 1. On encaisse la mise
        arcanaToken.transferFrom(msg.sender, address(this), betAmount);

        if (multiplier > 0) {
            // GAGNÉ : On paye le joueur depuis le contrat
            uint256 winAmount = betAmount * multiplier;
            arcanaToken.transfer(msg.sender, winAmount);
        } else {
            // PERDU : Répartition 10% LP / 90% Vault
            uint256 toLP = (betAmount * houseEdge) / 100;
            uint256 toVault = betAmount - toLP;
            
            arcanaToken.transfer(lpAddress, toLP);
            arcanaToken.transfer(vaultAddress, toVault);
        }
    }
}