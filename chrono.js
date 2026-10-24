/* Omni-Time — Copyright (c) 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OMNI-TIME — chrono.js
   Le chronomètre : démarrer, pause, tours, remise à zéro.

   Comme partout dans l'application, le temps est calculé à partir de
   l'heure réelle (Date.now()), jamais en comptant :
   - « cumul »  : le temps déjà compté avant la dernière pause (en ms) ;
   - « depuis » : l'heure du dernier démarrage (ou null si en pause).
   Temps affiché = cumul + (maintenant − depuis).
   L'état est enregistré : le chronomètre continue même si l'application
   est fermée puis rouverte.
   ============================================================ */
'use strict';

const TOURS_MAX = 999;

const Chrono = {
  etat: { cumul: 0, depuis: null, tours: [] },   // tours : temps total au moment de chaque tour

  charger() {
    const e = Stockage.lire(CLES.chrono, null);
    if (e && typeof e === 'object') {
      this.etat.cumul = Number.isFinite(e.cumul) ? Math.max(0, e.cumul) : 0;
      this.etat.depuis = Number.isFinite(e.depuis) ? e.depuis : null;
      this.etat.tours = Array.isArray(e.tours) ? e.tours.filter(Number.isFinite).slice(-TOURS_MAX) : [];
    }
    if (this.enMarche()) Ecran.garder('chrono');
  },

  sauver() {
    Stockage.ecrire(CLES.chrono, this.etat);
  },

  enMarche() {
    return this.etat.depuis !== null;
  },

  /* Temps écoulé, en millisecondes */
  ecoule() {
    if (this.etat.depuis === null) return this.etat.cumul;
    return this.etat.cumul + Math.max(0, Date.now() - this.etat.depuis);
  },

  /* Le gros bouton : Démarrer / Pause / Reprendre */
  basculer() {
    if (this.enMarche()) this.pause();
    else this.demarrer();
  },

  demarrer() {
    Sons.deverrouiller();
    this.etat.depuis = Date.now();
    this.sauver();
    Ecran.garder('chrono');
    Horloge.verifier();
    this.afficher();
    annoncer('Chronomètre démarré');
  },

  pause() {
    this.etat.cumul = this.ecoule();
    this.etat.depuis = null;
    this.sauver();
    Ecran.liberer('chrono');
    Horloge.verifier();
    this.afficher();
    annoncer('Chronomètre en pause à ' + dureeEnMots(Math.floor(this.etat.cumul / 1000)));
  },

  tour() {
    if (!this.enMarche() || this.etat.tours.length >= TOURS_MAX) return;
    const total = this.ecoule();
    const precedent = this.etat.tours.length ? this.etat.tours[this.etat.tours.length - 1] : 0;
    this.etat.tours.push(total);
    this.sauver();
    this.afficher();
    annoncer('Tour ' + this.etat.tours.length + ' : ' + dureeEnMots(Math.round((total - precedent) / 1000)));
  },

  remiseAZero() {
    this.etat = { cumul: 0, depuis: null, tours: [] };
    this.sauver();
    Ecran.liberer('chrono');
    Horloge.verifier();
    this.afficher();
    annoncer('Chronomètre remis à zéro');
  },

  /* Petit texte pour la tuile de l'accueil */
  resume() {
    const t = this.ecoule();
    if (this.enMarche()) return 'En marche · ' + formaterChrono(t).slice(0, -2);
    if (t > 0) return 'En pause · ' + formaterChrono(t).slice(0, -2);
    return null;
  },

  /* Les chiffres seuls (appelé dix fois par seconde quand il tourne) */
  afficherTemps() {
    const t = this.ecoule();
    const texte = formaterChrono(t);
    const zone = $('#chrono-temps');
    ecrireTexte(zone, texte);
    zone.classList.toggle('long', texte.length > 7);
    const dernier = this.etat.tours.length ? this.etat.tours[this.etat.tours.length - 1] : 0;
    ecrireTexte($('#chrono-tour'), formaterChrono(t - dernier));
  },

  /* Tout l'écran : chiffres, boutons, liste des tours */
  afficher() {
    this.afficherTemps();
    const enMarche = this.enMarche();
    const t = this.ecoule();
    ecrireTexte($('#chrono-marche'), enMarche ? 'Pause' : (t > 0 ? 'Reprendre' : 'Démarrer'));
    $('#chrono-bouton-tour').disabled = !enMarche;
    const raz = $('#chrono-raz');
    raz.disabled = enMarche || t === 0;
    if (raz.disabled) desarmerBouton(raz);
    this.afficherTours();
  },

  afficherTours() {
    const liste = $('#chrono-tours');
    const tours = this.etat.tours;
    $('#chrono-titre-tours').hidden = tours.length === 0;
    if (liste.childElementCount === tours.length) return;   // rien de neuf
    liste.textContent = '';
    // Le plus récent en haut
    for (let i = tours.length - 1; i >= 0; i--) {
      const duree = tours[i] - (i > 0 ? tours[i - 1] : 0);
      const li = document.createElement('li');
      const num = document.createElement('span');
      num.className = 'tour-num';
      num.textContent = 'Tour ' + (i + 1);
      const d = document.createElement('span');
      d.className = 'tour-duree';
      d.textContent = formaterChrono(duree);
      const total = document.createElement('span');
      total.className = 'tour-total';
      total.textContent = 'total ' + formaterChrono(tours[i]);
      li.append(num, d, total);
      liste.appendChild(li);
    }
  }
};
