/* Omni-Time — Copyright (c) 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OMNI-TIME — sons.js
   Les bips et les vibrations.

   Les bips sont fabriqués par le navigateur lui-même (« API Web Audio ») :
   aucun fichier son n'est utilisé. Deux sortes de bips, et rien d'autre
   (aucune voix) :
   - bip court : quand il reste 3, 2 puis 1 seconde ;
   - bip long  : à chaque changement de phase.

   BIPS PROGRAMMÉS À L'AVANCE
   Plutôt que de faire « bip » au moment où l'on s'aperçoit que l'heure
   est passée (ce qui peut arriver avec un peu de retard si le téléphone
   ralentit l'application), on confie chaque bip à l'horloge du son,
   une ou deux secondes avant qu'il doive sonner. Cette horloge est
   précise au millième de seconde, et elle continue de sonner à l'heure
   même si l'application est ralentie entre-temps.
   Chaque bip porte un nom unique (sa « clé ») : il n'est donc jamais
   programmé deux fois. En cas de pause, de passage à la phase suivante
   ou d'arrêt, les bips qui n'ont pas encore sonné sont annulés.

   Règle des navigateurs : aucun son ni vibration tant que la personne
   n'a pas touché l'écran. Le son est donc « réveillé » par le bouton
   Démarrer (et, par sécurité, par n'importe quel appui sur l'écran).
   ============================================================ */
'use strict';

/* Combien de temps à l'avance on programme un bip (en millisecondes).
   Quand l'application passe à l'arrière-plan, le navigateur ne la
   réveille plus qu'une fois par seconde : 2 secondes d'avance suffisent
   pour qu'aucun bip ne soit manqué. */
const AVANCE_BIPS = 2000;

/* Au-delà de ce retard, un bip n'est plus joué : mieux vaut le silence
   qu'une rafale de bips en retard quand le téléphone se réveille. */
const RETARD_MAX = { court: 500, long: 1500 };

const Sons = {
  contexte: null,     // le « moteur audio » du navigateur, créé au premier appui
  prevus: [],         // bips programmés : { cle, enveloppe, debut, fin }
  cles: new Set(),    // clés des bips déjà programmés (joués ou à venir)

  /* Crée le moteur audio, ou le réveille s'il dort. À appeler pendant
     un appui de la personne : c'est la seule façon d'en avoir le droit. */
  deverrouiller() {
    try {
      if (!this.contexte) {
        const MoteurAudio = window.AudioContext || window.webkitAudioContext;
        if (!MoteurAudio) return;        // navigateur trop ancien : pas de son
        this.contexte = new MoteurAudio();
      }
      if (this.contexte.state === 'suspended') this.contexte.resume().catch(() => {});
    } catch (e) {
      /* Pas de son possible : l'application marche quand même. */
    }
  },

  /* Vrai si le son est prêt à sortir */
  pret() {
    return !!this.contexte && this.contexte.state === 'running';
  },

  /* Le curseur de volume va de 0 à 100. L'oreille n'entend pas le volume
     de façon régulière : on l'élève au carré, pour que le milieu du curseur
     sonne vraiment « à moitié ». 0,8 au maximum : jamais de bip agressif. */
  intensite() {
    const v = reglages.volume / 100;
    return v * v * 0.8;
  },

  /* Fabrique un bip qui sonnera à l'instant « quand » de l'horloge du son
     (en secondes). Renvoie de quoi l'annuler, ou null si le volume est à 0. */
  fabriquer(type, quand) {
    const ctx = this.contexte;
    const force = this.intensite();
    if (!ctx || force <= 0) return null;

    const long = type === 'long';
    const duree = long ? 0.6 : 0.12;          // en secondes

    // Un « oscillateur » produit un son pur (onde sinusoïdale : la plus douce)
    const oscillateur = ctx.createOscillator();
    oscillateur.type = 'sine';
    oscillateur.frequency.value = long ? 660 : 880;   // le bip long est plus grave

    // L'« enveloppe » fait monter et descendre le volume en douceur :
    // sans elle, le son claquerait au début et à la fin.
    const enveloppe = ctx.createGain();
    enveloppe.gain.setValueAtTime(0.0001, quand);
    enveloppe.gain.exponentialRampToValueAtTime(force, quand + 0.015);
    enveloppe.gain.setValueAtTime(force, quand + duree - 0.05);
    enveloppe.gain.exponentialRampToValueAtTime(0.0001, quand + duree);

    oscillateur.connect(enveloppe);
    enveloppe.connect(ctx.destination);
    oscillateur.start(quand);
    oscillateur.stop(quand + duree + 0.02);
    return { enveloppe, debut: quand, fin: quand + duree + 0.02 };
  },

  /* Joue un bip tout de suite. type = 'court' ou 'long'.
     forcer = true : joue même si les bips sont coupés (bouton « Écouter »). */
  bip(type, forcer) {
    if (!forcer && !reglages.bips) return;
    const ctx = this.contexte;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    this.fabriquer(type, ctx.currentTime + 0.01);
  },

  /* Programme un bip pour une heure précise.
     - cle   : nom unique du bip (par exemple « S-abc-3-c2 ») ;
     - type  : 'court' ou 'long' ;
     - heure : l'heure réelle où il doit sonner, en millisecondes
               (la même échelle que Date.now()).
     Si ce bip a déjà été programmé, rien ne se passe. */
  programmer(cle, type, heure) {
    if (!reglages.bips || this.cles.has(cle)) return;
    const ctx = this.contexte;
    // Son pas encore autorisé (aucun appui depuis l'ouverture) : on
    // réessaiera au prochain passage de l'horloge.
    if (!ctx || ctx.state !== 'running') return;

    this.cles.add(cle);
    const dans = heure - Date.now();          // négatif : l'heure est déjà passée
    if (-dans > RETARD_MAX[type]) return;     // trop tard : on ne rattrape pas

    const bip = this.fabriquer(type, ctx.currentTime + Math.max(0, dans) / 1000);
    if (bip) {
      bip.cle = cle;
      this.prevus.push(bip);
    }
    // On oublie les bips qui ont fini de sonner
    this.prevus = this.prevus.filter((b) => b.fin > ctx.currentTime);
  },

  /* Programme les bips de la fin d'une phase (appelé dix fois par seconde ;
     chaque bip n'est programmé qu'une fois, quand son heure approche) :
     - bips courts quand il reste 3, 2 puis 1 seconde ;
     - bip long à la fin, sous la clé cleFin (c'est aussi le bip du début
       de la phase suivante : une seule clé, donc jamais deux bips).
     debut et fin : heures réelles du début et de la fin de la phase.
     Aucun bip court pendant les 0,4 premières secondes d'une phase : il
     se mêlerait au bip long qui vient de l'ouvrir. */
  programmerFinDePhase(base, debut, fin, cleFin) {
    const maintenant = Date.now();
    [3, 2, 1].forEach((s) => {
      const heure = fin - s * 1000;
      if (heure - maintenant > AVANCE_BIPS) return;   // trop tôt : on verra plus tard
      if (heure - debut < 400) return;
      this.programmer(base + 'c' + s, 'court', heure);
    });
    if (fin - maintenant <= AVANCE_BIPS) this.programmer(cleFin, 'long', fin);
  },

  /* Annule les bips programmés qui n'ont pas encore commencé à sonner
     (pause, passage à la phase suivante…). prefixe : seulement ceux dont
     la clé commence ainsi ('S' : séance, 'M' : minuteur, '' : tous).
     Leurs clés sont libérées : ils pourront être reprogrammés plus tard,
     à leur nouvelle heure. Un bip déjà en train de sonner finit son son. */
  annuler(prefixe) {
    const ctx = this.contexte;
    if (!ctx) return;
    const maintenant = ctx.currentTime;
    this.prevus = this.prevus.filter((b) => {
      if (!b.cle.startsWith(prefixe) || b.debut <= maintenant + 0.005) return true;
      try { b.enveloppe.disconnect(); } catch (e) { /* déjà débranché */ }
      this.cles.delete(b.cle);
      return false;
    });
  },

  /* Une séance ou un minuteur est terminé : on annule ses bips à venir et
     on oublie toutes ses clés (celles des bips déjà joués comprises). */
  oublier(prefixe) {
    this.annuler(prefixe);
    Array.from(this.cles).forEach((cle) => {
      if (cle.startsWith(prefixe)) this.cles.delete(cle);
    });
  },

  /* Le téléphone sait-il vibrer depuis une page web ? */
  vibrationsPossibles() {
    return typeof navigator.vibrate === 'function';
  },

  /* Fait vibrer. motif = durée en ms, ou liste [vibre, pause, vibre…].
     forcer = true : vibre même si l'option est coupée (bouton « Tester »). */
  vibrer(motif, forcer) {
    if (!forcer && !reglages.vibrations) return;
    if (!this.vibrationsPossibles()) return;
    try { navigator.vibrate(motif); } catch (e) { /* refus du navigateur : tant pis */ }
  }
};

/* Au moindre appui sur l'écran, on réveille le son (utile si l'application
   a été rouverte pendant une séance : il faut un appui pour en avoir le droit). */
document.addEventListener('pointerup', () => Sons.deverrouiller(), { passive: true });
document.addEventListener('keydown', () => Sons.deverrouiller());
