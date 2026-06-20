# Directory Data

This directory is the source of truth for `madeineurope.dev` curation.

## Files

- `directory.json` lists the taxonomy and points to each category file.
- `top-european-projects.json` contains the current top 5 GitHub-starred, recently maintained European projects found during the 2026-06-20 research pass.
- `categories/*.json` contains one declarative file per public category.
- `schema.json` documents the expected entry shape.

## Entry Rules

Each listing should include:

- `name`
- `category`
- `homepage`
- `description`
- `origin.country`
- `origin.evidence`
- `tags`
- `useCases`
- `deployment`
- `pricingModel`
- `license`
- `isOpenSource`
- `curation.confidence`
- `sources`

GitHub metadata is optional because many strong European tools are services or hardware companies without a canonical project repository. When a canonical repository exists, add `github.repository`, `github.stars`, and `github.pushedAt`.

## Lookup Examples

Find tools for a need:

```sh
jq '.entries[] | select(.useCases[]? | test("monitor|observability"; "i")) | .name' data/categories/analytics-monitoring.json
```

Find self-hostable entries:

```sh
jq '.entries[] | select(.deployment[]? == "self-hosted") | {name, category, homepage}' data/categories/*.json
```

Find high-confidence European entries:

```sh
jq '.entries[] | select(.curation.confidence == "high") | {name, country: .origin.country}' data/categories/*.json
```

