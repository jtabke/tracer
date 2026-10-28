# Tracer development register

This is Tracer's real product-development project, selected by the owner on 2026-10-20. It uses the existing headless application API and SQLite adapter. No frontend or running server is needed.

## Start a session

From the repository root:

```sh
node projects/tracer/project.mjs status
node projects/tracer/project.mjs show TR-004
node projects/tracer/project.mjs show PN-04
```

The persistent database is `projects/tracer/tracer.sqlite`. Paths in this helper resolve relative to its own location, so changing the shell's directory does not select a different database. `show` includes native IDs, captured versions, source/target keys and all incident links. Follow those keys to inspect rationale, source excerpts or remaining work.

Use this register before selecting feature work and update the affected records after completing a slice. An explicit current owner request takes precedence over the recorded recommendations. This is an initial curated inventory, not an exhaustive requirements audit.

The [2026-10-21 audit](../../docs/development-model-plan.md) identified mixed granularity and unclear evidence semantics. The owner selected the [current development model](../../docs/development-model.md) on 2026-10-23. The live project now has bounded REQ requirements, an explicit system/component hierarchy and VER verification plans. Existing TR summaries retain their identities and prior claims with `lifecycle=superseded`; follow their replacement keys. `status` shows active requirements and component ownership. Internal and discovery work can now target its actual subject.

## What belongs here

- `goal`: the existing UN-001–005 product direction.
- `user_need`: PN-01–09, with evidence qualifications and validation status.
- `story`: ND/SC/Q/R candidate tasks, retaining acceptance examples and uncertainties.
- `requirement`: REQ-001–034 behavioral obligations, including the selected local primitive slice REQ-027–030 and the selected requirement-verification specification REQ-034, with numbered criteria, capability area and independent status; TR-001–017 are preserved historical summaries.
- `component`: COMP-TRACER and its system/subcomponent responsibilities, organized by `part_of` and allocated from requirements.
- `verification_plan`: VER-001–034 planned methods and expected results against exact acceptance. A plan is not an executed result.
- `work_item`: selected work and proposed next/later actions, with rationale and requirement links.
- `source`: captured document sections or owner requests, with paths, headings and whole-file SHA-256 hashes where applicable.
- `artifact`: exact design/source/test/report references. Initial component source references identify ownership boundaries; they do not establish conformance.
- `decision`: register ownership and selected direction, with source links.
- `application_model`: versioned role/policy bindings for a selected application service. Installed definitions are `MODEL-CHANGE-ASSESSMENT` and `MODEL-REQUIREMENT-VERIFICATION`; their selected native versions govern interpretation.
- `change_assessment` / `impact_disposition`: native scope and candidate-judgment roles for the application build-out. Guarded model-bound opening records an exact selected scope. Controlled reads validate original command/genesis and explicit refresh retains prior obligations; headless dispositions/actions and controlled closure/reopen build on that scope. The shared assessment task projects these services; the completed local real-case proof and exact acceptance evidence are recorded in the register.
- `verification_case` / `verification_execution`: schema-v7 ordinary roles for the selected requirement-verification capability. Pinned-model resolution, native criterion/method preparation and controlled opening/execution capture are implemented headless operations. Result selection, verified conclusions, reassessment and dedicated shared UI remain pending; type presence or authored JSON establishes no verification outcome.

Requirements `addresses` needs, can `supports_story` candidate tasks and are `sourced_from` captured references. Needs `contributes_to` goals. Audited artifacts can be linked with `implemented_by` and `checked_by`; historical links keep their original meaning. These links are scoped assertions, not automatic proof of completion.

The current model adds requirement `allocated_to` component, component `part_of` component and `realized_by` artifact, requirement `verified_by` plan, and plan `evaluates` component. Work can advance a need, scenario, component, plan or decision as well as a requirement. `supersedes` explains each old-to-new disposition; historical associations remain available. Current structural policies apply only to active requirements and check need, allocation and plan links. Native immutable receipts continue to own executed results. See the model dictionary for exact meanings.

The register owns current structured need/requirement summaries, delivery status, work selection and trace relationships. Repository documents own detailed specifications, research context, UI/architecture decisions and technical evidence. Keep those documents and source references consistent when scope changes; do not maintain a second live feature-status list in Markdown. The checkpoint remains a dated engineering activity/evidence log and points here for current product status.

## Status conventions

Keep three independent fields on a requirement:

- `deliveryStatus`: `unassessed`, `not_implemented`, `in_progress`, `partial`, or `implemented`, relative to its stated scope and acceptance. Newly split requirements start unassessed; documentation claims remain on their historical summaries.
- `verificationStatus`: `not_verified`, `documented_not_reverified`, or `verified`. Imported reports are not a fresh audit. Use `verified` only with recorded candidate-specific checks and their limits.
- `validationStatus`: `not_validated` or `validated`, with representative task evidence for the stated context. Our setup checks are not participant research.

`selection` distinguishes `selected`, `existing_scope`, `proposed` and `candidate`. A documented delivered capability is not authorization for its extensions. Requirement summaries and goal mappings are assistant-curated interpretations of the linked sources. Imported candidate acceptance remains provisional. String values are project conventions, not enum constraints enforced by the core schema.

`lifecycle=active` selects current obligations; `superseded` retains replaced summaries. `specificationStatus` distinguishes ready acceptance from draft candidate scope. The new acceptance criteria and planned methods require actual candidate-specific checks before promoting verification status. The migration manifest records the initial schema extension from v1 to v2; v3 added overview paths, and v4 separates primary development stages from supporting rationale/provenance. Trace connections retains all native types and directions. Schema v5 adds `contextual_reference` for requirement/verification-plan uses of reusable resources, with role, scoped selector and current/pinned state; references remain supporting context rather than primary development stages. Historical source/claim records are preserved. Schema v6 adds the ordinary application-model, change-assessment and impact-disposition types plus `has_disposition` membership. The [installation template](change-assessment-model.json) supplies initial bindings; the installed native record and selected version own current configuration.

Work uses `deliveryStatus` (`not_started`, `in_progress`, `completed`, `blocked`), `horizon` (`now`, `next`, `later`), `selection`, `rationale`, `nextAction` and `completionEvidence`. Next/later entries are recommendations, not an approved implementation queue. A completed now item may remain as evidence of the most recently selected slice until new work is selected.

The initial source commit is recorded in `bootstrap.json`, alongside a warning about pre-existing uncommitted changes. Captured excerpts and per-file hashes preserve what was assessed; the commit alone does not identify those working-tree bytes. A source file changing does not automatically invalidate every claim from it: compare the relevant section and scope.

## Update through the existing interfaces

Read the current schema and record version before editing. The standard CLI remains available:

```sh
node src/interfaces/cli.ts --db projects/tracer/tracer.sqlite schema get
node src/interfaces/cli.ts --db projects/tracer/tracer.sqlite entity list '{"type":"work_item","limit":100}'
node src/interfaces/cli.ts --db projects/tracer/tracer.sqlite coverage evaluate '{"expectationId":"requirement_need","limit":100}'
node src/interfaces/cli.ts --db projects/tracer/tracer.sqlite history '{"limit":10}'
```

Use `Tracer.updateEntity` or CLI `entity update` with the captured schema/object versions and an actor/reason. **Fields replace the whole fields object**: preserve unchanged fields explicitly. Use `evaluations.commit` when related native updates and one immutable execution/analysis receipt must commit and recover together. Use `applyChangeset` for related updates and `expectedProjectRevision` when the proposal depends on the whole captured state. Re-read deliberately after a conflict; never blindly replay an uncertain write. The [developer reference](../../docs/developer-reference.md) documents full commands and recovery semantics.

After a slice: update its scoped requirement/work records, attach exact code/check references and actual results, preserve validation uncertainty, and export the new state. Do not mark an entire need satisfied merely because one requirement passed tests. Native receipts are available for version-pinned results; source records containing old test reports are not receipts from a new execution.

Optional HTTP access uses the same database:

```sh
npm run serve:api -- --db projects/tracer/tracer.sqlite --port 4317
```

## Preservation and first setup

```sh
node projects/tracer/project.mjs export
node projects/tracer/project.mjs backup /absolute/path/to/new-backup.sqlite
```

Export atomically replaces `project-export.json` with the core's deterministic export. Keep this review snapshot in version control after meaningful updates. **JSON export is not a supported restore format.** The SQLite backup command uses SQLite's online backup API, includes history and durable command outcomes, and refuses an existing destination. Back up to a durable location after meaningful work. To restore, close clients and copy a completed backup to a new database path; inspect it with `--db PATH status` before choosing it as the active project. Never copy only an active SQLite main file while WAL writes may be outstanding.

The live SQLite database and backups are ignored by Git. A fresh clone has the initial bootstrap and latest review export, but needs a database backup to resume the exact current project. Do not recreate a missing active database silently: recover its backup first.

Only for first setup or a disposable copy:

```sh
node projects/tracer/project.mjs init
node projects/tracer/project.mjs --db /existing/directory/disposable.sqlite init
```

`init` exclusively creates a new file, saves the schema, then creates all initial records/links in one atomic changeset. It refuses every existing file, including an empty one. If setup fails, inspect the newly created file; initialization is not a whole-file transaction and may leave only a schema. It never resets or updates an existing project. `bootstrap.json` is the historical starting dataset; edit the live database going forward, not that seed. Reinitializing elsewhere creates new identities and does not restore later work/history.
