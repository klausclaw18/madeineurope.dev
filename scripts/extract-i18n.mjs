#!/usr/bin/env node
// One-off extractor: pull langData + languages out of the legacy index.html
// and emit src/i18n.json with added directory UI keys.
// Re-run anytime the legacy file changes: `node scripts/extract-i18n.mjs`
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const legacy = readFileSync(join(root, 'index.html'), 'utf8');

// Robust brace/bracket matcher: from the opening token, find its matching close.
function extractBalanced(src, opener, startKey) {
  const start = src.indexOf(startKey);
  if (start === -1) throw new Error(`marker ${startKey} not found`);
  const openIdx = src.indexOf(opener, start + startKey.length);
  const close = opener === '{' ? '}' : ']';
  let depth = 0, i = openIdx, inStr = false, esc = false, quote = '';
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) { esc = false; }
      else if (c === '\\') esc = true;
      else if (c === quote) inStr = false;
    } else {
      if (c === '"' || c === "'" || c === '`') { inStr = true; quote = c; }
      else if (c === opener) depth++;
      else if (c === close) { depth--; if (depth === 0) { i++; break; } }
    }
  }
  return src.slice(openIdx, i);
}
const langData = eval('(' + extractBalanced(legacy, '{', 'const langData =') + ')');
const languages = eval('(' + extractBalanced(legacy, '[', 'const languages =') + ')');

// Directory UI strings. Keep keys stable; per-language best-effort translations
// fall back to English when a language is missing a key.
const dirUi = {
  en: {
    dir_search_placeholder: "Search tools, tags, use cases…",
    dir_filter_all: "All categories",
    dir_filter_country: "Country",
    dir_filter_license: "License",
    dir_filter_deployment: "Deployment",
    dir_filter_pricing: "Pricing",
    dir_filter_source: "Source",
    dir_sort: "Sort",
    dir_sort_name: "Name (A–Z)",
    dir_sort_stars: "GitHub stars",
    dir_sort_recent: "Recently pushed",
    dir_results_one: "1 tool",
    dir_results_many: "{n} tools",
    dir_results_none: "No tools match your filters.",
    dir_clear: "Clear filters",
    dir_open_source: "Open source",
    dir_closed_source: "Proprietary",
    dir_view_repo: "View repository",
    dir_view_homepage: "Visit homepage",
    dir_origin: "Origin",
    dir_license: "License",
    dir_pricing: "Pricing",
    dir_deployment: "Deployment",
    dir_use_cases: "Use cases",
    dir_confidence: "Curation confidence",
    dir_maintenance: "Maintenance",
    dir_stars: "stars",
    dir_back: "← Back to directory",
    dir_jump_to: "Jump to category",
    dir_categories: "Categories",
    dir_evidence: "Evidence",
    dir_all_tools: "All tools",
    dir_top_projects: "Top European projects"
  }
};

// Merge: existing per-language strings + dirUi fallback to English.
const out = { languages, translations: {} };
for (const code of Object.keys(langData)) {
  out.translations[code] = { ...langData[code], ...(dirUi[code] || dirUi.en) };
}
// Ensure every language has all dirUi keys (fall back to English).
for (const code of Object.keys(out.translations)) {
  for (const [k, v] of Object.entries(dirUi.en)) {
    if (!(k in out.translations[code])) out.translations[code][k] = v;
  }
}

writeFileSync(join(root, 'src/i18n.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`Wrote src/i18n.json: ${out.languages.length} languages, ${Object.keys(out.translations.en).length} keys/en.`);