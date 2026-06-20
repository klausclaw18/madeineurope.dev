import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const EUROPEAN_REGIONS = new Set(['EU', 'Europe', 'EEA', 'Global']);

export const REQUIRED_ENTRY_FIELDS = [
  'name',
  'homepage',
  'description',
  'origin',
  'tags',
  'useCases',
  'deployment',
  'pricingModel',
  'license',
  'isOpenSource',
  'curation',
  'sources',
];

const DEPLOYMENT_VALUES = new Set([
  'cloud',
  'self-hosted',
  'managed',
  'desktop',
  'hardware',
  'library',
  'api',
  'on-prem',
]);

const PRICING_VALUES = new Set([
  'free',
  'open-core',
  'commercial',
  'freemium',
  'paid',
  'hardware',
  'mixed',
  'unknown',
]);

const CONFIDENCE_VALUES = new Set(['high', 'medium', 'low']);
const MAINTENANCE_VALUES = new Set(['active', 'watch', 'unknown']);

export const readJSON = (absPath) => JSON.parse(readFileSync(absPath, 'utf8'));

export function loadDirectory(root) {
  const manifestPath = join(root, 'data', 'directory.json');
  const manifest = readJSON(manifestPath);
  const categories = [];

  for (const item of manifest.categories || []) {
    const rel = String(item.file || '').replace(/^\.\//, '');
    const abs = join(root, 'data', rel);
    if (!existsSync(abs)) {
      categories.push({
        id: item.id,
        name: item.name,
        description: '',
        categoryUseCases: [],
        entries: [],
        file: rel,
        missing: true,
      });
      continue;
    }

    const category = readJSON(abs);
    categories.push({
      ...category,
      id: category.id || item.id,
      name: category.name || item.name,
      file: rel,
      entries: category.entries || [],
    });
  }

  return { manifest, categories };
}

// ── Per-language content overrides ─────────────────────────────────────────
// Each file data/i18n/<lang>.json holds *optional* translations for category
// metadata and per-entry content (Tier 2 + Tier 3). Canonical English lives in
// data/categories/*.json and is always the fallback. Entries are indexed by
// their canonical English `name` (unique across the dataset), categories by id.
//
// Shape:
//   { categories: { "<id>": { name, description, categoryUseCases: [] } },
//     entries:    { "<entryName>": { description, tags: [], useCases: [], evidence } },
//     topProjects:{ "<projectName>": { name, description } } }
const SUPPORTED_LANGS = new Set([
  'en', 'de', 'fr', 'nl', 'es', 'it', 'pt', 'pl', 'sv', 'da', 'fi', 'cs',
  'ro', 'hu', 'sk', 'el', 'bg', 'hr', 'sl', 'et', 'lv', 'lt', 'ga', 'mt',
]);

export function loadI18nContent(root) {
  const dir = join(root, 'data', 'i18n');
  const content = {};
  if (!existsSync(dir)) return content;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const code = file.replace(/\.json$/, '');
    if (!SUPPORTED_LANGS.has(code)) continue; // unknown code → skip silently
    try {
      content[code] = readJSON(join(dir, file));
    } catch (e) {
      content[code] = { __error: e.message };
    }
  }
  return content;
}

export function flattenEntries(categories) {
  return categories.flatMap((category) => (category.entries || []).map((entry) => ({
    ...entry,
    categoryId: category.id,
    categoryName: category.name,
  })));
}

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const isUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

function requireString(errors, path, value) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${path} must be a non-empty string`);
}

function requireStringArray(errors, path, value, min = 1) {
  if (!Array.isArray(value) || value.length < min || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    errors.push(`${path} must be an array of at least ${min} non-empty string${min === 1 ? '' : 's'}`);
  }
}

export function validateDirectory(directory) {
  const errors = [];
  const warnings = [];
  const categoryIds = new Set();
  const names = new Map();

  if (!directory.manifest.name) errors.push('data/directory.json must include name');
  if (!Array.isArray(directory.manifest.categories) || directory.manifest.categories.length === 0) {
    errors.push('data/directory.json must include at least one category');
  }

  for (const category of directory.categories) {
    const prefix = `data/${category.file || `categories/${category.id}.json`}`;
    requireString(errors, `${prefix}.id`, category.id);
    requireString(errors, `${prefix}.name`, category.name);
    requireString(errors, `${prefix}.description`, category.description);
    requireStringArray(errors, `${prefix}.categoryUseCases`, category.categoryUseCases, 1);

    if (categoryIds.has(category.id)) errors.push(`duplicate category id: ${category.id}`);
    categoryIds.add(category.id);

    if (!Array.isArray(category.entries)) {
      errors.push(`${prefix}.entries must be an array`);
      continue;
    }

    for (const [index, entry] of category.entries.entries()) {
      const path = `${prefix}.entries[${index}]`;
      for (const field of REQUIRED_ENTRY_FIELDS) {
        if (!(field in entry)) errors.push(`${path}.${field} is required`);
      }

      requireString(errors, `${path}.name`, entry.name);
      requireString(errors, `${path}.description`, entry.description);
      if (!isUrl(entry.homepage)) errors.push(`${path}.homepage must be an http(s) URL`);
      if (entry.repository != null && !isUrl(entry.repository)) errors.push(`${path}.repository must be null or an http(s) URL`);

      if (entry.category && entry.category !== category.id && entry.category !== category.name) {
        warnings.push(`${path}.category is "${entry.category}" but category id is "${category.id}"`);
      }

      if (!isObject(entry.origin)) {
        errors.push(`${path}.origin must be an object`);
      } else {
        requireString(errors, `${path}.origin.country`, entry.origin.country);
        requireString(errors, `${path}.origin.region`, entry.origin.region);
        requireString(errors, `${path}.origin.evidence`, entry.origin.evidence);
        if (entry.origin.region && !EUROPEAN_REGIONS.has(entry.origin.region)) {
          warnings.push(`${path}.origin.region "${entry.origin.region}" is unusual; expected one of ${[...EUROPEAN_REGIONS].join(', ')}`);
        }
      }

      requireStringArray(errors, `${path}.tags`, entry.tags, 2);
      requireStringArray(errors, `${path}.useCases`, entry.useCases, 2);

      if (!Array.isArray(entry.deployment) || entry.deployment.length === 0) {
        errors.push(`${path}.deployment must include at least one deployment value`);
      } else {
        for (const value of entry.deployment) {
          if (!DEPLOYMENT_VALUES.has(value)) errors.push(`${path}.deployment includes unsupported value "${value}"`);
        }
      }

      if (!PRICING_VALUES.has(entry.pricingModel)) errors.push(`${path}.pricingModel has unsupported value "${entry.pricingModel}"`);
      if (typeof entry.isOpenSource !== 'boolean') errors.push(`${path}.isOpenSource must be boolean`);

      if (!isObject(entry.curation)) {
        errors.push(`${path}.curation must be an object`);
      } else {
        if (!CONFIDENCE_VALUES.has(entry.curation.confidence)) errors.push(`${path}.curation.confidence must be high, medium, or low`);
        if (!MAINTENANCE_VALUES.has(entry.curation.maintenance)) errors.push(`${path}.curation.maintenance must be active, watch, or unknown`);
        requireString(errors, `${path}.curation.notes`, entry.curation.notes);
      }

      if (!Array.isArray(entry.sources) || entry.sources.length === 0 || entry.sources.some((source) => !isUrl(source))) {
        errors.push(`${path}.sources must include at least one http(s) URL`);
      }

      if (entry.github != null) {
        if (!isObject(entry.github)) {
          errors.push(`${path}.github must be null or an object`);
        } else {
          requireString(errors, `${path}.github.repository`, entry.github.repository);
          if (typeof entry.github.stars !== 'number') errors.push(`${path}.github.stars must be a number`);
          requireString(errors, `${path}.github.pushedAt`, entry.github.pushedAt);
        }
      }

      const key = String(entry.name || '').toLowerCase();
      if (key) {
        const previous = names.get(key);
        if (previous && previous.categoryId !== category.id) {
          warnings.push(`${entry.name} appears in both ${previous.categoryId} and ${category.id}; keep only intentional cross-listings`);
        }
        names.set(key, { categoryId: category.id });
      }
    }
  }

  return { errors, warnings };
}

export function summarizeDirectory(categories) {
  const entries = flattenEntries(categories);
  const countries = new Set(entries.map((entry) => entry.origin?.country).filter(Boolean));
  const openSource = entries.filter((entry) => entry.isOpenSource).length;
  const selfHosted = entries.filter((entry) => entry.deployment?.includes('self-hosted')).length;

  return {
    categories: categories.length,
    entries: entries.length,
    countries: countries.size,
    openSource,
    selfHosted,
  };
}

// Validate per-language content overrides (data/i18n/*.json).
// Returns { errors, warnings, coverage }. Errors are fatal (malformed structure);
// warnings are advisory (orphan keys, stale array lengths) so renaming a tool or
// adding a category never breaks CI — the validator just tells you what's stale.
// coverage is a per-language report for the contributor compass (non-blocking).
export function validateI18nContent(categories, topProjects, content, manifestLangs = []) {
  const errors = [];
  const warnings = [];

  // Build lookup sets of canonical names/ids for orphan detection.
  const categoryIds = new Set(categories.map((c) => c.id));
  const entryNames = new Set(categories.flatMap((c) => (c.entries || []).map((e) => e.name)));
  const topProjectNames = new Set((topProjects || []).map((p) => p.name));
  // length lookups for stale-array warnings
  const entryLen = new Map(categories.flatMap((c) => (c.entries || []).map((e) => [e.name, e])));
  const catUseCasesLen = new Map(categories.map((c) => [c.id, (c.categoryUseCases || []).length]));

  const coverage = {};
  const totalEntries = entryNames.size;
  const totalCategories = categoryIds.size;
  const totalTop = topProjectNames.size;

  const requireString = (p, v) => {
    if (typeof v !== 'string' || v.trim() === '') errors.push(`${p} must be a non-empty string`);
  };
  const requireStringArray = (p, v) => {
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || x.trim() === '')) {
      errors.push(`${p} must be an array of non-empty strings`);
    }
    return Array.isArray(v) ? v : [];
  };

  const langCodes = Object.keys(content || {});
  const expectedLangs = manifestLangs.length ? manifestLangs : langCodes;

  for (const code of langCodes) {
    const prefix = `data/i18n/${code}.json`;
    const lang = content[code];

    if (lang && lang.__error) {
      errors.push(`${prefix}: ${lang.__error}`);
      continue;
    }
    if (!isObject(lang)) {
      errors.push(`${prefix} must be a JSON object`);
      continue;
    }

    let catCount = 0, entryCount = 0, topCount = 0;

    // categories
    if (lang.categories != null) {
      if (!isObject(lang.categories)) {
        errors.push(`${prefix}.categories must be an object keyed by category id`);
      } else for (const [id, c] of Object.entries(lang.categories)) {
        if (!categoryIds.has(id)) { warnings.push(`${prefix}.categories["${id}"] does not match a known category id — stale?`); continue; }
        if (!isObject(c)) { errors.push(`${prefix}.categories["${id}"] must be an object`); continue; }
        if (c.name != null) requireString(`${prefix}.categories["${id}"].name`, c.name);
        if (c.description != null) requireString(`${prefix}.categories["${id}"].description`, c.description);
        if (c.categoryUseCases != null) {
          const arr = requireStringArray(`${prefix}.categories["${id}"].categoryUseCases`, c.categoryUseCases);
          const want = catUseCasesLen.get(id);
          if (want != null && arr.length !== want) warnings.push(`${prefix}.categories["${id}"].categoryUseCases has ${arr.length} items, canonical has ${want}`);
        }
        catCount++;
      }
    }

    // entries
    if (lang.entries != null) {
      if (!isObject(lang.entries)) {
        errors.push(`${prefix}.entries must be an object keyed by entry name`);
      } else for (const [name, e] of Object.entries(lang.entries)) {
        if (!entryNames.has(name)) { warnings.push(`${prefix}.entries["${name}"] does not match a known entry — stale or typo?`); continue; }
        if (!isObject(e)) { errors.push(`${prefix}.entries["${name}"] must be an object`); continue; }
        if (e.description != null) requireString(`${prefix}.entries["${name}"].description`, e.description);
        if (e.evidence != null) requireString(`${prefix}.entries["${name}"].evidence`, e.evidence);
        if (e.tags != null) {
          const arr = requireStringArray(`${prefix}.entries["${name}"].tags`, e.tags);
          const want = entryLen.get(name);
          if (want && arr.length !== (want.tags || []).length) warnings.push(`${prefix}.entries["${name}"].tags has ${arr.length}, canonical has ${(want.tags || []).length}`);
        }
        if (e.useCases != null) {
          const arr = requireStringArray(`${prefix}.entries["${name}"].useCases`, e.useCases);
          const want = entryLen.get(name);
          if (want && arr.length !== (want.useCases || []).length) warnings.push(`${prefix}.entries["${name}"].useCases has ${arr.length}, canonical has ${(want.useCases || []).length}`);
        }
        entryCount++;
      }
    }

    // topProjects
    if (lang.topProjects != null) {
      if (!isObject(lang.topProjects)) {
        errors.push(`${prefix}.topProjects must be an object keyed by project name`);
      } else for (const [name, p] of Object.entries(lang.topProjects)) {
        if (!topProjectNames.has(name)) { warnings.push(`${prefix}.topProjects["${name}"] does not match a known top project — stale?`); continue; }
        if (!isObject(p)) { errors.push(`${prefix}.topProjects["${name}"] must be an object`); continue; }
        if (p.name != null) requireString(`${prefix}.topProjects["${name}"].name`, p.name);
        if (p.description != null) requireString(`${prefix}.topProjects["${name}"].description`, p.description);
        topCount++;
      }
    }

    coverage[code] = {
      categories: totalCategories ? `${catCount}/${totalCategories}` : `${catCount}`,
      entries: totalEntries ? `${entryCount}/${totalEntries}` : `${entryCount}`,
      topProjects: totalTop ? `${topCount}/${totalTop}` : `${topCount}`,
    };
  }

  return { errors, warnings, coverage };
}
