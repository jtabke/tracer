# Tracer engineering workbench review launcher

The normal application now opens the Graph / Matrix / History workbench from `ui/workbench/`. This directory retains its isolated review launcher, static-export fallback and regression scripts; runtime modules re-export production owners. The earlier `ui/map/` experience remains available through Project tools → Development map. Both use the native API, changesets, evidence comparison, immutable reviews and mutation recovery. Scripted verification is not representative-user acceptance or scale validation.

## Run

From the repository root, with Node 24.15+ and locked dependencies installed:

```sh
npm run workbench
# Open http://127.0.0.1:8174/?native=1&presentation=1
```

The runner seeds fictional Aster and Gatherline into a new temporary directory and prints its paths. Resume saved work with `TRACER_STUDY_DIRECTORY=/absolute/path npm run workbench`. It never opens a personal database. Database selection reloads document-bound transport identity; pending or uncertain writes block switching. Unsaved drafts require an explicit discard decision.

Static tab-local inspection remains available after `node docs/ux-artifacts/product-identity/build-data.mjs` and a repository-root HTTP server. Open `/docs/ux-artifacts/product-identity/?presentation=1`. Its generated `data.json` is ignored; edits in this fallback do not persist to a database.

## Verify and capture

```sh
npm run check                 # Production types, lint, unit/browser and quality gates
npm run workbench:check       # Candidate types and isolated regression journeys + screenshots
npm run workbench:screenshots # Only the paired assessment walkthrough and read-only layout checks
```

Install Chromium once with `npx playwright install chromium`. Candidate verification builds once, uses automatically assigned local ports and a fresh database per mutation suite, then closes its servers and removes only its own temporary directories. Individual mutation scripts require an explicit `TRACER_NATIVE_ORIGIN`; they reject the persistent review port 8174. `prepare-assessment.mjs` additionally requires a fresh r399 fixture and refuses repeat preparation.

Captures go to ignored `output/product-identity/workbench-review/`. Override the folder name with `TRACER_CAPTURE_NAME`. The generated gallery contains eighteen original PNGs, paired desktop **1440×1000** and narrow **680×900**, overview sheets and a request/result manifest. Full captures, galleries, databases and old iteration previews are local review material, not committed source. Deliberately selected documentation illustrations live in [docs/images](../../images/README.md), with captions and reproduction steps. A fresh clone regenerates them; historical local-output links in the checkpoint describe earlier verification, not bundled files.

The end-to-end capture starts from an explicitly simulated evaluation matching PRS-02 v2 at r399. It modifies 10–40°C to 5–45°C at r400, inspects the saved diff, follows twenty exact recorded links, compares captured/current inputs, retains a review draft across Matrix navigation, records Needs reevaluation once, returns to the investigation and reloads the saved decision. The original receipt and native r400 remain unchanged by the review. These outcomes are fictional fixture evidence, not physical test results.

## Interaction contract

- Graph, Matrix and History retain artifact, relationship, revision and investigation scope. Inspector visibility and graph camera remain view preferences. Historical state is visibly read-only.
- One graph workspace supports anchored neighbor expansion/collapse, exact typed paths, selection actions and readable fitted titles. Normal selection and lens returns retain positions and camera. Direct controls replace Focus/Nodes disclosures; relationship groups are expanded.
- Vertical wheel/two-finger scroll and pinch zoom at the pointer. Horizontal-only or Shift-scroll pans; blank-canvas, Space or middle-button dragging pans. Node dragging moves the node. There is no input-device selector. Inspector and Matrix scrolling stay independent.
- The inspector docks when enough canvas remains, otherwise uses a drawer or compact/partial sheet. A full artifact editor is a separate intentional task. At 680px partial details budget at least 300px of usable graph space.
- Grouped traceability paths retain canonical shared identities. Flat paths and exact-link adjacency remain alternatives. Matrix source identity and headers stick; floating editors preserve table geometry and scroll.
- Click selects; Enter/F2 or double-click edits. Typing starts title editing or target search. Escape cancels, structured fields submit with Command/Control-Enter, and arrows/Tab navigate cells. Shift-range selection copies rectangular TSV; it does not bulk mutate or import.
- New rows start with a title and suggested identifier. Required schema fields appear before commit; optional-scope links commit on target selection. Creating a target and its relationship is atomic. Existing captured schema/object versions and endpoint guards remain authoritative.
- Direct connections and Reachable in trace are distinct. Reachability follows the configured Matrix path and explains exact recorded routes; connectivity does not imply technical impact or assessed coverage.
- Assessment discovers declared input/captured-output evaluations, five per page. Outcome, input freshness and judgment remain separate. Stale tokens retain rationale and require explicit refreshed-input adoption. Unknown inputs cannot be accepted. An uncertain save requires inspection and acknowledgment without automatic replay.

## Source boundaries

| Module                                                                   | Responsibility                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `ui/workbench/app.js`, `workspace.css`, `styles/`                        | Production shell, interaction owners and responsive rendering                                                      |
| `workspace-snapshot.ts`                                                  | Shared immutable presentation conversion for native and exported snapshots, including deleted historical endpoints |
| `native-client.ts`                                                       | Typed native reads, existing mutation controller and reconciliation                                                |
| `matrix-editor.mjs`, `trace-table.mjs`                                   | Matrix rendering/draft capture and bounded grouped/flat path projection                                            |
| `workspace-history.ts`, `presentation.ts`, `relationship-policy.ts`      | Typed revision reconstruction/diffs, presentation labels and native permission policy                              |
| `graph-geometry.ts`, `graph-layout.ts`                                   | Pure geometry/camera policies and measured layout over one workspace position map                                  |
| `graph-input.ts`, `selection-delay.ts`, `workspace-events.ts`            | Abortable canvas gestures, guarded delayed selection and keyboard/resize/page lifetimes                            |
| `matrix-input.ts`, `matrix-form-input.ts`, `matrix-selection.ts`         | Scoped grid/form bindings, picker keyboard input, logical ranges and exact row paths                               |
| `matrix-placement.ts`, `matrix-proposal.ts`, `matrix-types.ts`           | Popover lifetime, pure guarded native operation building and typed draft contracts                                 |
| `matrix-recipes.ts`                                                      | Typed saved-recipe dialog/controller and scope reset through current write authority                               |
| `workspace-journeys.mjs`, `trace-context.mjs`                            | Neighborhood and recorded path policies                                                                            |
| `authoring-policy.ts`, `canvas-input.ts`                                 | Schema-required progression, key suggestions, literal changed spans and deterministic wheel intent                 |
| `evidence-workspace.tsx`, `evidence-workspace.css`                       | Retained assessment host around the production review owner; no parallel judgment model                            |
| `serve-native.mjs`, `build-data.mjs`                                     | Isolated native runner and regenerable fictional static export                                                     |
| `verification-fixtures.mjs`, `check-workbench.mjs`, `package-review.mjs` | Owned disposable servers, regression orchestration and ignored review output                                       |
| `verify-*.mjs`, `verify-snapshot.ts`                                     | Interaction, policy, native persistence, conflict/recovery and screenshot assertions                               |

The root strict configuration covers production TypeScript; the review harness also uses its local `tsconfig.json`. Production JavaScript is browser-verified and included in production dependency, complexity and measured coverage gates. `npm run check` includes native workbench regressions against the production build. Production source must not import this review directory.

## Limits

Graph drawing is bounded to 50 artifacts; traceability projection to 500 rows and 100 terminal links per grouped cell, with omissions disclosed. No virtualization, bulk mutation, spreadsheet paste, portable workspace context or arbitrary two-revision comparison is claimed. Assessment discovery is focus-only, not every reachable dependency or baseline impact analysis. Review drafts survive view switches but not reload; saved decisions persist. Project tools supports ordinary receipt authoring without fixtures. `prepare-assessment.mjs` remains optional simulated capture setup for review screenshots. Named Matrix configurations persist in SQLite; graph positions, view settings and investigations recover in the same browser/origin. Larger-project and representative-user validation remain separate work.

The current behavior supersedes the earlier three-direction studies, Trace/Explore switch, Mouse/Trackpad preference and collapsed relationship groups. Old review galleries remain local under `output/`; they are not alternate product implementations.
