const express = require('express');
const path = require('path');
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
const STATE_PENDING = 'PENDING';
const STATE_SUCCESS = 'SUCCESS';
let presaleData = {
    totalRaised: 5,
    target: TARGET_USD,
    buyerCount: 0,
    claimOpen: false,
    state: STATE_PENDING,
    buyers: new Set(),
    transactions: []
};

/** Appelée à chaque nouvelle transaction (après mise à jour du total). Passe l'état à SUCCESS et débloque le Claim dès que le compteur atteint 100 000 $. */
function checkGoalReached() {
    const reached = presaleData.totalRaised >= presaleData.target;
    presaleData.claimOpen = reached;
    presaleData.state = reached ? STATE_SUCCESS : STATE_PENDING;
    return presaleData.state;
}

// --- 2. ROUTE POUR LA BARRE DE PROGRESSION (site + contrat) ---
app.get('/api/presale-status', (req, res) => {
    checkGoalReached();
    res.json({
        totalRaised: presaleData.totalRaised,
        target: presaleData.target,
        claimOpen: presaleData.claimOpen,
        state: presaleData.state || STATE_PENDING,
        buyerCount: presaleData.buyers.size
    });
});

// --- 2b. ROUTE POUR METTRE À JOUR LE TOTAL RÉCOLTÉ APRÈS UN ACHAT : checkGoalReached à chaque nouvelle transaction ---
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
        presaleData.transactions.unshift({
            amount: addAmount,
            address: address || null,
            timestamp: new Date().toISOString()
        });
        const state = checkGoalReached();
        res.json({
            success: true,
            totalRaised: presaleData.totalRaised,
            claimOpen: presaleData.claimOpen,
            state,
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
    checkGoalReached();
    res.json({
        totalRaised: presaleData.totalRaised,
        target: presaleData.target,
        buyerCount: presaleData.buyers.size,
        claimOpen: presaleData.claimOpen,
        state: presaleData.state,
        percent: Math.min(100, (presaleData.totalRaised / presaleData.target) * 100)
    });
});

// --- 2d. API ADMIN : liste des transactions ---
app.get('/api/admin/transactions', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) || req.query.key || req.query.token;
    if (token !== ADMIN_SECRET) {
        return res.status(401).json({ error: 'Non autorisé' });
    }
    res.json({ transactions: presaleData.transactions });
});

// --- 2e. PAGE ADMIN à l'URL /arcana-admin ---
app.get('/arcana-admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
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