# Déploiement IPFS / arcana-safe.nft.limo

Ce guide permet de rendre le site **Arcana Safe** accessible via **arcana-safe.nft.limo** (passerelle .nft.limo pour contourner les limitations éventuelles de Cloudflare).

## Prérequis

- Compte [Pinata](https://pinata.cloud/)
- Fichiers du site (HTML, CSS, JS, images) prêts en local

## Fichiers à pincer sur IPFS

Pincez **tous** les fichiers statiques du site sur Pinata :

- `index.html`
- `arcade.html`
- `admin.html`
- `logo.png`

Les chemins doivent rester relatifs (liens `arcade.html`, `index.html`, etc.) pour que la navigation fonctionne.

## Étapes avec Pinata

1. **Connexion** : [pinata.cloud](https://pinata.cloud/) → Upload.

2. **Upload du dossier** :
   - Soit glisser-déposer le dossier du projet (Pinata préserve la structure).
   - Soit utiliser l’API Pinata pour pincer un build (voir ci-dessous).

3. **Récupérer le CID** : Après l’upload, Pinata affiche un **CID** (ex. `QmXXXX...`). Notez-le.

4. **URL IPFS** :
   - Passerelle Pinata : `https://gateway.pinata.cloud/ipfs/<CID>/`
   - Passerelle publique : `https://ipfs.io/ipfs/<CID>/`

## Accès via arcana-safe.nft.limo

Les domaines **.nft** sont résolubles via le service **.nft.limo** (passerelle IPFS).

1. **Lier le domaine .nft à l’IPFS** (dans la config de votre domaine .nft, si votre registrar / DNS le permet) :
   - Enregistrer le **CID** actuel comme contenu du domaine (méthode dépend du fournisseur .nft).

2. **Accès direct via .limo** :
   - Une fois le site pincé : `https://<CID>.ipfs.dweb.link/` ou via Pinata.
   - Pour **arcana-safe.nft.limo** : ce sous-domaine pointe en général vers la résolution IPFS du domaine **arcana-safe.nft**. Vérifier la doc de votre fournisseur .nft pour “limo gateway”.

3. **Mise à jour** : À chaque modification du site, re-pincer les fichiers, récupérer le **nouveau CID** et mettre à jour la référence (lien ou config DNS) vers ce nouveau CID.

## API backend (arcana-safe.nft)

Les appels API (présentation, prévente, admin) restent hébergés sur **https://arcana-safe.nft**. Le front déployé en IPFS continue d’utiliser cette URL pour les requêtes (déjà configurée dans le code). Aucun changement côté API nécessaire pour le passage par .limo.

## Résumé

| Élément              | Action |
|----------------------|--------|
| Fichiers statiques   | Pincer sur Pinata (index.html, arcade.html, admin.html, logo.png) |
| CID                  | Noter le CID après upload |
| arcana-safe.nft.limo | Utiliser la config .nft / .limo de votre fournisseur pour pointer vers ce CID |
| API                  | Reste sur https://arcana-safe.nft |
