/* Omni-Time — Copyright (c) 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OMNI-TIME — intervalles.js
   Le « calcul » d'une séance, sans rien afficher.

   Une séance est transformée en une liste de phases, l'une après l'autre :
     Échauffement → Travail 1 → Repos → Travail 2 → … → Travail N → Repos final
   (pas de repos après le dernier round : c'est le repos final qui suit).

   Le principe le plus important de toute l'application : on ne compte
   JAMAIS les secondes une par une. On note l'heure réelle du départ, et
   à chaque instant on calcule « combien de temps s'est écoulé depuis ».
   Ainsi, même si le téléphone ralentit l'application (écran verrouillé,
   autre application ouverte), le temps affiché reste juste.
   ============================================================ */
'use strict';

const NOMS_PHASES = {
  echauffement: 'Échauffement',
  travail: 'Travail',
  repos: 'Repos',
  reposFinal: 'Repos final'
};

function nomPhase(type) {
  return NOMS_PHASES[type] || '';
}

/* Liste des phases d'une séance. Chaque phase : { type, duree (s), round } */
function construirePhases(seance) {
  const phases = [];
  if (seance.echauffement > 0) {
    phases.push({ type: 'echauffement', duree: seance.echauffement, round: 0 });
  }
  for (let r = 1; r <= seance.rounds; r++) {
    phases.push({ type: 'travail', duree: seance.travail, round: r });
    if (r < seance.rounds && seance.repos > 0) {
      phases.push({ type: 'repos', duree: seance.repos, round: r });
    }
  }
  if (seance.reposFinal > 0) {
    phases.push({ type: 'reposFinal', duree: seance.reposFinal, round: seance.rounds });
  }
  return phases;
}

/* Durée totale d'une séance, en secondes */
function dureeTotaleSeance(seance) {
  return construirePhases(seance).reduce((total, p) => total + p.duree, 0);
}

/* Où en est-on, après « ecouleMs » millisecondes de séance ?
   Renvoie le numéro de la phase en cours, le temps déjà passé dedans,
   le temps qu'il y reste, et l'instant où elle se termine. */
function positionDans(phases, ecouleMs) {
  let debut = 0;
  for (let i = 0; i < phases.length; i++) {
    const fin = debut + phases[i].duree * 1000;
    if (ecouleMs < fin) {
      return {
        index: i,
        termine: false,
        debutMs: debut,
        finMs: fin,
        dansPhaseMs: ecouleMs - debut,
        resteMs: fin - ecouleMs
      };
    }
    debut = fin;
  }
  // Au-delà de la dernière phase : la séance est finie
  return { index: phases.length, termine: true, debutMs: debut, finMs: debut, dansPhaseMs: 0, resteMs: 0, totalMs: debut };
}
