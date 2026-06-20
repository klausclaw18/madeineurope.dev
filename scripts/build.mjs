#!/usr/bin/env node
// ============================================================================
// madeineurope.dev — static site generator
// Zero dependencies. Reads declarative JSON in /data + templates in /src,
// emits a static site into /dist:
//   dist/index.html          — landing page (categories, stats, top projects)
//   dist/<category>.html     — one directory page per category (dynamic)
//   dist/all.html            — all tools across every category
//   dist/assets/directory.json — bundled data the client fetches at runtime
//   dist/CNAME               — copied from root for GitHub Pages custom domain
// Re-run on any data change: `npm run build`.
// ============================================================================
import {
  readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const read = (rel) => readFileSync(join(root, rel), 'utf8');
const readJSON = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const render = (tpl, vars) => Object.entries(vars).reduce(
  (s, [k, v]) => s.split(`{{${k}}}`).join(v == null ? '' : String(v)), tpl,
);
// Prevent </script> inside inline JSON/JS from breaking the page.
const safeInline = (s) => s.replace(/<\/(script)/gi, '<\\/$1');

// Per-category icon, mirroring the original landing page. Category files may
// override with their own `icon` field; this is the fallback.
const ICONS = {
  'developer-tools': '🖥️',
  'cloud-hosting': '☁️',
  'security-auth': '🔒',
  'analytics-monitoring': '📊',
  'hardware-iot': '🛠️',
  'databases-storage': '🗄️',
  'communication-email': '📬',
  'ai-ml': '🤖',
  'payments-billing': '💳',
};

// ── Load sources of truth ──────────────────────────────────────────────────
const manifest = readJSON('data/directory.json');
const i18n = readJSON('src/i18n.json');
const styles = read('src/styles.css');
const clientJs = read('src/client.mjs');
const i18nJson = safeInline(JSON.stringify(i18n));
const clientJsInlined = safeInline(clientJs);

let topProjects = [];
const topPath = join(root, 'data', 'top-european-projects.json');
if (existsSync(topPath)) {
  try { topProjects = JSON.parse(readFileSync(topPath, 'utf8')).entries || []; }
  catch (e) { console.warn(`[build] top-european-projects.json: ${e.message}`); }
}

// ── Assemble category bundle ───────────────────────────────────────────────
const categories = [];
for (const c of manifest.categories || []) {
  const rel = (c.file || '').replace(/^\.\//, '');
  const abs = join(root, 'data', rel);
  let cat = null;
  if (rel && existsSync(abs)) {
    try { cat = JSON.parse(readFileSync(abs, 'utf8')); }
    catch (e) { console.warn(`[build] ${rel}: ${e.message}`); }
  }
  if (!cat) {
    cat = {
      id: c.id, name: c.name, icon: ICONS[c.id] || '📦',
      description: 'European tools in this category are being curated. Check back soon.',
      categoryUseCases: [], entries: [],
    };
  }
  cat.id = cat.id || c.id;
  cat.name = cat.name || c.name;
  cat.icon = cat.icon || ICONS[c.id] || '📦';
  cat.description = cat.description || 'European tools in this category.';
  cat.categoryUseCases = cat.categoryUseCases || [];
  cat.entries = (cat.entries || []).map((e) => ({ ...e, category: cat.name }));
  categories.push(cat);
}
const totalEntries = categories.reduce((n, c) => n + c.entries.length, 0);
const bundle = {
  name: manifest.name,
  description: manifest.description,
  researchDate: manifest.researchDate,
  categories,
};
const bundleJson = safeInline(JSON.stringify(bundle));

// ── Landing page ───────────────────────────────────────────────────────────
function buildLanding() {
  const tpl = read('src/templates/landing.html');

  const cards = categories.map((c) => {
    const count = c.entries.length;
    const examples = c.entries.slice(0, 4)
      .map((e) => `<span class="tag">${esc(e.name)}</span>`).join('');
    return `
      <a class="category-card" href="/${esc(c.id)}.html">
        <span class="category-icon">${c.icon}</span>
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.description)}</p>
        <div class="category-meta">
          <span class="category-count">${count} ${count === 1 ? 'tool' : 'tools'}</span>
        </div>
        ${examples ? `<div class="category-examples">${examples}</div>` : ''}
      </a>`;
  }).join('\n');

  const jumpbar = categories
    .map((c) => `<a href="/${esc(c.id)}.html">${esc(c.name)}</a>`).join('');

  const top = topProjects.map((p) => `
    <div class="top-project">
      <span class="rank">#${p.rank}</span>
      <h4>${esc(p.name)}</h4>
      <p class="desc">${esc(p.description)}</p>
      <div class="stats-row">
        <span class="star-count">★ ${typeof p.github?.stars === 'number' ? p.github.stars.toLocaleString('en') : '—'}</span>
        <span>${esc(p.origin?.country || '')}</span>
        <a href="${esc(p.repository || p.homepage)}" target="_blank" rel="noopener" style="margin-left:auto;color:var(--accent);text-decoration:none;font-family:var(--mono);">repo →</a>
      </div>
    </div>`).join('');

  return render(tpl, {
    LANG: 'en',
    PAGE_TITLE: 'Made in Europe — Dev Tools & Hardware Directory',
    PAGE_DESC: 'A curated directory of software and hardware tools for developers, built and maintained in Europe.',
    STYLES: styles,
    STATS_CATEGORIES: String(categories.length),
    STATS_TOOLS: String(totalEntries),
    CATEGORIES_GRID: cards,
    JUMPBAR: jumpbar,
    TOP_PROJECTS: top,
    I18N_JSON: i18nJson,
    CLIENT_JS: clientJsInlined,
    YEAR: String(new Date().getFullYear()),
  });
}

// ── Category / "all" page ──────────────────────────────────────────────────
function buildCategoryPage(cat, opts = {}) {
  const all = opts.all === true;
  const tpl = read('src/templates/category.html');
  const usecases = (cat.categoryUseCases || [])
    .map((u) => `<span class="tag">${esc(u)}</span>`).join('');
  const path = all ? '/all.html' : `/${cat.id}.html`;
  const name = all ? 'All European dev tools' : cat.name;
  const desc = all ? (manifest.description || '') : (cat.description || '');
  const icon = all ? '🇪🇺' : cat.icon;
  const cid = all ? 'all' : cat.id;
  return render(tpl, {
    LANG: 'en',
    PAGE_TITLE: `${name} — madeineurope.dev`,
    PAGE_DESC: esc(desc),
    PATH: path,
    STYLES: styles,
    CATEGORY_ID: cid,
    CATEGORY_NAME: esc(name),
    CATEGORY_DESC: esc(desc),
    CATEGORY_ICON: icon,
    CATEGORY_USECASES: usecases,
    I18N_JSON: i18nJson,
    CLIENT_JS: clientJsInlined,
    YEAR: String(new Date().getFullYear()),
  });
}

// ── Emit ───────────────────────────────────────────────────────────────────
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'assets'), { recursive: true });

writeFileSync(join(dist, 'index.html'), buildLanding(), 'utf8');
for (const cat of categories) {
  writeFileSync(join(dist, `${cat.id}.html`), buildCategoryPage(cat), 'utf8');
}
const allCat = { id: 'all', name: 'All tools', icon: '🇪🇺', description: manifest.description || '', categoryUseCases: [], entries: [] };
writeFileSync(join(dist, 'all.html'), buildCategoryPage(allCat, { all: true }), 'utf8');
writeFileSync(join(dist, 'assets', 'directory.json'), bundleJson, 'utf8');

// Preserve custom domain for GitHub Pages.
if (existsSync(join(root, 'CNAME'))) copyFileSync(join(root, 'CNAME'), join(dist, 'CNAME'));

const pageList = ['index.html', ...categories.map((c) => `${c.id}.html`), 'all.html'];
console.log(`[build] wrote ${pageList.length} pages + assets/directory.json to dist/`);
console.log(`[build]   categories: ${categories.length}, entries: ${totalEntries}, top projects: ${topProjects.length}`);