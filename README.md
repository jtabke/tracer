<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="ui/public/tracer-wordmark-light.svg" />
    <img src="ui/public/tracer-wordmark.svg" alt="Tracer" width="264" height="72" />
  </picture>
</h1>

Follow engineering intent through requirements, implementation and evidence—and see what changed.

Tracer is a local-first engineering knowledge and traceability workspace. Define your own record types and relationships, compare sibling responsibilities in aligned traces, inspect captured evidence in context, and save useful working scopes. SQLite stores the project; no account or cloud service is required.

This is a working source preview. It includes a CLI and browser workspace, with explicit limits described below.

Read [primitives and how to use them](docs/workspace-guide.md#primitives-what-to-create-and-when) for the core concepts, modeling choices and a worked requirement/source/test/review example.

Local contextual references reuse native resource identities and qualified relationships. Select an item and open **References and supporting material** to reference a document, observe/pin a local source and capture its use in an evaluation. See the [local reference guide](docs/developer-reference.md#local-resources-and-contextual-references) for explicit schema permissions, identity and version semantics. This slice preserves source states and uncertainty; it does not retain external bytes or automatically assess document passages.

## Get started

Use Node.js **24.15+**. Install dependencies from the repository root:

```sh
npm ci
```

### Explore an example

```sh
npm run demo
```

Open the printed URL to explore **Orbit R1**, a fictional robot-vacuum project with connected requirements, designs and simulated results. Follow the [example walkthrough](docs/getting-started.md#explore-an-example) to inspect a trace, edit a record and review changed evidence inputs.

Each launch creates one fresh example. Saved edits stay in its database; use the printed **Resume saved setup** command to continue them.

### Start your own project

```sh
npm start -- --db my-project.sqlite
```

Choose **Engineering** in **Project tools → Configure model** for acceptance criteria, verification methods, optional subsystem/build references, coverage policies and three saved Matrix views. The setup and your records persist in the database. Reopen the same file to continue.

Follow the [Engineering starter walkthrough](docs/getting-started.md#start-your-own-project) to create a small CO₂-monitor trace and reopen it in a clean browser.

For existing spreadsheet records, save the model, then use **Project tools → Import CSV** to map columns, preview errors and commit records/links together. See the [CSV import guide](docs/csv-import.md).

Use **Project tools → Export project** for deterministic JSON with records, links, schemas, exact history and evidence references. The same format is available through the CLI and API; see the [export guide](docs/project-export.md).

Both paths use the same **Graph / Matrix / History** workspace. **Project tools** opens complete editing, model configuration, evaluations, configurations and documentation. The [documentation index](docs/README.md) provides reference material after the walkthrough. The [workspace reference](docs/workspace-guide.md) illustrates the current views, search, editing and connection controls.

**Project tools → Verification** records exact criterion/method scope, actual activity results, explicit result selection and a controlled scoped conclusion. It preserves failures and explains reassessment after changes. See the [verification guide](docs/workspace-guide.md#requirement-verification) for model setup, authoring and recovery.

**Next work** keeps statement gaps, unallocated requirements, missing verification plans, changed evidence inputs and unresolved reviews in separate actionable queues. See the [next-work guide](docs/next-work.md).

## Core contracts and current UI limits

- Versioned entities/links share captured-version checks and immutable history; failed saves retain drafts.
- Receipts capture declared inputs, including historical pins. Reviews are separate immutable decisions; freshness does not rewrite outcomes.
- Configurations pin selected members and optional links; baselines pin one complete native project revision. Neither ordinary membership links nor manifests establish a complete BOM or readiness.
- Headless `coverage list` / `coverage evaluate JSON`, `impact get JSON` and `working-context get JSON` provide structural gap checks, baseline-scoped investigation and branch/receipt reads. See the [API guide](docs/developer-reference.md) for commands and guarded paging.

The browser's complete transactional snapshot is bounded to **10,000 records / 100,000 connections**; larger reads reject. Rendering/trace bounds are disclosed separately. Development-map folder/category edits and unnamed views are session-only. Named Matrix recipes and evidence persist in SQLite; browser-local spatial/investigation recovery stays with its origin.

Links do not establish satisfaction; changed inputs do not automatically invalidate results; schema permissions do not define completeness or release criteria. Engineering calculations, certification evaluation, hosted collaboration and CI/CAD/PLM synchronization are not implemented. File/Git observations require explicit actions.

## Documentation

Start with the [two-path walkthrough](docs/getting-started.md). The [documentation index](docs/README.md) links to workspace reference, customization, additional examples, industry context and developer guides. In the application, open **Project tools → Documentation**.

The [product vision](docs/user-needs.md#product-vision) describes the broader direction and stable needs. [UX exploration](docs/ux-plan.md) and the [checkpoint](docs/checkpoint.md) distinguish implemented behavior, proposals and historical checks.

## Use the headless core

Import `Tracer` from `@tracer-local/core` and `SQLiteRepository` from `@tracer-local/core/sqlite`, or use the CLI/local HTTP API. The [API guide](docs/developer-reference.md#use-the-headless-core) covers commands, guards, paging, errors and sessions. The API ships as source; no npm SDK is published. For atomic native updates plus an immutable execution/analysis receipt, use [`evaluations.commit`](docs/developer-reference.md#atomic-evaluation-operations), with explicit command recovery shared by core, CLI and HTTP.

To serve the API without a browser or frontend build:

```sh
npm run serve:api -- --db my-project.sqlite
```

Scripts can import `createClient` from `@tracer-local/core/client`. Each client has its own server, project and session; it uses the same typed contracts and response validation as the browser. See [headless HTTP operation](docs/developer-reference.md#headless-http-operation) for connection and recovery details. `GET /api/capabilities` reports API version, supported operations/features and limits; clients can [check compatibility before writes](docs/developer-reference.md#discover-capabilities-and-check-compatibility). The [endpoint reference](docs/api-reference.md) is generated from the shared definitions.

## Development

```sh
npx playwright install chromium
npm run check       # formatting, types, hooks, unit/browser tests and quality
npm test            # focused unit/service/projection checks
npm run build
npm run clean -- --dry-run  # preview reproducible build/cache cleanup
```

Linux runners may need additional Chromium system dependencies; see [contributing](CONTRIBUTING.md).

Review fixtures and scale commands are documented in the [developer reference](docs/developer-reference.md#development-fixtures).

See the [repository map](CONTRIBUTING.md#repository-map) for source boundaries and the [design study index](docs/ux-artifacts/README.md) for isolated prototypes.

The core and CLI use Node's built-in SQLite; React and Vite support the browser UI. No runtime server framework is required. Commands run from the repository root.

## License

[MIT](LICENSE). Dependencies retain their own licenses.
