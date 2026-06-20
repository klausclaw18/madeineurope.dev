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
import {
  flattenEntries,
  loadDirectory,
  loadI18nContent,
  summarizeDirectory,
  validateDirectory,
  validateI18nContent,
} from './lib/directory.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const read = (rel) => readFileSync(join(root, rel), 'utf8');
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
// Lucide icon name per category, for crisp vector iconography.
const LUCIDE_ICONS = {
  'developer-tools': 'terminal',
  'cloud-hosting': 'cloud',
  'security-auth': 'lock-keyhole',
  'analytics-monitoring': 'bar-chart-3',
  'hardware-iot': 'cpu',
  'databases-storage': 'database',
  'communication-email': 'mail',
  'ai-ml': 'bot',
  'payments-billing': 'credit-card',
};
const lucideSpan = (name) => `<span data-lucide="${esc(name)}"></span>`;

// ── Load sources of truth ──────────────────────────────────────────────────
const i18n = JSON.parse(read('src/i18n.json'));
const styles = read('src/styles.css');
const clientJs = read('src/client.mjs');

// Merge per-language content overrides (data/i18n/*.json) into the i18n island
// as {content:{<lang>:{categories,entries,topProjects}}}. Canonical English is
// always the fallback at runtime, so absence of a language file is fine.
const i18nContent = loadI18nContent(root);
i18n.content = i18nContent;
const i18nJson = safeInline(JSON.stringify(i18n));
const clientJsInlined = safeInline(clientJs);
// Inline pre-paint theme script: sets data-theme on <html> before first render
// so the correct theme appears instantly (no flash of wrong theme).
const themeBoot = safeInline(
  `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
);

let topProjects = [];
const topPath = join(root, 'data', 'top-european-projects.json');
if (existsSync(topPath)) {
  try { topProjects = JSON.parse(readFileSync(topPath, 'utf8')).entries || []; }
  catch (e) { console.warn(`[build] top-european-projects.json: ${e.message}`); }
}

// ── Assemble category bundle ───────────────────────────────────────────────
const directory = loadDirectory(root);
const { manifest, categories: loadedCategories } = directory;
const validation = validateDirectory(directory);
for (const warning of validation.warnings) console.warn(`[build:warn] ${warning}`);
if (validation.errors.length > 0) {
  for (const error of validation.errors) console.error(`[build:error] ${error}`);
  process.exit(1);
}

const categories = loadedCategories.map((cat) => {
  cat.icon = cat.icon || ICONS[cat.id] || '📦';
  cat.description = cat.description || 'European tools in this category.';
  cat.categoryUseCases = cat.categoryUseCases || [];
  cat.entries = (cat.entries || []).map((e) => ({ ...e, categoryId: cat.id, categoryName: cat.name, category: cat.name }));
  return cat;
});
const totalEntries = categories.reduce((n, c) => n + c.entries.length, 0);
const summary = summarizeDirectory(categories);
const bundle = {
  name: manifest.name,
  description: manifest.description,
  researchDate: manifest.researchDate,
  summary,
  categories,
};
const bundleJson = safeInline(JSON.stringify(bundle));

const fmtStars = (n) => {
  if (typeof n !== 'number') return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return String(n);
};
const renderTags = (items, className = 'tool-tags') => (items || []).length
  ? `<div class="${className}">${items.slice(0, 6).map((item) => `<span class="tag">${esc(item)}</span>`).join('')}</div>`
  : '';
// Build-side i18n lookup for SSR fallback HTML (always English at build time;
// the client re-renders in the active language once JS runs). Maps enum keys to
// human labels so no-JS visitors see "Self-hosted" instead of "self-hosted".
const enDict = i18n.translations.en || {};
const t = (key) => enDict[key] ?? key;
const enumLabel = (ns, value) => (value ? t(`enum.${ns}.${value}`) : '');
const renderToolCard = (e, opts = {}) => {
  const all = opts.all === true;
  const badges = [
    `<span class="badge ${e.isOpenSource ? 'oss' : 'closed'}">${e.isOpenSource ? t('dir_open_source') : t('dir_closed_source')}</span>`,
    e.curation?.confidence ? `<span class="badge conf-${esc(e.curation.confidence)}">${esc(enumLabel('curation.confidence', e.curation.confidence))}</span>` : '',
    e.curation?.maintenance ? `<span class="badge maint-${esc(e.curation.maintenance)}">${esc(enumLabel('curation.maintenance', e.curation.maintenance))}</span>` : '',
  ].join('');
  const github = e.github?.stars != null
    ? `<dt>${t('dir_stars')}</dt><dd>${esc(fmtStars(e.github.stars))}</dd>`
    : '';
  const category = all
    ? `<dt>${t('dir_categories')}</dt><dd>${esc(e.categoryName || e.category || '')}</dd>`
    : '';
  const deployment = (e.deployment || []).map((d) => esc(enumLabel('deployment', d))).join(', ');
  return `
    <article class="tool-card" data-source="${e.isOpenSource ? 'oss' : 'closed'}">
      <div class="tool-card-head">
        <h3><a href="${esc(e.homepage)}" target="_blank" rel="noopener">${esc(e.name)}</a></h3>
        <div class="tool-badges">${badges}</div>
      </div>
      <p class="tool-desc">${esc(e.description)}</p>
      <dl class="tool-attrs">
        <dt>${t('dir_origin')}</dt><dd>${esc(e.origin?.country || '')}</dd>
        <dt>${t('dir_license')}</dt><dd>${esc(e.license || t('dir_closed_source'))}</dd>
        <dt>${t('dir_pricing')}</dt><dd>${esc(enumLabel('pricing', e.pricingModel))}</dd>
        <dt>${t('dir_deployment')}</dt><dd>${deployment}</dd>
        ${github}
        ${category}
      </dl>
      ${renderTags(e.tags)}
      ${renderTags(e.useCases, 'tool-usecases')}
      ${e.origin?.evidence ? `<p class="tool-evidence">${esc(e.origin.evidence)}</p>` : ''}
      <div class="tool-footer">
        <a class="home" href="${esc(e.homepage)}" target="_blank" rel="noopener"><span data-lucide="external-link"></span> ${t('dir_view_homepage')}</a>
        ${e.repository ? `<a class="repo" href="${esc(e.repository)}" target="_blank" rel="noopener"><span data-lucide="github"></span> ${t('dir_view_repo')}</a>` : ''}
      </div>
    </article>`;
};

// ── Landing page ───────────────────────────────────────────────────────────
function buildLanding() {
  const tpl = read('src/templates/landing.html');
  const allEntries = flattenEntries(categories);
  const useCaseCounts = new Map();
  for (const entry of allEntries) {
    for (const useCase of entry.useCases || []) {
      useCaseCounts.set(useCase, (useCaseCounts.get(useCase) || 0) + 1);
    }
  }
  const useCaseLinks = [...useCaseCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([useCase, count]) => `<a href="/all.html?q=${encodeURIComponent(useCase)}"><span>${esc(useCase)}</span><small>${count}</small></a>`)
    .join('');

  const cards = categories.map((c) => {
    const count = c.entries.length;
    const examples = c.entries.slice(0, 4)
      .map((e) => `<span class="tag">${esc(e.name)}</span>`).join('');
    const icon = LUCIDE_ICONS[c.id] ? lucideSpan(LUCIDE_ICONS[c.id]) : `<span>${c.icon}</span>`;
    return `
      <a class="category-card" href="/${esc(c.id)}.html">
        <span class="category-icon">${icon}</span>
        <h3 data-i18n-content="categories.${esc(c.id)}.name">${esc(c.name)}</h3>
        <p data-i18n-content="categories.${esc(c.id)}.description">${esc(c.description)}</p>
        <div class="category-meta">
          <span class="category-count">${count} ${count === 1 ? t('stat_tool_one') : t('stat_tool_many')}</span>
        </div>
        ${examples ? `<div class="category-examples">${examples}</div>` : ''}
      </a>`;
  }).join('\n');

  const jumpbar = categories
    .map((c) => `<a href="/${esc(c.id)}.html">${esc(c.name)}</a>`).join('');

  const top = topProjects.map((p) => `
    <div class="top-project">
      <span class="rank">#${p.rank}</span>
      <h4 data-i18n-content="topProjects.${esc(p.name)}.name">${esc(p.name)}</h4>
      <p class="desc" data-i18n-content="topProjects.${esc(p.name)}.description">${esc(p.description)}</p>
      <div class="stats-row">
        <span class="star-count"><span data-lucide="star"></span> ${typeof p.github?.stars === 'number' ? p.github.stars.toLocaleString('en') : '—'}</span>
        <span>${esc(p.origin?.country || '')}</span>
        <a href="${esc(p.repository || p.homepage)}" target="_blank" rel="noopener" style="margin-left:auto;color:var(--accent);text-decoration:none;font-family:var(--mono);">repo →</a>
      </div>
    </div>`).join('');

  return render(tpl, {
    LANG: 'en',
    PAGE_TITLE: 'Made in Europe — Dev Tools & Hardware Directory',
    PAGE_DESC: 'A curated directory of software and hardware tools for developers, built and maintained in Europe.',
    STYLES: styles,
    THEME_BOOT: themeBoot,
    STATS_CATEGORIES: String(categories.length),
    STATS_TOOLS: String(totalEntries),
    CATEGORIES_GRID: cards,
    JUMPBAR: jumpbar,
    USECASE_LINKS: useCaseLinks,
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
  const iconLucide = all ? 'globe-2' : (LUCIDE_ICONS[cat.id] || 'package');
  const icon = lucideSpan(iconLucide);
  const cid = all ? 'all' : cat.id;
  const entries = all ? flattenEntries(categories) : (cat.entries || []);
  const cards = entries
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => renderToolCard(entry, { all }))
    .join('\n');
  return render(tpl, {
    LANG: 'en',
    PAGE_TITLE: `${name} — madeineurope.dev`,
    PAGE_DESC: esc(desc),
    PATH: path,
    STYLES: styles,
    THEME_BOOT: themeBoot,
    CATEGORY_ID: cid,
    CATEGORY_NAME: esc(name),
    CATEGORY_DESC: esc(desc),
    CATEGORY_ICON: icon,
    CATEGORY_USECASES: usecases,
    CATEGORY_COUNT: String(entries.length),
    DIRECTORY_DATA: bundleJson,
    TOOLS_GRID: cards,
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
