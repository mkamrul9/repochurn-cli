# RepoChurn CLI — Feature & Quality Upgrade Plan

## Overview

The current codebase is a working MVP that fetches GitHub commits and surfaces the top 5 hotspot files in a boxen panel. The goal is to transform it into a **genuinely useful, polished developer tool** that people actually reach for every day. The plan below groups work into clear tiers so we can ship incrementally.

---

## Current State Gaps

| Area | Problem |
|------|---------|
| **Features** | Only one command (`analyze`); no sub-commands, no output formats, no contributor stats |
| **CLI UX** | No progress spinner; large repos feel hung; no `--top N` option |
| **Output** | Only terminal box; no JSON / CSV / Markdown file export |
| **Data depth** | Only files analyzed; no commit-message trends, no contributor breakdown, no weekly velocity |
| **Code quality** | `index.ts` mixes orchestration + validation + UI; `commands/` directory is empty; no error-recovery retry logic; hardcoded file ignore list |
| **Config** | No `.repochurnrc` support despite README claiming it; `--format` flag described but not implemented |
| **Types** | `GitHubCommitDetail.author` field typing differs from `GitHubCommitListItem.commit.author`; potential `any` casts |
| **DX** | No `bin` entry in `package.json`; `npm start` only works after build |

---

## Proposed Changes

### 1 — `src/api/types.ts` — Richer type definitions
- Add `GitHubRepoInfo` (stars, language, description) for a summary header
- Add `additions`/`deletions` to `GitHubCommitListItem.commit.author` (unused but needed for velocity)
- Add `GitHubContributor` type (login, contributions)

### 2 — `src/api/github.ts` — New API methods
- `getRepoInfo(owner, repo)` — fetch repo metadata (language, stars, open issues)
- `getContributors(owner, repo, sinceISO)` — aggregate contributor stats
- Add retry logic with exponential back-off on 5xx / network errors (max 3 attempts)
- Paginate `getCommits` beyond 100 (honour Link header) up to a configurable cap

### 3 — `src/core/analyzer.ts` — Deeper analysis engine
- **Contributor map**: track per-author additions/deletions, not just a name set
- **Weekly velocity**: group commits by ISO-week and count them
- **Risk scoring**: compute a simple risk score = churn × unique_authors_inverse (bus factor signal)
- **Configurable top-N** hotspot limit (was hard-coded 5)
- **Configurable ignore list** instead of hard-coded `package.json` etc.
- **Stable file categorisation**: tag files as `source` / `test` / `config` / `docs` by extension

### 4 — `src/utils/formatter.ts` — Multiple output formats
- **Terminal** (current): keep the coloured boxen but add contributor table and velocity sparkline
- **`--format json`**: write structured JSON to stdout (pipe-friendly)
- **`--format csv`**: CSV with headers (filename, churn, authors, category)
- **`--format md`**: Markdown report with tables (great for PRs / wikis)

### 5 — `src/utils/spinner.ts` — Progress feedback [NEW]
- Wrap `process.stdout.write` with a lightweight ASCII spinner (no extra dep)
- Show phase labels: _"Fetching repo info…"_, _"Loading commits…"_, _"Analysing N commits…"_

### 6 — `src/utils/config.ts` — `.repochurnrc` support
- Read and merge `.repochurnrc` (JSON) from CWD before applying CLI flags
- Schema: `{ days, top, format, exclude, include }`

### 7 — `src/index.ts` — Refactored CLI surface

Restructure using Commander sub-commands:

```
repochurn analyze <owner/repo> [options]
repochurn compare <owner/repo1> <owner/repo2> [options]  ← NEW
```

**`analyze` options added:**
- `--top <n>` — number of hotspot files (default 10)
- `--format <type>` — terminal | json | csv | md (default terminal)
- `--output <file>` — write to file instead of stdout
- `--exclude <glob>` — comma-separated ignore patterns
- `--no-spinner` — disable progress animation (CI-friendly)

**`compare` command** (stretch goal, implement if time allows):
- Run `analyze` on two repos and render a side-by-side diff table showing which codebase is more volatile.

### 8 — `package.json` — Fix `bin` field
- Add `"bin": { "repochurn": "dist/index.js" }` so `npm link` / global install works correctly

### 9 — `tsconfig.json` — Strict improvements
- Add `"declaration": true` for downstream type consumption
- Add `"sourceMap": true` for better debugging

---

## File Change Summary

### `src/api/`

#### [MODIFY] [types.ts](file:///d:/dev/UNIQUE%20WORK/repochurn-cli/src/api/types.ts)
Add `GitHubRepoInfo`, `GitHubContributor` types; enrich existing interfaces.

#### [MODIFY] [github.ts](file:///d:/dev/UNIQUE%20WORK/repochurn-cli/src/api/github.ts)
Add `getRepoInfo`, `getContributors`; add retry logic + pagination.

---

### `src/core/`

#### [MODIFY] [analyzer.ts](file:///d:/dev/UNIQUE%20WORK/repochurn-cli/src/core/analyzer.ts)
Richer `AnalysisReport` with contributor map, weekly velocity, risk scores, file categories, configurable top-N.

---

### `src/utils/`

#### [MODIFY] [formatter.ts](file:///d:/dev/UNIQUE%20WORK/repochurn-cli/src/utils/formatter.ts)
Multi-format output: terminal (enhanced), json, csv, md.

#### [NEW] spinner.ts
Lightweight spinner class.

#### [MODIFY] [config.ts](file:///d:/dev/UNIQUE%20WORK/repochurn-cli/src/utils/config.ts)
`.repochurnrc` loading + merged config object.

---

### `src/`

#### [MODIFY] [index.ts](file:///d:/dev/UNIQUE%20WORK/repochurn-cli/src/index.ts)
Commander sub-commands, new flags, spinner integration, clean separation of concerns.

---

### Root

#### [MODIFY] [package.json](file:///d:/dev/UNIQUE%20WORK/repochurn-cli/package.json)
Add `bin` field, update `description`, add `lint` script.

#### [MODIFY] [tsconfig.json](file:///d:/dev/UNIQUE WORK/repochurn-cli/tsconfig.json)
Add `declaration`, `sourceMap`.

---

## Verification Plan

### Build Verification
```bash
npm run build   # Must compile with zero TypeScript errors
```

### Smoke Tests (manual)
```bash
# Basic analyze
npx tsx src/index.ts analyze facebook/react --days 30

# JSON output
npx tsx src/index.ts analyze vercel/next.js --format json --top 10

# CSV to file
npx tsx src/index.ts analyze torvalds/linux --format csv --output churn.csv --days 7

# Markdown
npx tsx src/index.ts analyze microsoft/typescript --format md

# No-spinner CI mode
npx tsx src/index.ts analyze microsoft/vscode --no-spinner --format json
```

### Error Cases
- Invalid repo format → clear error message
- Rate limit hit → boxen with reset time
- 404 not found → helpful suggestion
- `--days 400` → error capped at 365

