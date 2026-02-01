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

// --- AJOUT : DONNÉES DE LA PRÉVENTE ---
// C'est ici que tu peux changer les chiffres (5 et 250)
let presaleData = {
    totalRaised: 5,
    target: 250
};

// --- AJOUT : ROUTE POUR LA BARRE DE PROGRESSION ---
app.get('/api/presale-status', (req, res) => {
    res.json(presaleData);
});

// CONFIGURATION SÉCURISÉE
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
const provider = new ethers.providers.JsonRpcProvider("https://polygon-rpc.com");

if (!PRIVATE_KEY) {
    console.error("ERREUR: La PRIVATE_KEY est manquante dans les variables d'environnement !");
}

const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=== SERVEUR ARCANA OPÉRATIONNEL ===`);
    console.log(`En écoute sur le port ${PORT}`);
});