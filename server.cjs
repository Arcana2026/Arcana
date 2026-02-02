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

// --- 1. DONNÉES DE LA PRÉVENTE (sync avec objectif 100 000 $) ---
const TARGET_USD = 100000;
let presaleData = {
    totalRaised: 5,
    target: TARGET_USD,
    buyerCount: 0,
    claimOpen: false,
    buyers: new Set()
};

function updateClaimStatus() {
    presaleData.claimOpen = presaleData.totalRaised >= presaleData.target;
}

// --- 2. ROUTE POUR LA BARRE DE PROGRESSION (site + contrat) ---
app.get('/api/presale-status', (req, res) => {
    updateClaimStatus();
    res.json({
        totalRaised: presaleData.totalRaised,
        target: presaleData.target,
        claimOpen: presaleData.claimOpen,
        buyerCount: presaleData.buyers.size
    });
});

// --- 2b. ROUTE POUR METTRE À JOUR LE TOTAL RÉCOLTÉ APRÈS UN ACHAT (envoie l'adresse pour compter les acheteurs) ---
app.post('/api/presale-update', (req, res) => {
    try {
        const { amount, address } = req.body;
        const addAmount = parseFloat(amount);
        if (isNaN(addAmount) || addAmount <= 0) {
            return res.status(400).json({ success: false, error: "Montant invalide" });
        }
        presaleData.totalRaised += addAmount;
        if (address && typeof address === 'string' && ethers.utils.isAddress(address)) {
            presaleData.buyers.add(address.toLowerCase());
        }
        updateClaimStatus();
        res.json({
            success: true,
            totalRaised: presaleData.totalRaised,
            claimOpen: presaleData.claimOpen,
            buyerCount: presaleData.buyers.size
        });
    } catch (error) {
        console.error("Erreur mise à jour presale:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- 2c. API ADMIN : tableau de bord (nombre d'acheteurs en temps réel) ---
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.ARCANA_ADMIN_SECRET || 'arcana-admin-secret';
app.get('/api/admin/stats', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) || req.query.key || req.query.token;
    if (token !== ADMIN_SECRET) {
        return res.status(401).json({ error: 'Non autorisé' });
    }
    updateClaimStatus();
    res.json({
        totalRaised: presaleData.totalRaised,
        target: presaleData.target,
        buyerCount: presaleData.buyers.size,
        claimOpen: presaleData.claimOpen,
        percent: Math.min(100, (presaleData.totalRaised / presaleData.target) * 100)
    });
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