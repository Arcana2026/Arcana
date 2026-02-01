const express = require('express');
const ethers = require('ethers');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Configuration CORS pour autoriser ton site GitHub
app.use(cors({
    origin: '*' 
}));
app.use(express.json());

// --- 1. DONNÉES DE LA PRÉVENTE ---
let presaleData = {
    totalRaised: 5,
    target: 250
};

// --- 2. ROUTE POUR LA BARRE DE PROGRESSION ---
// Cette route permet à ton site d'afficher les 5$
app.get('/api/presale-status', (req, res) => {
    res.json(presaleData);
});

// --- 3. CONFIGURATION BLOCKCHAIN (RETRAITS) ---
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
const provider = new ethers.providers.JsonRpcProvider("https://polygon-rpc.com");

const wallet = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;

// --- 4. ROUTE POUR LA SIGNATURE DE RETRAIT ---
app.post('/api/sign-withdrawal', async (req, res) => {
    try {
        const { address, amount } = req.body;
        
        if (!address || !amount || !wallet) {
            return res.status(400).json({ success: false, error: "Serveur non configuré ou données manquantes" });
        }

        const nonce = Date.now();
        const messageHash = ethers.utils.solidityKeccak256(
            ["address", "uint256", "uint256"],
            [address, ethers.utils.parseUnits(amount.toString(), 18), nonce]
        );
        
        const signature = await wallet.signMessage(ethers.utils.arrayify(messageHash));

        res.json({
            success: true,
            amount: amount,
            nonce: nonce,
            signature: signature
        });
    } catch (error) {
        console.error("Erreur signature:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- 5. DÉMARRAGE DU SERVEUR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=== SERVEUR ARCANA PRÊT SUR LE PORT ${PORT} ===`);
});