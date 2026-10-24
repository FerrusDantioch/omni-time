# Omni-Time

Chronomètre, minuteur et séances d'intervalles programmables pour le sport :
la boxe et la musculation d'abord, et tous les autres sports. Application web
installable (PWA) de l'Omni-système, qui fonctionne **hors ligne**, **sans
compte** et **sans traceur**. Toutes les données restent sur le téléphone.

**Ouvrir l'application :** https://ferrusdantioch.github.io/omni-time/

---

## Ce que fait l'application

- **Accueil** : la liste des séances enregistrées, et l'accès au chronomètre
  et au minuteur.
- **Chronomètre** : démarrer, pause, tours (temps intermédiaires), remise à
  zéro.
- **Minuteur** : un compte à rebours réglable, avec des durées toutes prêtes
  (30 s à 10 min).
- **Séances** : échauffement, nombre de rounds, durée de travail, durée de
  repos, repos final, et un nom. Créer, modifier, dupliquer, supprimer.
- **Modèles prêts à l'emploi**, modifiables : Boxe (12 rounds de 3 min,
  1 min de repos), Tabata (8 × 20 s / 10 s), Musculation (4 séries de 45 s,
  90 s de repos).
- **Séance en cours** : très gros chiffres lisibles de loin, phase affichée
  (Échauffement / Travail / Repos), round en cours (par exemple 3 / 12),
  pause / reprise / arrêt, et passage direct à la phase suivante.
- **Bips** uniquement (aucune voix) : bip court sur les 3 dernières
  secondes, bip long à chaque changement de phase. Volume réglable, son
  coupable.
- **Vibrations** aux changements de phase (à activer dans les Réglages).
- **Écran maintenu allumé** pendant une séance, et pendant que le
  chronomètre ou le minuteur tournent.
- **Trois thèmes** : Omni-système (par défaut), Sombre, Clair. Le choix est
  mémorisé.

## Les fichiers

Tous les fichiers sont à la racine du dépôt (pas de sous-dossier), pour
pouvoir les envoyer depuis un téléphone.

| Fichier | Rôle |
|---|---|
| `index.html` | Les écrans et **tous les textes affichés** |
| `styles.css` | Couleurs des trois thèmes (tout en haut), tailles, mise en page |
| `app.js` | Le chef d'orchestre : navigation, réglages, horloge commune, numéro de version |
| `outils.js` | Petits outils : mise en forme des durées, boutons « deux appuis », réglages de durée |
| `stockage.js` | Ce qui est enregistré dans le téléphone, réglages par défaut, modèles |
| `sons.js` | Les bips (fabriqués par le navigateur) et les vibrations |
| `ecran.js` | Garder l'écran allumé |
| `intervalles.js` | Le calcul d'une séance (suite des phases) |
| `chrono.js` | Le chronomètre |
| `minuteur.js` | Le minuteur |
| `seances.js` | La liste des séances et l'écran de création / modification |
| `lecteur.js` | L'écran de la séance en cours |
| `sw.js` | Le mode hors ligne (numéro de version du cache tout en haut) |
| `manifest.json` | Nom, couleurs et icônes de l'application installée |
| `icon-192.png` `icon-512.png` `maskable-512.png` | Les icônes |
| `oxanium.woff2` `literata.woff2` `jetbrains-mono.woff2` | Les polices du thème Omni-système |
| `LICENSE` | La licence du code |
| `POLICES-OFL.txt` | La licence des polices |
| `GUIDE-GITHUB.md` | Publier et modifier l'application depuis un téléphone |

Tout le code est commenté en français.

## Comment le temps reste juste

Le temps n'est jamais « compté » seconde par seconde. L'application note
l'heure réelle du départ, et calcule à chaque instant le temps écoulé depuis.
Verrouiller le téléphone, changer d'application ou un téléphone qui ralentit
ne peuvent donc pas fausser le temps : l'affichage se remet à l'heure dès
qu'on revient.

Les bips sont confiés à l'avance à l'horloge du son du téléphone, précise au
millième de seconde : ils sonnent à l'heure même si l'application est
ralentie au même moment.

## Limites connues

- Une application web ne peut pas sonner quand le téléphone est verrouillé :
  si vous verrouillez l'écran pendant une séance, les bips peuvent s'arrêter
  (le temps, lui, reste juste). C'est pour cela que l'écran reste allumé
  pendant une séance.
- Après la réouverture de l'application en pleine séance, il faut toucher
  l'écran une fois pour réactiver les bips (règle des navigateurs). Un
  message le rappelle.
- Vider le cache ou les données du site dans Chrome efface les séances
  enregistrées.

## Donner votre avis

Une idée, une gêne, quelque chose qui manque ? Écrivez à
**omni-systeme.choking513@passmail.net** (aussi dans À propos, bouton
« Envoyer un retour par e-mail »).

## Conception

Omni-Time a été développée par **Ferrus Dantioch**, avec l'aide de
**Claude**, l'intelligence artificielle d'Anthropic : Ferrus Dantioch,
créateur de l'Omni-système, en a imaginé l'idée, les fonctions et
l'apparence ; Claude en a écrit le code. (C'est aussi indiqué dans la page
« À propos » de l'application.)

Pour découvrir l'Omni-système : **le portfolio**,
https://ferrusdantioch.github.io/omni-systeme/ (lien aussi dans « À propos »).

## Licence

Distribué sous licence **[Creative Commons BY-NC-ND 4.0](LICENSE)**
(Attribution - Utilisation non commerciale - Pas d'Œuvre dérivée), avec le
texte officiel en anglais et sa traduction française officielle.

Vous pouvez utiliser ce logiciel et en partager des copies identiques,
gratuitement, à condition de citer l'auteur (Ferrus Dantioch) et d'indiquer la
licence. Il est interdit de le vendre ou d'en tirer un profit commercial, et
de diffuser une version modifiée. Le logiciel est fourni « en l'état », sans
aucune garantie.

Les polices (`oxanium.woff2`, `literata.woff2`, `jetbrains-mono.woff2`)
gardent leur propre licence : SIL Open Font License 1.1, texte complet dans
`POLICES-OFL.txt`.

© 2026 Ferrus Dantioch

---
*Réalisé par Ferrus Dantioch*
