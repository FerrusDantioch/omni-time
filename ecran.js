/* Omni-Time — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OMNI-TIME — ecran.js
   Garder l'écran allumé (API « Wake Lock »).

   Pendant une séance, et tant que le chronomètre ou le minuteur tournent,
   on demande au téléphone de ne pas éteindre l'écran : on doit pouvoir
   lire les chiffres de loin sans le toucher.

   Plusieurs choses peuvent vouloir l'écran allumé en même temps (une
   séance ET le chronomètre…) : chacune donne une « raison ». L'écran
   est rendu au téléphone seulement quand il n'y a plus aucune raison.
   ============================================================ */
'use strict';

const Ecran = {
  raisons: new Set(),     // 'seance', 'chrono', 'minuteur'
  verrou: null,           // la permission accordée par le téléphone
  demandeEnCours: false,

  /* Le navigateur sait-il garder l'écran allumé ? */
  disponible() {
    return 'wakeLock' in navigator;
  },

  garder(raison) {
    this.raisons.add(raison);
    this.demander();
  },

  liberer(raison) {
    this.raisons.delete(raison);
    if (this.raisons.size === 0) this.rendre();
  },

  async demander() {
    if (!this.disponible() || this.verrou || this.demandeEnCours) return;
    // La demande n'est possible que si l'application est à l'écran
    if (document.visibilityState !== 'visible') return;
    this.demandeEnCours = true;
    try {
      const verrou = await navigator.wakeLock.request('screen');
      this.verrou = verrou;
      // Android rend la permission tout seul quand on quitte l'application
      verrou.addEventListener('release', () => {
        if (this.verrou === verrou) this.verrou = null;
      });
      // Tout a pu s'arrêter pendant la demande : on rend aussitôt
      if (this.raisons.size === 0) this.rendre();
    } catch (e) {
      /* Refus possible (économiseur de batterie…) : tout marche quand même,
         l'écran s'éteindra simplement comme d'habitude. */
    } finally {
      this.demandeEnCours = false;
    }
  },

  rendre() {
    if (this.verrou) {
      this.verrou.release().catch(() => {});
      this.verrou = null;
    }
  }
};

/* Au retour dans l'application, on redemande l'écran allumé si besoin
   (le téléphone l'a rendu automatiquement quand on est parti). */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Ecran.raisons.size > 0) Ecran.demander();
});
