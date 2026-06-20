# Contributing

Thanks for helping make European developer tooling easier to find. This repository is data-first: every contribution should improve the structured JSON in `data/` or the static app that renders it.

## Inclusion Rules

An entry belongs here when it is useful to developers and has credible European origin or European governance. Examples include:

- software, SaaS, APIs, infrastructure, and hardware used to build or operate software
- open-source projects with European foundation, company, or maintainer governance
- commercial services with a European company, headquarters, legal entity, or strong European data-residency fit

Every entry needs evidence. Prefer official homepages, imprint/legal pages, repository organizations, foundation pages, docs, or public company records.

## Required Entry Shape

Each listing must include:

- `name`
- `homepage`
- `description`
- `origin.country`, `origin.region`, and `origin.evidence`
- `tags`
- `useCases`
- `deployment`
- `pricingModel`
- `license`
- `isOpenSource`
- `curation.confidence`, `curation.maintenance`, and `curation.notes`
- `sources`

`repository` and `github` metadata are optional. Add them when there is a canonical repository for the product or project.

## Curation Guidance

Use developer-first descriptions. Good descriptions answer “why would I use this in my stack?” rather than repeating marketing copy.

Use cases should be task-oriented:

- Good: `add SSO`, `monitor production`, `store embeddings`, `accept iDEAL`
- Weak: `enterprise`, `platform`, `innovation`

Confidence should reflect evidence quality:

- `high`: official European legal/company/foundation evidence is clear
- `medium`: strong public evidence exists, but legal structure or governance needs review
- `low`: useful candidate, but origin or current ownership is uncertain

Maintenance should reflect current state:

- `active`: product or repository is visibly maintained
- `watch`: useful, but activity, governance, or licensing needs periodic review
- `unknown`: not enough information yet

## Workflow

```sh
npm run validate
npm run catalog
npm run build
```

Open a pull request with a short explanation of the developer need being served. If you add a lower-confidence entry, explain why it is still useful and what needs verification later.

## Internationalization (24 EU languages)

The site supports all 24 official EU languages. There are three tiers of translatable content, handled differently because they have different translation economics:

1. **UI chrome & enum labels** (finite vocabulary — `dir_*` strings, deployment/pricing/curation values, the "Why Europe" reasons) live in `src/i18n.json` under `translations.<lang>`. Enum values in entry data (`deployment`, `pricingModel`, `curation.confidence/maintenance`) are **machine-readable keys**, never free text — they're mapped to localized labels via the `enum.*` namespace at render time. Don't translate enum *values* in the data files; translate their labels in `src/i18n.json`.
2. **Category + top-project content** (names, descriptions, use cases) is small and high-value.
3. **Per-entry content** (the 43 tools' `description`, `tags`, `useCases`, `evidence`) is the long tail.

### How to add translations

Per-language content overrides live in `data/i18n/<lang>.json` (e.g. `data/i18n/de.json`). **Canonical English stays the single source of truth** in `data/categories/*.json` and `data/top-european-projects.json` — the `data/i18n/` files only carry *overrides*. Missing translations fall back to English automatically, so partial coverage is fine and a contributor who only knows English still ships a valid site.

File shape (all sections optional — provide only what you translate):

```json
{
  "categories": {
    "ai-ml": {
      "name": "KI & ML",
      "description": "Europäische KI-APIs …",
      "categoryUseCases": ["…", "…", "…", "…"]
    }
  },
  "entries": {
    "Mistral AI": {
      "description": "Französische AI-Firma …",
      "tags": ["llm", "api", "modelle", "open-weights", "frankreich"],
      "useCases": ["europäische LLM-APIs aufrufen", "…"],
      "evidence": "Mistral AI ist ein französisches AI-Unternehmen."
    }
  },
  "topProjects": {
    "n8n": { "name": "n8n", "description": "Workflow-Automatisierungsplattform …" }
  }
}
```

Key conventions:

- **Index entries by their canonical English `name`** (e.g. `"Mistral AI"`), and categories by their `id` (e.g. `"ai-ml"`). These are unique across the dataset.
- `tags` / `useCases` / `categoryUseCases` arrays should have the **same length** as the canonical English arrays — the validator warns on mismatched lengths (a stale-translation signal).
- Translate incrementally: categories first (Tier 2), then entries (Tier 3). `npm run validate` prints a **coverage report** per language showing exactly what's translated and what isn't — it's your compass, never a gate. A missing translation is never an error; only a malformed file is.

The validator also warns on **orphan keys** (a `data/i18n/<lang>.json` entry name that doesn't match any canonical entry) — this is how a renamed tool surfaces for cleanup without breaking CI.
