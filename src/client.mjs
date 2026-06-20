// ============================================================================
// madeineurope.dev — client.mjs
// Zero-dependency browser ES module. Powers:
//   1. The 24-EU-language switcher (inline i18n JSON island + modal).
//   2. The dynamic directory page: fetch bundled JSON, render tool cards,
//      live search, multi-facet filters, sort, results counter, clear button.
// The build step inlines this into each page and provides a JSON island.
// ============================================================================

// Re-run Lucide for any <span data-lucide="..."> in the document. Safe to call
// repeatedly; no-op if Lucide isn't loaded yet (CDN may still be in flight).
const lucideIcons = () => {
  if (window.lucide?.createIcons) window.lucide.createIcons();
};

const t = (key, vars = {}) => {
  const dict = window.__i18n__ || {};
  let s = dict[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
};
// Translate an enum value (deployment / pricing / curation.confidence / curation.maintenance)
// through the active UI dictionary. Falls back to the raw value if no label exists.
const tEnum = (ns, value) => (value ? t(`enum.${ns}.${value}`) : value || '');
// Look up a per-language content override (Tier 2/3) by dotted path, e.g.
// tContent('entries', entry.name, 'description', entry.description). Returns the
// override for the active language, or the fallback (English/canonical) when missing.
const tContent = (kind, key, field, fallback) => {
  const content = window.__i18nContent__ || {};
  const entry = content[kind]?.[key];
  if (entry && entry[field] != null) return entry[field];
  return fallback;
};
// Resolve a dotted content path like "categories.ai-ml.name" into a value, given
// a fallback string (the English text already in the DOM). Returns null if no override.
const resolveContentPath = (path) => {
  const content = window.__i18nContent__ || {};
  const parts = path.split('.');
  const kind = parts[0];
  const field = parts[parts.length - 1];
  const key = parts.slice(1, -1).join('.');
  const entry = content[kind]?.[key];
  return entry && entry[field] != null ? entry[field] : null;
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v != null) e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return e;
};

const fmtStars = (n) => {
  if (typeof n !== 'number') return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return String(n);
};
const relTime = (iso) => {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};
const dedupe = (arr) => [...new Set(arr.filter(Boolean))];

// ── i18n: language switcher + modal ────────────────────────────────────────
function initI18n() {
  const island = $('#i18n-data');
  if (!island) return;
  let payload;
  try { payload = JSON.parse(island.textContent); } catch { return; }
  const { languages = [], translations = {}, content = {} } = payload;
  window.__i18n__ = translations.en || {};
  window.__i18nContentAll__ = content;
  window.__i18nContent__ = content.en || {};
  window.__i18nLanguages__ = languages;

  // Apply Tier 2/3 content overrides to any node carrying data-i18n-content.
  // Falls back to the text already in the DOM (the canonical English) when no
  // override exists for the active language, so partial coverage just works.
  const applyContent = () => {
    $$('[data-i18n-content]').forEach((node) => {
      const value = resolveContentPath(node.dataset.i18nContent);
      if (value != null) {
        if (node.hasAttribute('data-i18n-content-array') && Array.isArray(value)) {
          node.replaceChildren(...value.map((v) => el('span', { class: 'tag', text: v })));
        } else {
          node.textContent = value;
        }
      }
    });
  };

  const apply = (code) => {
    const dict = translations[code] || translations.en;
    window.__i18n__ = dict;
    window.__i18nContent__ = content[code] || content.en || {};
    $$('[data-i18n]').forEach((node) => {
      const key = node.dataset.i18n;
      if (dict[key] != null) node.textContent = dict[key];
    });
    $$('[data-i18n-placeholder]').forEach((node) => {
      const key = node.dataset.i18nPlaceholder;
      if (dict[key] != null) node.setAttribute('placeholder', dict[key]);
    });
    applyContent();
    document.documentElement.lang = code;
    const label = $('#langLabel');
    if (label) label.textContent = code.toUpperCase();
    localStorage.setItem('lang', code);
    $$('.lang-card').forEach((c) => c.classList.toggle('active', c.dataset.lang === code));
    document.dispatchEvent(new CustomEvent('langchange', { detail: { code } }));
  };

  const buildGrid = () => {
    const grid = $('#langGrid');
    if (!grid) return;
    languages.forEach((lang, i) => {
      const card = el('button', {
        type: 'button',
        class: 'lang-card',
        'data-lang': lang.code,
        style: `animation-delay:${i * 24}ms`,
        html: `
          <span class="flag">${lang.flags}</span>
          <span class="native-name">${lang.native}</span>
          <span class="countries">${lang.countries}</span>
          <span class="code-badge">${lang.code.toUpperCase()}</span>`,
      });
      card.addEventListener('click', () => { apply(lang.code); closeModal(); });
      grid.append(card);
    });
  };

  const openModal = () => { $('#langModal')?.classList.add('open'); document.body.classList.add('lang-modal-open'); };
  const closeModal = () => { $('#langModal')?.classList.remove('open'); document.body.classList.remove('lang-modal-open'); };

  buildGrid();
  const stored = localStorage.getItem('lang');
  const browser = (navigator.language || '').slice(0, 2).toLowerCase();
  const initial = stored || (languages.some((l) => l.code === browser) ? browser : 'en');
  apply(initial);

  $('#langToggle')?.addEventListener('click', openModal);
  $('#langModalClose')?.addEventListener('click', closeModal);
  $('.lang-modal-backdrop')?.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // Decorative EU star rings
  const ring = $('#starsRing');
  if (ring && !ring.childElementCount) {
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 - 90) * (Math.PI / 180);
      const x = 50 + 38 * Math.cos(a), y = 50 + 38 * Math.sin(a);
      ring.append(el('div', {
        class: 'star-point',
        style: `left:calc(${x}% - 7px);top:calc(${y}% - 7px);color:#FFCC00;font-size:0.65rem`,
        text: '★',
      }));
    }
  }
  const modalStars = $('#langModalStars');
  if (modalStars && !modalStars.childElementCount) {
    for (let i = 0; i < 12; i++) {
      modalStars.append(el('span', { style: `--angle:${i * 30}deg`, text: '★' }));
    }
  }

  window.__applyLang__ = apply;
}

// ── Directory: data fetch + render + filters ───────────────────────────────
async function initDirectory() {
  const root = $('#directory');
  if (!root) return;

  const categoryId = root.dataset.categoryId || '';
  const isAll = categoryId === 'all';
  const dataUrl = root.dataset.bundleUrl || '/assets/directory.json';

  // Skeleton state
  const grid = $('#toolsGrid');
  if (grid && grid.childElementCount === 0) {
    grid.append(...Array.from({ length: 6 }, () => el('div', { class: 'skeleton-card' })));
  }

  let bundle;
  try {
    const inline = $('#directory-data');
    if (inline?.textContent?.trim()) {
      bundle = JSON.parse(inline.textContent);
    } else {
      const res = await fetch(dataUrl, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      bundle = await res.json();
    }
  } catch (err) {
    if (grid) grid.innerHTML = `<div class="dir-empty"><span class="icon">⚠️</span><p>Failed to load directory data.</p></div>`;
    console.error('[directory] fetch failed:', err);
    return;
  }

  // Flatten entries across categories; each entry knows its category id/name.
  const allEntries = [];
  for (const cat of bundle.categories || []) {
    for (const e of cat.entries || []) {
      allEntries.push({ ...e, categoryId: cat.id, categoryName: cat.name, categoryIcon: cat.icon });
    }
  }
  const entries = isAll ? allEntries : allEntries.filter((e) => e.categoryId === categoryId);

  // Build filter options from data
  const countries = dedupe(entries.map((e) => e.origin?.country).filter(Boolean)).sort();
  const licenses = dedupe(entries.map((e) => e.license).filter(Boolean)).sort();
  const deployments = dedupe(entries.flatMap((e) => e.deployment || [])).sort();
  const pricing = dedupe(entries.map((e) => e.pricingModel).filter(Boolean)).sort();
  const sourceOptions = ['oss', 'closed'];

  // Populate select dropdowns. `map` optional function translates a raw option
// value into a human label (for enum filters); the raw value stays the option
// value so filtering keeps matching on canonical keys across languages.
const fillSelect = (id, options, labelKey, map) => {
    const sel = $(`#${id}`);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">${t(labelKey)}</option>` +
      options.map((o) => `<option value="${o}">${map ? map(o) : o}</option>`).join('');
    if (current) sel.value = current;
  };
  fillSelect('fCountry', countries, 'dir_filter_country');
  fillSelect('fLicense', licenses, 'dir_filter_license');
  fillSelect('fDeployment', deployments, 'dir_filter_deployment', (v) => tEnum('deployment', v));
  fillSelect('fPricing', pricing, 'dir_filter_pricing', (v) => tEnum('pricing', v));
  fillSelect('fSource', sourceOptions, 'dir_filter_source', (v) => (v === 'oss' ? t('dir_open_source') : t('dir_closed_source')));

  // State
  const state = { q: '', country: '', license: '', deployment: '', pricing: '', source: '', sort: 'name' };
  const params = new URLSearchParams(location.search);
  for (const k of ['q', 'country', 'license', 'deployment', 'pricing', 'source', 'sort']) {
    if (params.has(k)) state[k] = params.get(k);
  }
  $('#dirSearch').value = state.q;
  $('#fCountry').value = state.country;
  $('#fLicense').value = state.license;
  $('#fDeployment').value = state.deployment;
  $('#fPricing').value = state.pricing;
  $('#fSource').value = state.source;
  $('#fSort').value = state.sort;

  const matchEntry = (e) => {
    if (state.country && e.origin?.country !== state.country) return false;
    if (state.license && e.license !== state.license) return false;
    if (state.deployment && !(e.deployment || []).includes(state.deployment)) return false;
    if (state.pricing && e.pricingModel !== state.pricing) return false;
    if (state.source === 'oss' && !e.isOpenSource) return false;
    if (state.source === 'closed' && e.isOpenSource) return false;
    if (state.q) {
      const q = state.q.toLowerCase();
      // Search both canonical English and any active-language translation, so a
      // user browsing in German can find "Übersetzung" as well as "translation".
      const descT = tContent('entries', e.name, 'description', e.description);
      const tagsT = tContent('entries', e.name, 'tags', e.tags || []);
      const ucT = tContent('entries', e.name, 'useCases', e.useCases || []);
      const hay = [
        e.name, e.description, descT, e.categoryName,
        ...(e.tags || []), ...(tagsT || []),
        ...(e.useCases || []), ...(ucT || []),
        e.origin?.country, e.license,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const sortEntries = (arr) => {
    const by = state.sort;
    const c = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
    if (by === 'stars') return [...arr].sort((a, b) => (b.github?.stars ?? -1) - (a.github?.stars ?? -1));
    if (by === 'recent') {
      return [...arr].sort((a, b) => new Date(b.github?.pushedAt || 0) - new Date(a.github?.pushedAt || 0));
    }
    return [...arr].sort((a, b) => c(a.name?.toLowerCase(), b.name?.toLowerCase()));
  };

  const renderCard = (e) => {
    const sourceBadge = e.isOpenSource
      ? el('span', { class: 'badge oss', text: t('dir_open_source') })
      : el('span', { class: 'badge closed', text: t('dir_closed_source') });
    const confBadge = e.curation?.confidence
      ? el('span', { class: `badge conf-${e.curation.confidence}`, text: tEnum('curation.confidence', e.curation.confidence) })
      : null;
    const maintBadge = e.curation?.maintenance
      ? el('span', { class: `badge maint-${e.curation.maintenance}`, text: tEnum('curation.maintenance', e.curation.maintenance) })
      : null;

    const head = el('div', { class: 'tool-card-head' },
      el('h3', {}, el('a', { href: e.homepage, target: '_blank', rel: 'noopener', text: e.name })),
      el('div', { class: 'tool-badges' }, sourceBadge, confBadge, maintBadge),
    );

    const desc = el('p', { class: 'tool-desc', text: tContent('entries', e.name, 'description', e.description) });

    const attrs = el('dl', { class: 'tool-attrs' });
    const addAttr = (labelKey, value) => {
      if (value == null || value === '') return;
      attrs.append(el('dt', {}, t(labelKey)), el('dd', {}, value));
    };
    addAttr('dir_origin', e.origin?.country || '');
    addAttr('dir_license', e.license || '—');
    addAttr('dir_pricing', tEnum('pricing', e.pricingModel) || '—');
    addAttr('dir_deployment', (e.deployment || []).map((d) => tEnum('deployment', d)).join(', ') || '—');
    if (e.github?.stars != null) {
      addAttr('dir_stars', `${fmtStars(e.github.stars)} (${relTime(e.github.pushedAt)})`);
    }
    if (isAll) {
      const catNameT = tContent('categories', e.categoryId, 'name', e.categoryName);
      attrs.append(el('dt', {}, t('dir_categories')), el('dd', {}, catNameT));
    }

    const tagsArr = tContent('entries', e.name, 'tags', e.tags) || [];
    const tags = tagsArr.length
      ? el('div', { class: 'tool-tags' }, ...tagsArr.slice(0, 6).map((tg) => el('span', { class: 'tag', text: tg })))
      : null;
    const useCasesArr = tContent('entries', e.name, 'useCases', e.useCases) || [];
    const useCases = useCasesArr.length
      ? el('div', { class: 'tool-usecases' }, ...useCasesArr.slice(0, 6).map((uc) => el('span', { class: 'tag', text: uc })))
      : null;

    const footer = el('div', { class: 'tool-footer' },
      el('a', { class: 'home', href: e.homepage, target: '_blank', rel: 'noopener' },
        el('span', { 'data-lucide': 'external-link' }), document.createTextNode(' ' + t('dir_view_homepage'))),
      e.repository ? el('a', { class: 'repo', href: e.repository, target: '_blank', rel: 'noopener' },
        el('span', { 'data-lucide': 'github' }), document.createTextNode(' ' + t('dir_view_repo'))) : null,
    );

    const evidenceText = tContent('entries', e.name, 'evidence', e.origin?.evidence);
    const evidence = evidenceText
      ? el('p', { class: 'tool-evidence', text: evidenceText })
      : null;

    return el('article', {
      class: 'tool-card',
      'data-source': e.isOpenSource ? 'oss' : 'closed',
    }, head, desc, attrs, tags, useCases, evidence, footer);
  };

  const render = () => {
    const filtered = sortEntries(entries.filter(matchEntry));
    if (grid) grid.replaceChildren(...filtered.map(renderCard));
    if (filtered.length === 0 && grid) {
      grid.replaceChildren(
        el('div', { class: 'dir-empty' },
          el('span', { class: 'icon', text: '🔍' }),
          el('p', {}, t('dir_results_none')),
        ),
      );
    }
    lucideIcons();
    const count = $('#dirCount');
    if (count) {
      const label = filtered.length === 1 ? t('dir_results_one') : t('dir_results_many', { n: filtered.length });
      count.innerHTML = `<strong>${filtered.length}</strong> ${label.replace(/^\d+\s*/, '')}`;
    }
    renderChips();
    syncUrl();
  };

  const chipsHost = $('#dirActiveFilters');
  const renderChips = () => {
    if (!chipsHost) return;
    const chips = [];
    const addChip = (label, key) => {
      chips.push(el('span', { class: 'filter-chip' },
        document.createTextNode(label),
        el('button', {
          type: 'button', 'aria-label': 'remove filter',
          onclick: () => {
            state[key] = '';
            const selId = `#f${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            const sel = document.querySelector(selId);
            if (sel) sel.value = '';
            render();
          },
        }, '×'),
      ));
    };
    if (state.country) addChip(state.country, 'country');
    if (state.license) addChip(state.license, 'license');
    if (state.deployment) addChip(state.deployment, 'deployment');
    if (state.pricing) addChip(state.pricing, 'pricing');
    if (state.source) addChip(state.source === 'oss' ? t('dir_open_source') : t('dir_closed_source'), 'source');
    if (state.q) addChip(`"${state.q}"`, 'q');
    chipsHost.replaceChildren(...chips);
  };

  const syncUrl = () => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) if (v) p.set(k, v);
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  };

  // Wire events
  $('#dirSearch')?.addEventListener('input', (e) => { state.q = e.target.value; render(); });
  $('#fCountry')?.addEventListener('change', (e) => { state.country = e.target.value; render(); });
  $('#fLicense')?.addEventListener('change', (e) => { state.license = e.target.value; render(); });
  $('#fDeployment')?.addEventListener('change', (e) => { state.deployment = e.target.value; render(); });
  $('#fPricing')?.addEventListener('change', (e) => { state.pricing = e.target.value; render(); });
  $('#fSource')?.addEventListener('change', (e) => { state.source = e.target.value; render(); });
  $('#fSort')?.addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  $('#dirClear')?.addEventListener('click', () => {
    Object.assign(state, { q: '', country: '', license: '', deployment: '', pricing: '', source: '', sort: 'name' });
    $('#dirSearch').value = '';
    ['#fCountry', '#fLicense', '#fDeployment', '#fPricing', '#fSource'].forEach((s) => { if ($(s)) $(s).value = ''; });
    $('#fSort').value = 'name';
    render();
  });

  // Re-render on language change: re-translate cards/empty-state/chips, and
// re-populate enum-labeled filter dropdowns so their labels localize while
// the selected raw value (canonical key) is preserved.
  document.addEventListener('langchange', () => {
    fillSelect('fCountry', countries, 'dir_filter_country');
    fillSelect('fLicense', licenses, 'dir_filter_license');
    fillSelect('fDeployment', deployments, 'dir_filter_deployment', (v) => tEnum('deployment', v));
    fillSelect('fPricing', pricing, 'dir_filter_pricing', (v) => tEnum('pricing', v));
    fillSelect('fSource', sourceOptions, 'dir_filter_source', (v) => (v === 'oss' ? t('dir_open_source') : t('dir_closed_source')));
    render();
  });

  render();
}

// ── Theme toggle (light / dark) ────────────────────────────────────────────
function initTheme() {
  const toggle = $('#themeToggle');
  const apply = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (toggle) {
      const isDark = theme === 'dark';
      const icon = isDark ? 'sun' : 'moon';
      toggle.innerHTML = `<span data-lucide="${icon}"></span>`;
      toggle.setAttribute('aria-pressed', String(!isDark));
    }
    lucideIcons();
  };
  const stored = localStorage.getItem('theme');
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  const initial = stored || (prefersLight ? 'light' : 'dark');
  apply(initial);
  toggle?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(next);
  });
}

// ── Hero starfield ─────────────────────────────────────────────────────────
function initHeroStars() {
  const host = $('#heroStars');
  if (!host || host.childElementCount) return;
  for (let i = 0; i < 36; i++) {
    const s = el('span', {
      class: 'sf-star',
      style: `left:${Math.round((i * 97) % 100)}%;top:${Math.round((i * 53) % 100)}%;animation-delay:${(i % 7) * 0.6}s;animation-duration:${3 + (i % 4)}s`,
      text: '★',
    });
    host.append(s);
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────
function boot() {
  initTheme();
  initI18n();
  initHeroStars();
  initDirectory();
  lucideIcons();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
