#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import {
  loadDirectory, summarizeDirectory, validateDirectory,
  loadI18nContent, validateI18nContent,
} from './lib/directory.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const directory = loadDirectory(root);
const { manifest, categories } = directory;
const { errors, warnings } = validateDirectory(directory);
const summary = summarizeDirectory(categories);

// Load top projects (optional) for i18n content validation.
let topProjects = [];
const topPath = join(root, 'data', 'top-european-projects.json');
if (existsSync(topPath)) {
  try { topProjects = JSON.parse(readFileSync(topPath, 'utf8')).entries || []; }
  catch { /* build.mjs already warns; ignore here */ }
}

// Language list comes from the i18n manifest so the validator knows which
// languages *could* have content files (absence is fine — English is fallback).
const i18nManifest = JSON.parse(readFileSync(join(root, 'src', 'i18n.json'), 'utf8'));
const langCodes = i18nManifest.languages.map((l) => l.code);

const i18nContent = loadI18nContent(root);
const i18nResult = validateI18nContent(categories, topProjects, i18nContent, langCodes);

for (const warning of [...warnings, ...i18nResult.warnings]) console.warn(`[warn] ${warning}`);

if (errors.length > 0 || i18nResult.errors.length > 0) {
  for (const error of [...errors, ...i18nResult.errors]) console.error(`[error] ${error}`);
  const total = errors.length + i18nResult.errors.length;
  console.error(`[validate] failed with ${total} error${total === 1 ? '' : 's'}`);
  process.exit(1);
}

console.log(
  `[validate] ok: ${summary.entries} entries, ${summary.categories} categories, ` +
  `${summary.countries} countries, ${summary.openSource} open-source, ${summary.selfHosted} self-hostable`,
);

// Coverage report — the contributor compass. Non-blocking: it only shows which
// languages have translations, it never gates a PR.
const coverage = i18nResult.coverage;
const langLines = langCodes
  .map((code) => ({ code, ...coverage[code] }))
  .filter((c) => c.entries || c.categories || c.topProjects);
if (langLines.length) {
  console.log('[validate] i18n content coverage (Tier 2/3 — English is the fallback):');
  for (const l of langLines) {
    console.log(`  ${l.code}: categories ${l.categories || '0/' + categories.length}, entries ${l.entries || '0/' + summary.entries}, top ${l.topProjects || '0'}`);
  }
} else {
  console.log('[validate] i18n content: no data/i18n/*.json files yet (everything serves English)');
}