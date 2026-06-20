#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenEntries, loadDirectory, summarizeDirectory } from './lib/directory.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { manifest, categories } = loadDirectory(root);
const entries = flattenEntries(categories);
const summary = summarizeDirectory(categories);

const anchor = (value) => String(value)
  .toLowerCase()
  .replace(/&/g, '')
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-');

const sorted = (values) => [...values].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)));
const byName = (a, b) => a.name.localeCompare(b.name);
const tableValue = (value) => String(value ?? '').replace(/\|/g, '\\|');

const countries = new Map();
const deployments = new Map();
const useCases = new Map();
const licenses = new Map();

for (const entry of entries) {
  const add = (map, key) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  };

  add(countries, entry.origin?.country);
  for (const deployment of entry.deployment || []) add(deployments, deployment);
  for (const useCase of entry.useCases || []) add(useCases, useCase);
  add(licenses, entry.license || 'Proprietary / service');
}

function renderEntry(entry) {
  const model = [
    entry.isOpenSource ? 'open-source' : 'closed/source-available',
    entry.pricingModel,
    ...(entry.deployment || []),
  ].join(', ');

  return `| [${tableValue(entry.name)}](${entry.homepage}) | ${tableValue(entry.categoryName)} | ${tableValue(entry.origin?.country)} | ${tableValue(model)} | ${tableValue((entry.useCases || []).slice(0, 3).join('; '))} |`;
}

function renderCompactIndex(title, map, maxItems = 24) {
  const items = sorted(map.keys()).slice(0, maxItems)
    .map((key) => {
      const seen = new Set();
      const entries = map.get(key)
        .sort(byName)
        .filter((entry) => {
          const id = entry.homepage || entry.name;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .slice(0, 8);
      return `- **${key}**: ${entries.map((entry) => `[${entry.name}](${entry.homepage})`).join(', ')}`;
    })
    .join('\n');
  return `## ${title}\n\n${items || '_No entries yet._'}\n`;
}

const lines = [];
lines.push('# Made in Europe Developer Directory');
lines.push('');
lines.push('This catalog is generated from `data/` and is meant for developers browsing the repository directly on GitHub.');
lines.push('');
lines.push(`Last research pass: **${manifest.researchDate || 'unknown'}**`);
lines.push('');
lines.push(`- **${summary.entries}** tools and services`);
lines.push(`- **${summary.categories}** developer categories`);
lines.push(`- **${summary.countries}** represented origins`);
lines.push(`- **${summary.openSource}** entries flagged as open-source or open components`);
lines.push(`- **${summary.selfHosted}** self-hostable entries`);
lines.push('');
lines.push('## Browse by Category');
lines.push('');
for (const category of categories) {
  lines.push(`- [${category.name}](#${anchor(category.name)}) - ${(category.entries || []).length} entries`);
}
lines.push('');
lines.push('## Lookup Shortcuts');
lines.push('');
lines.push('- Need hosting or regulated infrastructure? Start with `cloud`, `managed`, and `on-prem` deployment labels.');
lines.push('- Need control over runtime and data? Start with `self-hosted` and open-source entries.');
lines.push('- Need an alternative for a specific workflow? Search this file for a use case such as `add SSO`, `monitor production`, `accept iDEAL`, or `build RAG systems`.');
lines.push('- Need procurement confidence? Prefer entries with `curation.confidence: high` in the JSON source.');
lines.push('');

for (const category of categories) {
  lines.push(`## ${category.name}`);
  lines.push('');
  lines.push(category.description || '');
  lines.push('');
  if ((category.categoryUseCases || []).length) {
    lines.push(`Common use cases: ${category.categoryUseCases.map((item) => `\`${item}\``).join(', ')}`);
    lines.push('');
  }
  lines.push('| Tool | Category | Origin | Model | Developer use cases |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const entry of [...(category.entries || [])].sort(byName)) lines.push(renderEntry({ ...entry, categoryName: category.name }));
  lines.push('');
}

lines.push(renderCompactIndex('Browse by Country', countries));
lines.push(renderCompactIndex('Browse by Deployment', deployments));
lines.push(renderCompactIndex('Browse by License', licenses, 30));
lines.push(renderCompactIndex('Common Use Cases', useCases, 40));

lines.push('## Maintenance');
lines.push('');
lines.push('Run `npm run validate` before opening a pull request. Run `npm run catalog` after changing `data/` so this GitHub catalog stays synchronized with the static site.');
lines.push('');

const output = lines.join('\n');
writeFileSync(join(root, 'CATALOG.md'), output, 'utf8');
console.log(`[catalog] wrote CATALOG.md with ${entries.length} entries`);
