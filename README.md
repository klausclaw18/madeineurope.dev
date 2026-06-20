# madeineurope.dev

A statically generated developer directory for finding software, services, cloud providers, hardware, and infrastructure made in Europe.

The project has two equal outputs:

- `https://madeineurope.dev` - a fast static web app with search, filters, category pages, and shareable URLs.
- [`CATALOG.md`](./CATALOG.md) - a generated GitHub catalog for developers who prefer browsing the repository directly.

## Find Tools

Use the web app when you want interactive lookup by:

- developer use case, such as `add SSO`, `host EU applications`, `build RAG systems`, or `accept iDEAL`
- country or region of origin
- deployment model, including `self-hosted`, `cloud`, `managed`, `api`, `desktop`, `hardware`, and `on-prem`
- source model, license, pricing model, confidence, and maintenance status

Use [`CATALOG.md`](./CATALOG.md) when reviewing the directory on GitHub. It is generated from the same JSON data as the website.

## Repository Model

`data/` is the source of truth. The website and GitHub catalog are consumers.

```text
data/
  directory.json                 taxonomy and category file list
  schema.json                    documented entry shape
  categories/*.json              curated category entries
  top-european-projects.json     highlighted open-source projects
src/
  templates/*.html               static page templates
  client.mjs                     progressive enhancement for search/filter/sort/i18n
  styles.css                     app styling
scripts/
  build.mjs                      validates data and renders dist/
  catalog.mjs                    generates CATALOG.md
  validate.mjs                   checks data quality and consistency
```

## Local Development

Requires Node.js 20+ and no npm dependencies.

```sh
npm run validate  # check data quality
npm run catalog   # regenerate CATALOG.md
npm run build     # validate and render dist/
npm run serve     # serve dist/ at http://localhost:4321
npm run dev       # watch data/src/scripts and serve locally
npm run check     # validate + build
```

## Add or Edit an Entry

1. Pick the closest file in `data/categories/`.
2. Add or update one JSON object in `entries`.
3. Include official evidence for European origin in `origin.evidence` and `sources`.
4. Run `npm run validate`.
5. Run `npm run catalog` if the data changed.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for curation rules and examples.

## Deployment

GitHub Actions runs validation, builds `dist/`, and deploys it to GitHub Pages. The `CNAME` file is copied into `dist/` during build.

## License

MIT
