# Directory Best Practice Patterns

Research date: 2026-06-20

This note distills patterns from five GitHub directories that are close to the goal of `madeineurope.dev`: a curated, developer-oriented directory of European tools, software, services, and hardware.

## Repositories Reviewed

1. [TheMorpheus407/european-alternatives](https://github.com/TheMorpheus407/european-alternatives)
   - Community-curated European alternatives directory.
   - Useful patterns: browse by category, filter by country/pricing/open-source status, search across names/descriptions/tags, explicit trust scoring, vetting status, reservations, decision matrix, denied alternatives log, and contribution guide.

2. [Melanie12/awesome-devtools-EU](https://github.com/Melanie12/awesome-devtools-EU)
   - Lightweight country-file directory for European developer-first tools.
   - Useful patterns: country-specific files, short entry format, required official link, tags such as `oss`, `self-hosted`, and `cloud`, plus a template for missing countries.

3. [agamm/awesome-developer-first](https://github.com/agamm/awesome-developer-first)
   - Broad developer-first tools list organized by developer need.
   - Useful patterns: simple category headings, short benefit-oriented descriptions, visible GitHub/image badges for open-source entries, and category language based on what developers are trying to do.

4. [ml-tooling/best-of-python-dev](https://github.com/ml-tooling/best-of-python-dev)
   - Ranked open-source developer tooling directory generated from structured project metadata.
   - Useful patterns: machine-readable source data, project quality score, GitHub stars/forks/issues, contributor counts, package-manager signals, stale/dead project markers, and category counts.

5. [BEKO2210/european-alternatives.eu-free-open-source](https://github.com/BEKO2210/european-alternatives.eu-free-open-source)
   - Searchable FOSS alternatives directory for the DACH region.
   - Useful patterns: strict inclusion policy, explicit license allowlist, self-hosting flags, searchable category pages, bilingual support, and automated discovery/enforcement scripts.

## Patterns To Use In This Repository

1. Keep entries declarative.
   - Store category data in JSON files instead of embedding it in prose or HTML.
   - Make every entry easy to parse by future website, API, or CLI agents.

2. Separate category taxonomy from listings.
   - Keep a manifest of all categories.
   - Keep one file per category so contributors can edit a focused surface.

3. Record evidence and confidence, not just claims.
   - Every curated entry should include source URLs.
   - Add `europeanEvidence`, `maintenance`, and `curation.confidence` fields so readers can see why an entry belongs.

4. Optimize for developer needs.
   - Each category should describe use cases such as "host EU workloads", "add passkeys", "monitor production", or "prototype hardware".
   - Entries should include tags and `useCases` so lookup can be need-based rather than brand-based.

5. Distinguish open-source from open-core, source-available, SaaS-only, and hardware.
   - Do not flatten very different licensing and delivery models into one "open" label.
   - Include `license`, `pricingModel`, `deployment`, and `isOpenSource` fields.

6. Rank transparently.
   - Use GitHub stars only where a canonical repository exists.
   - Combine stars with recent activity and maintenance notes.
   - Keep non-GitHub services discoverable, but avoid comparing them directly against GitHub projects.

7. Support trust and sovereignty signals.
   - Include jurisdiction, headquarters, data residency notes, self-hosting availability, GDPR/privacy notes, and official legal or imprint sources when possible.

8. Make contribution rules visible.
   - Provide a data schema and examples.
   - Require official homepage, origin evidence, category, tags, and maintenance evidence.

9. Allow uncertainty.
   - Use `confidence: high | medium | low`.
   - Use notes when a tool has European origins but current legal structure is multinational or unclear.

10. Keep the static site as a consumer, not the source of truth.
   - The repository data should stand alone.
   - Website rendering can be implemented later from the same JSON files.

