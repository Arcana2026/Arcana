const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- DONNÉES DE LA PRÉVENTE ---
// Ces chiffres sont stockés en mémoire. Si le serveur redémarre, ils reviennent à ces valeurs.
let totalRaised = 6450; 
const TARGET_GOAL = 50000;

// --- ROUTES POUR LES JEUX / RETRAITS (Ton ancien code) ---

app.get('/api/sign-withdrawal', (req, res) => {
    // On garde la structure pour que ton bouton de retrait ne casse pas
    res.json({ success: true, message: "Signature effectuée", amount: 10000 });
});

// --- NOUVELLES ROUTES POUR LA PRÉVENTE ---

// 1. Récupérer la progression pour la barre de ton site
app.get('/api/presale-status', (req, res) => {
    const percentage = (totalRaised / TARGET_GOAL) * 100;
    res.json({
        raised: totalRaised,
        target: TARGET_GOAL,
        percentage: percentage.toFixed(2)
    });
});

// 2. Mettre à jour le montant (Pour toi uniquement)
// Tu peux tester cette route avec un outil comme Postman ou simplement la garder pour plus tard
app.post('/api/update-raised', (req, res) => {
    const { amountToAdd, secret } = req.body;
    if (secret === "arcana2026") { // Ton mot de passe temporaire
        totalRaised += parseFloat(amountToAdd);
        res.json({ success: true, newTotal: totalRaised });
    } else {
        res.status(403).json({ error: "Non autorisé" });
    }
});

// --- DÉMARRAGE DU SERVEUR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur ARCANA opérationnel sur le port ${PORT}`);
});