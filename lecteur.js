/* Omni-Time — Copyright (c) 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OMNI-TIME — lecteur.js
   La séance en cours : très gros chiffres, phase, round, pause,
   passage à la phase suivante, arrêt, écran de fin.

   Même principe que le chronomètre : on retient le temps déjà écoulé
   (« cumul ») et l'heure du dernier départ (« depuis »). À chaque
   instant, positionDans() (fichier intervalles.js) en déduit la phase
   en cours et le temps qu'il y reste. Rien n'est jamais « décompté ».

   L'état est enregistré dans le téléphone : si Android ferme
   l'application en pleine séance, elle reprend au bon endroit.
   ============================================================ */
'use strict';

const Lecteur = {
  /* null quand aucune séance n'est lancée. Sinon :
     { seance, phases, cumul, depuis, termine, course }
     « course » est un identifiant propre à ce lancement : il sert à
     nommer les bips (voir sons.js) pour ne jamais les mélanger avec
     ceux d'un lancement précédent. */
  etat: null,
  indexAffiche: -1,             // la phase affichée au dernier passage

  /* Au lancement de l'application : reprend une séance interrompue */
  charger() {
    const e = Stockage.lire(CLES.lecteur, null);
    if (!e || typeof e !== 'object') return;
    const seance = nettoyerSeance(e.seance);
    if (!seance) return;
    this.etat = {
      seance: seance,
      phases: construirePhases(seance),
      cumul: Number.isFinite(e.cumul) ? Math.max(0, e.cumul) : 0,
      depuis: Number.isFinite(e.depuis) ? e.depuis : null,
      termine: e.termine === true,
      course: typeof e.course === 'string' ? e.course : nouvelId()
    };
    // Les changements de phase survenus pendant que l'application était
    // fermée ne font ni biper ni vibrer : on note simplement où l'on en est.
    const pos = positionDans(this.etat.phases, this.ecoule());
    this.indexAffiche = pos.index;
    if (pos.termine && !this.etat.termine) {
      this.etat.termine = true;
      this.etat.cumul = pos.totalMs;
      this.etat.depuis = null;
      this.sauver();
    }
    if (this.actif()) Ecran.garder('seance');
  },

  sauver() {
    if (!this.etat) {
      Stockage.effacer(CLES.lecteur);
      return;
    }
    const e = this.etat;
    Stockage.ecrire(CLES.lecteur, {
      seance: e.seance, cumul: e.cumul, depuis: e.depuis, termine: e.termine, course: e.course
    });
  },

  /* Une séance est lancée et pas encore finie */
  actif()    { return !!this.etat && !this.etat.termine; },
  enPause()  { return this.actif() && this.etat.depuis === null; },
  enMarche() { return this.actif() && this.etat.depuis !== null; },

  /* Début du nom des bips de ce lancement (voir sons.js) */
  prefixe()  { return 'S' + (this.etat ? this.etat.course : '') + '-'; },

  /* Temps écoulé depuis le début de la séance (sans les pauses), en ms.
     On utilise Date.now() (l'heure réelle) plutôt que performance.now() :
     sur Android, performance.now() peut s'arrêter pendant que le téléphone
     dort, alors que l'heure réelle, elle, continue toujours d'avancer. */
  ecoule() {
    const e = this.etat;
    if (!e) return 0;
    if (e.depuis === null) return e.cumul;
    return e.cumul + Math.max(0, Date.now() - e.depuis);
  },

  dureeTotaleMs() {
    return this.etat ? dureeTotaleSeance(this.etat.seance) * 1000 : 0;
  },

  /* Lance une séance. Appelé par le bouton « Démarrer » : c'est cet appui
     qui donne au navigateur le droit de faire biper et vibrer. */
  demarrer(seance) {
    this.lancer(seance);
    allerA('seance');
  },

  lancer(seance) {
    Sons.deverrouiller();
    Sons.oublier('S');                      // plus rien d'une séance précédente
    const copie = nettoyerSeance(seance);   // une copie : modifier la séance pendant qu'elle tourne ne la change pas
    this.etat = {
      seance: copie,
      phases: construirePhases(copie),
      cumul: 0,
      depuis: Date.now(),
      termine: false,
      course: nouvelId()
    };
    this.indexAffiche = -1;
    desarmerBouton($('#lecteur-passer'));
    this.sauver();
    Ecran.garder('seance');
    this.tick();                            // bip long du départ
    Horloge.verifier();
  },

  /* Le gros bouton : Pause / Reprendre */
  basculerPause() {
    const e = this.etat;
    if (!this.actif()) return;
    if (e.depuis !== null) {
      e.cumul = this.ecoule();
      e.depuis = null;
      Sons.annuler(this.prefixe());         // les bips à venir n'ont plus lieu d'être
      annoncer('Pause');
    } else {
      Sons.deverrouiller();
      e.depuis = Date.now();
      annoncer('Reprise');
    }
    this.sauver();
    Horloge.verifier();
    this.tick();
    this.afficher();
  },

  /* Vrai si « Passer » mettrait fin à la séance (dernière phase) */
  passerTermine() {
    if (!this.actif()) return false;
    const pos = positionDans(this.etat.phases, this.ecoule());
    return !pos.termine && pos.index === this.etat.phases.length - 1;
  },

  /* « Passer » : termine tout de suite la phase en cours.
     De l'échauffement, on passe au round 1 ; du travail, au repos ;
     du repos, au round suivant. */
  passer() {
    if (!this.actif()) return;
    const e = this.etat;
    const pos = positionDans(e.phases, this.ecoule());
    if (pos.termine) return;
    Sons.annuler(this.prefixe());           // les bips prévus pour la phase sautée
    e.cumul = pos.finMs;
    if (e.depuis !== null) e.depuis = Date.now();
    this.sauver();
    this.tick();
  },

  arreter() {
    Sons.oublier('S');
    this.etat = null;
    this.sauver();
    Ecran.liberer('seance');
    Horloge.verifier();
    annoncer('Séance arrêtée');
    revenir();
  },

  recommencer() {
    if (!this.etat) return;
    this.lancer(this.etat.seance);
    this.afficher();
    $('#lecteur-nom').focus();
  },

  /* Écran de fin → retour à l'accueil */
  fermer() {
    Sons.oublier('S');
    this.etat = null;
    this.sauver();
    revenir();
  },

  /* Fin de la séance. retardMs : depuis combien de temps elle est finie
     (presque 0 en temps normal ; beaucoup plus si l'application dormait,
     et dans ce cas on ne sonne pas en retard). */
  terminer(retardMs) {
    const e = this.etat;
    const sonner = retardMs < RETARD_MAX.long;
    // Bip long de la fin : déjà programmé à l'avance en temps normal
    // (rien ne se passe alors), joué ici si on a sauté la dernière phase.
    if (sonner) Sons.programmer(this.prefixe() + 'p' + e.phases.length, 'long', Date.now() - retardMs);
    e.termine = true;
    e.cumul = this.dureeTotaleMs();
    e.depuis = null;
    this.sauver();
    Ecran.liberer('seance');
    Horloge.verifier();
    if (sonner) Sons.vibrer([400, 150, 400]);
    annoncer('Séance terminée');
    if (vueActive === 'seance') {
      this.afficher();
      $('#lecteur-nom').focus();
    }
  },

  /* Appelé dix fois par seconde pendant la séance (même si l'on regarde
     un autre écran : les bips doivent continuer). */
  tick() {
    const e = this.etat;
    if (!e || e.termine) return;
    const ecoule = this.ecoule();
    const pos = positionDans(e.phases, ecoule);

    if (pos.termine) {
      this.terminer(ecoule - pos.totalMs);
      return;
    }

    // Bips : celui du début de la phase en cours (s'il n'a pas déjà
    // sonné), puis ceux de sa fin, quand leur heure approche.
    if (this.enMarche()) {
      const maintenant = Date.now();
      const debut = maintenant - pos.dansPhaseMs;
      const fin = maintenant + pos.resteMs;
      const base = this.prefixe() + 'p';
      Sons.programmer(base + pos.index, 'long', debut);
      Sons.programmerFinDePhase(base + pos.index + '-', debut, fin, base + (pos.index + 1));
    }

    // Changement de phase : vibration, et annonce pour les lecteurs d'écran
    if (pos.index !== this.indexAffiche) {
      if (this.enMarche() && pos.dansPhaseMs < RETARD_MAX.long) Sons.vibrer(400);
      this.indexAffiche = pos.index;
      annoncer(this.textePhase(pos.index) + ', ' + dureeEnMots(e.phases[pos.index].duree));
    }

    if (vueActive === 'seance') this.afficher(pos);
  },

  /* « Travail, round 3 sur 12 » (pour les lecteurs d'écran) */
  textePhase(index) {
    const p = this.etat.phases[index];
    if (p.type === 'travail') return 'Travail, round ' + p.round + ' sur ' + this.etat.seance.rounds;
    return nomPhase(p.type);
  },

  /* Ligne « Round 3 / 12 » sous le nom de la phase */
  texteRound(phase) {
    const total = this.etat.seance.rounds;
    if (phase.type === 'echauffement') return total + (total > 1 ? ' rounds ensuite' : ' round ensuite');
    if (phase.type === 'travail') return 'Round ' + phase.round + ' / ' + total;
    return 'Après le round ' + phase.round + ' / ' + total;
  },

  /* Ligne « Ensuite : … » */
  texteEnsuite(index) {
    const suivante = this.etat.phases[index + 1];
    if (!suivante) return { libelle: 'Fin de la séance', duree: '' };
    const libelle = suivante.type === 'travail' ? 'Round ' + suivante.round : nomPhase(suivante.type);
    return { libelle: libelle, duree: formaterDuree(suivante.duree) };
  },

  /* Le bouton « Passer » dit exactement où il mène */
  texteBoutonPasser(index) {
    const suivante = this.etat.phases[index + 1];
    if (!suivante) return 'Terminer la séance';
    if (suivante.type === 'travail') return 'Passer au round ' + suivante.round;
    if (suivante.type === 'repos') return 'Passer au repos';
    return 'Passer au repos final';
  },

  /* Petit résumé pour le bandeau de l'accueil */
  resume() {
    const e = this.etat;
    if (!e) return '';
    if (e.termine) return 'Durée ' + formaterDuree(this.dureeTotaleMs() / 1000);
    const pos = positionDans(e.phases, this.ecoule());
    if (pos.termine) return '';
    const p = e.phases[pos.index];
    const morceaux = [nomPhase(p.type)];
    if (p.type !== 'echauffement') morceaux.push('round ' + p.round + '/' + e.seance.rounds);
    morceaux.push(formaterDuree(Math.ceil(pos.resteMs / 1000), true));
    if (this.enPause()) morceaux.push('en pause');
    return morceaux.join(' · ');
  },

  afficher(pos) {
    const e = this.etat;
    if (!e) return;
    ecrireTexte($('#lecteur-nom'), e.seance.nom);
    $('#lecteur-actif').hidden = e.termine;
    $('#lecteur-fin').hidden = !e.termine;

    if (e.termine) {
      const r = e.seance.rounds;
      ecrireTexte($('#fin-resume'), r + (r > 1 ? ' rounds' : ' round') + ' · ' + formaterDuree(this.dureeTotaleMs() / 1000));
      return;
    }

    pos = pos || positionDans(e.phases, this.ecoule());
    if (pos.termine) return;
    const phase = e.phases[pos.index];
    const zone = $('#lecteur-actif');
    const enPause = this.enPause();

    if (zone.dataset.phase !== phase.type) zone.dataset.phase = phase.type;
    zone.classList.toggle('en-pause', enPause);
    $('#lecteur-badge-pause').hidden = !enPause;
    ecrireTexte($('#lecteur-phase'), nomPhase(phase.type));
    ecrireTexte($('#lecteur-round'), this.texteRound(phase));

    const temps = $('#lecteur-temps');
    const texteTemps = formaterDuree(Math.ceil(pos.resteMs / 1000), true);
    ecrireTexte(temps, texteTemps);
    temps.classList.toggle('long', texteTemps.length > 5);

    // La barre se vide au fil de la phase
    const fraction = pos.resteMs / (phase.duree * 1000);
    $('#lecteur-progression').style.transform = 'scaleX(' + borner(fraction, 0, 1).toFixed(4) + ')';

    const ensuite = this.texteEnsuite(pos.index);
    const ligne = $('#lecteur-ensuite');
    const texteEnsuite = 'Ensuite : ' + ensuite.libelle + (ensuite.duree ? ' · ' + ensuite.duree : '');
    if (ligne.textContent !== texteEnsuite) {
      ligne.textContent = 'Ensuite : ';
      const fort = document.createElement('strong');
      fort.textContent = ensuite.libelle;
      ligne.appendChild(fort);
      if (ensuite.duree) ligne.append(' · ' + ensuite.duree);
    }

    // Bouton « Passer » : son texte suit la phase. S'il était « armé »
    // (« Terminer la séance » demande deux appuis) et que la phase a
    // changé entre-temps, on le désarme d'abord.
    const passer = $('#lecteur-passer');
    const textePasser = this.texteBoutonPasser(pos.index);
    if (passer.classList.contains('arme') && passer.dataset.texteOriginal !== textePasser) desarmerBouton(passer);
    if (!passer.classList.contains('arme')) ecrireTexte(passer, textePasser);

    const resteTotal = this.dureeTotaleMs() - this.ecoule();
    ecrireTexte($('#lecteur-reste'), formaterDuree(Math.ceil(resteTotal / 1000)));
    ecrireTexte($('#lecteur-pause'), enPause ? 'Reprendre' : 'Pause');
    $('#lecteur-son').hidden = !(reglages.bips && !Sons.pret());
  }
};
