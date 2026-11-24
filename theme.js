/* Omni-Time — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */
'use strict';

/* Pose le thème choisi AVANT le premier affichage : sans cela, l'écran
   s'allumerait une fraction de seconde avec les couleurs par défaut
   (un éclair clair, désagréable dans le noir). app.js refait la même
   chose ensuite. */
(function () {
  var t = 'omni';
  try {
    var texte = localStorage.getItem('omnitime_reglages');
    if (texte) {
      var r = JSON.parse(texte);
      if (r && typeof r === 'object' && (r.theme === 'omni' || r.theme === 'sombre' || r.theme === 'clair')) {
        t = r.theme;
      }
    }
  } catch (e) { /* rien d'enregistré, JSON invalide ou stockage refusé : thème par défaut */ }
  document.documentElement.dataset.theme = t;
})();
