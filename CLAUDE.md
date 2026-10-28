# Omni-Time — notes pour Claude

PWA de chronomètre, minuteur et séances d'intervalles pour le sport (boxe et
musculation d'abord), en **HTML/CSS/JS pur, sans dépendance ni compilation**.
Application de l'Omni-système, sœur de Refuge, Cap et L'Atelier. L'auteur
est novice en programmation : garder les commentaires en français simple,
sans jargon, et lui répondre en français.

Écrans : Accueil (séances + tuiles Chronomètre / Minuteur), Chronomètre,
Minuteur, Création / modification d'une séance, Séance en cours, Réglages,
À propos.

## ⚠️ Contraintes à préserver

- **Le vrai nom de l'auteur n'apparaît nulle part** (ni dans le code, ni dans
  l'application, ni dans la documentation). Seul le pseudonyme **Ferrus
  Dantioch** est utilisé.
- **Licence : Creative Commons BY-NC-ND 4.0**, la même que L'Atelier.
  `LICENSE` est une copie exacte de celui de L'Atelier (première ligne :
  `© 2026 Ferrus Dantioch`, puis textes officiels anglais et français). Chaque fichier de code (HTML, CSS,
  JS) commence par la même mention de trois lignes ; `manifest.json` n'en a
  pas (le format JSON n'accepte pas les commentaires). Tout nouveau fichier
  de code reçoit la même mention. La page À propos résume la licence.
- **Thème Omni-système : valeurs du portfolio, à l'identique** (celles de
  `css/theme.css` de L'Atelier). Ne pas « améliorer » ces couleurs. Les
  thèmes Sombre et Clair reprennent la gamme Bleu-gris de Cap ; en Clair, les
  couleurs de phases ont été foncées pour dépasser 5:1 de contraste.
  Aucun blanc pur ni noir pur.
- **Sons : des bips uniquement, jamais de voix.** Bip court à 3, 2 et 1 s de
  la fin d'une phase, bip long à chaque changement de phase. Fabriqués par
  Web Audio (aucun fichier audio). Volume plafonné (intensité 0,8 au
  maximum), 50 % par défaut. Vibrations éteintes par défaut.
- **Bips programmés à l'avance** (`sons.js`) : chaque bip a une clé unique
  (`S<course>-p<index>…` pour une séance, `M<course>-…` pour le minuteur) et
  est confié à l'horloge audio jusqu'à 2 s avant son heure. Pause, « Passer »
  et arrêt appellent `Sons.annuler()` / `Sons.oublier()`. Ne pas revenir à un
  bip déclenché « quand on s'aperçoit que l'heure est passée ».
- **Le temps vient toujours de l'heure réelle** (`Date.now()`) : cumul +
  heure du dernier départ, ou heure d'arrivée pour le minuteur. Jamais de
  compteur qui descend à chaque tick. `performance.now()` est évité exprès :
  sur Android, il peut s'arrêter pendant que le téléphone dort.
- **Son et vibration seulement après un appui** (règle des navigateurs) :
  `Sons.deverrouiller()` est appelé par Démarrer et par tout appui.
- **Actions qui font perdre quelque chose = deux appuis** (`armerBouton()`) :
  supprimer une séance, arrêter une séance ou le minuteur, remettre le
  chronomètre à zéro, « Terminer la séance » via « Passer ». Jamais de
  `confirm()` natif.
- **Tutoiement** dans l'application (comme Refuge et Cap) ; vouvoiement dans
  le README et le guide (comme les autres dépôts).
- **Zones tactiles larges** (56 px au minimum, 84 px pour les boutons
  principaux), `prefers-reduced-motion` pleinement respecté, transitions
  lentes (400 ms), aucun clignotement.
- **Aucun compte, aucun appel réseau, aucun traceur.** Tout est en
  `localStorage`.
- **Nouvelle version : jamais de changement par surprise.** Elle attend un
  appui sur « Mettre à jour » (`#bandeau-mise-a-jour`, accueil seulement,
  avec « Plus tard » ; objet `MiseAJour` d'`app.js`), caché pendant une
  séance ou un minuteur qui tourne (la page rechargée ne pourrait plus
  biper avant un appui). Pas de `self.skipWaiting()` dans l'installation
  de `sw.js` (seulement au message `{ type: 'activer' }`), et le `fetch`
  ne remplace jamais en arrière-plan un fichier rangé dans le cache.

## Même adresse de site que les autres applications

Refuge, Cap, L'Atelier et Omni-Time sont tous servis depuis
`ferrusdantioch.github.io` : ils partagent le **même `localStorage`** et le
**même espace de caches**.
- Toutes les clés commencent par `omnitime_` (voir `CLES` dans
  `stockage.js`).
- `sw.js` ne supprime que les caches qui commencent par `omni-time-`.
- `sw.js` vérifie à chaque ouverture que son cache est complet et le
  remplit à nouveau sinon : les versions actuelles de Refuge et Cap effacent
  tous les caches qui ne sont pas les leurs quand elles se mettent à jour.

## Données (localStorage)

- `omnitime_reglages` : `{ theme, bips, volume, vibrations }`.
- `omnitime_seances` : `[{ id, nom, echauffement, rounds, travail, repos,
  reposFinal }]` (durées en secondes).
- `omnitime_initialise` : vrai après le premier lancement (les trois modèles
  ne sont ajoutés qu'une fois).
- `omnitime_seance_en_cours`, `omnitime_chrono`, `omnitime_minuteur` : ce qui
  tourne, pour reprendre au bon endroit après une fermeture.
- ⚠️ `nettoyerReglages()` et `nettoyerSeance()` ne gardent **que** les champs
  qu'elles connaissent : tout nouveau champ doit y être ajouté.

## ⚠️ Avant de pousser : incrémenter la version du service worker

Après toute modification d'un fichier mis en cache (tout sauf README,
GUIDE-GITHUB.md, CLAUDE.md, LICENSE, POLICES-OFL.txt), incrémenter la
constante en haut de `sw.js`, en partant du numéro qui y figure :

```js
const CACHE = 'omni-time-vN';   // → 'omni-time-vN+1'
```

et `VERSION` en haut d'`app.js` (numéro affiché dans À propos). En cas
d'ajout de fichier, l'inscrire aussi dans la liste `FICHIERS` de `sw.js`.
Garder tous les fichiers **à la racine** : l'envoi depuis un téléphone ne
sait pas créer de dossier.

## Tester en local

Un service worker ne fonctionne que sur `https://` ou `http://localhost`,
jamais en `file://`. Servir le dossier parent pour reproduire l'adresse de
GitHub Pages (`/omni-time/`), par exemple `python3 -m http.server` depuis le
dossier qui contient `omni-time`, puis ouvrir
`http://localhost:8000/omni-time/`.

Déploiement : GitHub Pages, branche `main`, racine →
https://ferrusdantioch.github.io/omni-time/
