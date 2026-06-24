# RepoChurn CLI v2.0 — Walkthrough

## What Was Done

All 9 source files were upgraded. Build passes with **zero TypeScript errors**.

---

## File-by-File Changes

### `src/api/types.ts`
- Added `GitHubRepoInfo` (stars, language, open issues, forks)
- Added `GitHubContributor` (login, contributions)
- Enriched `GitHubCommitDetail` with `stats` (additions/deletions) and `previous_filename` on file diffs
- Fixed `commit.author` typing on detail response

### `src/api/github.ts`
- **Transparent pagination** — follows GitHub `Link` headers beyond 100 commits (capped at 500 by default)
- **Exponential-backoff retry** — up to 3 attempts on transient network/5xx errors
- **`getRepoInfo(owner, repo)`** — new method for repo metadata
- **`getContributors(owner, repo)`** — new method for contributor list
- Updated `User-Agent` header to v2.0.0

### `src/core/analyzer.ts` _(major rewrite)_
- **Contributor stats map** — tracks per-author commits, additions, deletions
- **Weekly velocity** — groups commits by ISO-week for sparkline data
- **Bus-factor risk score** — `churn ÷ unique_authors`, normalised 0–100
- **File categorisation** — automatically tags each file as `source | test | config | docs | other`
- **Configurable topN** via `AnalyzeOptions`
- **Configurable ignore list** via `excludePatterns` in options
- **Spinner integration** — phase labels throughout analysis
- Removed hardcoded `package.json` ignore — now driven by `DEFAULT_IGNORE_PATTERNS` in config

### `src/utils/spinner.ts` _(NEW)_
- Zero-dependency ASCII spinner using `setInterval` + ANSI escape codes
- No-ops gracefully when `stdout` is not a TTY (CI, piped output)
- `succeed()`, `fail()`, `info()` stop states with coloured symbols

### `src/utils/config.ts`
- Loads `.repochurnrc` (JSON) from CWD on startup
- Exports merged `AppConfig` with `rc` sub-object
- Exports `DEFAULT_IGNORE_PATTERNS` (replaces hardcoded list in analyzer)
- Default timeout raised from 10s → 15s

### `src/utils/formatter.ts` _(major rewrite)_
| Format | Description |
|--------|-------------|
| `terminal` | Rich boxen panel: sparkline velocity, category badges, risk bars, contributor table |
| `json` | Structured JSON — pipe-friendly, CI-ready |
| `csv` | CSV with headers — open in Excel/Sheets |
| `md` | Markdown tables — paste into PRs or wikis |

- `--output <file>` writes to disk, prints confirmation
- All formats accept the same `AnalysisReport` — no duplicate logic

### `src/index.ts` _(restructured)_
- **`analyze` sub-command** with: `--days`, `--top`, `--format`, `--output`, `--exclude`, `--no-spinner`
- **`compare` sub-command** — analyzes two repos and renders a side-by-side comparison table (commits, lines, contributors, language, stars, top hotspot)
- Backward-compat route: `repochurn owner/repo` (no sub-command) still works
- All validation extracted to `validateRepo()`, `validateDays()`, `validateFormat()` helpers
- Error handling unified in `handleFatalError()`

### `package.json`
- Added `"bin": { "repochurn": "dist/index.js" }` — global install now works correctly
- Version bumped to `2.0.0`
- Added `lint` and `dev:analyze` scripts

### `tsconfig.json`
- Added `declaration: true`, `declarationMap: true`, `sourceMap: true`

---

## New Usage Examples

```bash
# Basic (backward-compat, unchanged)
npx tsx src/index.ts facebook/react

# Explicit sub-command with all new flags
npx tsx src/index.ts analyze vercel/next.js --days 90 --top 15 --format md

# Export JSON for CI pipeline consumption
npx tsx src/index.ts analyze torvalds/linux --format json --output churn.json --no-spinner

# Export CSV report
npx tsx src/index.ts analyze microsoft/typescript --format csv --output report.csv

# Side-by-side repo comparison
npx tsx src/index.ts compare facebook/react vuejs/core --days 30
```

## Build Verification

```
> npm run build
✔ (zero TypeScript errors)

> repochurn --help
Usage: repochurn [options] [command] [repository]
Commands: analyze, compare
```
