# Omni-Time — publier et modifier depuis un téléphone

Ce guide explique comment mettre Omni-Time en ligne avec GitHub Pages, puis la
modifier **entièrement depuis un téléphone Android**, via l'interface web de
GitHub, sans ordinateur ni ligne de commande — comme pour Refuge et Cap.

## 1. Activer GitHub Pages (une seule fois)

Le dépôt `omni-time` contient déjà tous les fichiers. Il reste à demander à
GitHub de le publier :

1. Ouvrez **github.com/FerrusDantioch/omni-time** dans Chrome.
   *Si l'affichage est trop simplifié : menu ⋮ de Chrome → cochez
   « Version pour ordinateur ».*
2. Onglet **Settings** du dépôt (roue dentée).
3. Menu de gauche → **Pages**.
4. **Source** : `Deploy from a branch`.
5. **Branch** : `main`, dossier `/ (root)`. Touchez **Save**.
6. Patientez 1 à 2 minutes, puis rechargez la page : l'adresse apparaît en
   haut. Elle sera : `https://ferrusdantioch.github.io/omni-time/`

> ⚠️ GitHub Pages n'est gratuit que sur les dépôts **publics** : c'est déjà
> le cas d'`omni-time`.

## 2. Installer sur l'écran d'accueil

1. Ouvrez l'adresse dans Chrome.
2. Menu ⋮ → **Ajouter à l'écran d'accueil** → **Installer**.

L'icône apparaît sur l'écran d'accueil. L'application s'ouvre en plein écran
et fonctionne **sans connexion** après cette première visite.

> Si Chrome dit « Cette appli est déjà installée » alors qu'elle ne l'est
> pas : c'est une limite de Chrome, qui n'installe qu'une application par site
> (Refuge, Cap et Omni-Time sont tous sur `ferrusdantioch.github.io`).
> Choisissez « Créer un raccourci », ou utilisez un autre navigateur (Brave).

---

## Modifier l'application plus tard

1. Sur GitHub, ouvrez le fichier (`index.html` pour les textes, `styles.css`
   pour les couleurs, `stockage.js` pour les modèles et les réglages par
   défaut…).
2. Touchez le **crayon** ✏️ en haut à droite.
3. Modifiez, puis **Commit changes**.

**À faire à chaque modification d'un fichier de l'application** (tous sauf
`README.md`, `GUIDE-GITHUB.md`, `CLAUDE.md`, `LICENSE` et `POLICES-OFL.txt`) :
ouvrez `sw.js` et augmentez la version d'un cran, tout en haut. Partez du
numéro qui y figure :

```js
const CACHE = 'omni-time-v1';   →   const CACHE = 'omni-time-v2';
```

Sans cela, les téléphones continuent d'afficher l'ancienne version qu'ils
gardent en mémoire. Pensez aussi à changer `VERSION` en haut d'`app.js`
(c'est le numéro affiché dans « À propos »).

Comptez 1 à 2 minutes après chaque commit pour que GitHub Pages republie.

## Mettre à jour avec une nouvelle archive

1. Décompressez la nouvelle archive sur le téléphone
   (Gestionnaire de fichiers → appui long sur le zip → **Extraire**).
2. Sur le dépôt GitHub : **Add file** → **Upload files**.
3. Sélectionnez les fichiers modifiés. GitHub **remplace** les anciens
   automatiquement : il n'y a rien à supprimer. Tous les fichiers sont à la
   racine : aucun dossier à créer.
4. **Commit changes**, puis attendez 1 à 2 minutes.
5. Sur le téléphone, ouvrez l'application et **fermez-la complètement**
   (bouton carré d'Android → balayer la fenêtre), puis rouvrez-la. La
   nouvelle version s'installe au second lancement.

Vos séances et vos réglages ne sont pas touchés : ils vivent dans le
téléphone, pas dans les fichiers du dépôt.

---

## En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| Erreur 404 | Pages pas encore publié | Attendre 2 min, recharger |
| Page blanche ou sans style | Un fichier manquant | Vérifier que les 20 fichiers de l'application sont à la racine du dépôt |
| Pas de « Ajouter à l'écran d'accueil » | Adresse en `http://` | L'adresse GitHub Pages est en `https://`, vérifiez-la |
| Une modification n'apparaît pas | Cache du service worker | Augmenter `CACHE` dans `sw.js` |
| Pas de bip | Son du téléphone coupé, ou aucun appui depuis l'ouverture | Monter le volume du téléphone ; toucher l'écran une fois |
| Pas de vibration | Option éteinte | Réglages → Vibrations |
