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
const { lancer, section, verifier, nouvellePage, controlesCommuns } = require('./outils.js');

const texte = (p, sel) => p.$eval(sel, (el) => el.textContent.replace(/\s+/g, ' ').trim());
async function aller(p, sel) { await p.click(sel); await p.waitForTimeout(500); }

lancer('Omni-Time', async () => {
  await controlesCommuns({ serviceWorker: 'sw.js' });

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

  await section('Chronomètre', async () => {
    await aller(p, '#tuile-chrono');
    await p.click('#chrono-marche');
    await p.clock.runFor(65000);
    const t = await texte(p, '#chrono-temps');
    verifier(t.startsWith('01:05'), 'après 65 s : 01:05', t);
    await p.click('#chrono-marche');                 // pause
    await p.clock.runFor(30000);
    verifier((await texte(p, '#chrono-temps')).startsWith('01:05'), 'en pause, le temps ne bouge plus');
    await p.click('#chrono-raz');                    // 1er appui : armé
    verifier((await texte(p, '#chrono-temps')).startsWith('01:05'), 'remise à zéro : un seul appui ne suffit pas');
    await p.click('#chrono-raz');                    // 2e appui : confirmé
    verifier((await texte(p, '#chrono-temps')).startsWith('00:00'), 'deux appuis : remis à zéro', await texte(p, '#chrono-temps'));
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
});
