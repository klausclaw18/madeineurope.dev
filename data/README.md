# Directory Data

This folder is the source of truth for madeineurope.dev. The static website, bundled JSON asset, and GitHub catalog are all generated from these files.

## Files

- `directory.json` defines the public taxonomy and points to category files.
- `categories/*.json` contains curated entries, one focused category per file.
- `schema.json` documents the JSON shape for editors and external tools.
- `top-european-projects.json` powers the highlighted project section on the home page.

## Lookup Examples

Find tools for a developer need:

```sh
jq '.entries[] | select(.useCases[]? | test("monitor production|observability"; "i")) | {name, homepage}' data/categories/*.json
```

Find self-hostable tools:

```sh
jq '.entries[] | select(.deployment[]? == "self-hosted") | {name, category, homepage}' data/categories/*.json
```

Find high-confidence European entries:

```sh
jq '.entries[] | select(.curation.confidence == "high") | {name, country: .origin.country, evidence: .origin.evidence}' data/categories/*.json
```

Find open-source or open-core candidates:

```sh
jq '.entries[] | select(.isOpenSource == true) | {name, license, repository}' data/categories/*.json
```

## Maintenance

Run these commands after changing data:

```sh
npm run validate
npm run catalog
npm run build
```

Validation is intentionally strict about required fields, URLs, enum values, origin evidence, and curation metadata. Warnings call out unusual but sometimes acceptable cases, such as intentional cross-listings.
