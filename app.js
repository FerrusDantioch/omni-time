/* Omni-Time — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OMNI-TIME — app.js
   Le chef d'orchestre : passage d'un écran à l'autre, réglages,
   « horloge » commune qui fait avancer ce qui tourne, et démarrage
   de l'application. Chargé en dernier.
   ============================================================ */
'use strict';

/* Numéro de version affiché dans « À propos ». À changer à chaque
   nouvelle version publiée (en même temps que CACHE dans sw.js). */
const VERSION = '1.0.3';

/* ---------- 1. Navigation entre les écrans ----------
   Chaque écran est une <section class="vue" data-vue="…">.
   Un seul est visible à la fois. On garde une trace dans l'historique
   du navigateur : le bouton « retour » d'Android ramène donc à l'écran
   précédent, au lieu de fermer l'application. */

const VUES = ['accueil', 'chrono', 'minuteur', 'edition', 'seance', 'reglages', 'apropos'];
let vueActive = 'accueil';

/* Quel écran l'adresse demande-t-elle ? (« …/index.html#chrono » → chrono) */
function vueDepuisAdresse() {
  const nom = location.hash.replace('#', '');
  return VUES.includes(nom) ? nom : 'accueil';
}

function afficherVue(nom) {
  // Certains écrans n'ont de sens que dans une situation précise
  if (nom === 'seance' && !Lecteur.etat) nom = 'accueil';
  if (nom === 'edition' && !Editeur.ouvert) nom = 'accueil';
  if (nom !== 'edition') Editeur.fermer();

  vueActive = nom;
  document.body.dataset.vue = nom;
  $$('.vue').forEach((section) => { section.hidden = section.dataset.vue !== nom; });

  // Remet chaque écran à jour au moment où on l'ouvre
  switch (nom) {
    case 'accueil':  Seances.afficherListe(); Seances.majAccueil(); MiseAJour.majBandeau(); break;
    case 'chrono':   Chrono.afficher(); break;
    case 'minuteur': Minuteur.afficher(); break;
    case 'seance':   Lecteur.afficher(); break;
    case 'reglages': Reglages.afficher(); break;
  }

  window.scrollTo(0, 0);
  // Le titre de l'écran reçoit le focus : un lecteur d'écran l'annonce
  const titre = $('.vue[data-vue="' + nom + '"] h1');
  if (titre) titre.focus({ preventScroll: true });
  Horloge.verifier();
}

/* Ouvre un écran en l'ajoutant à l'historique */
function allerA(nom) {
  history.pushState({ omniTime: true }, '', '#' + nom);
  afficherVue(nom);
}

/* Revient à l'écran précédent (ou à l'accueil si l'application a été
   ouverte directement sur cet écran, par exemple via un raccourci). */
function revenir() {
  if (history.state && history.state.omniTime) {
    history.back();
  } else {
    history.replaceState(null, '', location.pathname + location.search);
    afficherVue('accueil');
  }
}

// Bouton « retour » du téléphone (ou geste de retour)
window.addEventListener('popstate', () => afficherVue(vueDepuisAdresse()));


/* ---------- 2. L'horloge commune ----------
   Dix fois par seconde, tant que quelque chose tourne (séance, minuteur
   ou chronomètre), on met à jour les chiffres et on vérifie s'il faut
   biper. Quand plus rien ne tourne, l'horloge s'arrête : pas de batterie
   consommée pour rien.
   Rappel : l'horloge ne COMPTE pas le temps. Elle se contente de
   regarder l'heure réelle ; si elle est ralentie par le téléphone,
   le temps affiché reste juste. */

const Horloge = {
  id: null,

  besoin() {
    return Lecteur.enMarche() || Minuteur.etat.statut === 'marche' || Chrono.enMarche();
  },

  verifier() {
    if (this.besoin() && this.id === null) {
      this.id = setInterval(() => this.tick(), 100);
    } else if (!this.besoin() && this.id !== null) {
      clearInterval(this.id);
      this.id = null;
    }
  },

  tick() {
    Lecteur.tick();
    Minuteur.tick();
    if (vueActive === 'chrono' && Chrono.enMarche()) Chrono.afficherTemps();
    if (vueActive === 'accueil') { Seances.majAccueil(); MiseAJour.majBandeau(); }
    this.verifier();
  }
};

// Au retour dans l'application, on remet tout à l'heure tout de suite
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    Horloge.tick();
    if (vueActive === 'seance') Lecteur.afficher();
    if (vueActive === 'minuteur') Minuteur.afficher();
  }
});


/* ---------- 3. Thème ---------- */

function appliquerTheme() {
  document.documentElement.dataset.theme = reglages.theme;
  // La barre du haut d'Android prend la couleur du fond du thème
  const fond = getComputedStyle(document.documentElement).getPropertyValue('--fond').trim();
  const meta = $('meta[name="theme-color"]');
  if (meta && fond) meta.setAttribute('content', fond);
}


/* ---------- 4. Réglages ---------- */

const Reglages = {
  initialiser() {
    // Thème : appliqué dès qu'on le touche, et mémorisé
    $$('input[name="theme"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        reglages.theme = radio.value;
        enregistrerReglages();
        appliquerTheme();
      });
    });

    $('#reglage-bips').addEventListener('change', (e) => {
      reglages.bips = e.target.checked;
      enregistrerReglages();
      // Bips coupés : ceux qui étaient déjà programmés ne sonnent pas
      if (!reglages.bips) Sons.annuler('');
      this.afficher();
    });

    // Volume : on enregistre en glissant, et on fait entendre un petit bip
    // quand on lâche le curseur, pour juger tout de suite.
    const curseur = $('#reglage-volume');
    curseur.addEventListener('input', () => {
      reglages.volume = Number(curseur.value);
      enregistrerReglages();
      ecrireTexte($('#volume-valeur'), reglages.volume + ' %');
    });
    curseur.addEventListener('change', () => {
      Sons.deverrouiller();
      Sons.bip('court');
    });

    $('#reglage-vibrations').addEventListener('change', (e) => {
      reglages.vibrations = e.target.checked;
      enregistrerReglages();
      this.afficher();
    });

    // Ce que le téléphone ne sait pas faire est signalé, simplement
    if (!Sons.vibrationsPossibles()) {
      $('#vibration-info').hidden = false;
    }
    if (!Ecran.disponible()) {
      $('#ecran-info').textContent = 'Ce navigateur ne sait pas garder l’écran allumé : '
        + 'pendant une séance, l’écran s’éteindra comme d’habitude. '
        + 'Le temps reste juste quand tu le rallumes.';
    }
    ecrireTexte($('#numero-version'), 'Version ' + VERSION);
  },

  afficher() {
    $$('input[name="theme"]').forEach((radio) => { radio.checked = radio.value === reglages.theme; });
    $('#reglage-bips').checked = reglages.bips;
    $('#reglage-volume').value = String(reglages.volume);
    $('#reglage-volume').disabled = !reglages.bips;
    ecrireTexte($('#volume-valeur'), reglages.volume + ' %');
    $('#bouton-tester-bip').disabled = !reglages.bips;
    $('#reglage-vibrations').checked = reglages.vibrations;
    $('#reglage-vibrations').disabled = !Sons.vibrationsPossibles();
    $('#bouton-tester-vibration').disabled = !Sons.vibrationsPossibles() || !reglages.vibrations;
  }
};


/* ---------- 5. Tous les boutons ----------
   Un seul « écouteur » pour toute la page : il regarde l'attribut
   data-aller (changer d'écran) ou data-action (faire quelque chose)
   du bouton touché. */

document.addEventListener('click', (e) => {
  const cible = e.target.closest('[data-aller], [data-action]');
  if (!cible || cible.disabled) return;

  if (cible.dataset.aller) {
    allerA(cible.dataset.aller);
    return;
  }

  // Pour les boutons d'une carte de séance : de quelle séance s'agit-il ?
  const carte = cible.closest('[data-id]');
  const id = carte ? carte.dataset.id : null;

  switch (cible.dataset.action) {
    case 'retour':              revenir(); break;
    case 'revenir-seance':      allerA('seance'); break;

    // Nouvelle version
    case 'mettre-a-jour':       MiseAJour.appliquer(cible); break;
    case 'plus-tard':           MiseAJour.repousser(); break;

    // Séances
    case 'nouvelle-seance':     Editeur.ouvrir(null); break;
    case 'demarrer':            Seances.demarrer(id); break;
    case 'modifier':            Editeur.ouvrir(id); break;
    case 'dupliquer':           Seances.dupliquer(id); break;
    case 'supprimer':           armerBouton(cible, 'Confirmer ?', () => Seances.supprimer(id)); break;

    // Chronomètre
    case 'chrono-marche':       Chrono.basculer(); break;
    case 'chrono-tour':         Chrono.tour(); break;
    case 'chrono-raz':          armerBouton(cible, 'Confirmer ?', () => Chrono.remiseAZero()); break;

    // Minuteur
    case 'minuteur-demarrer':   Minuteur.demarrer(); break;
    case 'minuteur-pause':      Minuteur.basculer(); break;
    case 'minuteur-arreter':
      if (Minuteur.etat.statut === 'fini') Minuteur.arreter();
      else armerBouton(cible, 'Confirmer l’arrêt ?', () => Minuteur.arreter());
      break;

    // Séance en cours
    case 'lecteur-pause':       Lecteur.basculerPause(); break;
    case 'lecteur-passer':
      // Passer la dernière phase termine la séance : deux appuis, comme « Arrêter »
      if (Lecteur.passerTermine()) armerBouton(cible, 'Confirmer la fin ?', () => Lecteur.passer());
      else Lecteur.passer();
      break;
    case 'lecteur-arreter':     armerBouton(cible, 'Confirmer l’arrêt ?', () => Lecteur.arreter()); break;
    case 'lecteur-recommencer': Lecteur.recommencer(); break;
    case 'lecteur-fermer':      Lecteur.fermer(); break;

    // Réglages
    case 'tester-bip':
      Sons.deverrouiller();
      Sons.bip('court', true);
      setTimeout(() => Sons.bip('long', true), 450);
      break;
    case 'tester-vibration':    Sons.vibrer(400, true); break;
    case 'rajouter-modeles': {
      Seances.rajouterModeles();
      const message = $('#modeles-message');
      message.hidden = false;
      setTimeout(() => { message.hidden = true; }, 4000);
      break;
    }
  }
});


/* ---------- 6. Nouvelle version ----------
   Le service worker télécharge une nouvelle version en arrière-plan,
   puis ATTEND : rien ne change par surprise. L'accueil le dit, et c'est
   la personne qui choisit « Mettre à jour » ou « Plus tard ».
   Jamais pendant une séance ou un minuteur qui tourne : la page
   rechargée ne pourrait plus biper avant le prochain appui (règle des
   navigateurs pour le son). */

const MiseAJour = {
  inscription: null,   // l'inscription du service worker
  demandee: false,     // vrai après un appui sur « Mettre à jour »
  repoussee: false,    // « Plus tard » : plus rien jusqu'à la prochaine ouverture

  surveiller(inscription) {
    this.inscription = inscription;
    // Une version attendait déjà (téléchargée lors d'une visite précédente)
    this.majBandeau();
    inscription.addEventListener('updatefound', () => {
      const nouveau = inscription.installing;
      if (!nouveau) return;
      nouveau.addEventListener('statechange', () => {
        if (nouveau.state === 'installed') this.majBandeau();
      });
    });
    // À chaque retour dans l'application, on regarde s'il y a du nouveau
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') inscription.update().catch(() => {});
    });
  },

  prete() {
    // Sans « controller », c'est la toute première installation : rien à proposer
    return !!(this.inscription && this.inscription.waiting && navigator.serviceWorker.controller);
  },

  majBandeau() {
    const occupe = Lecteur.actif() || Minuteur.etat.statut === 'marche';
    $('#bandeau-mise-a-jour').hidden = !this.prete() || this.repoussee || occupe;
  },

  appliquer(bouton) {
    if (!this.prete()) return;
    this.demandee = true;
    bouton.disabled = true;
    ecrireTexte(bouton, 'Mise à jour…');
    this.inscription.waiting.postMessage({ type: 'activer' });
  },

  repousser() {
    this.repoussee = true;
    this.majBandeau();
    annoncer('D’accord. Omni-Time te le reproposera à la prochaine ouverture.');
  }
};


/* ---------- 7. Démarrage ---------- */

function demarrerApplication() {
  appliquerTheme();

  // Préparation des écrans (une seule fois)
  Editeur.initialiser();
  Minuteur.initialiser();
  Reglages.initialiser();

  // On relit ce qui tournait peut-être avant la fermeture
  Chrono.charger();
  Minuteur.charger();
  Lecteur.charger();

  // Premier écran. Une séance interrompue en pleine course ? On la
  // réaffiche directement (le retour mène à l'accueil).
  let depart = vueDepuisAdresse();
  if (Lecteur.actif()) {
    history.replaceState(null, '', location.pathname + location.search);
    history.pushState({ omniTime: true }, '', '#seance');
    depart = 'seance';
  } else if (depart === 'edition' || depart === 'seance') {
    history.replaceState(null, '', location.pathname + location.search);
    depart = 'accueil';
  }
  afficherVue(depart);
  Horloge.verifier();

  // Mode hors ligne : on installe le service worker (fichier sw.js)
  if ('serviceWorker' in navigator) {
    // Ce changement a aussi lieu à la toute première installation : on
    // ne recharge que si la personne a touché « Mettre à jour ».
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (MiseAJour.demandee) location.reload();
    });
    navigator.serviceWorker.register('./sw.js').then((i) => MiseAJour.surveiller(i)).catch(() => {
      /* Pas de mode hors ligne (adresse en file:// par exemple) :
         l'application marche quand même tant qu'elle est ouverte. */
    });
  }
}

// Les fichiers sont chargés avec « defer » : la page est déjà prête ici.
demarrerApplication();
