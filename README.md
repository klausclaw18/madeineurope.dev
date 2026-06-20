# 🇪🇺 madeineurope.dev

> A curated directory of developer tools, software & hardware made in Europe.

## What is this?

A community-driven list of software, SaaS, hardware, and cloud services built by European companies — privacy-first, GDPR-native, and keeping your data on this side of the Atlantic.

## Categories

- 🖥️ Developer Tools — IDEs, CLIs, debuggers, profilers
- ☁️ Cloud & Hosting — VPS, managed databases, serverless
- 🔒 Security & Auth — SSO, secrets management, VPNs
- 📊 Analytics & Monitoring — privacy-first analytics, APM
- 🛠️ Hardware & IoT — keyboards, microcontrollers, SBCs
- 🗄️ Databases & Storage — managed databases, object storage
- 📬 Communication & Email — transactional mail, messaging
- 🤖 AI & ML — European AI APIs, model providers
- 💳 Payments & Billing — SEPA, iDEAL, PSD2-compliant

## Directory data

The repository-facing source of truth lives in [`data/`](data/):

- [`data/directory.json`](data/directory.json) is the category manifest.
- [`data/categories/`](data/categories/) contains one declarative JSON file per category.
- [`data/top-european-projects.json`](data/top-european-projects.json) contains the current top 5 GitHub-starred, recently maintained European projects from the 2026-06-20 research pass.
- [`data/schema.json`](data/schema.json) documents the entry shape.
- [`DIRECTORY_BEST_PRACTICE_PATTERNS.md`](DIRECTORY_BEST_PRACTICE_PATTERNS.md) summarizes patterns from similar GitHub directories.

Example lookup:

```sh
jq '.entries[] | select(.deployment[]? == "self-hosted") | {name, category, homepage}' data/categories/*.json
```

## Contributing

Found a tool that belongs here? Open a PR!

Add or update entries in the relevant `data/categories/*.json` file. Include official source links, European origin evidence, tags, use cases, deployment model, license, and confidence notes.

## Why it matters

European tools aren't just about compliance. They're about choosing where your data lives and who has access to it. GDPR by default, lower latency for EU users, and supporting local tech ecosystems.

## License

MIT
