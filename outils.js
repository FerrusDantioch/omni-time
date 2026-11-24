/* Omni-Time — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OMNI-TIME — outils.js
   Petites fonctions utiles partout dans l'application :
   trouver des éléments de la page, mettre les durées en forme,
   parler aux lecteurs d'écran, boutons « deux appuis »,
   réglages de durée [−] 03:00 [+].
   (Les bips, eux, sont dans sons.js.)
   ============================================================ */
'use strict';

/* Trouve UN élément de la page (le premier qui correspond). */
function $(selecteur, racine) {
  return (racine || document).querySelector(selecteur);
}

/* Trouve TOUS les éléments qui correspondent, sous forme de liste. */
function $$(selecteur, racine) {
  return Array.from((racine || document).querySelectorAll(selecteur));
}

/* Garde un nombre entre un minimum et un maximum. */
function borner(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/* Écrit un nombre sur deux chiffres : 7 → « 07 ». */
function deuxChiffres(n) {
  return String(n).padStart(2, '0');
}

/* Change le texte d'un élément seulement s'il a changé (évite de
   redessiner la page dix fois par seconde pour rien). */
function ecrireTexte(element, texte) {
  if (element && element.textContent !== texte) element.textContent = texte;
}

/* Met une durée (en secondes entières) en forme :
   - 185 → « 3:05 »           (format court, pour les résumés)
   - 185 → « 03:05 »          (avec complet = true, pour les gros chiffres)
   - 3725 → « 1:02:05 »       (au-delà d'une heure) */
function formaterDuree(totalSecondes, complet) {
  const s = Math.max(0, Math.round(totalSecondes));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return h + ':' + deuxChiffres(m) + ':' + deuxChiffres(sec);
  return (complet ? deuxChiffres(m) : String(m)) + ':' + deuxChiffres(sec);
}

/* Temps du chronomètre, en millisecondes, avec les dixièmes :
   83 400 → « 01:23,4 » ; au-delà d'une heure → « 1:02:03,4 ».
   (En français, on sépare les dixièmes par une virgule.) */
function formaterChrono(ms) {
  const dixiemesTotal = Math.floor(Math.max(0, ms) / 100);
  const dixieme = dixiemesTotal % 10;
  const s = Math.floor(dixiemesTotal / 10);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const debut = h > 0 ? h + ':' + deuxChiffres(m) : deuxChiffres(m);
  return debut + ':' + deuxChiffres(sec) + ',' + dixieme;
}

/* Durée en toutes lettres, pour les lecteurs d'écran :
   90 → « 1 minute 30 secondes ». */
function dureeEnMots(totalSecondes) {
  const s = Math.max(0, Math.round(totalSecondes));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const morceaux = [];
  if (h) morceaux.push(h + (h > 1 ? ' heures' : ' heure'));
  if (m) morceaux.push(m + (m > 1 ? ' minutes' : ' minute'));
  if (sec || morceaux.length === 0) morceaux.push(sec + (sec > 1 ? ' secondes' : ' seconde'));
  return morceaux.join(' ');
}

/* Fait lire un message par le lecteur d'écran (zone invisible « annonce »). */
let minuteurAnnonce = null;

function annoncer(texte) {
  const zone = document.getElementById('annonce');
  if (!zone) return;
  clearTimeout(minuteurAnnonce);
  zone.textContent = '';
  minuteurAnnonce = setTimeout(() => { zone.textContent = texte; }, 60);
}

/* Fabrique un identifiant unique (pour reconnaître chaque séance). */
function nouvelId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* Ajoute un suffixe (« (copie) », « (2) »…) en gardant le nom dans la limite. */
function nomAvecSuffixe(nom, suffixe, max) {
  const limite = max || 40;
  const base = String(nom || '').slice(0, Math.max(0, limite - suffixe.length)).trimEnd();
  return (base + suffixe).slice(0, limite);
}


/* ---------- Boutons « deux appuis » ----------
   Pour les actions qui font perdre quelque chose (supprimer, arrêter) :
   le premier appui « arme » le bouton (il change de texte et de couleur),
   le second confirme. Sans second appui, il se désarme seul après 4 s.
   Même fonctionnement que dans Cap. */
function armerBouton(bouton, texteArme, action) {
  if (!bouton.classList.contains('arme')) {
    bouton.classList.add('arme');
    bouton.dataset.texteOriginal = bouton.textContent;
    bouton.textContent = texteArme;
    // Le nom lu par les lecteurs d'écran change aussi (« Confirmer ? »)
    if (bouton.hasAttribute('aria-label')) {
      bouton.dataset.ariaOriginal = bouton.getAttribute('aria-label');
      bouton.setAttribute('aria-label', texteArme);
    }
    clearTimeout(bouton._minuteurArme);
    bouton._minuteurArme = setTimeout(() => desarmerBouton(bouton), 4000);
    return;
  }
  // On remet le bouton dans son état normal AVANT l'action : un bouton qui
  // reste affiché ne doit pas rester armé pour la fois suivante.
  desarmerBouton(bouton);
  action();
}

function desarmerBouton(bouton) {
  clearTimeout(bouton._minuteurArme);
  bouton.classList.remove('arme');
  if (bouton.dataset.texteOriginal) {
    bouton.textContent = bouton.dataset.texteOriginal;
    delete bouton.dataset.texteOriginal;
  }
  if (bouton.dataset.ariaOriginal) {
    bouton.setAttribute('aria-label', bouton.dataset.ariaOriginal);
    delete bouton.dataset.ariaOriginal;
  }
}


/* ---------- Réglage d'une durée : [−] 03 : 00 [+] ----------
   Transforme un simple <div data-libelle="…" data-min="…"> en réglage
   complet : deux cases (minutes, secondes) et deux gros boutons.
   Le pas des boutons s'adapte : 5 s sous la minute, 15 s jusqu'à 5 min,
   30 s jusqu'à 10 min, puis 1 min. Un appui long fait défiler.
   Renvoie un petit objet pour lire / écrire la durée en secondes. */
const DUREE_MAX = 99 * 60 + 59;   // 99:59, la plus longue durée possible

function pasPour(secondes, sens) {
  const reference = sens > 0 ? secondes : secondes - 1;
  if (reference < 60) return 5;
  if (reference < 300) return 15;
  if (reference < 600) return 30;
  return 60;
}

function creerChampDuree(conteneur) {
  const libelle = conteneur.dataset.libelle || 'Durée';
  const minimum = Number(conteneur.dataset.min) || 0;
  conteneur.classList.add('duree');
  conteneur.textContent = '';

  const btnMoins = document.createElement('button');
  btnMoins.type = 'button';
  btnMoins.className = 'bouton duree-bouton';
  btnMoins.dataset.sens = '-1';
  btnMoins.setAttribute('aria-label', libelle + ' : diminuer');
  btnMoins.textContent = '−';

  const champs = document.createElement('span');
  champs.className = 'duree-champs';

  const champMin = document.createElement('input');
  champMin.type = 'text';
  champMin.setAttribute('inputmode', 'numeric');
  champMin.setAttribute('pattern', '[0-9]*');
  champMin.setAttribute('maxlength', '2');
  champMin.className = 'duree-min';
  champMin.setAttribute('aria-label', libelle + ' : minutes');

  const sep = document.createElement('span');
  sep.className = 'duree-sep';
  sep.setAttribute('aria-hidden', 'true');
  sep.textContent = ':';

  const champSec = document.createElement('input');
  champSec.type = 'text';
  champSec.setAttribute('inputmode', 'numeric');
  champSec.setAttribute('pattern', '[0-9]*');
  champSec.setAttribute('maxlength', '2');
  champSec.className = 'duree-sec';
  champSec.setAttribute('aria-label', libelle + ' : secondes');

  champs.append(champMin, sep, champSec);

  const btnPlus = document.createElement('button');
  btnPlus.type = 'button';
  btnPlus.className = 'bouton duree-bouton';
  btnPlus.dataset.sens = '1';
  btnPlus.setAttribute('aria-label', libelle + ' : augmenter');
  btnPlus.textContent = '+';

  conteneur.append(btnMoins, champs, btnPlus);

  const ecouteurs = [];

  function lireBrut() {
    const m = parseInt(champMin.value, 10) || 0;
    const s = parseInt(champSec.value, 10) || 0;
    return borner(m, 0, 99) * 60 + borner(s, 0, 59);
  }

  function lire() {
    return lireBrut();
  }

  function lireBornee() {
    return borner(lireBrut(), minimum, DUREE_MAX);
  }

  function formaterChamps(secondes) {
    const s = borner(Math.round(secondes) || 0, 0, DUREE_MAX);
    champMin.value = deuxChiffres(Math.floor(s / 60));
    champSec.value = deuxChiffres(s % 60);
  }

  function ecrire(secondes) {
    formaterChamps(borner(Math.round(secondes) || 0, minimum, DUREE_MAX));
  }

  function prevenir() { ecouteurs.forEach((f) => f(lire())); }

  // Un pas en avant ou en arrière, « aimanté » sur un multiple du pas :
  // 0:07 + 5 s donne 0:10, pas 0:12.
  function avancer(sens) {
    const actuel = lireBornee();
    const pas = pasPour(actuel, sens);
    const suivant = sens > 0
      ? Math.floor(actuel / pas) * pas + pas
      : Math.ceil(actuel / pas) * pas - pas;
    ecrire(suivant);
    prevenir();
  }

  // On ne garde que les chiffres pendant la frappe
  [champMin, champSec].forEach((champ) => {
    champ.addEventListener('input', () => {
      const propre = champ.value.replace(/\D/g, '').slice(0, 2);
      if (propre !== champ.value) champ.value = propre;
      prevenir();
    });
    // En quittant la case, on remet la durée au propre (ex. « 7 » → « 07 »)
    // sans écraser 00:00, pour que la validation signale l'erreur au clic.
    champ.addEventListener('blur', () => { formaterChamps(lireBrut()); prevenir(); });
    // Toucher une case sélectionne son contenu : on retape directement
    champ.addEventListener('focus', () => champ.select());
  });

  $$('.duree-bouton', conteneur).forEach((bouton) => {
    const sens = Number(bouton.dataset.sens);
    brancherAppuiLong(bouton, () => avancer(sens));
  });

  return {
    lire,
    ecrire,
    surChangement(fonction) { ecouteurs.push(fonction); }
  };
}

/* Un bouton qui agit une fois à l'appui, puis se répète si on garde le
   doigt dessus (au bout d'une demi-seconde, environ 8 fois par seconde). */
function brancherAppuiLong(bouton, action) {
  let attente = null;
  let repetition = null;
  let aRepete = false;

  function arreter() {
    clearTimeout(attente);
    clearInterval(repetition);
    attente = null;
    repetition = null;
  }

  bouton.addEventListener('pointerdown', () => {
    aRepete = false;
    arreter();
    attente = setTimeout(() => {
      aRepete = true;
      action();
      repetition = setInterval(action, 120);
    }, 500);
  });
  ['pointerup', 'pointerleave', 'pointercancel', 'lostpointercapture', 'blur'].forEach((type) => {
    bouton.addEventListener(type, arreter);
  });
  window.addEventListener('blur', arreter);
  bouton.addEventListener('keydown', () => { aRepete = false; });
  // Le « clic » sert pour un appui simple (et pour le clavier).
  // Après un défilement par appui long, on l'ignore une fois.
  bouton.addEventListener('click', () => {
    if (aRepete) { aRepete = false; return; }
    action();
  });
}
