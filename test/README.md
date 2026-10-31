# Tests

All browser specs now exercise the shipped production build in `dist/`. There is no duplicate tabbed application or legacy UI build. `test/workbench/` remains isolated orchestration over production owners, including static-export loading—not an alternate product renderer.

## Run

- `npm test`: unit/service/projection checks and fresh unit coverage.
- `npm run test:smoke`: default desktop/mobile workflow and sidebar checks; used by PR CI.
- `npm run test:ui`: all production Chromium workflows.
- `npm run check`: complete checks, workbench journeys and unchanged measured-quality thresholds.

The full gate needs current unit/browser V8 measurements. Use disposable databases and `closeTestPage` before closing servers; retained examples and private data are never test targets.

## Legacy retirement coverage map

Retirement was audited at `9f84f1b`. Valuable shared tests were rehosted or strengthened on the production route before obsolete shell suites were removed. Original sources remain in Git and local `.local/tracer-development/archive/legacy-ui-9f84f1b/`; the detailed static audit is local evidence, not another tracked report.

| Invariant group                                                                                                        | Production regression owners                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Multi-input receipt, archived field schema, recorded paths, failed authoritative reads and explicit observed content   | `receipt-authoring-browser.spec.ts`, `reference-primitives-browser.spec.ts`                                                                                        |
| Review basis drift, unknowns, receipt-switch discard, no replay and exact off-page configuration return                | `evidence-review-browser.spec.ts`, `evidence-cycle-browser.spec.ts`, `main-workflow-browser.spec.ts`                                                               |
| Visual/Text model, declared port direction, retained coverage policy, stale schema and lost committed response         | `schema-visual-browser.spec.ts`, `coverage-browser.spec.ts`, `schema-recovery-browser.spec.ts`, requirement schema/relationship specs                              |
| Complete pinned members, mixed historical revisions, capture retention, missing capability and explicit recovery       | `configuration-workspace-browser.spec.ts`, `configurations-browser.spec.ts`, `configuration-change-browser.spec.ts`                                                |
| Incoming-only directed connection, required scope, endpoint race and no partial write                                  | `production-boundaries-browser.spec.ts`, `inspector-polish-browser.spec.ts`, Matrix proposal/atomic changeset contracts and native workbench journeys              |
| Dense connections outside drawn graph, structured statements, failed refresh locks and exact historical absence/relink | `production-boundaries-browser.spec.ts`, `statement-reading.test.ts`, `temporal.test.ts`, `workbench-navigation.test.ts`, production map geometry/projection tests |
| Rendered documentation, images/diagrams/source links, actual modal scroll owner and retained drafts                    | `documentation-browser.spec.ts`, `documentation-layout.test.ts`                                                                                                    |
| Independent evidence rendering, field serialization, configurable names and typed mutation/read guards                 | Retained shared cases in `native-views.test.ts`, `work-model.test.ts`, `ui-constraints.test.ts`                                                                    |

The former Family/Home/query-tab layout, editable-row bulk mutation, incoming saved-recipe authoring and old SVG badge/controller arrangements were unshipped prototype affordances, not requirements to recreate. Atlas range copy is not claimed as bulk editing. Core Family/Chain/saved-view/graph services and their storage/HTTP/CLI contracts remain supported and tested; Development-map session views are not claimed as persisted Family/Chain authoring. See [projection-query scope](../docs/reference/developer-reference.md#projection-queries).

The migration fixed actual integration defects found by the ports: dirty receipt switching, nested unknown-save locks, exact configuration return wiring, native-task receipt layout, modal documentation scroll restoration and structured statement rendering. Source deletion alone was not accepted as equivalent coverage. Passing software checks do not establish device performance, release authority or representative-user validation.
