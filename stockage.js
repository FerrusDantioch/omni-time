/* Omni-Time — Copyright (c) 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OMNI-TIME — stockage.js
   Tout ce qui est enregistré dans le téléphone (localStorage) :
   réglages, séances, et ce qui tourne en ce moment.
   Aucun compte, aucun serveur : rien ne quitte l'appareil.

   ⚠️ Toutes les applications de ferrusdantioch.github.io partagent le même
   localStorage. Chaque clé commence donc par « omnitime_ » pour ne jamais
   se mélanger avec celles de Refuge ou de Cap.
   ============================================================ */
'use strict';

const CLES = {
  reglages:  'omnitime_reglages',
  seances:   'omnitime_seances',
  initialise:'omnitime_initialise',        // vrai après le tout premier lancement
  lecteur:   'omnitime_seance_en_cours',   // la séance qui tourne
  chrono:    'omnitime_chrono',
  minuteur:  'omnitime_minuteur'
};

const THEMES = ['omni', 'sombre', 'clair'];

/* Réglages au premier lancement : thème Omni-système, bips activés à
   volume modéré (pas de bruit fort par défaut), vibrations éteintes
   (on les active dans les Réglages si on le souhaite). */
const REGLAGES_DEFAUT = Object.freeze({
  theme: 'omni',
  bips: true,
  volume: 50,
  vibrations: false
});

/* Les trois modèles prêts à l'emploi (durées en secondes).
   Musculation : seul le repos de 90 s entre les séries était demandé ;
   4 séries de 45 s sont une base de départ, modifiable comme tout le
   reste (en musculation, un « round » est une série). */
const MODELES = [
  { nom: 'Boxe',        echauffement: 0, rounds: 12, travail: 180, repos: 60, reposFinal: 0 },
  { nom: 'Tabata',      echauffement: 0, rounds: 8,  travail: 20,  repos: 10, reposFinal: 0 },
  { nom: 'Musculation', echauffement: 0, rounds: 4,  travail: 45,  repos: 90, reposFinal: 0 }
];

const ROUNDS_MAX = 99;


/* ---------- Lire et écrire sans jamais planter ----------
   localStorage peut refuser (navigation privée, mémoire pleine) :
   l'application doit continuer de marcher quand même. */
const Stockage = {
  lire(cle, parDefaut) {
    try {
      const texte = localStorage.getItem(cle);
      return texte === null ? parDefaut : JSON.parse(texte);
    } catch (e) {
      return parDefaut;
    }
  },
  ecrire(cle, valeur) {
    try {
      localStorage.setItem(cle, JSON.stringify(valeur));
      return true;
    } catch (e) {
      return false;
    }
  },
  effacer(cle) {
    try { localStorage.removeItem(cle); } catch (e) { /* rien à faire */ }
  }
};


/* ---------- Nettoyage ----------
   Ce qui est relu depuis le téléphone est vérifié : une valeur abîmée ou
   absente est remplacée par une valeur sûre. ⚠️ Ces fonctions ne gardent
   QUE les champs qu'elles connaissent : tout nouveau champ doit y être
   ajouté, sinon il disparaît au prochain lancement. */

/* Un nombre entier entre min et max, ou la valeur par défaut. */
function entierBorne(valeur, min, max, parDefaut) {
  const n = Math.round(Number(valeur));
  return Number.isFinite(n) ? borner(n, min, max) : parDefaut;
}

function nettoyerReglages(r) {
  const o = (r && typeof r === 'object') ? r : {};
  return {
    theme: THEMES.includes(o.theme) ? o.theme : REGLAGES_DEFAUT.theme,
    bips: typeof o.bips === 'boolean' ? o.bips : REGLAGES_DEFAUT.bips,
    volume: entierBorne(o.volume, 0, 100, REGLAGES_DEFAUT.volume),
    vibrations: typeof o.vibrations === 'boolean' ? o.vibrations : REGLAGES_DEFAUT.vibrations
  };
}

function nettoyerSeance(s) {
  if (!s || typeof s !== 'object') return null;
  const nom = (typeof s.nom === 'string' && s.nom.trim()) ? s.nom.trim().slice(0, 40) : 'Ma séance';
  return {
    id: (typeof s.id === 'string' && s.id) ? s.id : nouvelId(),
    nom: nom,
    echauffement: entierBorne(s.echauffement, 0, DUREE_MAX, 0),
    rounds:       entierBorne(s.rounds, 1, ROUNDS_MAX, 1),
    travail:      entierBorne(s.travail, 1, DUREE_MAX, 60),
    repos:        entierBorne(s.repos, 0, DUREE_MAX, 0),
    reposFinal:   entierBorne(s.reposFinal, 0, DUREE_MAX, 0)
  };
}


/* ---------- Réglages ---------- */

let reglages = nettoyerReglages(Stockage.lire(CLES.reglages, null));

function enregistrerReglages() {
  Stockage.ecrire(CLES.reglages, reglages);
}


/* ---------- Séances ---------- */

function chargerSeances() {
  const liste = Stockage.lire(CLES.seances, []);
  if (!Array.isArray(liste)) return [];
  const vues = new Set();
  return liste.map(nettoyerSeance).filter((s) => {
    if (!s) return false;
    if (vues.has(s.id)) s.id = nouvelId();   // deux fois le même identifiant : on corrige
    vues.add(s.id);
    return true;
  });
}

let seances = chargerSeances();

function enregistrerSeances() {
  return Stockage.ecrire(CLES.seances, seances);
}

/* Une copie neuve d'un modèle, avec son propre identifiant */
function copieDeModele(modele) {
  return nettoyerSeance(Object.assign({}, modele, { id: nouvelId() }));
}

/* Au tout premier lancement, on range les trois modèles dans la liste,
   pour que l'application soit utilisable tout de suite. Ils se modifient,
   se dupliquent et se suppriment comme n'importe quelle séance. */
if (!Stockage.lire(CLES.initialise, false)) {
  if (seances.length === 0) {
    seances = MODELES.map(copieDeModele);
    enregistrerSeances();
  }
  Stockage.ecrire(CLES.initialise, true);
}
