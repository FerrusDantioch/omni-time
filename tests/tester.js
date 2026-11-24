/* Omni-Time — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   Tests automatiques d'Omni-Time.
   Ils ouvrent l'application dans un vrai navigateur (Chromium, piloté
   par Playwright). Pour ne pas attendre de vraies minutes, le test fait
   « avancer l'horloge » du navigateur : une minute passe en un instant.
   Rien n'est envoyé sur internet.

   Lancer (Playwright doit être installé) :  node tests/tester.js
   ============================================================ */
'use strict';
const fs = require('fs');
const { lancer, section, verifier, nouvellePage, controlesCommuns, adresse } = require('./outils.js');

const texte = (p, sel) => p.$eval(sel, (el) => el.textContent.replace(/\s+/g, ' ').trim());
const estCache = (p, sel) => p.$eval(sel, (el) => el.hidden);
async function aller(p, sel) { await p.click(sel); await p.waitForTimeout(500); }

lancer('Omni-Time', async () => {
  await controlesCommuns({ serviceWorker: 'sw.js' });

  /* ---------- 1. Base & horloge simulée ---------- */
  const { ctx, p } = await nouvellePage();
  await p.waitForTimeout(800);

  await section('Calcul d’une séance (intervalles.js)', async () => {
    const r = await p.evaluate(() => {
      const s = { echauffement: 10, rounds: 3, travail: 60, repos: 30, reposFinal: 20 };
      const phases = construirePhases(s);
      return {
        types: phases.map((x) => x.type).join(','),
        total: dureeTotaleSeance(s),
        a75: positionDans(phases, 75000),
        fin: positionDans(phases, 270000).termine,
        sansRepos: construirePhases({ echauffement: 0, rounds: 2, travail: 20, repos: 0, reposFinal: 0 }).length
      };
    });
    verifier(r.types === 'echauffement,travail,repos,travail,repos,travail,reposFinal', 'phases dans l’ordre, pas de repos après le dernier round', r.types);
    verifier(r.total === 270, 'durée totale : 4 min 30 s', r.total);
    verifier(r.a75.index === 2 && r.a75.resteMs === 25000, 'à 1 min 15 s : premier repos, reste 25 s', r.a75);
    verifier(r.fin, 'à 4 min 30 s : séance terminée');
    verifier(r.sansRepos === 2, 'sans échauffement ni repos : 2 phases seulement', r.sansRepos);
  });

  // À partir d'ici, l'horloge du navigateur est entre les mains du test.
  await p.clock.install();

  await section('Chronomètre et tours', async () => {
    await aller(p, '#tuile-chrono');
    verifier(await p.$eval('#chrono-bouton-tour', (b) => b.disabled), 'à l’arrêt, le bouton Tour est désactivé');
    verifier(await estCache(p, '#chrono-titre-tours'), 'sans tour, la liste des tours est cachée');

    await p.click('#chrono-marche');
    await p.clock.runFor(12500);
    await p.click('#chrono-bouton-tour');
    verifier(!(await estCache(p, '#chrono-titre-tours')), 'après le 1er tour, le titre Tours apparaît');
    verifier((await p.$$('#chrono-tours li')).length === 1, '1 tour enregistré');
    verifier((await texte(p, '#chrono-tours li:first-child .tour-duree')) === '00:12,5', 'Tour 1 : 00:12,5', await texte(p, '#chrono-tours li:first-child .tour-duree'));

    await p.clock.runFor(7500);
    await p.click('#chrono-bouton-tour');
    verifier((await p.$$('#chrono-tours li')).length === 2, '2 tours enregistrés');
    verifier((await texte(p, '#chrono-tours li:first-child .tour-num')) === 'Tour 2', 'le plus récent (Tour 2) est en haut');
    verifier((await texte(p, '#chrono-tours li:first-child .tour-duree')) === '00:07,5', 'Tour 2 : 00:07,5', await texte(p, '#chrono-tours li:first-child .tour-duree'));
    verifier((await texte(p, '#chrono-tours li:first-child .tour-total')) === 'total 00:20,0', 'total Tour 2 : 00:20,0', await texte(p, '#chrono-tours li:first-child .tour-total'));

    await p.clock.runFor(45000);
    const t = await texte(p, '#chrono-temps');
    verifier(t.startsWith('01:05'), 'après 65 s : 01:05', t);
    await p.click('#chrono-marche');                 // pause
    verifier(await p.$eval('#chrono-bouton-tour', (b) => b.disabled), 'en pause, Tour est désactivé');
    await p.clock.runFor(30000);
    verifier((await texte(p, '#chrono-temps')).startsWith('01:05'), 'en pause, le temps ne bouge plus');

    // Vérifie afficherTours() quand les valeurs changent à longueur égale
    await p.evaluate(() => {
      Chrono.etat.tours = [10000, 25000];
      Chrono.afficherTours();
    });
    verifier((await texte(p, '#chrono-tours li:first-child .tour-total')) === 'total 00:25,0', 'afficherTours() met à jour même si la longueur est identique');

    await p.click('#chrono-raz');                    // 1er appui : armé
    verifier((await texte(p, '#chrono-temps')).startsWith('01:05'), 'remise à zéro : un seul appui ne suffit pas');
    await p.click('#chrono-raz');                    // 2e appui : confirmé
    verifier((await texte(p, '#chrono-temps')).startsWith('00:00'), 'deux appuis : remis à zéro', await texte(p, '#chrono-temps'));
    verifier((await p.$$('#chrono-tours li')).length === 0 && (await estCache(p, '#chrono-titre-tours')), 'la remise à zéro efface les tours');
    await p.goBack().catch(() => {});
    await p.waitForTimeout(300);
  });

  await section('Minuteur', async () => {
    await p.goto(p.url().split('#')[0]);
    await p.clock.install().catch(() => {});
    await aller(p, '#tuile-minuteur');
    await p.click('[data-secondes="30"]');
    await p.click('[data-action="minuteur-demarrer"]');
    await p.clock.runFor(10000);
    const t = await texte(p, '#minuteur-temps');
    verifier(/00:2[01]/.test(t), 'après 10 s : il reste 20 s', t);
    await p.clock.runFor(25000);
    const etat = await texte(p, '#minuteur-etat');
    verifier(/termin|fini/i.test(etat), 'après 35 s : terminé', etat);
  });

  await section('Une séance d’intervalles', async () => {
    await p.goto(p.url().split('#')[0]);
    await p.clock.install().catch(() => {});
    await p.waitForSelector('#liste-seances [data-action="demarrer"]');
    const nom = await texte(p, '#liste-seances .seance-nom');
    await aller(p, '#liste-seances [data-action="demarrer"]');
    verifier((await texte(p, '#lecteur-nom')).includes(nom), 'la séance « ' + nom + ' » démarre');
    const ou = async () => (await texte(p, '#lecteur-phase')) + ' / ' + (await texte(p, '#lecteur-round'));
    const avant = await ou();
    verifier(avant.length > 3, 'la phase en cours est affichée : ' + avant);
    await p.clock.runFor(5 * 60 * 1000);
    const apres = await ou().catch(() => 'terminée');
    verifier(apres !== avant, 'après 5 minutes, la séance a avancé : ' + apres, [avant, apres]);
  });

  await ctx.close();

  /* ---------- 2. CRUD Séances, dupliquer, idEnCours supprimé, reload() ---------- */
  await section('Séances — CRUD, copie longue, idEnCours supprimé, reload()', async () => {
    const { ctx: c, p: page } = await nouvellePage();
    await page.waitForTimeout(500);
    const initial = (await page.$$('#liste-seances .seance')).length;

    // Création
    await aller(page, '[data-action="nouvelle-seance"]');
    verifier((await texte(page, '#edition-titre')) === 'Nouvelle séance', 'titre Création correct');
    await page.fill('#seance-nom', 'Fractionné test');
    await page.fill('#seance-rounds-champ', '4');
    await page.fill('[data-champ="travail"] .duree-min', '00');
    await page.fill('[data-champ="travail"] .duree-sec', '45');
    await page.click('#form-seance button[type="submit"]');
    await page.waitForTimeout(300);
    const nomsApresAjout = await page.$$eval('#liste-seances .seance-nom', (els) => els.map((e) => e.textContent));
    verifier(nomsApresAjout.includes('Fractionné test') && nomsApresAjout.length === initial + 1, 'séance créée et affichée');

    // Modification
    const carteTest = page.locator('#liste-seances .seance', { hasText: 'Fractionné test' });
    await carteTest.locator('[data-action="modifier"]').click();
    await page.waitForTimeout(300);
    verifier((await texte(page, '#edition-titre')) === 'Modifier la séance', 'titre Modification correct');
    verifier(await estCache(page, '#edition-modeles'), 'modèles masqués en modification');
    await page.fill('#seance-nom', 'Fractionné modifié');
    await page.click('#form-seance button[type="submit"]');
    await page.waitForTimeout(300);
    const nomsApresModif = await page.$$eval('#liste-seances .seance-nom', (els) => els.map((e) => e.textContent));
    verifier(nomsApresModif.includes('Fractionné modifié') && nomsApresModif.length === initial + 1, 'séance modifiée sur place');

    // Duplication d'un nom de 40 caractères sans tronquer " (copie)"
    await aller(page, '[data-action="nouvelle-seance"]');
    const nomLong = 'S'.repeat(40);
    await page.fill('#seance-nom', nomLong);
    await page.click('#form-seance button[type="submit"]');
    await page.waitForTimeout(300);
    const carteLongue = page.locator('#liste-seances .seance', { hasText: nomLong });
    await carteLongue.locator('[data-action="dupliquer"]').click();
    await page.waitForTimeout(200);
    const nomsApresDup = await page.$$eval('#liste-seances .seance-nom', (els) => els.map((e) => e.textContent));
    const copieLongue = nomsApresDup.find((n) => n !== nomLong && n.startsWith('S') && n.endsWith(' (copie)'));
    verifier(!!copieLongue && copieLongue.length <= 40, 'duplication 40 car. garde le suffixe (copie)', copieLongue);

    // Suppression de la séance en cours d'édition avant Enregistrer
    const carteModif = page.locator('#liste-seances .seance', { hasText: 'Fractionné modifié' });
    await carteModif.locator('[data-action="modifier"]').click();
    await page.waitForTimeout(300);
    await page.evaluate(() => { Seances.supprimer(Editeur.idEnCours); });
    await page.fill('#seance-nom', 'Fractionné ressuscité');
    await page.click('#form-seance button[type="submit"]');
    await page.waitForTimeout(300);
    const nomsApresRes = await page.$$eval('#liste-seances .seance-nom', (els) => els.map((e) => e.textContent));
    verifier(nomsApresRes.includes('Fractionné ressuscité'), 'idEnCours supprimé est réinséré à l’enregistrement');

    // Suppression en deux appuis
    const carteRes = page.locator('#liste-seances .seance', { hasText: 'Fractionné ressuscité' });
    await carteRes.locator('[data-action="supprimer"]').click();
    verifier((await carteRes.locator('[data-action="supprimer"]').textContent()).trim() === 'Confirmer ?', '1er appui Supprimer arme le bouton');
    await carteRes.locator('[data-action="supprimer"]').click();
    await page.waitForTimeout(200);
    verifier((await page.locator('#liste-seances .seance', { hasText: 'Fractionné ressuscité' }).count()) === 0, '2e appui Supprimer retire la séance');

    // Persistance au reload() : thème + tour chrono + séance
    await aller(page, '[data-aller="reglages"]');
    await page.click('input[name="theme"][value="sombre"]', { force: true });
    await aller(page, '.vue:not([hidden]) [data-action="retour"]');
    await aller(page, '#tuile-chrono');
    await page.click('#chrono-marche');
    await page.waitForTimeout(150);
    await page.click('#chrono-bouton-tour');
    await page.click('#chrono-marche');
    await page.reload();
    await page.waitForLoadState('load');
    await page.waitForTimeout(400);
    verifier((await page.evaluate(() => document.documentElement.dataset.theme)) === 'sombre', 'thème sombre conservé après reload()');
    verifier((await page.$$('#chrono-tours li')).length === 1, 'tour du chronomètre conservé après reload()');
    await aller(page, '.vue:not([hidden]) [data-action="retour"]');
    verifier((await page.$$eval('#liste-seances .seance-nom', (els) => els.map((e) => e.textContent))).includes(nomLong), 'séance créée conservée après reload()');
    await aller(page, '#tuile-chrono');
    verifier((await page.$$('#chrono-tours li')).length === 1, 'tour du chronomètre toujours affiché après retour');
    await c.close();
  });

  /* ---------- 3. Erreurs 00:00, appui long, message modèles ---------- */
  await section('Erreurs 00:00, appui long et timer #modeles-message', async () => {
    const { ctx: c, p: page } = await nouvellePage();
    await page.waitForTimeout(400);

    // Minuteur 00:00
    await aller(page, '#tuile-minuteur');
    await page.fill('#minuteur-duree .duree-min', '00');
    await page.fill('#minuteur-duree .duree-sec', '00');
    await page.click('[data-action="minuteur-demarrer"]');
    verifier(!(await estCache(page, '#minuteur-erreur')), '#minuteur-erreur affiché pour 00:00');
    verifier(await estCache(page, '#minuteur-marche'), 'minuteur ne démarre pas sur 00:00');
    await page.click('#minuteur-duree [data-sens="-1"]');
    const secBorne = await page.$eval('#minuteur-duree .duree-sec', (i) => i.value);
    verifier(secBorne === '01', 'bouton [−] borne toujours à 00:01', secBorne);
    await aller(page, '.vue:not([hidden]) [data-action="retour"]');

    // Éditeur Travail 00:00
    await aller(page, '[data-action="nouvelle-seance"]');
    await page.fill('[data-champ="travail"] .duree-min', '00');
    await page.fill('[data-champ="travail"] .duree-sec', '00');
    await page.click('#form-seance button[type="submit"]');
    verifier(!(await estCache(page, '#edition-erreur')), '#edition-erreur affiché pour travail 00:00');
    verifier((await page.evaluate(() => document.body.dataset.vue)) === 'edition', 'reste sur édition en cas d’erreur');
    await page.fill('[data-champ="travail"] .duree-sec', '20');
    verifier(await estCache(page, '#edition-erreur'), 'modifier la durée masque #edition-erreur');
    await aller(page, '.vue:not([hidden]) [data-action="retour"]');

    // Appui long arrêté par blur + double-clic rajouter-modeles
    await page.clock.install();
    await aller(page, '#tuile-minuteur');
    await page.click('[data-secondes="30"]');
    const btnPlus = page.locator('#minuteur-duree [data-sens="1"]');
    await btnPlus.dispatchEvent('pointerdown');
    await page.clock.runFor(750);
    const valeurApresAppuiLong = await page.$eval('#minuteur-duree .duree-sec', (i) => i.value);
    await btnPlus.dispatchEvent('blur');
    await page.clock.runFor(600);
    const valeurApresBlur = await page.$eval('#minuteur-duree .duree-sec', (i) => i.value);
    verifier(Number(valeurApresAppuiLong) > 30 && valeurApresAppuiLong === valeurApresBlur, 'blur arrête la répétition de l’appui long', [valeurApresAppuiLong, valeurApresBlur]);
    await aller(page, '.vue:not([hidden]) [data-action="retour"]');

    await aller(page, '[data-aller="reglages"]');
    await page.click('[data-action="rajouter-modeles"]');
    await page.clock.runFor(3000);
    await page.click('[data-action="rajouter-modeles"]');
    await page.clock.runFor(2000);
    verifier(!(await estCache(page, '#modeles-message')), '#modeles-message reste visible 4 s après le 2e clic');
    await page.clock.runFor(2100);
    verifier(await estCache(page, '#modeles-message'), '#modeles-message se masque après 4 s');
    await c.close();
  });

  /* ---------- 4. Paysage 844×390 & Contraste CSS ---------- */
  await section('Vue paysage 844×390 et contraste --bord-bouton >= 3:1', async () => {
    const { ctx: c, p: page } = await nouvellePage({ viewport: { width: 844, height: 390 } });
    await page.waitForTimeout(500);

    const debordAccueil = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    verifier(debordAccueil <= 0, 'paysage : accueil sans débordement horizontal', debordAccueil);

    await aller(page, '#tuile-chrono');
    verifier((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, 'paysage : chrono sans débordement');
    await aller(page, '.vue:not([hidden]) [data-action="retour"]');

    await aller(page, '#tuile-minuteur');
    await page.click('[data-action="minuteur-demarrer"]');
    verifier((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, 'paysage : minuteur en marche sans débordement');
    await page.click('#minuteur-arreter');
    await page.click('#minuteur-arreter');
    await aller(page, '.vue:not([hidden]) [data-action="retour"]');

    await aller(page, '#liste-seances [data-action="demarrer"]');
    const grille = await page.evaluate(() => {
      const lecteur = document.querySelector('#lecteur-actif');
      const temps = document.querySelector('#lecteur-temps').getBoundingClientRect();
      const cmds = document.querySelector('#lecteur-actif .commandes').getBoundingClientRect();
      return {
        debord: document.documentElement.scrollWidth - innerWidth,
        colonnes: getComputedStyle(lecteur).gridTemplateColumns.split(' ').length,
        gaucheDroite: temps.right <= cmds.left + 2
      };
    });
    verifier(grille.debord <= 0, 'paysage : séance sans débordement', grille.debord);
    verifier(grille.colonnes === 2 && grille.gaucheDroite, 'paysage : lecteur en 2 colonnes (chiffres à gauche, boutons à droite)', grille);

    // Vérification mathématique du contraste calculé pour --bord-bouton dans les 3 thèmes
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const contrastes = await page.evaluate(() => {
      function parseRgb(str) {
        const m = str.match(/[\d.]+/g);
        if (!m) return [0, 0, 0];
        return m.slice(0, 3).map(Number);
      }
      function lum(rgb) {
        const c = rgb.map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      }
      function ratio(a, b) {
        const l1 = lum(a), l2 = lum(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }
      function hexToRgb(hex) {
        const h = hex.trim().slice(1);
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      }
      const res = {};
      const btn = document.querySelector('.vue:not([hidden]) [data-action="retour"]');
      for (const theme of ['omni', 'sombre', 'clair']) {
        document.documentElement.dataset.theme = theme;
        const styleRoot = getComputedStyle(document.documentElement);
        const bord = parseRgb(getComputedStyle(btn).borderTopColor);
        const minRatio = Math.min(
          ratio(bord, hexToRgb(styleRoot.getPropertyValue('--fond'))),
          ratio(bord, hexToRgb(styleRoot.getPropertyValue('--surface'))),
          ratio(bord, hexToRgb(styleRoot.getPropertyValue('--surface-2')))
        );
        res[theme] = Number(minRatio.toFixed(2));
      }
      return res;
    });
    verifier(
      contrastes.omni >= 3 && contrastes.sombre >= 3 && contrastes.clair >= 3,
      'contraste --bord-bouton >= 3:1 dans les 3 thèmes',
      contrastes
    );
    await c.close();
  });

  /* ---------- 5. Export / Import JSON & stockage persistant ---------- */
  await section('Réglages — Export / Import JSON & navigator.storage.persist()', async () => {
    const { ctx: c, p: page } = await nouvellePage({
      avant: async (context) => {
        await context.addInitScript(() => {
          window.__persistAppele = 0;
          if (navigator.storage) {
            Object.defineProperty(navigator.storage, 'persisted', {
              configurable: true,
              value: () => Promise.resolve(false)
            });
            Object.defineProperty(navigator.storage, 'persist', {
              configurable: true,
              value: () => { window.__persistAppele++; return Promise.resolve(true); }
            });
          }
        });
      }
    });
    await page.waitForTimeout(500);
    verifier((await page.evaluate(() => window.__persistAppele)) >= 1, 'navigator.storage.persist() appelé au démarrage');

    await aller(page, '[data-aller="reglages"]');

    // Export JSON
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-action="exporter-seances"]')
    ]);
    const cheminExport = await dl.path();
    const contenuExport = JSON.parse(fs.readFileSync(cheminExport, 'utf8'));
    verifier(
      contenuExport.application === 'omni-time' && contenuExport.version === 1 && Array.isArray(contenuExport.seances) && contenuExport.seances.length === 3,
      'export JSON contient les 3 séances avec le bon schéma',
      { app: contenuExport.application, nb: contenuExport.seances && contenuExport.seances.length }
    );

    // Rejets : JSON cassé, mauvais schéma, tableau vide, durée invalide
    const testerRejet = async (nomFichier, contenu, libelle) => {
      await page.setInputFiles('#import-seances-fichier', {
        name: nomFichier,
        mimeType: 'application/json',
        buffer: Buffer.from(contenu, 'utf8')
      });
      await page.waitForTimeout(200);
      verifier(!(await estCache(page, '#sauvegarde-erreur')), libelle);
    };
    await testerRejet('casse.json', '{invalide', 'import rejette un JSON malformé');
    await testerRejet('schema.json', '{"mauvais":123}', 'import rejette un schéma inconnu');
    await testerRejet('vide.json', '{"application":"omni-time","version":1,"seances":[]}', 'import rejette une liste vide');
    await testerRejet('borne.json', JSON.stringify({
      application: 'omni-time', version: 1,
      seances: [{ nom: 'Mauvaise', echauffement: 0, rounds: 1, travail: 0, repos: 0, reposFinal: 0 }]
    }), 'import rejette travail: 0');
    verifier((await page.evaluate(() => seances.length)) === 3, 'les séances existantes restent intactes après rejets');

    // Import valide + déduplication + persistance reload()
    const fichierValide = JSON.stringify({
      application: 'omni-time',
      version: 1,
      seances: [
        contenuExport.seances[0], // doublon exact -> ignoré
        { id: contenuExport.seances[1].id, nom: contenuExport.seances[1].nom, echauffement: 15, rounds: 3, travail: 45, repos: 15, reposFinal: 0 }, // même id et nom mais modifiée -> nouveau id + suffixe (2)
        { nom: 'Séance importée', echauffement: 15, rounds: 3, travail: 45, repos: 15, reposFinal: 0 }
      ]
    });
    await page.setInputFiles('#import-seances-fichier', {
      name: 'sauvegarde.json',
      mimeType: 'application/json',
      buffer: Buffer.from(fichierValide, 'utf8')
    });
    await page.waitForTimeout(300);
    verifier(await estCache(page, '#sauvegarde-erreur'), 'aucune erreur sur import valide');
    verifier(!(await estCache(page, '#sauvegarde-message')), '#sauvegarde-message affiché après import valide');

    await page.reload();
    await page.waitForLoadState('load');
    await page.waitForTimeout(400);
    await aller(page, '.vue:not([hidden]) [data-action="retour"]');
    const nomsImportes = await page.$$eval('#liste-seances .seance-nom', (els) => els.map((e) => e.textContent));
    verifier(nomsImportes.includes('Séance importée') && nomsImportes.length === 5, 'séances importées fusionnées et conservées après reload()', nomsImportes);
    await c.close();
  });

  /* ---------- 6. Bandeaux son & Sons.programmer / Sons.bip ---------- */
  await section('Bandeaux son (#minuteur-son, #lecteur-son) & Sons', async () => {
    const injecterMockAudio = async (context) => {
      await context.addInitScript(() => {
        window.__oscCount = 0;
        window.__audioResolvers = [];
        class MockAudioContext {
          constructor() {
            this.state = 'suspended';
            this.currentTime = 0;
            this.destination = {};
            this._ecouteurs = [];
          }
          addEventListener(type, fn) {
            if (type === 'statechange') this._ecouteurs.push(fn);
          }
          resume() {
            return new Promise((ok) => {
              window.__audioResolvers.push(() => {
                this.state = 'running';
                this._ecouteurs.forEach((fn) => fn());
                ok();
              });
            });
          }
          createOscillator() {
            return {
              type: 'sine',
              frequency: { value: 440 },
              connect() {},
              start() { window.__oscCount++; },
              stop() {}
            };
          }
          createGain() {
            return {
              gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
              connect() {},
              disconnect() {}
            };
          }
        }
        window.AudioContext = MockAudioContext;
        window.webkitAudioContext = MockAudioContext;
      });
    };

    const { ctx: c, p: page } = await nouvellePage({ avant: injecterMockAudio });
    await page.waitForTimeout(400);

    // Minuteur : bandeau visible tant que suspended, masqué dès que running
    await aller(page, '#tuile-minuteur');
    await page.click('[data-secondes="30"]');
    await page.click('[data-action="minuteur-demarrer"]');
    verifier(!(await estCache(page, '#minuteur-son')), '#minuteur-son visible quand AudioContext est suspended');

    // Sons.bip() en mode suspended programme un bip exactement une fois après resume
    const avOsc = await page.evaluate(() => { Sons.bip('court', true); return window.__oscCount; });
    verifier(avOsc === 0, 'Sons.bip() ne crée pas d’oscillateur tant que suspended');
    await page.evaluate(() => {
      const fns = window.__audioResolvers.splice(0);
      fns.forEach((fn) => fn());
    });
    await page.waitForTimeout(100);
    verifier(await estCache(page, '#minuteur-son'), '#minuteur-son se masque immédiatement au passage à running');
    const apOsc = await page.evaluate(() => window.__oscCount);
    verifier(apOsc >= 1, 'Sons.bip() joue après résolution de resume()', apOsc);

    // Volume = 0 -> Sons.programmer() ne marque pas la clé dans Sons.cles
    const clesVolumeZero = await page.evaluate(() => {
      Sons.cles.clear();
      const ancien = reglages.volume;
      reglages.volume = 0;
      Sons.programmer('test-v0', 'court', Date.now() + 500);
      const tailleZero = Sons.cles.size;
      reglages.volume = 50;
      Sons.programmer('test-v0', 'court', Date.now() + 500);
      const tailleCinquante = Sons.cles.size;
      reglages.volume = ancien;
      return { tailleZero, tailleCinquante };
    });
    verifier(clesVolumeZero.tailleZero === 0 && clesVolumeZero.tailleCinquante === 1, 'Sons.programmer() ne bloque pas la clé quand volume = 0', clesVolumeZero);
    await c.close();

    // Lecteur : bandeau #lecteur-son caché en pause, réaffiché à la reprise si toujours suspended
    const { ctx: c2, p: p2 } = await nouvellePage({ avant: injecterMockAudio });
    await p2.waitForTimeout(400);
    await aller(p2, '#liste-seances [data-action="demarrer"]');
    verifier(!(await estCache(p2, '#lecteur-son')), '#lecteur-son visible pendant séance active avec son suspended');
    await p2.click('#lecteur-pause');
    verifier(await estCache(p2, '#lecteur-son'), '#lecteur-son masqué quand la séance est en pause');
    await p2.click('#lecteur-pause');
    verifier(!(await estCache(p2, '#lecteur-son')), '#lecteur-son réapparaît à la reprise si toujours suspended');
    await c2.close();
  });

  /* ---------- 7. Raccourcis clavier (Espace, T, Échap) ---------- */
  await section('Raccourcis clavier (Espace, T, Échap)', async () => {
    const { ctx: c, p: page } = await nouvellePage();
    await page.waitForTimeout(400);
    await page.clock.install();

    // Chrono
    await aller(page, '#tuile-chrono');
    await page.keyboard.press('Space');
    verifier((await texte(page, '#chrono-marche')) === 'Pause', 'Espace démarre le chronomètre');
    await page.clock.runFor(2000);
    await page.keyboard.press('t');
    verifier((await pText(page, '#chrono-tours li')).length === 1, 'T ajoute un tour');
    // Espace sur le bouton Tour focalisé ne doit pas basculer Pause en plus d'ajouter un tour
    await page.focus('#chrono-bouton-tour');
    await page.keyboard.press('Space');
    verifier((await page.$$('#chrono-tours li')).length === 2 && (await texte(page, '#chrono-marche')) === 'Pause', 'Espace sur #chrono-bouton-tour ajoute un tour sans pauser');
    await page.focus('#titre-chrono');
    await page.keyboard.press('Space');
    verifier((await texte(page, '#chrono-marche')) === 'Reprendre', 'Espace met le chronomètre en pause');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    verifier((await page.evaluate(() => document.body.dataset.vue)) === 'accueil', 'Échap revient à l’accueil depuis chrono');

    // Séance : Espace pause/reprend, Échap désarme d'abord .bouton.arme puis revient
    await aller(page, '#liste-seances [data-action="demarrer"]');
    await page.focus('#lecteur-nom');
    await page.keyboard.press('Space');
    verifier(!(await estCache(page, '#lecteur-badge-pause')), 'Espace met la séance en pause');
    await page.keyboard.press('Space');
    verifier(await estCache(page, '#lecteur-badge-pause'), 'Espace reprend la séance');
    await page.click('[data-action="lecteur-arreter"]'); // arme le bouton Arrêter
    verifier((await page.$$('.vue:not([hidden]) .bouton.arme')).length === 1, 'Arrêter est armé');
    await page.keyboard.press('Escape');
    verifier((await page.$$('.vue:not([hidden]) .bouton.arme')).length === 0 && (await page.evaluate(() => document.body.dataset.vue)) === 'seance', '1er Échap désarme sans quitter');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    verifier((await page.evaluate(() => document.body.dataset.vue)) === 'accueil' && !(await estCache(page, '#bandeau-seance')), '2e Échap revient à l’accueil avec bandeau actif');

    // T dans un champ texte ne déclenche rien
    await aller(page, '[data-action="nouvelle-seance"]');
    await page.focus('#seance-nom');
    await page.keyboard.type('Test');
    verifier((await page.$eval('#seance-nom', (i) => i.value)) === 'Test', 'saisie normale de T dans un champ texte');
    await c.close();
  });

  /* ---------- 8. Wake Lock — pause / reprise / rechargement ---------- */
  await section('Wake Lock — libération en pause, reprise et reload()', async () => {
    const { ctx: c, p: page } = await nouvellePage({
      avant: async (context) => {
        await context.addInitScript(() => {
          window.__wl = { requests: 0, releases: 0, active: 0 };
          const wl = {
            request() {
              window.__wl.requests++;
              window.__wl.active++;
              let libere = false;
              const ecouteurs = [];
              return Promise.resolve({
                addEventListener(t, fn) { if (t === 'release') ecouteurs.push(fn); },
                release() {
                  if (!libere) {
                    libere = true;
                    window.__wl.releases++;
                    window.__wl.active--;
                    ecouteurs.forEach((fn) => fn());
                  }
                  return Promise.resolve();
                }
              });
            }
          };
          Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: wl });
        });
      }
    });
    await page.waitForTimeout(400);

    await aller(page, '#liste-seances [data-action="demarrer"]');
    await page.waitForTimeout(100);
    let wl = await page.evaluate(() => window.__wl);
    verifier(wl.requests === 1 && wl.active === 1, 'Wake Lock demandé au démarrage de la séance', wl);

    await page.click('#lecteur-pause');
    await page.waitForTimeout(100);
    wl = await page.evaluate(() => window.__wl);
    verifier(wl.releases === 1 && wl.active === 0, 'Wake Lock libéré en pause', wl);

    await page.click('#lecteur-pause');
    await page.waitForTimeout(100);
    wl = await page.evaluate(() => window.__wl);
    verifier(wl.requests === 2 && wl.active === 1, 'Wake Lock redemandé à la reprise', wl);

    await page.click('#lecteur-pause');
    await page.waitForTimeout(100);
    await page.reload();
    await page.waitForLoadState('load');
    await page.waitForTimeout(300);
    wl = await page.evaluate(() => window.__wl);
    verifier(wl.requests === 0 && wl.active === 0, 'après reload() en pause, aucun Wake Lock demandé', wl);
    await c.close();
  });

  /* ---------- 9. Service Worker — repli navigate hors ligne ---------- */
  await section('Service Worker — repli navigate hors ligne', async () => {
    const { ctx: c, p: page } = await nouvellePage();
    await page.waitForTimeout(1000);
    const pret = await page.evaluate(() => Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise((ok) => setTimeout(() => ok(false), 10000))
    ]));
    verifier(pret, 'service worker prêt');
    await page.reload();
    await page.waitForLoadState('load');
    await page.waitForTimeout(500);
    await c.setOffline(true);
    let texteInexistant = 0;
    try {
      await page.goto(adresse() + 'page-inexistante');
      await page.waitForTimeout(500);
      texteInexistant = await page.evaluate(() => document.body.innerText.trim().length);
    } catch (e) { /* échec navigation */ }
    verifier(texteInexistant > 20, 'repli navigate hors ligne sert l’application sur une URL inconnue', texteInexistant);
    await c.close();
  });
});

async function pText(p, sel) {
  return p.$$(sel);
}
