const express = require('express');
const ethers = require('ethers');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Autorise ton site GitHub à parler au serveur
app.use(cors({
    origin: '*' 
}));
app.use(express.json());

// --- CONFIGURATION SÉCURISÉE ---
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
const provider = new ethers.providers.JsonRpcProvider("https://polygon-rpc.com");

// --- CONFIGURATION PRÉVENTE (Nouveau) ---
let totalRaised = 6450; // Ce montant sera mis à jour via l'API ou ton contrat
const TARGET_GOAL = 50000;
const ADMIN_SECRET = "TON_MOT_DE_PASSE_SECRET"; // Change ceci pour sécuriser tes mises à jour manuelles

// Vérification de la clé au démarrage
if (!PRIVATE_KEY) {
    console.error("ERREUR: La PRIVATE_KEY est manquante dans les variables d'environnement !");
}

const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// --- ROUTE 1 : SIGNATURE DE RETRAIT (Tes jeux actuels) ---
app.post('/api/sign-withdrawal', async (req, res) => {
    try {
        const { address, amount } = req.body;
        
        if (!address || !amount) {
            return res.status(400).json({ success: false, error: "Données manquantes" });
        }

        const nonce = Date.now();
        
        const messageHash = ethers.utils.solidityKeccak256(
            ["address", "uint256", "uint256"],
            [address, ethers.utils.parseUnits(amount.toString(), 18), nonce]
        );
        
        const signature = await wallet.signMessage(ethers.utils.arrayify(messageHash));

        console.log(`Signature générée pour ${address} - Montant: ${amount}`);

        res.json({
            success: true,
            amount: amount,
            nonce: nonce,
            signature: signature
        });
    } catch (error) {
        console.error("Erreur serveur:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- ROUTE 2 : STATUT DE LA PRÉVENTE (Pour ta barre de progression) ---
app.get('/api/presale-status', (req, res) => {
    const percentage = (totalRaised / TARGET_GOAL) * 100;
    res.json({
        success: true,
        raised: totalRaised,
        target: TARGET_GOAL,
        percentage: percentage.toFixed(2)
    });
});

// --- ROUTE 3 : MISE À JOUR MANUELLE DU MONTANT (Pour toi uniquement) ---
app.post('/api/update-presale', (req, res) => {
    const { secret, amountToAdd } = req.body;
    
    if (secret !== ADMIN_SECRET) {
        return res.status(403).json({ success: false, error: "Accès refusé" });
    }

    totalRaised += parseFloat(amountToAdd);
    console.log(`Nouvel objectif de prévente : ${totalRaised}$`);
    
    res.json({
        success: true,
        newTotal: totalRaised
    });
});

// Port adaptatif pour Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=== SERVEUR ARCANA OPÉRATIONNEL (JEUX + PRÉVENTE) ===`);
    console.log(`En écoute sur le port ${PORT}`);
});