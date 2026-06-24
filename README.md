# repochurn-cli

---

## 📖 What the Tool Does
`repochurn-cli` is a **Node.js command‑line utility** that analyses a Git repository’s *churn* – the frequency and magnitude of changes to each file over time.  It walks the commit history, aggregates line‑addition/deletion/modification counts, identifies hotspots, and can emit the results in **JSON**, **CSV**, or **Markdown**.  By surfacing which files change most often, teams can:

* Detect technical debt early
* Prioritise testing and code‑review effort on volatile files
* Make data‑driven refactoring decisions
* Integrate churn metrics into CI pipelines for quality gates

---

## 🎯 Why the Project Exists
- **Code‑base health:** Continuous insight into file‑level churn helps keep the code stable.
- **Risk management:** High‑churn files are statistically more error‑prone; the tool highlights them automatically.
- **Data‑driven workflows:** Generates machine‑readable reports that can be consumed by dashboards or CI checks.
- **Lightweight & extensible:** No heavyweight dependencies, easy to drop into existing projects or CI pipelines.

---

## 🚀 Core Features
| Feature | Description | CLI Example |
|---------|-------------|-------------|
| **Full repository churn report** | Calculates total additions, deletions, and modifications per file. | `repochurn-cli analyze .` |
| **Date‑range filtering** | Restrict analysis to a specific window (e.g., last 30 days). | `repochurn-cli analyze . --since 2024-01-01 --until 2024-02-01` |
| **File pattern inclusion/exclusion** | Focus on certain directories or ignore generated files. | `repochurn-cli analyze . --include "src/**/*.js" --exclude "node_modules/**"` |
| **Hotspot identification** | Shows the top N most‑churny files. | `repochurn-cli analyze . --top 10` |
| **Multiple output formats** | JSON for programmatic consumption, CSV for spreadsheets, Markdown for human‑readable reports. | `repochurn-cli analyze . --format json` |
| **CI integration** | Emit a JSON report that can break builds when churn thresholds are exceeded. | `repochurn-cli analyze . --format json --fail-on-threshold 500` |
| **Config file support** | Default options can be stored in a `.repochurnrc` file at the project root. | Automatically read when present. |

---

## 🛠️ Getting Started
### Prerequisites
- **Node.js** ≥ 18
- **npm** ≥ 9 (or **yarn** / **pnpm**) 
- A **Git** repository you want to analyse.

### Installation
```bash
# Global install (adds the `repochurn-cli` command to PATH)
npm i -g repochurn-cli

# Or as a dev‑dependency in a project
npm i -D repochurn-cli
```
### Basic Usage
```bash
# Analyse the current repository and output a Markdown report
repochurn-cli analyze . --format md > CHURN_REPORT.md

# Analyse only the last 90 days and output JSON
repochurn-cli analyze . --since "90 days ago" --format json
```
### Configuration File (optional)
Create a `.repochurnrc` in the repository root:
```json
{
  "since": "2024-01-01",
  "until": "2024-12-31",
  "exclude": ["node_modules/**", "dist/**"],
  "format": "json"
}
```
The CLI will automatically merge these defaults with any command‑line flags you pass.

---

## 📚 Documentation
- **README** – This file (quick start, feature list, usage examples).
- **PROJECT_OVERVIEW.md** – High‑level architecture and roadmap (see `docs/PROJECT_OVERVIEW.md`).
- **ARCHITECTURE.md** – Mermaid diagram of the internal component layout (in `docs/`).
- **DEVELOPMENT.md** – How to run tests, add new output formats, and work on the codebase (`docs/DEVELOPMENT.md`).
- **CODE_QUALITY_GUIDELINES.md** – Recommended practices for keeping the project production‑grade (`CODE_QUALITY_GUIDELINES.md`).

---

## 🤝 Contributing
1. **Fork** the repository and clone your fork.
2. Create a feature branch:
   ```bash
   git checkout -b feat/<your‑feature>
   ```
3. Install dependencies:
   ```bash
   npm ci
   ```
4. Run the lint and test suite before committing:
   ```bash
   npm run lint && npm test
   ```
5. Make your changes, add or update tests, and update documentation if you alter the public API.
6. Commit using **Conventional Commits** (e.g., `feat: add CSV output`).
7. Push and open a Pull Request.  CI will automatically run lint, tests, and a smoke‑test of the CLI.
8. Ensure the PR checklist passes (see **CODE_QUALITY_GUIDELINES.md** for the full checklist).

---

## 📄 License
`repochurn-cli` is released under the **MIT License**.  See the `LICENSE` file for the full text.

---

*Prepared by Antigravity AI – your coding co‑pilot.*