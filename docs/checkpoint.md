# Tracer implementation status

Updated 2026-10-17. Verification dates appear with each maintenance round. Design decisions belong in [UX planning](ux-plan.md); contracts belong in [architecture](architecture.md).

## Native application

Normal launch opens `ui/workbench/` Graph / Matrix / History over the selected database. Orbit, Aster and empty projects share this UI/core. Project tools retains full item/link editing, model configuration, receipt authoring, configurations, documentation and the Development map.

SQLite supports version-guarded atomic writes, immutable history, directed links, saved views, exact configurations, baselines, structural coverage and scoped change investigation. Captured inputs, current freshness and review decisions remain separate.

## Integrated workflow

`npm start`/demo use production sources; `npm run workbench` launches disposable Aster/Gatherline review databases. The [review guide](ux-artifacts/product-identity/README.md) owns regression orchestration. Studies re-export production modules; production cannot import studies.

Implemented workflows include:

- Create artifacts from a title-first Matrix row, revealing schema-required fields before commit.
- Link compatible existing artifacts or atomically create an artifact and its connection.
- Edit fields in floating editors while preserving table geometry, scroll and canonical shared identity.
- Retain artifact, relationship, revision and investigation scope across Graph, Matrix and History.
- Explore recorded dependency paths with stable positions, readable fitted titles and contextual actions.
- Author an ordinary evaluation receipt with exact input items/fields or historical pins, then compare captured/current inputs and record an immutable assessment with rationale. No fixture preparation is required for ordinary authoring.
- Save named Matrix row/path/search recipes in SQLite; recover graph positions, view settings, selected revision and investigation scope in the same browser/origin after reload.
- Preserve drafts across view changes, reject stale versions/tokens and inspect uncertain saves without automatic replay.
- Use a docked inspector, drawer or compact/partial sheet according to available workspace; historical states are read-only.

The fresh-project browser journey defines a small custom model, creates and connects two records, authors a selected-field receipt, changes the captured statement, investigates its exact link, records Needs reevaluation, saves a Matrix recipe and reloads the same decision, investigation and graph positions. It passes at 1440px and 680px.

The established Aster assessment scenario modifies PRS-02 from 10–40°C to 5–45°C at r400, retains twenty exact recorded links across views, identifies changed captured inputs, records Needs reevaluation and reloads the same decision. The receipt and native project revision remain unchanged by the review. All example outcomes are explicitly simulated.

## Maintenance round

Three post-integration cleanups separated workbench history/permissions/Matrix recipes, graph geometry/layout/input/lifecycle, and Matrix input/selection/placement/proposal construction. History diffs index prior state once; directory counts use one identity pass. The main controller fell from 3,276 to 2,751 lines; the Matrix renderer/draft owner is 410 lines. Module contracts belong in [architecture](architecture.md#workbench-ownership).

Added 22 unit/policy cases covering history identity/deletion, recipe scope, area counts, geometry, selection cancellation, Matrix paths/placement and captured mutation authority. Browser regressions exercise detached canvases/cells/forms, delayed callbacks, blur/dialog cancellation, view return, resize and retained drafts/focus at 680px. Existing conflict/recovery, keyboard/copy, fit, expansion, investigation and reload journeys pass without unintended native revisions.

Full verification passed. No thresholds, baselines or exclusions changed. The rendering controller remains a cleanup candidate; advisory fan-in findings alone do not require splitting cohesive helpers.

## Navigation cleanup

2026-10-17: extracted typed selection, perspective, revision, inspector and investigation-return transitions into `workspace-navigation.ts`. The renderer uses explicit draft/render/focus callbacks and the same state object; current head/scope providers avoid capturing stale context. Mutation guards, recovery format and draft ownership are unchanged. The main rendering controller is now 2,546 lines, down from 2,748 before this round.

Seven focused tests cover transition ordering, queued selection, historical edit locks, current-head changes, exact investigation links/return geometry, view preferences and draft-owned Matrix context. `npm run check` passed: formatting, strict types, lint, 372 unit tests, 136 browser tests, production/harness builds, workbench regressions and dependency/architecture/duplication/health gates. No thresholds, baselines or exclusions changed.

## Verification

Integration and maintenance verification, 2026-10-16:

| Check                     | Result                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`           | Passed formatting, strict types, lint, 365 unit tests, 136 browser tests, production/harness builds and dependency/duplication/health gates          |
| `npm run workbench:check` | Passed workbench types, policy/projection checks and disposable-database authoring, conflict/recovery, assessment and responsive journeys            |
| Documentation navigation  | 57 local file/heading links in seven changed Markdown documents resolve; documentation/onboarding browser checks passed at desktop and narrow widths |
| README illustrations      | Four selected native-backed screenshots; wordmark and images checked at desktop and 680px without horizontal overflow                                |

The new main-app scale journeys exercise 1,000 artifacts / 5,000 relationships and 10,000 / 100,000 at 680px. One clean local run measured 156ms / 2,077ms from navigation to the first graph node and 13ms / 41ms for keyboard search and selection. Both retained the selected Matrix scope after reload without horizontal overflow. These synthetic timings are observations, not a service target or human task-completion measurement.

Measured V8 ranges merge across processes before health checks; later zero-count captures cannot hide earlier exercised handlers.

Regression coverage includes immutable snapshot conversion, deleted historical endpoints, editor/table stability, keyboard and range copy, exact cross-view identities, schema-optional shortcuts, comparison-token drift, unknown inputs, failed reads, lost responses, database switching and historical write locks. The keyboard reader-return regression also verifies that a delayed focus callback cannot steal focus after returning to the item list.

These fictional-fixture checks establish technical behavior, not representative-user efficiency, accessibility certification or engineering validity.

## Current limits

- The production map reads a transactional native snapshot bounded to 10,000 artifacts and 100,000 relationships. Drawing/query bounds are disclosed separately.
- The workbench draws up to 50 artifacts and projects up to 500 trace rows or 100 terminal links per grouped cell. It is not virtualized.
- Assessment discovery follows declared input/captured-output scope, five evaluations per page. Ordinary graph connectivity is not an assessed dependency or proof of impact.
- Unsaved drafts remain tab-local and are deliberately excluded from recovery. Leaving/reloading warns; uncertain writes restore a pause without replay. Spatial and investigation recovery uses browser local storage, keyed by project identity and tied to the same browser/origin. Saved engineering records, review decisions and named Matrix path recipes persist in SQLite.
- Spreadsheet paste/bulk mutation, portable workspace context and arbitrary two-revision comparison remain open. Matrix saved recipes currently support outgoing path columns; receipt creation pickers remain bounded to 1,000 items.
- PostgreSQL parity, authenticated collaboration, hosted integrations, restoration and standalone packaging remain future work.

## Open work

Evaluate complete create → connect → modify → investigate → assess tasks with representative users in more than one domain. An unfamiliar-user session has not been run. Use observed next-action choices, completion time, assistance, errors and context loss to prioritize larger-dataset interaction, clearer review context and remaining authoring friction. Automated checks and visual consistency are supporting evidence, not substitutes for task validation.

## Documentation maintenance

2026-10-17: condensed the main guidance in three passes—prose, cross-document repetition, then consistency/link checks. Retained need/story IDs, source labels, technical bounds and historical study records. Verified 115 local links, all original heading anchors and stable IDs, and unchanged runnable code blocks. Formatting/diff checks, production/harness builds, the executable API example test and all three documentation browser tests passed (1440px, 390px and direct-link navigation).
