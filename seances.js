/* Omni-Time — Copyright (c) 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OMNI-TIME — seances.js
   La liste des séances sur l'accueil (démarrer, modifier, dupliquer,
   supprimer) et l'écran de création / modification d'une séance.
   ============================================================ */
'use strict';

/* ---------- Liste des séances (accueil) ---------- */

const Seances = {

  /* Résumé d'une séance en une ligne :
     « Échauffement 5:00 · 12 rounds × 3:00 · repos 1:00 » */
  resume(s) {
    const morceaux = [];
    if (s.echauffement > 0) morceaux.push('Échauffement ' + formaterDuree(s.echauffement));
    morceaux.push(s.rounds + (s.rounds > 1 ? ' rounds × ' : ' round × ') + formaterDuree(s.travail));
    if (s.repos > 0 && s.rounds > 1) morceaux.push('repos ' + formaterDuree(s.repos));
    if (s.reposFinal > 0) morceaux.push('repos final ' + formaterDuree(s.reposFinal));
    return morceaux.join(' · ');
  },

  afficherListe() {
    const liste = $('#liste-seances');
    liste.textContent = '';
    $('#liste-vide').hidden = seances.length > 0;
    seances.forEach((s) => liste.appendChild(this.creerCarte(s)));
  },

  /* Fabrique la carte d'une séance. Le nom est écrit avec textContent :
     même si quelqu'un tape du code dans le nom, il s'affiche comme du
     simple texte, sans jamais s'exécuter. */
  creerCarte(s) {
    const li = document.createElement('li');
    li.className = 'carte seance';
    li.dataset.id = s.id;

    const titre = document.createElement('h3');
    titre.className = 'seance-nom';
    titre.textContent = s.nom;

    const resume = document.createElement('p');
    resume.className = 'seance-resume mono';
    resume.textContent = this.resume(s);

    const total = document.createElement('p');
    total.className = 'seance-total';
    total.append('Durée totale : ');
    const t = document.createElement('strong');
    t.className = 'mono';
    t.textContent = formaterDuree(dureeTotaleSeance(s));
    total.appendChild(t);

    const demarrer = this.creerBouton('Démarrer', 'demarrer', 'bouton bouton-principal enorme', s.nom);
    const rangee = document.createElement('div');
    rangee.className = 'rangee-3';
    rangee.append(
      this.creerBouton('Modifier', 'modifier', 'bouton', s.nom),
      this.creerBouton('Dupliquer', 'dupliquer', 'bouton', s.nom),
      this.creerBouton('Supprimer', 'supprimer', 'bouton', s.nom)
    );

    li.append(titre, resume, total, demarrer, rangee);
    return li;
  },

  creerBouton(texte, action, classes, nomSeance) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = classes;
    b.dataset.action = action;
    b.textContent = texte;
    // Pour les lecteurs d'écran : « Démarrer : Boxe »
    b.setAttribute('aria-label', texte + ' : ' + nomSeance);
    return b;
  },

  trouver(id) {
    return seances.find((s) => s.id === id) || null;
  },

  demarrer(id) {
    const s = this.trouver(id);
    if (s) Lecteur.demarrer(s);
  },

  dupliquer(id) {
    const index = seances.findIndex((s) => s.id === id);
    if (index < 0) return;
    const copie = nettoyerSeance(Object.assign({}, seances[index], {
      id: nouvelId(),
      nom: (seances[index].nom + ' (copie)').slice(0, 40)
    }));
    seances.splice(index + 1, 0, copie);   // la copie se range juste après l'original
    enregistrerSeances();
    this.afficherListe();
    annoncer('Séance dupliquée : ' + copie.nom);
  },

  supprimer(id) {
    const s = this.trouver(id);
    if (!s) return;
    seances = seances.filter((x) => x.id !== id);
    enregistrerSeances();
    this.afficherListe();
    annoncer('Séance supprimée : ' + s.nom);
    $('#titre-accueil').focus();
  },

  /* Remet les trois modèles dans la liste (en plus des séances existantes) */
  rajouterModeles() {
    MODELES.forEach((m) => seances.push(copieDeModele(m)));
    enregistrerSeances();
    annoncer('Modèles ajoutés à ta liste');
  },

  /* Accueil : le bandeau « séance en cours » et l'état des tuiles */
  majAccueil() {
    const bandeau = $('#bandeau-seance');
    if (Lecteur.etat) {
      bandeau.hidden = false;
      ecrireTexte($('#bandeau-titre'), Lecteur.etat.termine ? 'Séance terminée' : 'Séance en cours');
      ecrireTexte($('#bandeau-nom'), Lecteur.etat.seance.nom);
      ecrireTexte($('#bandeau-detail'), Lecteur.resume());
    } else {
      bandeau.hidden = true;
    }

    const etatChrono = Chrono.resume();
    $('#tuile-chrono').classList.toggle('active', !!etatChrono);
    ecrireTexte($('#etat-chrono'), etatChrono || 'Démarrer, pause, tours');

    const etatMinuteur = Minuteur.resume();
    $('#tuile-minuteur').classList.toggle('active', !!etatMinuteur);
    ecrireTexte($('#etat-minuteur'), etatMinuteur || 'Compte à rebours');
  }
};


/* ---------- Écran de création / modification ---------- */

/* Valeurs proposées pour une séance toute neuve */
const NOUVELLE_SEANCE = { nom: '', echauffement: 0, rounds: 5, travail: 60, repos: 30, reposFinal: 0 };

const Editeur = {
  ouvert: false,     // vrai tant que l'écran d'édition est utilisé
  idEnCours: null,   // null = nouvelle séance
  champs: {},        // les réglages de durée, rangés par nom

  /* Prépare l'écran (une seule fois, au lancement) */
  initialiser() {
    $$('[data-champ]').forEach((conteneur) => {
      const champ = creerChampDuree(conteneur);
      champ.surChangement(() => this.majTotal());
      this.champs[conteneur.dataset.champ] = champ;
    });

    // Nombre de rounds : [−] 12 [+]
    const champRounds = $('#seance-rounds-champ');
    champRounds.addEventListener('input', () => {
      const propre = champRounds.value.replace(/\D/g, '').slice(0, 2);
      if (propre !== champRounds.value) champRounds.value = propre;
      this.majTotal();
    });
    champRounds.addEventListener('blur', () => { this.ecrireRounds(this.lireRounds()); this.majTotal(); });
    champRounds.addEventListener('focus', () => champRounds.select());
    $$('[data-rounds]').forEach((bouton) => {
      brancherAppuiLong(bouton, () => {
        this.ecrireRounds(this.lireRounds() + Number(bouton.dataset.rounds));
        this.majTotal();
      });
    });

    // Boutons « Partir d'un modèle »
    $$('[data-modele]').forEach((bouton) => {
      const modele = MODELES[Number(bouton.dataset.modele)];
      bouton.setAttribute('aria-label', 'Partir du modèle ' + modele.nom);
      bouton.addEventListener('click', () => {
        this.remplir(modele);
        annoncer('Modèle ' + modele.nom + ' chargé');
      });
    });

    $('#seance-nom').addEventListener('input', () => { $('#edition-erreur').hidden = true; });
    $('#form-seance').addEventListener('submit', (e) => {
      e.preventDefault();      // sinon le navigateur rechargerait la page
      this.enregistrer();
    });
  },

  lireRounds() {
    return borner(parseInt($('#seance-rounds-champ').value, 10) || 1, 1, ROUNDS_MAX);
  },

  ecrireRounds(n) {
    $('#seance-rounds-champ').value = String(borner(n, 1, ROUNDS_MAX));
  },

  /* id = identifiant de la séance à modifier, ou null pour en créer une */
  ouvrir(id) {
    const existante = id ? Seances.trouver(id) : null;
    this.idEnCours = existante ? existante.id : null;
    this.ouvert = true;
    this.remplir(existante || NOUVELLE_SEANCE);
    ecrireTexte($('#edition-titre'), existante ? 'Modifier la séance' : 'Nouvelle séance');
    $('#edition-modeles').hidden = !!existante;
    $('#edition-erreur').hidden = true;
    allerA('edition');
  },

  fermer() {
    this.ouvert = false;
    this.idEnCours = null;
  },

  remplir(s) {
    $('#seance-nom').value = s.nom;
    this.champs.echauffement.ecrire(s.echauffement);
    this.ecrireRounds(s.rounds);
    this.champs.travail.ecrire(s.travail);
    this.champs.repos.ecrire(s.repos);
    this.champs.reposFinal.ecrire(s.reposFinal);
    this.majTotal();
  },

  lire() {
    return {
      nom: $('#seance-nom').value.trim(),
      echauffement: this.champs.echauffement.lire(),
      rounds: this.lireRounds(),
      travail: this.champs.travail.lire(),
      repos: this.champs.repos.lire(),
      reposFinal: this.champs.reposFinal.lire()
    };
  },

  majTotal() {
    ecrireTexte($('#edition-total'), formaterDuree(dureeTotaleSeance(this.lire())));
  },

  enregistrer() {
    const donnees = this.lire();
    if (!donnees.nom) donnees.nom = 'Ma séance';
    if (donnees.travail < 1) {
      const erreur = $('#edition-erreur');
      erreur.textContent = 'La durée de travail doit être d’au moins une seconde.';
      erreur.hidden = false;
      return;
    }
    if (this.idEnCours) {
      const index = seances.findIndex((s) => s.id === this.idEnCours);
      if (index >= 0) seances[index] = nettoyerSeance(Object.assign({ id: this.idEnCours }, donnees));
    } else {
      seances.push(nettoyerSeance(Object.assign({ id: nouvelId() }, donnees)));
    }
    if (!enregistrerSeances()) {
      const erreur = $('#edition-erreur');
      erreur.textContent = 'Impossible d’enregistrer sur ce téléphone (mémoire pleine ou navigation privée).';
      erreur.hidden = false;
      return;
    }
    annoncer('Séance enregistrée : ' + donnees.nom);
    this.fermer();
    revenir();
  }
};
