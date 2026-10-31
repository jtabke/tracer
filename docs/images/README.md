# Documentation images

The root README deliberately selects the Graph hero, Matrix editor, History diff and `change-assessments-workspace-desktop.png` rather than embedding a complete review gallery. The assessment image is a 1440×1000 production capture from a synthetic exact-pair follow-through after the readable-name presentation correction: one candidate is accounted for, the original failed evaluation still needs judgment, and changed discovery remains an explicit obligation. A completed Verification conclusion does not silently complete the whole assessment. Regenerate with `npm run build` and `npx playwright test test/configuration-application-browser.spec.ts`, selecting `output/assessment-page/engineering-1440-follow-through.png`. All other generated study/report captures remain local and ignored.

The selected `aster-workbench-*.png` images illustrate the current shared Graph / Matrix / History workspace in the [workspace reference](../guides/workspace-guide.md) and in-app documentation. Refreshed on 2026-10-29 (America/Los_Angeles) from disposable, fictional Aster projects; evaluation outcomes are explicitly simulated.

| Image                                   | Viewport  | Captured state                                                                                                               |
| --------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `aster-workbench-graph.png`             | 1440×1000 | Saved operating-temperature edit at r400 and twenty exact recorded dependency paths; connectivity is not an assessed impact. |
| `aster-workbench-matrix.png`            | 1440×1000 | Floating statement editor with an unsaved operating-temperature proposal at r399.                                            |
| `aster-workbench-history.png`           | 1440×1000 | Saved r400 change and field-level diff.                                                                                      |
| `aster-workbench-assessment.png`        | 1440×1000 | Recorded Needs reevaluation decision; captured/current inputs remain changed.                                                |
| `aster-workbench-search.png`            | 1440×1000 | Identifier/title/statement search for pressure at r399, with match count and active suggestion.                              |
| `aster-workbench-editor.png`            | 1440×1000 | Unsaved inline statement proposal at r399; other draft fields are retained in the same tab.                                  |
| `aster-workbench-connection-mobile.png` | 390×844   | Prepared connection from PRS-01 to SYS-01, exact endpoint summaries and required scope; not yet submitted.                   |

The navigation captures preserve the existing Atlas design language: a docked desktop sidebar and the same destinations in an open mobile drawer. Selected-record actions remain beside the visible identity.

| Image                                    | Viewport  | Captured state                                                                          |
| ---------------------------------------- | --------- | --------------------------------------------------------------------------------------- |
| `aster-workbench-navigation-desktop.png` | 1440×1000 | Real shared workspace at r399 with persistent sidebar destinations and selected PRS-01. |
| `aster-workbench-navigation-mobile.png`  | 390×844   | Open modal side drawer over the retained r399 workspace; no project writes.             |

Regenerate these two with `npm run build` followed by `npx playwright test test/project-sidebar-browser.spec.ts`. Select `workspace-1440.png` and `sidebar-mobile-390.png` from `output/sidebar-navigation/`. The test also checks 680px navigation, focus containment, dismissal, short-height scrolling and context preservation across resize.

Regenerate the first four with `npm run workbench:screenshots`. Select, respectively, `03-desktop-investigate-dependencies.png`, `01-desktop-modify-operating-range.png`, `02-desktop-inspect-saved-change.png` and `06-desktop-recorded-decision.png` from `output/product-identity/workbench-review/`. The generated gallery and manifest preserve the complete paired desktop/680px walkthrough locally.

Regenerate the last three with `npm run build` followed by `npx playwright test test/inspector-polish-browser.spec.ts`. Select the 1440px draft-retention case's `search.png` and `statement-editor.png`, and the 390px relationship-search case's `connection.png`, from `test-results/`.

The selected `verification-workspace-desktop.png` (1440×1000) and `verification-workspace-mobile.png` (390×1000) illustrate the retained Verification page in an explicitly synthetic configured research project. Both show an open controlled case, exact configuration target and declared basis; no verification execution has been recorded in that case. They are software-presentation evidence, not physical or representative-user validation. Regenerate with `npm run build` and `npx playwright test test/configuration-reference-authoring-browser.spec.ts`, then select `recorded-target-1440.png` and `recorded-target-390.png` from `output/verification-workspace/`.

Inspect original PNGs before replacing deliberately selected illustrations. Keep the captions' distinction between a proposal, saved change and recorded review. Full galleries, databases, coverage and other captures remain ignored local review material.

The older `aster-development-map.jpg` remains available for the retained Development map documentation; it is not the shared workbench preview. The original [capture notes](../../test/workbench/README.md#verify-and-capture) describe fixture isolation and the simulated assessment.
