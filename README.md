# 🇪🇺 madeineurope.dev

> A curated directory of developer tools, software, services & hardware made in Europe.

The repository is a **declarative directory**: the source of truth lives in `data/` as
JSON. A zero-dependency static site generator consumes that data and renders a static
site with a **dynamic front-end** (live search, multi-facet filters, sort, and a
24-EU-language switcher) into `dist/`.

## What is this?

A community-driven list of software, SaaS, hardware, and cloud services built by
European companies — privacy-first, GDPR-native, and keeping your data on this side of
the Atlantic.

## Architecture

```
data/                       ← source of truth (declarative JSON)
  directory.json            ← taxonomy: list of categories + their files
  schema.json              ← entry schema (JSON Schema 2020-12)
  top-european-projects.json
  categories/*.json        ← one file per category, edited by curators
src/
  templates/landing.html   ← landing page template ({{token}} placeholders)
  templates/category.html  ← directory page template (search/filter/sort UI)
  styles.css               ← full stylesheet (EU-themed dark UI)
  client.mjs               ← browser ES module: i18n switcher + directory engine
  i18n.json                ← 24 EU languages (extracted from legacy page + UI keys)
scripts/
  build.mjs                ← static site generator → dist/
  serve.mjs                ← tiny zero-dep dev server
  extract-i18n.mjs        ← one-off: regenerate src/i18n.json from legacy page
.github/workflows/deploy.yml ← build + deploy dist/ to GitHub Pages
dist/                      ← generated site (gitignored, built on push)
```

The data is the source of truth; the site is a consumer of it
(see `DIRECTORY_BEST_PRACTICE_PATTERNS.md`, pattern 10).

## Getting started

Requires Node.js 20+.

```sh
npm run build     # render data/ → dist/ (landing + one page per category + all.html)
npm run serve     # serve dist/ at http://localhost:4321
npm run dev       # rebuild on data/src/scripts change + serve
npm start         # build && serve
```

## Curating content

Edit the declarative JSON — no HTML to touch.

- Add a tool → append an entry to `data/categories/<category>.json` (see `data/schema.json` for the shape).
- Add a category → add it to `data/directory.json` and create `data/categories/<id>.json`.
- Rebuild → `npm run build` (or it auto-rebuilds under `npm run dev`).

Every entry should include: `name`, `category`, `homepage`, `description`,
`origin.country`, `origin.evidence`, `tags`, `useCases`, `deployment`,
`pricingModel`, `license`, `isOpenSource`, `curation.confidence`, `sources`
(see `data/README.md` for lookup examples).

## The dynamic directory

Each category page (and `/all.html`) ships with a sticky toolbar offering:

- **Live text search** across name, description, tags, use cases, origin.
- **Faceted filters**: country, license, deployment, pricing, open/closed source.
- **Sort**: name, GitHub stars, recently pushed.
- **Shareable state**: filters are mirrored to the URL query string.
- **24-EU-language switcher** with a modal chooser (strings in `src/i18n.json`).

The page initially renders skeleton cards, fetches `/assets/directory.json`
(the bundled data), then hydrates the grid — all client-side, no framework.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which runs `npm run build`
and deploys `dist/` to GitHub Pages via `actions/deploy-pages`.

In the repo settings → **Pages → Source**, select **GitHub Actions** (not "Deploy
from a branch"). The `CNAME` (custom domain `madeineurope.dev`) is copied into
`dist/` automatically by the build.

## Regenerating i18n

The 24-language strings were extracted from the legacy hand-written landing page
into `src/i18n.json`. Directory UI strings are added there too. If you need to
re-extract from an updated legacy file:

```sh
node scripts/extract-i18n.mjs
```

## Why it matters

European tools aren't just about compliance. They're about choosing where your data
lives and who has access to it. GDPR by default, lower latency for EU users, and
supporting local tech ecosystems.

## License

MIT