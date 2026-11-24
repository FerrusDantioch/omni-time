/* Omni-Time — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   Contrôles statiques d'Omni-Time (zéro dépendance externe).
   Lancer :  node tests/verifier-statique.mjs
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, '..');

function lire(rel) {
  return fs.readFileSync(path.join(RACINE, rel), 'utf8');
}

function sansCommentairesHtml(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function sansCommentairesJs(js) {
  return js.replace(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (m, chaine) => chaine || ''
  );
}

function sansCommentairesCss(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function normaliserChemin(ref) {
  const propre = ref.split('#')[0].split('?')[0].trim();
  if (!propre || propre === './' || propre === '.') return 'index.html';
  return propre.replace(/^\.\//, '');
}

function fichiersJsRacine() {
  return fs.readdirSync(RACINE).filter((f) => f.endsWith('.js'));
}

test('1. Hygiène GitHub Pages : .nojekyll présent à la racine', () => {
  assert.ok(fs.existsSync(path.join(RACINE, '.nojekyll')), '.nojekyll manquant à la racine');
});

test('2. CSP stricte et zéro code en ligne / innerHTML', () => {
  const html = sansCommentairesHtml(lire('index.html'));
  const cspMatch = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  assert.ok(cspMatch, 'Balise meta Content-Security-Policy manquante dans index.html');

  const csp = cspMatch[1] ?? cspMatch[2] ?? '';
  const directives = new Map();
  for (const morceau of csp.split(';')) {
    const propre = morceau.trim();
    if (!propre) continue;
    const jetons = propre.split(/\s+/);
    const nom = jetons[0].toLowerCase();
    const valeur = jetons.slice(1).join(' ');
    assert.ok(!directives.has(nom), `Directive CSP dupliquée : ${nom}`);
    directives.set(nom, valeur);
  }

  const attendues = [
    ['default-src', "'self'"],
    ['script-src', "'self'"],
    ['style-src', "'self'"],
    ['img-src', "'self'"],
    ['font-src', "'self'"],
    ['connect-src', "'self'"],
    ['object-src', "'none'"],
    ['base-uri', "'none'"],
    ['form-action', "'none'"],
    ['frame-src', "'none'"]
  ];
  for (const [nom, valeur] of attendues) {
    assert.equal(directives.get(nom), valeur, `Directive CSP attendue : ${nom} ${valeur}`);
  }
  const interdits = ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", '*', 'http:', 'https:', 'data:', 'blob:'];
  for (const [nom, valeur] of directives) {
    const jetons = valeur.split(/\s+/).filter(Boolean).map((j) => j.toLowerCase());
    for (const interdit of interdits) {
      assert.ok(
        !jetons.includes(interdit) && !valeur.toLowerCase().includes(interdit),
        `Jeton CSP interdit trouvé dans ${nom} : ${interdit}`
      );
    }
  }

  assert.ok(!/<style[\s>]/i.test(html), 'Balise <style> en ligne interdite dans index.html');
  assert.ok(!/\sstyle\s*=/i.test(html), 'Attribut style= interdit dans index.html');
  assert.ok(!/\son[a-z]+\s*=/i.test(html), 'Attribut on*= interdit dans index.html');

  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    const corps = m[2].trim();
    assert.ok(/\bsrc\s*=/i.test(attrs), '<script> sans attribut src= interdit dans index.html');
    assert.equal(corps, '', 'Contenu inline interdit dans <script src=...>');
  }

  for (const fichier of fichiersJsRacine()) {
    const js = sansCommentairesJs(lire(fichier));
    assert.ok(!/\.innerHTML\s*=/.test(js), `${fichier} utilise .innerHTML =`);
    assert.ok(!/\.outerHTML\s*=/.test(js), `${fichier} utilise .outerHTML =`);
    assert.ok(!/\.insertAdjacentHTML\s*\(/.test(js), `${fichier} utilise .insertAdjacentHTML(`);
  }
});

test('3. Zéro ressource externe chargée (HTML, CSS, JS)', () => {
  const html = sansCommentairesHtml(lire('index.html'));
  const balisesRessources = /<(?:link|script|img|iframe|source|video|audio|object|embed)\b[^>]*>/gi;
  for (const m of html.matchAll(balisesRessources)) {
    assert.ok(
      !/\b(?:src|href)\s*=\s*["']?\s*(?:https?:)?\/\//i.test(m[0]),
      `Ressource externe détectée dans index.html : ${m[0]}`
    );
  }

  const css = sansCommentairesCss(lire('styles.css'));
  assert.ok(!/@import\b/i.test(css), '@import interdit dans styles.css');
  assert.ok(!/url\(\s*["']?(?:https?:)?\/\//i.test(css), 'URL externe détectée dans styles.css');

  for (const fichier of fichiersJsRacine()) {
    const js = sansCommentairesJs(lire(fichier));
    assert.ok(!/https?:\/\//i.test(js), `URL externe détectée dans ${fichier}`);
  }
});

test('4. Vérification réciproque HTML/CSS/manifest.json <-> sw.js <-> disque', () => {
  const sw = lire('sw.js');
  assert.ok(/const\s+PREFIXE\s*=\s*['"]omni-time-['"]\s*;/.test(sw), "PREFIXE doit valoir 'omni-time-'");
  const cacheMatch = sw.match(/const\s+CACHE\s*=\s*['"]([^'"]+)['"]\s*;/);
  assert.ok(cacheMatch && cacheMatch[1].startsWith('omni-time-'), 'CACHE doit commencer par omni-time-');
  assert.ok(/k\.startsWith\(PREFIXE\)\s*&&\s*k\s*!==\s*CACHE/.test(sw), 'activate doit filtrer par PREFIXE && k !== CACHE');

  const fichiersMatch = sw.match(/const\s+FICHIERS\s*=\s*\[([\s\S]*?)\]\s*;/);
  assert.ok(fichiersMatch, 'Tableau FICHIERS introuvable dans sw.js');
  const entreesSw = [...fichiersMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
  assert.ok(entreesSw.length > 0, 'FICHIERS est vide');

  const swSet = new Set(entreesSw.map(normaliserChemin));
  for (const f of swSet) {
    assert.ok(fs.existsSync(path.join(RACINE, f)), `Fichier listé dans sw.js absent du disque : ${f}`);
  }

  const references = new Set();

  // HTML (<link>, <script>, <img>)
  const html = sansCommentairesHtml(lire('index.html'));
  for (const m of html.matchAll(/<(?:link|script|img)\b[^>]*\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const u = (m[1] ?? m[2] ?? '').trim();
    if (/^(#|mailto:|data:|https?:|\/\/)/i.test(u)) continue;
    references.add(normaliserChemin(u));
  }

  // CSS (url(...))
  const css = sansCommentairesCss(lire('styles.css'));
  for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    const u = m[1].trim();
    if (/^(data:|https?:|\/\/)/i.test(u)) continue;
    references.add(normaliserChemin(u));
  }

  // manifest.json
  const manifeste = JSON.parse(lire('manifest.json'));
  assert.equal(manifeste.id, '/omni-time/', 'manifest.json id doit rester /omni-time/');
  if (manifeste.start_url) references.add(normaliserChemin(manifeste.start_url));
  for (const icone of manifeste.icons || []) {
    if (icone.src) references.add(normaliserChemin(icone.src));
  }
  for (const raccourci of manifeste.shortcuts || []) {
    if (raccourci.url) references.add(normaliserChemin(raccourci.url));
  }

  for (const ref of references) {
    assert.ok(fs.existsSync(path.join(RACINE, ref)), `Ressource référencée absente du disque : ${ref}`);
    assert.ok(swSet.has(ref), `Ressource référencée absente de sw.js FICHIERS : ${ref}`);
  }
});

test('5. Icône iOS apple-touch-icon.png opaque 180x180 RGB', () => {
  const chemin = path.join(RACINE, 'apple-touch-icon.png');
  assert.ok(fs.existsSync(chemin), 'apple-touch-icon.png manquant');
  const buf = fs.readFileSync(chemin);
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Signature PNG invalide');
  assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR', 'Chunk IHDR attendu en premier');
  const largeur = buf.readUInt32BE(16);
  const hauteur = buf.readUInt32BE(20);
  const colorType = buf[25];
  assert.equal(largeur, 180, 'apple-touch-icon.png doit faire 180 px de large');
  assert.equal(hauteur, 180, 'apple-touch-icon.png doit faire 180 px de haut');
  assert.equal(colorType, 2, 'apple-touch-icon.png doit être RGB opaque (colorType 2, sans alpha)');
  assert.ok(!buf.includes(Buffer.from('tRNS')), 'apple-touch-icon.png ne doit pas contenir de chunk tRNS');
});

function analyserEnTeteSupports(texte) {
  const idx = texte.search(/@supports\b/i);
  if (idx < 0) return { complet: false, estColorMix: false, reste: '' };
  const apres = texte.slice(idx + '@supports'.length);
  let profParen = 0;
  let dansCondition = false;
  for (let j = 0; j < apres.length; j++) {
    const ch = apres[j];
    if (ch === '(') {
      dansCondition = true;
      profParen++;
    } else if (ch === ')') {
      if (profParen > 0) profParen--;
    } else if (ch === '{' && (!dansCondition || profParen === 0)) {
      const condition = apres.slice(0, j);
      return {
        complet: true,
        estColorMix: /\bcolor-mix\s*\(/i.test(condition),
        reste: apres.slice(j)
      };
    }
  }
  return { complet: false, estColorMix: false, reste: '' };
}

test('6. Replis CSS avant color-mix() dans styles.css', () => {
  const css = sansCommentairesCss(lire('styles.css'));
  const lignes = css.split(/\r?\n/);
  let enTeteSupports = null;
  let dansSupportsColorMix = false;
  let profondeur = 0;

  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    if (!dansSupportsColorMix && enTeteSupports === null && /@supports\b/i.test(l)) {
      enTeteSupports = l;
    } else if (enTeteSupports !== null) {
      enTeteSupports += '\n' + l;
    }

    if (enTeteSupports !== null) {
      const analyse = analyserEnTeteSupports(enTeteSupports);
      if (!analyse.complet) continue;
      enTeteSupports = null;
      if (analyse.estColorMix) {
        dansSupportsColorMix = true;
        profondeur = 0;
        for (const ch of analyse.reste) {
          if (ch === '{') profondeur++;
          else if (ch === '}') profondeur--;
        }
        if (profondeur <= 0) dansSupportsColorMix = false;
        continue;
      }
    } else if (dansSupportsColorMix) {
      for (const ch of l) {
        if (ch === '{') profondeur++;
        else if (ch === '}') profondeur--;
      }
      if (profondeur <= 0 && l.includes('}')) dansSupportsColorMix = false;
      continue;
    }

    if (l.includes('color-mix(')) {
      const mProp = l.match(/^\s*([a-z-]+)\s*:/i);
      assert.ok(mProp, `Déclaration color-mix() inattendue ligne ${i + 1}`);
      const prop = mProp[1];
      let j = i - 1;
      while (j >= 0 && lignes[j].trim() === '') j--;
      const prec = j >= 0 ? lignes[j] : '';
      assert.ok(
        new RegExp(`^\\s*${prop}\\s*:`).test(prec) && !prec.includes('color-mix('),
        `Repli manquant avant color-mix() pour ${prop} (ligne ${i + 1})`
      );
    }
  }
});

test('7. Syntaxe JavaScript valide (node --check)', () => {
  const fichiers = [
    ...fichiersJsRacine(),
    ...fs.readdirSync(path.join(RACINE, 'tests'))
      .filter((f) => f.endsWith('.js') || f.endsWith('.mjs'))
      .map((f) => path.join('tests', f))
  ];
  for (const rel of fichiers) {
    execFileSync(process.execPath, ['--check', path.join(RACINE, rel)], { stdio: 'pipe' });
  }
});
