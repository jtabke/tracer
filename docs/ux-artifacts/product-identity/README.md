# Tracer engineering workbench candidate

This is the maintained, native-backed workflow candidate for the selected dark Atlas shell, organized graph and temporal navigation. It remains separate from the production map in `ui/map/`. Both use the same native API, changesets, evidence comparison, immutable reviews and mutation recovery. Scripted verification is not representative-user acceptance or scale validation.

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

Captures go to ignored `output/product-identity/workbench-review/`. Override the folder name with `TRACER_CAPTURE_NAME`. The generated gallery contains eighteen original PNGs, paired desktop **1440×1000** and narrow **680×900**, overview sheets and a request/result manifest. Screenshots, galleries, databases and old iteration previews are local review material, not committed source. A fresh clone regenerates them; historical local-output links in the checkpoint describe earlier verification, not bundled files.

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
| `study.js`, `study.css`, `workspace.css`                                 | Candidate shell, interaction owners and responsive rendering                                                       |
| `workspace-snapshot.ts`                                                  | Shared immutable presentation conversion for native and exported snapshots, including deleted historical endpoints |
| `native-client.ts`                                                       | Typed native reads, existing mutation controller and reconciliation                                                |
| `matrix-editor.mjs`, `trace-table.mjs`                                   | Stable editors and bounded grouped/flat path projection                                                            |
| `workspace-model.mjs`, `workspace-journeys.mjs`, `trace-context.mjs`     | Revision projection, neighborhood/path policies and contextual labels                                              |
| `authoring-policy.mjs`, `canvas-input.mjs`                               | Schema-required progression, key suggestions, literal changed spans and deterministic wheel intent                 |
| `evidence-workspace.tsx`, `evidence-workspace.css`                       | Retained assessment host around the production review owner; no parallel judgment model                            |
| `serve-native.mjs`, `build-data.mjs`                                     | Isolated native runner and regenerable fictional static export                                                     |
| `verification-fixtures.mjs`, `check-workbench.mjs`, `package-review.mjs` | Owned disposable servers, regression orchestration and ignored review output                                       |
| `verify-*.mjs`, `verify-snapshot.ts`                                     | Interaction, policy, native persistence, conflict/recovery and screenshot assertions                               |

The root strict configuration applies to candidate TypeScript through its local `tsconfig.json`. The vanilla JavaScript candidate remains browser-verified; production dependency/coverage gates do not include design studies. Production source must not import this candidate.

## Limits

Graph drawing is bounded to 50 artifacts; traceability projection to 500 rows and 100 terminal links per grouped cell, with omissions disclosed. No virtualization, bulk mutation, spreadsheet paste, durable recipes/positions or arbitrary two-revision comparison is claimed. Assessment discovery is focus-only, not every reachable dependency or baseline impact analysis. Review drafts survive view switches but not reload; saved decisions persist. Receipt authoring here is explicit fixture preparation. Production adoption and larger-project/representative-user validation remain separate work.

The current behavior supersedes the earlier three-direction studies, Trace/Explore switch, Mouse/Trackpad preference and collapsed relationship groups. Old review galleries remain local under `output/`; they are not alternate product implementations.
