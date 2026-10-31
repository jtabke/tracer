# Contributing to Tracer

## Start here

Use **Node.js 24.15+** and the locked npm dependencies:

```sh
npm ci
npx playwright install chromium
npm run check
```

Explore a disposable example with `npm run demo`, or follow [getting started](docs/guides/getting-started.md) for a new project. Never reseed an existing database to test a change. Linux runners may need Chromium system dependencies; see [Playwright's CI guide](https://playwright.dev/docs/ci).

## Repository map

| Path                  | Purpose                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| `src/core/`           | Portable domain types and invariants                                       |
| `src/application/`    | Guarded commands, queries and repository ports                             |
| `src/persistence/`    | SQLite transactions, migrations and history                                |
| `src/interfaces/`     | CLI, local HTTP server and typed endpoint contracts                        |
| `ui/`                 | Production workbench, retained task pages/map and assets                   |
| `examples/`           | Fictional seeds and benchmarks                                             |
| `test/`               | Unit, integration and browser checks; fixtures beside callers              |
| `test/workbench/`     | Isolated production-backed regression/capture harness                      |
| `docs/guides/`        | User tasks and industry context                                            |
| `docs/reference/`     | API/CLI, architecture contracts and model templates                        |
| `docs/development/`   | Maintained direction/specifications, private-register and archive guidance |
| `scripts/`, `config/` | Maintenance commands and versioned quality policy                          |

[Architecture](docs/architecture.md) maps implementation owners. The [documentation index](docs/README.md) is the user/reference entry point. A fresh clone needs no private register, generated history export or research archive to build and test.

## Scope and preserve behavior

Start with the current request and relevant [project context](AGENTS.md). Candidate stories, prototype controls and historical status are not implementation approval. Prefer a thin complete task using existing domain/query/command owners; don't move modules merely to make folders smaller.

Preserve stable identities, exact versions, directed links, immutable history/evidence, transaction rollback and captured-input guards. A link, compatible schema or fresh receipt is not satisfaction or release readiness. Unknown saves require inspection of the original command, never blind replay. UI changes preserve draft ownership, cancellation, historical/failed-read locks, keyboard focus and retained investigation context.

Production must not import tests, studies or private development data. Keep Node/files/database concerns outside the portable core/application boundary. Use the typed client and existing mutation/transport owners rather than raw HTTP bypasses. The [focused architecture contracts](docs/architecture.md#detailed-contracts) document these boundaries.

## Checks

| Command                      | Use                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `npm run check`              | Full formatting, strict types, lint, unit/browser, workbench and measured-quality gates |
| `npm test`                   | Unit/service/projection tests; starts fresh coverage measurements                       |
| `npm run test:ui`            | Production and test-harness builds plus Chromium workflows                              |
| `npm run workbench:check`    | Disposable native journeys, geometry, recovery and paired captures                      |
| `npm run build`              | Product build                                                                           |
| `npm run clean -- --dry-run` | Preview safe generated-output cleanup                                                   |

Run the full check after shared UI/state/transport changes or broad reorganization. Use focused tests during iteration. Inspect actual desktop/narrow screenshot pixels for layout changes; automation is not representative-user validation. Keep database/server cleanup in `finally` blocks and preserve useful logs in ignored `output/`.

Quality policy in `.fallowrc.json` and `config/` enforces boundaries, complexity, duplication and measured coverage without raised thresholds or baselines. Unit and browser V8 measurements merge through `test/merge-coverage.ts`; `npm run quality` alone needs the current complete captures. Production TypeScript stays strictly checked; the legacy test UI and [workbench harness](test/workbench/README.md) remain clearly isolated.

The [CI workflow](.github/workflows/check.yml) runs formatting, types, lint, unit tests and the production build for PRs and pushes to `main`. Documentation-only changes skip it; feature pushes avoid duplicate runs and newer runs cancel older ones. Browser/coverage-dependent gates remain required locally and available through **Actions → Check → Run workflow → full**. If branch protection is added, account for documentation-only skipped checks.

## Keep the public tree intentional

Commit maintained code, reusable fixtures, user/reference docs and selected `docs/images/` illustrations with accurate captions. Do not commit whole galleries, generated history exports, per-run review dumps, private databases/backups or alternate prototype implementations. Experiments belong in ignored `studies/`, `experiments/` or `output/`; optional internal dogfooding data belongs in `.local/tracer-development/`. [Register recovery](docs/development/register.md) and [historical recovery](docs/development/archive.md) explain preservation without publishing that paperwork.

Stop services using generated assets before `npm run clean`. The cleaner removes explicit build/test/analysis output, not dependencies, private data, backups, logs or source snapshots; it rejects a symlinked cache parent. Cleaning invalidates generated coverage, so rerun `npm run check` before the next quality claim.

## License and claims

Original contributions use [MIT](LICENSE); retain third-party notices and establish asset rights. Keep fictional/simulated examples labeled. Do not infer hosted collaboration, backend parity, physical/regulatory conformity, release authority or representative-user validation from local software checks.
