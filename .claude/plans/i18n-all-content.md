# Full 24-language support for all site content

## Goal
Extend the existing 24-EU-language system — today only the landing-page marketing copy is translated — to cover **every user-facing string on the site**: directory UI chrome, category names/descriptions, the 43 tool entries (description / tags / use cases / evidence), the top projects, the "Why Europe" reasons, and page `<title>`/meta.

Constraints (decided with the user):
- **Client-side swap, one HTML per route** — no `/de/...` URL duplication; the existing JSON-island + `data-i18n` pattern just gets extended. Suits GitHub Pages, instant language switching, no 24× build cost.
- **Human-authored translations in JSON, validated at build** — no machine translation, no API keys. Community-driven like the rest of the data.

## The core insight / clever part
Today there are **two parallel i18n systems that don't know about each other**:

1. `src/i18n.json` `translations` — a flat `{key: string}` dictionary per language, applied to `data-i18n` elements in static HTML.
2. The directory data in `data/` — English prose baked into every entry, fetched as a JSON bundle and rendered client-side by `renderCard()`.

The fix is to **unify them under one translation model** with three tiers of content, each handled differently because they have different translation economics:

- **Tier 1 — UI chrome & enum labels** (fixed, enumerable vocabulary): `dir_*` strings, deployment values (`cloud`, `self-hosted`…), pricing (`free`, `open-core`…), curation (`high`/`active`…), "Why Europe" reasons. These are **keys**, looked up from a per-language dictionary. Finite set, translate once per language, done forever. Add new enum terms → add new dictionary entries.
- **Tier 2 — content metadata** (one string per *category* + per *top project*): category `name`/`description`/`categoryUseCases`, top-project `name`/`description`. Small set (~9 + 5), contributor-authored per-language.
- **Tier 3 — per-entry content** (43 entries × several fields): entry `description`, `tags`, `useCases`, `origin.evidence`. The long tail. Contributor-authored per-language, optional per entry.

The single design rule that makes this clean: **enum values stay as machine-readable keys in the data; everything a human reads is looked up by key from a dictionary, or pulled from a per-language content object with graceful fallback to English.**

## Data model

### Tier 1 — `src/i18n.json` `translations` (extend, don't restructure)
- Finish translating the existing `dir_*` keys for all 24 languages (23 are English today). This is bulk work, scoped into the implementation as a separate pass so it doesn't block the architecture.
- Add enum-label namespaces, one key per enum value, all 24 languages:
  - `enum.deployment.cloud`, `enum.deployment.self-hosted`, … (8 values)
  - `enum.pricing.free`, `enum.pricing.open-core`, … (8 values)
  - `enum.curation.confidence.high/medium/low`, `enum.curation.maintenance.active/watch/unknown`
- Add keys for the "Why Europe" reasons (6×2 = heading + body each) and the landing hardcoded lines, so `landing.html` stops having un-translated English.

### Tier 2 & 3 — per-language content files
New directory: `data/i18n/<lang>.json` for each of the 24 languages (e.g. `data/i18n/de.json`). Shape:

```json
{
  "categories": {
    "ai-ml": {
      "name": "KI & ML",
      "description": "Europäische KI-APIs, Modell-Anbieter, …",
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
    "Qdrant": { "name": "Qdrant", "description": "…" }
  }
}
```

**Key choices:**
- **Index entries by `name`** (the English/canonical name), not by a slug. Names are already unique across the dataset (validator warns on dupes), and it keeps contributors' mental model simple: "translate the entry called *Mistral AI* into German." No new IDs to mint or keep in sync.
- **Partial coverage is fine and explicit.** If `data/i18n/de.json` has no entry for `"Jina AI"`, the runtime falls back to the English `description` from `data/categories/*.json`. The validator reports missing-but-this-is-ok coverage; it never blocks a PR on a missing translation (only on *malformed* ones).
- **Canonical English stays the source of truth** in `data/categories/*.json` / `data/top-european-projects.json`, untouched. `data/i18n/*.json` only carries *overrides*. So English is never out of sync with itself, and a contributor who only knows English still ships a valid site.

## Runtime (`src/client.mjs`)
1. Parse `#i18n-data` island as today → `window.__i18n__` (UI dict) **and** `window.__i18nContent__` (the current language's Tier 2/3 content object). The build inlines the selected language's content object alongside the UI dict — but since the page is single-HTML and the language can switch at runtime, we instead inline **all 24 content objects** keyed by language code, and `apply(code)` swaps both `__i18n__` and `__i18nContent__` together.
2. Extend the `t()` helper with content lookup:
   - `tContent(kind, key, field, fallback)` → returns `__i18nContent__[kind][key][field]` or `fallback`.
3. `renderCard()` uses `tContent('entries', e.name, 'description', e.description)` etc. so each card re-renders in the active language on `langchange`. The existing `document.addEventListener('langchange', () => render())` already re-renders the grid — so per-entry translation is wired almost for free once the data reaches the client.
4. `apply(code)` gains: set `<title>`, `<meta description>`, `<html lang>`, and translate the category hero (name/desc/use cases) and "Why Europe" section — all via `data-i18n` attributes already present or newly added.
5. Enum rendering: `renderCard` and the SSR `renderToolCard` both map `e.deployment` / `e.pricingModel` / `curation.*` values through `t('enum.deployment.cloud')` etc. instead of echoing the raw key. (Raw keys were never user-shown, but this is what makes them actually localized.)

### Payload size note
Inlining 24 content objects × ~43 entries is real but bounded. Mitigations, in order of preference: (a) inline only, keep it, measure — the existing bundle is already ~all-entries JSON and loads fine; (b) if it's too big, split into `assets/i18n/<lang>.json` fetched lazily on language switch (only the chosen language downloads). The plan defaults to inline for instant switching and revisits if `dist/index.html` grows past a sensible threshold. Decision deferred to the build-size check in implementation.

## Build (`scripts/build.mjs`)
- Load all `data/i18n/*.json` present; assemble `{ <lang>: <content> }`. Missing files = that language simply has no Tier 2/3 overrides (falls back to English) — not an error.
- Build the merged i18n island: `{ languages, translations, content: { de: {...}, fr: {...}, … } }`.
- `renderToolCard` (SSR fallback for no-JS) maps enum values through the English dictionary so the initial HTML is correct English. Enum labels + "Why Europe" get `data-i18n` attributes so they swap client-side.
- Landing: replace the hardcoded English "Why Europe" `<h4>`/`<p>` pairs with `data-i18n`-tagged versions; add keys for them.
- Category page: tag the hero name/desc/use-cases with `data-i18n-content` attributes keyed by category id, OR render them client-side from the content object. (Leaning: render hero client-side from `__i18nContent__` so it follows the same fallback path as cards — single code path.)
- Set `<title>`/meta to English at build (correct for crawlers/no-JS); client overrides on language pick.

## Validation (`scripts/lib/directory.mjs` + `scripts/validate.mjs`)
Extend `validateDirectory` to check `data/i18n/*.json`:
- Each file must be an object with `categories` / `entries` / `topProjects` (all optional, may be empty).
- Every `entries` key must match a real entry `name` in the canonical data — **orphan translations (typos, renamed tools) are warnings**, not errors, so renaming a tool doesn't break CI until someone cleans up.
- Every `categories` key must match a real category `id`.
- Translated `tags`/`useCases` arrays must be non-empty and ideally match the canonical entry's array length (warning if length differs — signals a stale translation).
- Add a **coverage report** to `npm run validate` output: per language, % of entries/categories with translations. Visible, not blocking. This is the contributor compass — it shows which languages need love without gating PRs.

## Catalog (`scripts/catalog.mjs`)
`CATALOG.md` is the GitHub-browsing markdown index. Keep it English (it's a developer reference for the repo itself, not a localized product surface). No change needed beyond confirming it still builds — it reads canonical English, which is untouched. Document this choice in CONTRIBUTING.

## CONTRIBUTING.md
Add an "Internationalization" section:
- How to add a new language file (`data/i18n/<code>.json`).
- The fallback rule (partial is fine; English is always the baseline).
- The indexing-by-`name` convention.
- `npm run validate` shows coverage; aim to translate Tier 2 (categories) first, then Tier 3 entries incrementally.
- Don't translate enum *values* in entry data — those are keys. Only translate via `src/i18n.json` `enum.*`.

## Implementation order (so it ships in reviewable chunks)
1. **Enum labels in `src/i18n.json`** + finish `dir_*` for all 24 — purely dictionary work, no architecture change. Land this and the directory chrome is already fully localized.
2. **Content data model**: create `data/i18n/` + extend `directory.mjs` loader + validator. Ship with one example language file (e.g. `de.json` covering the `ai-ml` category + a few entries) to prove the shape.
3. **Build**: merge content objects into the island, wire enum translation + hero/why-europe `data-i18n`.
4. **Client**: `tContent` + use it in `renderCard` + hero/why-europe re-render on `langchange` + `<title>`/meta/`<html lang>` on `apply`.
5. **Coverage report** in `validate`, **CONTRIBUTING** section.
6. **Seed translations**: translate at least categories + top projects for a handful of languages (de, fr, nl, es) so the feature is visibly working end-to-end. Remaining languages fill in via community PRs over time.

## Out of scope (explicitly)
- Per-language URL routes (`/de/developer-tools.html`). Chosen against; revisit only if SEO-per-language becomes a hard requirement.
- Machine translation fallback. Chosen against.
- Translating `CATALOG.md` (repo-internal dev doc, English).
- Translating `origin.country` (proper nouns — "Germany"/"Deutschland" — left as canonical English in data; a future enhancement could add country-name localization via the `enum.*` pattern, but not now).