# repochurn-cli – Project Overview

---

## 📖 What the Application Does
`repochurn-cli` is a **Node.js command‑line tool** that analyses a Git repository’s *churn* – the frequency and magnitude of changes to files over time.  It parses commit history, computes per‑file churn metrics (additions, deletions, modifications), visualises hotspots, and can output reports in JSON, CSV, or Markdown.  The tool helps developers and managers identify unstable parts of a codebase, spot potentially risky files, and guide refactoring or code‑review focus.

---

## 🎯 Why the Project Exists
- **Code‑base health** – Continuous insight into which files change most often can flag technical debt early.
- **Risk management** – High‑churn files are statistically more likely to contain bugs; teams can prioritize testing and reviews.
- **Data‑driven decisions** – Provides objective metrics for retrospectives, sprint planning, and architecture discussions.
- **Lightweight & extensible** – No heavy dependencies; the CLI can be integrated into CI pipelines, pre‑commit hooks, or run locally on demand.

---

## 🏗️ High‑Level Architecture
```
+-------------------+      +-------------------+      +-------------------+
|   Git Repository  |<--->|   revochurn-cli   |<--->|   Output Formats  |
+-------------------+      +-------------------+      +-------------------+
        |                         |                         |
        v                         v                         v
+-------------------+      +-------------------+      +-------------------+
|   Node.js Runtime |      |   Core Engine    |      |   CLI Interface   |
+-------------------+      +-------------------+      +-------------------+
        |                         |
        v                         v
+-------------------+      +-------------------+
|   utils/          |      |   parsers/        |
+-------------------+      +-------------------+
```
- **Core Engine** – Walks the commit graph (via `simple-git`), aggregates line‑change stats, and computes churn scores.
- **Parsers** – Separate modules for Git log parsing, diff parsing, and optional language‑specific analysis.
- **CLI Interface** – `commander`‑based command parsing, options for target path, date range, file filters, and output format.
- **Output Formats** – JSON for programmatic consumption, CSV for spreadsheets, and Markdown for human‑readable reports.

---

## 🚀 Core Features
| Feature | Description | CLI Option |
|---------|-------------|-----------|
| **Full repo churn report** | Calculates total additions, deletions, and modifications per file. | `repochurn-cli analyze <repo>` |
| **Date‑range filtering** | Restrict analysis to a specific window (e.g., last 30 days). | `--since <date> --until <date>` |
| **File pattern inclusion/exclusion** | Focus on certain directories or ignore generated files. | `--include <glob> --exclude <glob>` |
| **Hotspot identification** | Highlights top N churn‑heavy files. | `--top <N>` |
| **Export formats** | Choose JSON, CSV, or Markdown output. | `--format json|csv|md` |
| **CI integration** | Emit a machine‑readable JSON that can break builds on threshold breaches. | Use `--json` in CI scripts. |
| **Config file support** | Store default options in a `.repochurnrc` file. | Automatically read from project root.

---

## 🔧 Current Implementation Highlights
- **Entry point** – `src/index.js` uses `commander` to define commands and options.
- **Git handling** – The `GitService` wrapper around `simple-git` provides a clean API for log and diff retrieval.
- **Metrics calculation** – `ChurnCalculator` aggregates line changes and derives a churn *score* (weighted sum of adds + deletes + modifications).
- **Testing** – Unit tests exist for the calculator and Git wrapper under `__tests__/`; integration tests cover the CLI with mock repos.
- **CI workflow** – GitHub Action (`.github/workflows/ci.yml`) runs lint, test, and a smoke test of the CLI.

---

## 🛠️ Improvements & Roadmap
1. **Type Safety** – Migrate to **TypeScript** (or add JSDoc with `tsc` checks) for better developer experience.
2. **Performance Optimisation** – Stream Git logs instead of loading the entire history into memory; add parallel processing for large repos.
3. **Advanced Analytics** – Include churn per author, per module, and churn trend over time (line‑chart data).
4. **Pluggable Parsers** – Architecture to allow language‑specific parsers (e.g., Python AST) for semantic churn.
5. **Better CI Integration** – Provide a `--fail‑on‑threshold <value>` flag to automatically fail pipelines when churn exceeds a risk threshold.
6. **Documentation** – Generate API docs with **Typedoc**, improve README with usage examples, add a `CONTRIBUTING.md`.
7. **Packaging** – Publish to **npm** with a proper `bin` entry, enable automatic version bump via **semantic-release**.
8. **Testing Coverage** – Expand test suite to cover edge cases (empty repos, binary files, large diffs) and aim for >90 % coverage.

---

## 🏭 Making It Production‑Grade
| Area | Action Items |
|------|--------------|
| **Security** | Validate user‑provided paths, avoid command injection, run Git commands with limited privileges.
| **Observability** | Add structured logging (e.g., `pino`) and optional telemetry (e.g., Sentry) for crash reports.
| **Packaging** | Use `pkg` or `npx` to distribute as a single executable for environments without Node.
| **Versioning** | Adopt **semantic‑versioning**, automate release notes with `standard-version`.
| **Rollback** | Provide a `--dry‑run` mode and keep previous release artifacts on npm.
| **Performance** | Benchmark on large repos (>10k commits) and publish performance numbers; enable caching of intermediate results.
| **User Feedback** | Interactive mode (`--interactive`) to guide users through configuration, and a `--help` with rich examples.

---

## 📈 Scalability & Maintainability
- **Modular Codebase** – Each concern (CLI, Git service, calculator, output formatter) lives in its own folder under `src/`.
- **Config‑Driven** – Central configuration file (`.repochurnrc`) allows default behaviours without code changes.
- **Dependency Management** – Pin exact versions in `package-lock.json`, run `npm audit` regularly, and consider using **pnpm** for faster installs.
- **Documentation‑Driven Development** – Keep `docs/ARCHITECTURE.md` (Mermaid diagram), `docs/USAGE.md`, and an OpenAPI‑style spec for the JSON output.
- **Contribution Friendly** – Add `CONTRIBUTING.md` with:
  * Prerequisites (Node >= 18, npm >= 9)
  * Branching model (GitFlow)
  * Commit message format (Conventional Commits)
  * Lint‑and‑test checklist before PRs.

---

## 🤝 Contributing
1. Fork the repository and create a feature branch (`git checkout -b feat/<your‑feature>`).
2. Install dependencies: `npm ci`.
3. Run the test suite and lint: `npm run lint && npm test`.
4. Implement your change, update documentation, and add tests.
5. Open a Pull Request – CI will run lint, tests, and the build steps automatically.
6. Ensure the PR description explains the problem, the solution, and any breaking changes.

---

## 📚 Further Reading
- **Architecture Diagram** – `docs/ARCHITECTURE.md` contains a Mermaid diagram of the component interactions.
- **CLI Usage Guide** – `docs/USAGE.md` provides detailed examples for common scenarios.
- **Design Decisions** – `docs/DECISIONS.md` records why certain libraries (e.g., `simple-git`, `commander`) were chosen.

---

*Prepared by Antigravity AI – your coding co‑pilot.*
