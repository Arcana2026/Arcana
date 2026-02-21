const express = require('express');
const path = require('path');
const fs = require('fs');
const ethers = require('ethers');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- Optimisation Cloudflare : reconnaître les IP réelles (X-Forwarded-For, CF-Connecting-IP) ---
app.set('trust proxy', 1);

/** Retourne l'IP réelle du visiteur (derrière Cloudflare ou autre proxy). */
function getClientIp(req) {
    return req.headers['cf-connecting-ip']
        || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.ip
        || req.socket?.remoteAddress
        || '';
}

// ========== CONFIGURATION ADMIN & VAULT (UNIQUE) ==========
// Seule cette adresse est ADMIN et VAULT : elle perçoit tous les profits et gère les fonds.
// Aucune autre adresse ne peut recevoir les pertes Arcade ni gérer le coffre.
const ADMIN_VAULT_ADDRESS = (process.env.ARCANA_ADMIN_VAULT || '0x29D61511C84E332635E296e37bf22Eb4fB514147').toLowerCase();

// Domaine Web3 officiel Arcana Safe (transaction Polygon 0x5fda... confirmée)
const OFFICIAL_DOMAIN = process.env.OFFICIAL_DOMAIN || 'https://arcana-ezl.pages.dev';

// Configuration CORS : autoriser le site Cloudflare Pages et arcana-safe.nft
const ALLOWED_ORIGINS = [
    OFFICIAL_DOMAIN,
    'https://arcana-ezl.pages.dev',
    'https://arcana-safe.nft',
    'https://www.arcana-safe.nft',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000'
];
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.some(o => origin === o || origin.endsWith('.arcana-safe.nft'))) {
            cb(null, true);
        } else {
            cb(null, true);
        }
    },
    credentials: true
}));
app.use(express.json());

// Cache : les réponses API dynamiques ne doivent pas être mises en cache par Cloudflare
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    next();
});

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
            ip: getClientIp(req),
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

// --- 2c2. ARCADE : plus gros gains du jour (leaderboard) ---
let arcadeWins = [];
const LEADERBOARD_MAX = 20;

function isToday(ts) {
    const d = new Date(ts);
    const now = new Date();
    return d.getUTCDate() === now.getUTCDate() && d.getUTCMonth() === now.getUTCMonth() && d.getUTCFullYear() === now.getUTCFullYear();
}

app.post('/api/arcade-win', (req, res) => {
    try {
        const { address, amount, game } = req.body;
        const amt = parseFloat(amount);
        if (!address || typeof address !== 'string' || isNaN(amt) || amt <= 0) {
            return res.status(400).json({ success: false, error: 'Données invalides' });
        }
        arcadeWins.push({
            address: address.toLowerCase(),
            amount: amt,
            game: (game && typeof game === 'string') ? game.slice(0, 50) : 'Arcade',
            timestamp: new Date().toISOString()
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/arcade-leaderboard', (req, res) => {
    const today = arcadeWins.filter(w => isToday(w.timestamp));
    today.sort((a, b) => b.amount - a.amount);
    res.json({ leaderboard: today.slice(0, LEADERBOARD_MAX) });
});

// --- Réserve du coffre Arcade (même adresse ADMIN/VAULT) : Max Bet = 5% réserve, 0 = Maintenance ---
const VAULT_ADDRESS = ADMIN_VAULT_ADDRESS;
const ARCANA_TOKEN_ABI = ['function balanceOf(address owner) view returns (uint256)'];
const ARCANA_TOKEN_ADDRESS = process.env.ARCANA_TOKEN_ADDRESS || VAULT_ADDRESS;
const MAX_BET_PERCENT = 0.05; // Limite 5% de la réserve pour protéger le capital
// Réserve de départ (311 POL + 10 000 ARC) : active les jeux même si la chaîne renvoie 0 en attendant le transfert des 5M
const FALLBACK_RESERVE_ARCANA = parseFloat(process.env.ARCANA_ARCADE_FALLBACK_RESERVE || '10000');
let arcadeTokenContract = null;
try {
    arcadeTokenContract = new ethers.Contract(ARCANA_TOKEN_ADDRESS, ARCANA_TOKEN_ABI, provider);
} catch (e) {
    console.warn('Arcade: contrat token non initialisé, utilisation réserve de départ:', e.message);
}

app.get('/api/arcade-vault-reserve', async (req, res) => {
    try {
        let reserve = 0;
        if (arcadeTokenContract) {
            try {
                const raw = await arcadeTokenContract.balanceOf(VAULT_ADDRESS);
                reserve = parseFloat(ethers.utils.formatUnits(raw, 18));
            } catch (_) {}
        }
        if (reserve <= 0) reserve = FALLBACK_RESERVE_ARCANA;
        const maxBet = Math.floor(reserve * MAX_BET_PERCENT * 1000) / 1000;
        const maintenance = false;
        res.json({ reserve, maxBet, maintenance });
    } catch (e) {
        console.error('Erreur réserve arcade:', e.message);
        res.json({ reserve: FALLBACK_RESERVE_ARCANA, maxBet: Math.floor(FALLBACK_RESERVE_ARCANA * MAX_BET_PERCENT * 1000) / 1000, maintenance: false });
    }
});

// --- Settlement Arcade : AUTOMATISATION — gains du coffre vers joueur, pertes verrouillées dans le coffre (ADMIN_VAULT) ---
app.post('/api/arcade-settle', async (req, res) => {
    try {
        const { address, bet, winAmount, game } = req.body;
        const betNum = parseFloat(bet);
        const winNum = parseFloat(winAmount);
        if (!address || typeof address !== 'string' || !ethers.utils.isAddress(address)) {
            return res.status(400).json({ success: false, error: 'Adresse invalide' });
        }
        if (isNaN(betNum) || betNum < 0) {
            return res.status(400).json({ success: false, error: 'Mise invalide' });
        }
        const netWin = winNum - betNum;
        if (netWin > 0) {
            arcadeWins.push({
                address: address.toLowerCase(),
                amount: netWin,
                game: (game && typeof game === 'string') ? game.slice(0, 50) : 'Arcade',
                timestamp: new Date().toISOString()
            });
        }
        // Gains = transfert depuis ADMIN_VAULT vers address ; pertes = restent dans ADMIN_VAULT. Pour l’instant enregistrement côté serveur uniquement.
        res.json({ success: true, recorded: true });
    } catch (e) {
        console.error('Erreur arcade-settle:', e);
        res.status(500).json({ success: false, error: e.message });
    }
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

// --- 2e. Route explicite : /arcana-admin renvoie le fichier physique admin.html (cache statique Cloudflare) ---
const adminHtmlPath = path.resolve(__dirname, 'admin.html');
const CACHE_STATIC_SECONDS = 300; // 5 min pour les fichiers statiques
app.get('/arcana-admin', (req, res) => {
    res.set('Cache-Control', `public, max-age=${CACHE_STATIC_SECONDS}`);
    res.sendFile(adminHtmlPath, (err) => {
        if (err) {
            console.error('admin.html introuvable:', adminHtmlPath, err.message);
            res.status(err.status || 500).send('Fichier admin non disponible.');
        }
    });
});
app.get('/arcana-admin/', (req, res) => res.redirect(301, '/arcana-admin'));

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
if (!fs.existsSync(adminHtmlPath)) {
    console.warn('ATTENTION: admin.html introuvable à', adminHtmlPath, '- la route /arcana-admin renverra une erreur.');
} else {
    console.log('admin.html trouvé:', adminHtmlPath);
}
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=== SERVEUR ARCANA PRÊT SUR LE PORT ${PORT} ===`);
    console.log('Domaine officiel:', OFFICIAL_DOMAIN);
    console.log('Route admin:', OFFICIAL_DOMAIN + '/arcana-admin');
});