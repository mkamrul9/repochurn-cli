# Code Quality & Production‑Grade Guidelines for repochurn-cli

---

## 1️⃣ Project Structure & Modularity
- **Root layout**
  ```
  repochurn-cli/
  ├─ src/                 # All source files
  │   ├─ cli/            # Commander command definitions & entry point
  │   ├─ services/       # Business logic (GitService, ChurnCalculator, OutputFormatter)
  │   ├─ utils/          # Helper utilities (logger, validation, date helpers)
  │   └─ config/         # Configuration loader (`.repochurnrc` handling)
  ├─ tests/               # Unit & integration tests (mirroring src layout)
  ├─ docs/                # Documentation, architecture diagrams, usage examples
  ├─ .github/workflows/   # CI pipelines
  ├─ package.json
  └─ README.md
  ```
- **Separation of concerns** – Keep the CLI thin: it should only parse arguments and delegate to services.  Services must not depend on `commander` or any I/O.
- **Single‑responsibility modules** – Each service should expose a clear API:
  * `GitService` → `getCommitLog`, `getDiffs`
  * `ChurnCalculator` → `calculate(changes)`
  * `OutputFormatter` → `toJson`, `toCsv`, `toMarkdown`

---

## 2️⃣ Type Safety
- **Migrate to TypeScript** (or add JSDoc with `tsc` checks).  Benefits:
  * Compile‑time validation of Git‑log parsing, diff structures, and CLI options.
  * Better IDE auto‑completion for contributors.
  * Prevents accidental `any` usage and clarifies data contracts.
- If you prefer staying in JavaScript, enforce **strict mode** and add comprehensive JSDoc annotations with `npm run lint` checking for missing types.

---

## 3️⃣ Linting & Formatting
- Add **ESLint** with the `eslint-config-airbnb-base` (or `eslint:recommended`) and **Prettier**.
- Create an npm script:
  ```json
  "scripts": {
    "lint": "eslint src/**/*.js",
    "format": "prettier --write src/**/*.js"
  }
  ```
- Enforce linting in CI (fail the build on lint errors).

---

## 4️⃣ Testing Strategy
- **Unit tests** for each service using **Jest**.  Mock `simple-git` to test edge cases (empty repo, large diffs, binary files).
- **Integration tests** that run the CLI against a temporary Git repo created in the test harness (`tmp/git‑repo`).
- Target **≥90 % coverage** and add a coverage badge to the README.
- Add a `npm test:watch` script for rapid local development.

---

## 5️⃣ Error Handling & Logging
- Wrap all external calls (`simple‑git`, file‑system) in `try/catch` and surface a **custom error class** (e.g., `RepochurnError`).
- Centralised **logger** (e.g., `pino` or `winston`) with configurable log level (`DEBUG`, `INFO`, `WARN`, `ERROR`).
- Provide a `--verbose` flag that sets the logger to `DEBUG`.
- For production, add optional **Sentry** integration to capture uncaught exceptions.

---

## 6️⃣ Configuration Management
- Support a **`.repochurnrc`** file (JSON or YAML) at the project root.  Load defaults with a small `ConfigService`.
- CLI options should **override** config values, not duplicate logic.
- Validate configuration schema with **ajv** and give friendly error messages.

---

## 7️⃣ CI/CD Pipeline Enhancements
| Step | Action |
|------|--------|
| **Lint** | `npm run lint` – fail on warnings.
| **Test** | `npm test -- --coverage` – upload coverage badge.
| **Security** | `npm audit --audit-level=high` – fail on high severity.
| **Build** | Run a **smoke test**: `node ./src/cli.js analyze . --format json` on a fixture repo.
| **Release** | Use **semantic‑release** to automate version bump, changelog, and npm publish.

---

## 8️⃣ Packaging & Distribution
- Add a **`bin`** entry in `package.json` so the CLI can be installed globally (`npm i -g repochurn-cli`).
- Provide a **Dockerfile** for environments without Node (use `node:alpine` and copy the built package).
- Optionally bundle the CLI as a **single executable** using `pkg` for zero‑dependency distribution.

---

## 9️⃣ Documentation & developer onboarding
- Keep the **README** concise but include:
  * Quick‑start example.
  * Full list of CLI flags with examples.
  * Contribution guide linking to `CONTRIBUTING.md`.
- Add `docs/ARCHITECTURE.md` with a Mermaid diagram (the one shown in the project overview).
- Create `docs/DEVELOPMENT.md` that describes the folder layout, how to run tests, and how to add new output formats.

---

## 🔟 Contribution Guidelines
- **Branching model** – GitFlow or simple `feature/…` branches.
- **Commit messages** – Follow **Conventional Commits** (`feat:`, `fix:`, `docs:`) to enable automated changelogs.
- **Pull‑request checklist**:
  1. Lint passes (`npm run lint`).
  2. Tests pass (`npm test`).
  3. New/changed code has corresponding tests.
  4. Documentation updated if public API changed.
  5. No new `console.log` statements – use the logger instead.

---

## 📦 Final Checklist for Production‑Readiness
- [ ] TypeScript (or full JSDoc) with `noImplicitAny`/`strict`.
- [ ] ESLint + Prettier enforced in CI.
- [ ] ≥90 % test coverage, CI runs tests on every PR.
- [ ] Structured logging with configurable verbosity.
- [ ] Robust error handling and user‑friendly messages.
- [ ] Secure handling of user‑provided paths (no command injection).
- [ ] Automated release pipeline (semantic‑release) publishing to npm.
- [ ] Documentation up‑to‑date (README, usage guide, architecture diagram).
- [ ] Contribution guide and PR checklist for external contributors.

---

*Prepared by Antigravity AI – your coding co‑pilot.*
