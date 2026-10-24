/* Omni-Time — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OMNI-TIME — minuteur.js
   Le minuteur simple : un compte à rebours réglable.

   La fin est calculée comme une HEURE D'ARRIVÉE (« finA ») :
   au démarrage, finA = maintenant + durée. Le temps restant est toujours
   finA − maintenant. Verrouiller le téléphone ou changer d'écran ne
   peut donc pas fausser le temps.

   Quatre états possibles :
   - 'arret'  : on règle la durée ;
   - 'marche' : le compte à rebours tourne ;
   - 'pause'  : arrêté en gardant le temps restant (« reste ») ;
   - 'fini'   : arrivé à zéro.
   ============================================================ */
'use strict';

const Minuteur = {
  etat: { duree: 180, statut: 'arret', finA: null, reste: 0, course: '' },
  champ: null,                 // le réglage [−] 03:00 [+]

  /* Début du nom des bips de ce lancement (voir sons.js) */
  prefixe() { return 'M' + this.etat.course + '-'; },

  /* Prépare l'écran (une seule fois, au lancement) */
  initialiser() {
    this.champ = creerChampDuree($('#minuteur-duree'));
    this.champ.surChangement((s) => {
      this.etat.duree = s;
      this.sauver();
      $('#minuteur-erreur').hidden = true;
    });
    // Les boutons « 30 s », « 1 min »… règlent la durée d'un coup
    $$('[data-secondes]').forEach((bouton) => {
      bouton.addEventListener('click', () => {
        this.etat.duree = Number(bouton.dataset.secondes);
        this.champ.ecrire(this.etat.duree);
        this.sauver();
        $('#minuteur-erreur').hidden = true;
      });
    });
  },

  charger() {
    const e = Stockage.lire(CLES.minuteur, null);
    if (e && typeof e === 'object') {
      this.etat.duree = entierBorne(e.duree, 1, DUREE_MAX, 180);
      this.etat.statut = ['arret', 'marche', 'pause', 'fini'].includes(e.statut) ? e.statut : 'arret';
      this.etat.finA = Number.isFinite(e.finA) ? e.finA : null;
      this.etat.reste = Number.isFinite(e.reste) ? Math.max(0, e.reste) : 0;
      this.etat.course = typeof e.course === 'string' ? e.course : '';
      if (this.etat.statut === 'marche' && this.etat.finA === null) this.etat.statut = 'arret';
      // Terminé pendant que l'application était fermée : pas de bip en retard
      if (this.etat.statut === 'marche' && this.etat.finA <= Date.now()) {
        this.etat.statut = 'fini';
        this.etat.finA = null;
      }
    }
    this.champ.ecrire(this.etat.duree);
    if (this.etat.statut === 'marche') Ecran.garder('minuteur');
  },

  sauver() {
    Stockage.ecrire(CLES.minuteur, this.etat);
  },

  /* Temps restant, en millisecondes */
  resteMs() {
    switch (this.etat.statut) {
      case 'marche': return Math.max(0, this.etat.finA - Date.now());
      case 'pause':  return this.etat.reste;
      case 'fini':   return 0;
      default:       return this.etat.duree * 1000;
    }
  },

  demarrer() {
    const duree = this.champ.lire();
    if (duree < 1) {
      const erreur = $('#minuteur-erreur');
      erreur.textContent = 'Choisis une durée d’au moins une seconde.';
      erreur.hidden = false;
      return;
    }
    Sons.deverrouiller();
    Sons.oublier('M');                  // plus rien d'un minuteur précédent
    this.etat.duree = duree;
    this.etat.statut = 'marche';
    this.etat.finA = Date.now() + duree * 1000;
    this.etat.course = nouvelId();      // nouveau lancement : de nouveaux noms de bips
    this.sauver();
    Ecran.garder('minuteur');
    Horloge.verifier();
    this.afficher();
    annoncer('Minuteur lancé : ' + dureeEnMots(duree));
  },

  /* Le gros bouton : Pause / Reprendre / Recommencer */
  basculer() {
    const e = this.etat;
    if (e.statut === 'marche') {
      e.reste = this.resteMs();
      e.statut = 'pause';
      e.finA = null;
      Sons.annuler(this.prefixe());     // les bips à venir n'ont plus lieu d'être
      Ecran.liberer('minuteur');
      annoncer('Minuteur en pause');
    } else if (e.statut === 'pause') {
      Sons.deverrouiller();
      e.finA = Date.now() + e.reste;
      e.statut = 'marche';
      Ecran.garder('minuteur');
      annoncer('Minuteur repris');
    } else if (e.statut === 'fini') {
      this.demarrer();
      return;
    }
    this.sauver();
    Horloge.verifier();
    this.afficher();
  },

  /* Retour à l'écran de réglage */
  arreter() {
    Sons.oublier('M');
    this.etat.statut = 'arret';
    this.etat.finA = null;
    this.etat.reste = 0;
    this.sauver();
    Ecran.liberer('minuteur');
    Horloge.verifier();
    this.afficher();
    annoncer('Minuteur arrêté');
  },

  /* Appelé dix fois par seconde tant que le minuteur tourne */
  tick() {
    if (this.etat.statut !== 'marche') return;
    const reste = this.resteMs();
    if (reste <= 0) {
      this.terminer();
      return;
    }
    // Bips courts à 3, 2, 1 seconde, bip long à zéro (programmés à l'avance)
    const fin = this.etat.finA;
    const debut = fin - this.etat.duree * 1000;
    Sons.programmerFinDePhase(this.prefixe(), debut, fin, this.prefixe() + 'fin');
    if (vueActive === 'minuteur') this.afficherTemps();
  },

  terminer() {
    const retard = Date.now() - this.etat.finA;
    // Bip long et vibration, sauf si la fin est passée depuis longtemps
    // (application mise en sommeil) : on ne sonne pas en retard.
    // Le bip est en principe déjà programmé (rien ne se passe alors).
    if (retard < RETARD_MAX.long) {
      Sons.programmer(this.prefixe() + 'fin', 'long', this.etat.finA);
      Sons.vibrer([300, 150, 300]);
    }
    this.etat.statut = 'fini';
    this.etat.finA = null;
    this.sauver();
    Ecran.liberer('minuteur');
    Horloge.verifier();
    annoncer('Minuteur terminé');
    this.afficher();
  },

  /* Petit texte pour la tuile de l'accueil */
  resume() {
    switch (this.etat.statut) {
      case 'marche': return 'En marche · ' + formaterDuree(Math.ceil(this.resteMs() / 1000));
      case 'pause':  return 'En pause · ' + formaterDuree(Math.ceil(this.resteMs() / 1000));
      case 'fini':   return 'Terminé';
      default:       return null;
    }
  },

  afficherTemps() {
    const reste = this.resteMs();
    const zone = $('#minuteur-temps');
    const texte = formaterDuree(Math.ceil(reste / 1000), true);
    ecrireTexte(zone, texte);
    zone.classList.toggle('long', texte.length > 5);
    const fraction = this.etat.duree > 0 ? reste / (this.etat.duree * 1000) : 0;
    $('#minuteur-progression').style.transform = 'scaleX(' + borner(fraction, 0, 1).toFixed(4) + ')';
  },

  afficher() {
    const statut = this.etat.statut;
    const reglage = statut === 'arret';
    $('#minuteur-reglage').hidden = !reglage;
    $('#minuteur-marche').hidden = reglage;
    if (reglage) return;

    const zone = $('#minuteur-marche');
    zone.dataset.phase = statut === 'fini' ? 'fini' : 'minuteur';
    zone.classList.toggle('en-pause', statut === 'pause');
    ecrireTexte($('#minuteur-etat'), { marche: 'En cours', pause: 'En pause', fini: 'Terminé' }[statut]);
    ecrireTexte($('#minuteur-pause'), { marche: 'Pause', pause: 'Reprendre', fini: 'Recommencer' }[statut]);
    const arreter = $('#minuteur-arreter');
    desarmerBouton(arreter);
    ecrireTexte(arreter, statut === 'fini' ? 'Changer la durée' : 'Arrêter');
    $('#minuteur-son').hidden = !(statut === 'marche' && reglages.bips && !Sons.pret());
    this.afficherTemps();
  }
};
