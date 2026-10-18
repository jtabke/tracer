# Contributing to Tracer

Use Node.js 24.15+ and npm. Install the locked dependencies with `npm ci`, then run:

```sh
npx playwright install chromium
npm run check
```

The [CI workflow](.github/workflows/check.yml) keeps automatic runs small: one Node 24.15 job checks formatting, types, hooks, unit/service/projection tests and the production build. It runs for pull requests and pushes to `main`; feature-branch pushes do not create duplicate runs. Documentation-only changes skip CI, and newer runs cancel older runs for the same branch or pull request. Dependency downloads use the npm cache.

Run the full `npm run check` locally before release or after broad changes. Browser workflows and coverage-dependent Fallow gates are omitted from automatic CI to conserve GitHub minutes; they remain available through **Actions → Check → Run workflow → full**. Manual runs default to the smaller checks. Browser installation follows [Playwright’s CI instructions](https://playwright.dev/docs/ci). If branch protection later requires this workflow, account for documentation-only skips, which leave required checks pending.

`npm run demo` starts a fresh isolated integrated-product example. Use its printed database path to resume saved work. Never reseed an existing project to test a change.

## Scope a change

Start with a concrete engineering task and read the relevant documents listed in [AGENTS.md](AGENTS.md). Product hypotheses and existing prototype controls are not automatic requirements. Keep decisions in their owning document and verification in the checkpoint.

Prefer the existing core and query boundaries over adding a parallel domain-specific engine. Examples may use different terminology while sharing entity, relationship, revision and receipt contracts.

## Preserve the contracts

Keep transactional persistence, captured-version checks, historical identities, directed links and immutable evidence/reviews. Reads must remain bounded or paged, with partial context disclosed. An uncertain mutation outcome must not be reported as proof that nothing saved.

UI changes must preserve draft ownership, cancellation, failure recovery and keyboard focus. A recorded link, permitted schema slot or fresh receipt must not be presented as satisfaction, required coverage or release readiness.

## Verify the behavior

Run checks appropriate to the change. Use focused tests for concrete regressions and broaden to the full browser suite when shared navigation, state or server contracts change. Inspect actual pixels at normal and narrow widths for layout changes. Passing automation is technical evidence, not human usability acceptance.

Use disposable directories and databases for examples. Keep project-specific data fictional and identify simulated outcomes. Document new limitations and interfaces without claiming planned capabilities are delivered.

Contributions to Tracer's original source and documentation use the [MIT license](LICENSE). Retain third-party license notices and image credits. Do not add third-party assets or code without establishing their rights and attribution.

## Repository map

| Path                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `src/core/`          | Portable domain types and invariants                                                                |
| `src/application/`   | Commands, queries and service orchestration                                                         |
| `src/persistence/`   | Repository contracts, SQLite storage and migrations                                                 |
| `src/interfaces/`    | CLI and local HTTP adapters                                                                         |
| `ui/`                | Production workbench, retained React tasks/map and browser assets                                   |
| `examples/`          | Fictional seeds, fixtures and benchmarks                                                            |
| `test/`              | Root application unit, integration and browser checks                                               |
| `config/`            | Versioned tooling policies; `.fallow/` is disposable cache                                          |
| `docs/`              | User guides, architecture, product decisions and progress                                           |
| `docs/ux-artifacts/` | Isolated design studies and historical research; see the [study index](docs/ux-artifacts/README.md) |
| `.github/workflows/` | Checks run by GitHub Actions                                                                        |

`src/index.ts` is the supported portable API entry point; package subpath `@tracer-local/core/sqlite` owns the platform adapter. Prefer named commands for new integrations and retain positional-call compatibility when changing native commands. Core API changes need contract tests for version guards, transaction rollback, invocation-time capture, error details and the runnable guide.

Keep source beside the layer that owns its behavior. The root package builds the only product UI, with the default `ui/workbench/` and retained `ui/map/`. All example commands use it over native databases. The former map-first package only delegates to root commands; projection tests live in `test/map/`. The older editor/query components live in `test/legacy-ui/components/` and mount through a test-only harness under `.fallow/legacy-ui`; production imports from this fixture are forbidden. Avoid moving modules solely to make directories smaller: preserve import boundaries and group by behavior when a concrete change warrants it.

Generated builds, dependency installs, caches, local databases, environment files and `output/` review captures stay out of Git. Preserve useful review images locally; copy only intentionally selected documentation illustrations into `docs/images/` or a documented study.

## Maintaining the shared UI

Keep projection/geometry policies independent of React and use strict TypeScript contracts for new policy/lifecycle modules. Keep drafts, working view and native mutation ownership explicit. A retained snapshot supplies display context; it does not authorize writes.

An effect that registers a listener or schedules frames must release both on cleanup. Cancel pending work when its scope changes; coalesce repeated resize work. Follow [React's effect dependency guidance](https://react.dev/learn/removing-effect-dependencies): dependencies must reflect the values the effect reads, rather than hiding stale closures. Preserve different map/walker camera policies when sharing lifecycle code.

Test meaningful invariants such as cancellation between frames, exact recorded identity, deterministic layout/label behavior, nonmutation of snapshots and real browser return/resize flows. Use disposable example databases for workflow checks. Extract behavior around a clear responsibility; file splitting alone is not a reduction in total code or complexity.

## Quality checks and coverage

`npm run check` runs formatting, strict TypeScript, UI lint rules, unit/service/projection tests, production and harness builds, Chromium workflows, then Fallow dependency, architecture, duplication and health gates. `npm test` and `npm run lint` provide focused feedback. Chromium must be installed before the full check.

The retained map renderer and new recovery policy use strict TypeScript. Workbench history, relationship permissions, Matrix recipes/input/placement/proposals, graph geometry/layout/input and browser lifecycle owners also use strict TypeScript. Artifact draft/save/cancel, relationship scope editing, authoring dialogs and shared picker keyboard navigation also use strict TypeScript. `workspace.css` composes the ordered base, layout, search and editing styles in `ui/workbench/styles/`. The adopted workbench renderer remains JavaScript, verified by production browser journeys and the same dependency, complexity and measured coverage gates. State owners separate the working view, session organization, search, saved views, open tools, trace history and layout lifetime. Pure policies keep graph traversal, geometry and presentation independent of React. The trace lens shares layout policies while owning its dialog focus and chosen-path state.

UI linting includes JavaScript and TypeScript, with unreachable-code, duplicate-case, unsafe-finally and typeof checks alongside React hook dependency and ordering rules. `useEffectEvent` supplies current values to registered listeners and other effect-owned callbacks; reactive scope changes remain explicit dependencies. No production TypeScript source is excluded from strict checking. `skipLibCheck` skips dependency declaration checking because ELK's upstream declarations fail strict checking; this setting applies to all dependency declaration files. ELK's NodeNext constructor adaptation stays at the layout boundary.

Node unit tests use c8 and Chromium browser tests use v8-to-istanbul to collect measured coverage in disposable `.fallow/coverage/`. Both produce Istanbul maps, merged with istanbul-lib-coverage for reporting. The verification merger combines measured V8 ranges across processes with `@bcoe/v8-coverage` before Fallow reads them, so a later zero-count capture cannot hide an earlier exercised handler. Fallow consumes that merged raw V8 capture to match anonymous function locations precisely. Source maps connect browser assets to source; minification preserves function/class names for coverage matching and useful failure traces. `npm test` clears old coverage, and browser workflows append their measurements before health runs. Run the full check after changing UI source so source maps and coverage match. `npm run quality` requires unit and browser measurements; it does not substitute old complexity exemptions. The page fixture snapshots counters before navigation/reload, because execution-context disposal can discard prior counters. Cleanup uses `closeTestPage` to capture before closure. Keep server/database cleanup in a `finally` block.

Architecture regression fixtures verify that forbidden imports, raw HTTP and new complexity are rejected. Production UI cannot import historical fixtures or design artifacts. Dead-code, duplication and health checks run without baselines; thresholds have not been raised. Passing gates measure technical properties, not human usability acceptance or arbitrary-scale performance.

## Maintaining the integrated workbench

The native-backed [product-identity review launcher](docs/ux-artifacts/product-identity/README.md) uses the production `ui/workbench/` sources. Runtime modules in that study directory only re-export production owners. `npm run workbench:check` runs policy/projection checks and disposable native journeys against the production build, with measured browser coverage; it is included in `npm run check`. `npm run workbench:screenshots` regenerates paired desktop/680px review material. Keep generated exports, screenshots and galleries out of commits, and preserve existing personal/review databases. The guide documents module boundaries, interaction contracts and current limits.
