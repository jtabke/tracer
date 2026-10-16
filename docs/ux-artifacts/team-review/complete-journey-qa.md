# Complete journey study — independent QA

Status: bounded design-study review complete. This evaluates the interactive fictional rehearsal at `http://127.0.0.1:4352/`, not production delivery, backend correctness, or representative-user acceptance. The final targeted transition checks used study SHA-256 `169f39f3b57c9d910002382f047fa2e827476a5d8ba2a938cbc8480717af4770`; already-passing author/link journeys were not rerun unnecessarily. QA changed this report and screenshot artifacts only.

## Fixture and scope evidence

The embedded normalized snapshots contain 113 medical records / 282 links, 83 technology records / 222 links, and 72 integrated-product records / 170 links. Medical deliberately omits CMP-06 and its incident links initially, giving 112 starting records. Recreating that human key creates a new preview identity; it does not resurrect old identity or links. All rehearsal mutations stayed in an isolated browser profile; no live project database was modified.

## Normal-pointer journey results

| Journey                          | Observed result                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Medical SYS-07 → new CMP-06      | One component requirement with independent title/statement was created with **zero new recorded connections**. Explicit rationale and Record connection then created SYS-07 → decomposes_into → the new identity. The scope, Table and Reading each retained one CMP-06 identity. Matrix showed one SYS-07/CMP-06 link. |
| Technology STORY-12 → new test   | Created one test definition, then recorded STORY-12 → checked_by → TEST-PREVIEW-11. WORK-10 subsequently linked to that exact same UUID, not a duplicate test. Both incoming native arrows were visible. Copy explicitly distinguishes a definition from an executed result.                                            |
| Orbit DES-09 → existing EVAL-R04 | Recorded the ordinary evaluated_by connection. EVAL-R04 still contained its original five declared captured inputs, excluding DES-09, and its simulated failing outcome remained unchanged. The comparison explicitly stated DES-09 is not a declared input.                                                            |
| Changed-input review             | EVAL-R02 listed all five declared inputs, exactly DES-01 v1 → v2 changed and four matching. Captured configuration remained BUILD-R01. Saving “Acknowledge changed inputs” stored decision/rationale separately without changing the simulated native outcome.                                                          |

Find/library lookup returned one newly created CMP-06. Native source/target direction remained explicit in scope neighbors, connection proposals, and Matrix. Graph/Table/Reading/Matrix retained the same loaded scope. Trace now states the recipe projection separately: SYS-07 showed **3 trace items from 6 loaded items**, while the neighborhood remained **6 items / 8 recorded connections**. This does not imply complete product coverage.

## Final guard and draft checks

- Editing STORY-12 retained its native acceptance and status fields. Normal-pointer Save produced current v2 while preserving captured v1 statement/version.
- A duplicate TEST-PREVIEW-11 human key was rejected with title/statement retained and created count unchanged. This is a study guard, not a new native uniqueness claim.
- An independently valid application record created from STORY-12 remained unlinked when Record rejected the incompatible checked_by target. The connection rationale and proposal remained available; recorded-link count did not increase.
- Project changes, same-identity scope selection, and different-scope library navigation retained dirty authoring state. The global Return to unsaved draft entry restored the filled form.
- Latest review transition: Return to scope paused the evidence review; Return to draft restored its decision, rationale and capture. Explicit Save then stored the review.

Initial review found blur-triggered rerenders that swallowed pointer clicks, empty optional-field drafts, same-item draft hiding, incompatible endpoint recording, and missing unknown-input acceptance protection. The parent corrected the study. Pointer save, attribute preservation, identity/endpoint guards, and review recovery passed the checks above. A stale loaded revision still swallowed Save until refresh; it is not a defect claim against the final study.

## Visual checks and remaining design risks

Authoring, captured comparison and Model were inspected and captured at outer browser widths 1024 and 390. The iframe has a 32px wrapper allowance; inner document widths equaled 992 and 358 respectively, with no document overflow. Authoring has a clear primary form plus context at 1024. The captured comparison keeps all five input selectors alongside the diff at 1024, and provides Return to scope on mobile.

The complete-study Model selects the actual project schemas: 18 medical types / 22 authored routes, 17 technology / 16 routes, and 16 Orbit / 28 routes. Orbit design focus distinguishes requirement input, design dependency feedback, component output, design-under-test evaluation, and configured design. This focused input/output representation does **not** establish completion of the requested full visual workflow editor; integration with the separate model study remains open.

Two mobile hierarchy risks remain for design review: the declared-input selector follows the entire selected diff and review controls, so users can encounter a decision before discovering the other inputs; authoring puts substantial sibling/context copy before the first field. Neither element is hidden, but these orders delay the main task. Consider a compact visible input selector before the diff and shorter contextual summaries before fields. At mobile width the type selector also truncates the selected component-requirement label.

Screenshots: [author 1024](../studio-design-first/qa-complete-author-1024.png), [author 390](../studio-design-first/qa-complete-author-390.png), [capture 1024](../studio-design-first/qa-complete-capture-1024.png), [capture 390](../studio-design-first/qa-complete-capture-390.png), [model 1024](../studio-design-first/qa-complete-model-1024.png), [model 390](../studio-design-first/qa-complete-model-390.png).

## Limits

Host-only Rehearsal condition controls were unavailable in the CLI wrapper (`Tweak` absent), so save conflicts, read failures and unavailable inputs were **not interactively tested**. Source review confirms an explicit unknown-input acceptance block retaining rationale, separate reevaluation/acknowledgment decisions, and retained conflict draft paths; that is not browser proof. Created-then-edited historical snapshots also received source review only. Native persistence/concurrency, accessibility beyond these visible labels/controls, comprehensive cross-view selection restoration, full model configuration, performance, and real customer validation remain outside this bounded review. Passing these tasks supports further design review; it is not whole-feature approval.
