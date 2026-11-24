/* Omni-Time — © 2026 Ferrus Dantioch
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


/* ---------- Sauvegarde JSON & stockage persistant ---------- */

const TAILLE_IMPORT_MAX = 512 * 1024;   // 512 Ko
const SEANCES_IMPORT_MAX = 200;
const SEANCES_TOTAL_MAX = 500;

/* Demande au navigateur de ne pas effacer nos données automatiquement
   quand la mémoire du téléphone manque (espace partagé sur GitHub Pages). */
function demanderStockagePersistant() {
  if (!navigator.storage || typeof navigator.storage.persist !== 'function') return;
  const verifier = typeof navigator.storage.persisted === 'function'
    ? navigator.storage.persisted().catch(() => false)
    : Promise.resolve(false);
  verifier.then((deja) => {
    if (!deja) return navigator.storage.persist();
  }).catch(() => {});
}

function construireExportSeances() {
  return {
    application: 'omni-time',
    version: 1,
    exporteLe: new Date().toISOString(),
    seances: seances.map((s) => ({
      id: s.id,
      nom: s.nom,
      echauffement: s.echauffement,
      rounds: s.rounds,
      travail: s.travail,
      repos: s.repos,
      reposFinal: s.reposFinal
    }))
  };
}

function exporterSeancesJson() {
  const texte = JSON.stringify(construireExportSeances(), null, 2);
  const blob = new Blob([texte], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = 'omni-time-seances-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function estEntierDansBornes(valeur, min, max) {
  return typeof valeur === 'number' && Number.isInteger(valeur) && valeur >= min && valeur <= max;
}

function validerSeanceImport(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  if (typeof s.nom !== 'string') return null;
  const nom = s.nom.trim();
  if (nom.length < 1 || nom.length > 40) return null;

  let id = null;
  if ('id' in s && s.id !== undefined && s.id !== null && s.id !== '') {
    if (typeof s.id !== 'string' || s.id.length > 64) return null;
    id = s.id;
  }

  if (!estEntierDansBornes(s.echauffement, 0, DUREE_MAX)) return null;
  if (!estEntierDansBornes(s.rounds, 1, ROUNDS_MAX)) return null;
  if (!estEntierDansBornes(s.travail, 1, DUREE_MAX)) return null;
  if (!estEntierDansBornes(s.repos, 0, DUREE_MAX)) return null;
  if (!estEntierDansBornes(s.reposFinal, 0, DUREE_MAX)) return null;

  return {
    id: id,
    nom: nom,
    echauffement: s.echauffement,
    rounds: s.rounds,
    travail: s.travail,
    repos: s.repos,
    reposFinal: s.reposFinal
  };
}

function importerSeancesDepuisTexte(texte) {
  if (typeof texte !== 'string' || texte.length > TAILLE_IMPORT_MAX) {
    return { ok: false, erreur: 'Ce fichier est trop volumineux (maximum 512 Ko).' };
  }

  let donnees;
  try {
    donnees = JSON.parse(texte);
  } catch (e) {
    return { ok: false, erreur: 'Ce fichier n’est pas un JSON valide.' };
  }

  if (!donnees || typeof donnees !== 'object' || Array.isArray(donnees)) {
    return { ok: false, erreur: 'Format de fichier non reconnu.' };
  }
  if ('application' in donnees && donnees.application !== 'omni-time') {
    return { ok: false, erreur: 'Ce fichier ne provient pas d’Omni-Time.' };
  }
  if ('version' in donnees && donnees.version !== 1) {
    return { ok: false, erreur: 'Version de sauvegarde non prise en charge.' };
  }
  if (!Array.isArray(donnees.seances)) {
    return { ok: false, erreur: 'Format de fichier non reconnu : liste de séances absente.' };
  }
  if (donnees.seances.length === 0) {
    return { ok: false, erreur: 'Ce fichier ne contient aucune séance.' };
  }
  if (donnees.seances.length > SEANCES_IMPORT_MAX) {
    return { ok: false, erreur: 'Trop de séances dans un seul fichier (maximum ' + SEANCES_IMPORT_MAX + ').' };
  }

  const valides = [];
  for (let i = 0; i < donnees.seances.length; i++) {
    const v = validerSeanceImport(donnees.seances[i]);
    if (!v) {
      return { ok: false, erreur: 'Séance invalide (élément ' + (i + 1) + ') : vérifie les champs et les durées.' };
    }
    valides.push(v);
  }

  const parId = new Map(seances.map((s) => [s.id, s]));
  const idsExistants = new Set(seances.map((s) => s.id));
  const nomsExistants = new Set(seances.map((s) => s.nom.trim().toLocaleLowerCase('fr')));
  const ajoutees = [];
  let ignorees = 0;

  for (let i = 0; i < valides.length; i++) {
    const s = valides[i];
    const existante = s.id ? parId.get(s.id) : null;
    if (existante
      && existante.nom === s.nom
      && existante.echauffement === s.echauffement
      && existante.rounds === s.rounds
      && existante.travail === s.travail
      && existante.repos === s.repos
      && existante.reposFinal === s.reposFinal) {
      ignorees++;
      continue;
    }

    let idFinal = (s.id && !idsExistants.has(s.id)) ? s.id : nouvelId();
    while (idsExistants.has(idFinal)) idFinal = nouvelId();

    let nomFinal = s.nom;
    let n = 2;
    while (nomsExistants.has(nomFinal.toLocaleLowerCase('fr'))) {
      nomFinal = nomAvecSuffixe(s.nom, ' (' + n + ')', 40);
      n++;
    }

    const nouvelle = {
      id: idFinal,
      nom: nomFinal,
      echauffement: s.echauffement,
      rounds: s.rounds,
      travail: s.travail,
      repos: s.repos,
      reposFinal: s.reposFinal
    };
    idsExistants.add(nouvelle.id);
    nomsExistants.add(nouvelle.nom.toLocaleLowerCase('fr'));
    ajoutees.push(nouvelle);
  }

  if (seances.length + ajoutees.length > SEANCES_TOTAL_MAX) {
    return { ok: false, erreur: 'Limite de ' + SEANCES_TOTAL_MAX + ' séances atteinte sur cet appareil.' };
  }

  if (ajoutees.length > 0) {
    const avant = seances.slice();
    seances = seances.concat(ajoutees);
    if (!enregistrerSeances()) {
      seances = avant;
      return { ok: false, erreur: 'Impossible d’enregistrer sur ce téléphone (mémoire pleine ou navigation privée).' };
    }
  }

  let message;
  if (ajoutees.length === 0) {
    message = 'Toutes les séances de ce fichier sont déjà présentes.';
  } else {
    const pluriel = ajoutees.length > 1 ? 's' : '';
    message = ajoutees.length + ' séance' + pluriel + ' importée' + pluriel;
    if (ignorees > 0) {
      const plurielIg = ignorees > 1 ? 's' : '';
      message += ' (' + ignorees + ' déjà présente' + plurielIg + ' ignorée' + plurielIg + ')';
    }
    message += '.';
  }
  return { ok: true, importees: ajoutees.length, ignorees, message };
}
