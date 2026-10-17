<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="ui/public/tracer-wordmark-light.svg" />
    <img src="ui/public/tracer-wordmark.svg" alt="Tracer" width="264" height="72" />
  </picture>
</h1>

Follow engineering intent through requirements, implementation and evidence—and see what changed.

Tracer is a local-first engineering knowledge and traceability workspace. Define your own record types and relationships, compare sibling responsibilities in aligned traces, inspect captured evidence in context, and save useful working scopes. SQLite stores the project; no account or cloud service is required.

This is a working source preview. It includes a CLI and browser workspace, with explicit limits described below.

## Try it

Use Node.js **24.15+** and npm:

```sh
npm ci
npm run demo
```

Open the printed URL. The project picker switches between **Orbit R1** (a fictional robot vacuum) and **Aster Home BP** (a fictional blood-pressure monitor). Each project has its own SQLite database. Both use the same Graph / Matrix / History workspace built over the headless core; switching projects never combines their records.

Start in **Graph**, switch to **Matrix** to author records and direct connections, and use **History** to inspect saved changes and investigate their recorded paths. **Assess evidence** compares captured inputs and records a separate decision. **Project tools** retains model configuration, complete item editing, evaluation receipt authoring, configurations and documentation. The earlier **Development map** remains available there. The [walkthrough](docs/getting-started.md) explains both routes.

Graph positions, Matrix settings, selected revision and investigation context recover after reload in the same browser and local origin. Named **Save Matrix configuration** recipes persist in the project database. Unsaved drafts remain tab-local: leaving or reloading warns before discarding them. An unconfirmed save blocks new writes until its saved result has been inspected; proposals are never replayed automatically.

Each launch creates two fresh projects. Edits persist in their printed databases; the terminal prints a command to reopen **both**. Project switching confirms draft disposal and reloads; saved records and recovery stay project-specific.

## Engineering workbench

`npm run workbench` launches isolated Aster/Gatherline review databases using production sources. Its [guide](docs/ux-artifacts/product-identity/README.md) covers regressions and desktop/680px screenshots.

**Graph — investigate a change through its recorded dependency paths.**

![Tracer workbench Graph showing the changed Aster requirement, recorded dependency paths and artifact inspector.](docs/images/aster-workbench-graph.png)

**Matrix — edit engineering information without leaving the traceability context.**

![Tracer workbench Matrix with grouped requirement-to-verification paths and a floating statement editor.](docs/images/aster-workbench-matrix.png)

**History — inspect the saved change and connected engineering work.**

![Tracer workbench History showing the saved operating-temperature change at revision 400 and its field-level diff.](docs/images/aster-workbench-history.png)

**Assessments — compare captured inputs and record an engineering decision.**

![Tracer workbench assessment showing captured versus current requirement statements and a recorded Needs reevaluation decision.](docs/images/aster-workbench-assessment.png)

_Native-backed workbench at 1440×1000 using fictional Aster data. The walkthrough saves an edit at r400 and an immutable review; evaluation outcomes are explicitly simulated._

## Three realistic examples

| Command                        | Fictional project            | What to explore                                                                               |
| ------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run workspace:integrated` | Orbit R1 robot vacuum        | Shared hardware/software responsibilities, alternatives, build configurations and evaluations |
| `npm run workspace:medical`    | Aster Home BP monitor        | User needs, product requirements, subsystem allocations, risk controls and design V&V         |
| `npm run workspace:technology` | Gatherline offline event app | Product outcomes, stories, architecture, delivery, experiments and operational findings       |

Each includes multiple hierarchy levels, sibling comparisons, shared records, missing evaluations and an actual version change affecting a captured receipt. All project-specific targets and outcomes are fictional. See [example structures and tasks](docs/realistic-examples.md).

For scale exploration, `npm run demo:working` creates 1,000 synthetic items; `npm run demo:large` creates 10,000. `npm run demo:small` exercises local file and Git observations and requires Git. These are separate fixtures, not capacity guarantees.

## Start your own project

```sh
npm start -- --db my-project.sqlite
```

Follow the [worked example](docs/getting-started.md#worked-example-start-a-product-from-an-empty-database) to build a desk-light model from an empty database, add three items, connect them and reopen saved work.

Open **Project tools → Configure model** to define types, fields and relationships, then **New item** to populate the project. Use Matrix for contextual authoring, or **Project tools → Edit item and connections** for the complete schema-defined form. Project terms and schemas remain configurable. Evaluation receipts and exact native configurations are available from the same shell.

To open two existing databases in the project picker:

```sh
npm start -- --db orbit/project.sqlite --guide orbit/tasks.json --secondary-db aster/project.sqlite --secondary-guide aster/tasks.json
```

Guides are optional for ordinary projects. Database files must be different; the server only exposes the explicitly configured projects.

To keep a realistic example in a chosen new directory:

```sh
npm run seed -- my-example --size integrated
npm start -- --db my-example/project.sqlite --guide my-example/tasks.json
```

Seeding refuses an existing directory. Omit `--guide` for an ordinary project. Use `--port 4318` if the default port is occupied. Ctrl+C closes the server; reopen the same database to resume work.

## Core contracts and current UI limits

- Versioned entities/links share captured-version checks and immutable history; failed saves retain drafts.
- Receipts capture declared inputs, including historical pins. Reviews are separate immutable decisions; freshness does not rewrite outcomes.
- Configurations pin selected members and optional links; baselines pin one complete native project revision. Neither ordinary membership links nor manifests establish a complete BOM or readiness.
- Headless `coverage list` / `coverage evaluate JSON`, `impact get JSON` and `working-context get JSON` provide structural gap checks, baseline-scoped investigation and branch/receipt reads. See the [API guide](docs/developer-reference.md) for commands and guarded paging.

The browser's complete transactional snapshot is bounded to **10,000 records / 100,000 connections**; larger reads reject. Rendering/trace bounds are disclosed separately. Development-map folder/category edits and unnamed views are session-only. Named Matrix recipes and evidence persist in SQLite; browser-local spatial/investigation recovery stays with its origin.

Links do not establish satisfaction; changed inputs do not automatically invalidate results; schema permissions do not define completeness or release criteria. Engineering calculations, certification evaluation, hosted collaboration and CI/CAD/PLM synchronization are not implemented. File/Git observations require explicit actions.

## Documentation

Use the [documentation index](docs/README.md) or **Documentation** in the application. Entry points:

- [First-use walkthrough](docs/getting-started.md)
- [Realistic example structures](docs/realistic-examples.md)
- [Product development across industries](docs/industry-workflows/README.md)
- [CLI, working views and storage contracts](docs/developer-reference.md)
- [Architecture](docs/architecture.md) and [contributing](CONTRIBUTING.md)

The [product vision](docs/user-needs.md#product-vision) describes the broader direction and stable needs. [UX exploration](docs/ux-plan.md) and the [checkpoint](docs/checkpoint.md) distinguish implemented behavior, proposals and historical checks.

## Use the headless core

Import `Tracer` from `@tracer-local/core` and `SQLiteRepository` from `@tracer-local/core/sqlite`, or use the CLI/local HTTP API. The [API guide](docs/developer-reference.md#use-the-headless-core) covers commands, guards, paging, errors and sessions. Run `node examples/product-model.ts` for a disposable headless example. The API ships as source; no npm SDK is published.

## Development

```sh
npx playwright install chromium
npm run check       # formatting, types, hooks, unit/browser tests and quality
npm test            # focused unit/service/projection checks
npm run build
```

Linux runners may need additional Chromium system dependencies; see [contributing](CONTRIBUTING.md).

See the [repository map](CONTRIBUTING.md#repository-map) for source boundaries and the [design study index](docs/ux-artifacts/README.md) for isolated prototypes.

The core and CLI use Node's built-in SQLite; React and Vite support the browser UI. No runtime server framework is required. Commands run from the repository root.

## License

[MIT](LICENSE). Dependencies retain their own licenses.
