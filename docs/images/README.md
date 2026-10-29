# Documentation images

The selected `aster-workbench-*.png` images illustrate the current shared Graph / Matrix / History workspace in the [workspace reference](../workspace-guide.md) and in-app documentation. Refreshed on 2026-10-29 (America/Los_Angeles) from disposable, fictional Aster projects; evaluation outcomes are explicitly simulated.

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

Inspect original PNGs before replacing deliberately selected illustrations. Keep the captions' distinction between a proposal, saved change and recorded review. Full galleries, databases, coverage and other captures remain ignored local review material.

The older `aster-development-map.jpg` remains available for the retained Development map documentation; it is not the shared workbench preview. The original [capture notes](../ux-artifacts/product-identity/README.md#verify-and-capture) describe fixture isolation and the simulated assessment.
