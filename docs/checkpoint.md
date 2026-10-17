# Tracer implementation status

Updated 2026-10-16. This page summarizes implemented behavior, verification and remaining work. Design rationale belongs in the [UX plan](ux-plan.md); storage and API contracts belong in [architecture](architecture.md).

## Native application

The normal launch now opens the shared Graph / Matrix / History workbench from `ui/workbench/`, using the explicitly selected database. Project tools retains complete item/connection editing, schema configuration, native receipt authoring, configurations, documentation and the earlier Development map. Separate fictional Orbit and Aster databases and ordinary empty projects use the same application and core contracts.

The headless core provides version-guarded atomic changesets, immutable native history, directed relationships, saved views, exact configurations, native baselines, structural coverage and scoped change investigation. SQLite is the implemented storage adapter. Captured evaluation inputs, current input freshness and recorded review decisions remain separate facts.

## Integrated workflow

`npm start` and the demo commands open the workbench directly. `npm run workbench` remains a disposable Aster/Gatherline review launcher using the same production sources. The [review guide](ux-artifacts/product-identity/README.md) documents its interaction contract and regression orchestration. Design-study runtime modules now re-export production owners; production does not import studies.

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

The first post-integration cleanup separates typed workbench history, relationship permissions and Matrix recipe ownership from the rendering closure. Historical diffs index the preceding state once rather than repeatedly scanning history per changed object; directory area counts also use one identity pass. The snapshot adapter now exposes a discriminated revision union. Trivial action wrappers no longer introduce unnecessary async boundaries or unused arguments.

The retained map separates directory structure/areas/reveal paging (`organization.ts`, 136 lines), graph projection (`directory-projection.ts`) and fictional assignments (`study-organization.ts`). Production consumers import these owners directly. The first cleanup reduced the workbench rendering file from 3,276 to 3,164 lines. Fallow's advisory high-fan-in suggestions for small cohesive helpers are not automatic split requirements. No thresholds, baselines or exclusions changed.

Five additional unit cases cover historical deletion/recreation and colliding entity/link IDs, prior-changeset comparisons and endpoint ordering, Matrix scope reset and unsupported incoming recipes, and deduplicated area counts with empty authored choices. Full verification passed after this round.

The graph follow-up reduces that controller to 2,751 lines. Strict TypeScript owners now separate pure geometry, measured layout, canvas gestures, delayed selection and document keyboard/resize lifetimes. Positions use one workspace map. Replacing a canvas aborts its listeners and cancels pending selection; blur and dialogs cancel delayed selection, and page suspension cancels gestures and resize work. Cached-page restoration resumes one listener lifetime. The remaining rendering/navigation controller is still a future cleanup candidate; Matrix binding is addressed by the follow-up below.

Eight new unit cases cover anchored zoom bounds, drag/projection scales, measured-card fitting, pinned investigation packing, dense-placement bounds, delayed-selection invalidation and page/resize cancellation. A browser regression retains detached node references, replaces the canvas before a delayed click fires, opens a dialog, cycles views and cancels an active pan on blur; selection remains scoped and the native revision is unchanged. Existing desktop/680px fit, expansion, pinning, investigation and recovery journeys pass. No quality thresholds, baselines or exclusions changed.

The Matrix follow-up leaves a 410-line renderer and captured-draft lifecycle, backed by typed owners for grid/form input, placement, selection/navigation, draft contracts and native proposal construction. Each workspace now owns its listeners, observer and delayed selection render; teardown and page suspension cancel stale work while preserving the draft. Graph and Matrix share the generation-guarded scheduler with separate delays. Native proposals are pure and retain captured endpoint versions, exact relationship IDs, schema guards and atomic create-and-link operations. New-artifact focus now reaches its actual title input.

Nine new policy tests cover merged cells/ranges, parallel paths, placement, captured authority, replacement and duplicate guards, atomic target creation, preserved fields and delayed Matrix selection. A 680px browser regression leaves and quickly returns to Matrix, exercises detached cells/forms and resize, verifies retained drafts/focus, and confirms the native revision is unchanged. Full workbench conflict/recovery, keyboard/range copy and responsive authoring journeys pass. No quality gates were weakened.

## Verification

Integration and maintenance verification, 2026-10-16:

| Check                     | Result                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`           | Passed formatting, strict types, lint, 365 unit tests, 136 browser tests, production/harness builds and dependency/duplication/health gates          |
| `npm run workbench:check` | Passed workbench types, policy/projection checks and disposable-database authoring, conflict/recovery, assessment and responsive journeys            |
| Documentation navigation  | 57 local file/heading links in seven changed Markdown documents resolve; documentation/onboarding browser checks passed at desktop and narrow widths |
| README illustrations      | Four selected native-backed screenshots; wordmark and images checked at desktop and 680px without horizontal overflow                                |

The new main-app scale journeys exercise 1,000 artifacts / 5,000 relationships and 10,000 / 100,000 at 680px. One clean local run measured 156ms / 2,077ms from navigation to the first graph node and 13ms / 41ms for keyboard search and selection. Both retained the selected Matrix scope after reload without horizontal overflow. These synthetic timings are observations, not a service target or human task-completion measurement.

Coverage merges measured V8 ranges across processes before the health gate; a zero-count capture cannot hide a handler exercised in a different journey. Complexity thresholds and exclusions are unchanged.

Regression coverage includes immutable snapshot conversion, deleted historical endpoints, editor/table stability, keyboard and range copy, exact cross-view identities, schema-optional shortcuts, comparison-token drift, unknown inputs, failed reads, lost responses, database switching and historical write locks. The keyboard reader-return regression also verifies that a delayed focus callback cannot steal focus after returning to the item list.

These are technical checks using fictional fixtures. They do not establish representative-user efficiency, broad accessibility certification or engineering validity.

## Current limits

- The production map reads a transactional native snapshot bounded to 10,000 artifacts and 100,000 relationships. Drawing/query bounds are disclosed separately.
- The workbench draws up to 50 artifacts and projects up to 500 trace rows or 100 terminal links per grouped cell. It is not virtualized.
- Assessment discovery follows declared input/captured-output scope, five evaluations per page. Ordinary graph connectivity is not an assessed dependency or proof of impact.
- Unsaved drafts remain tab-local and are deliberately excluded from recovery. Leaving/reloading warns; uncertain writes restore a pause without replay. Spatial and investigation recovery uses browser local storage, keyed by project identity and tied to the same browser/origin. Saved engineering records, review decisions and named Matrix path recipes persist in SQLite.
- Spreadsheet paste/bulk mutation, portable workspace context and arbitrary two-revision comparison remain open. Matrix saved recipes currently support outgoing path columns; receipt creation pickers remain bounded to 1,000 items.
- PostgreSQL parity, authenticated collaboration, hosted integrations, restoration and standalone packaging remain future work.

## Open work

Evaluate complete create → connect → modify → investigate → assess tasks with representative users in more than one domain. An unfamiliar-user session has not been run. Use observed next-action choices, completion time, assistance, errors and context loss to prioritize larger-dataset interaction, clearer review context and remaining authoring friction. Automated checks and visual consistency are supporting evidence, not substitutes for task validation.
