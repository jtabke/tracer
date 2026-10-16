# System-neighborhood interaction experiment

**Status: owner-rejected UX direction (UR-9).** The owner opened the prototype and reports walls of text, poor visual hierarchy, unclear interactions and no clear screen goal. Retained only as a discarded experiment and technical receipt; do not refine this layout into the product. This is fictional content, not an actual device model or engineering assessment. Passing functional checks below do not establish useful UX.

## Open and work

Open [index.html](index.html) directly in your browser. On macOS, from the repository root:

```sh
open docs/ux-artifacts/system-neighborhood/index.html
```

Keep the whole folder together: HTML, CSS, fixture and scripts. It runs offline in a browser without an account or build. Controls really change the **toy workspace**, not Tracer data. This is not the earlier static image gallery or an editable Excalidraw drawing.

**Saving is explicit:** drafts are held in this tab's memory, not automatically stored. Before closing/reloading, use **Download toy drafts**, verify the JSON file saved, and later select it using **Resume from file**. Download includes local wording, authored items, proposed relationships, questions, selected family/lens and an unfinished author form with its captured parent. The original fixture is never overwritten. Import/reset replacement requires confirmation when there is local work. Invalid imports retain the current workspace. Browser unload prompts are best-effort; downloading is the preservation path. Use toy/sanitized text only.

## What is different from the image concepts

- Both full system-intent statements stay in the workspace; desktop scrolling pins them while you work below. At widths up to 950px they return to normal document flow, rather than consuming the whole screen. Narrow layout does not show everything simultaneously.
- A family is several readable, editable contributions together—not a single selected record with the rest hidden by its inspector.
- The shared `SW-LIMIT` item appears in either family's context as the same identity. Edits and questions survive browsing; no duplicated child is created.
- Typed relationship buttons expose the other parent and drive contract. Scope says which family/cross-cutting items/observations are included; this is not a full-project graph or automatic impact finder.
- Author a contribution where its parent intent is visible, or propose a relationship to existing information. An unfinished author draft retains its captured parent even when you browse another family.
- The change lens uses the same family, with original/proposed wording and assessment questions. No downstream rewrite, mathematical propagation, validity status or approval occurs.

This is one **interaction hypothesis**, not proof that cards, a board or this layout should be the product default. It still has long vertical scrolling, separate evidence below authoring, and limited simultaneous comparison. These were friction candidates for the original walkthrough, not issues solved by styling; the owner subsequently rejected the overall direction. Current next steps are in [ux-plan.md](../../ux-plan.md#evaluation-plan).

## The fictional starting material

Grounding: the user-reported motor-change context in [user-journeys.md](../../user-journeys.md), the system-context complaint UR-7 and [competitive critique](../../ux-competitive-review.md). All statements, versions, links and observation content here are authored toy data. They do not describe the owner's actual medication-delivery device or constitute clinical/safety limits. The deliberately vague tolerance/range remain unknown, rather than inventing numbers.

| Identity        | Role in the task                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `SYS-DEL`       | Delivery intent, unchanged by the toy proposal.                                                                                 |
| `SYS-STOP`      | Fault-stopping intent, also unchanged.                                                                                          |
| `SW-MOTION`     | One delivery sibling: translates requested volume into calibrated motion.                                                       |
| `SW-LIMIT`      | Shared contribution under both intentions: currently stops issuing motion commands immediately at the configured command limit. |
| `DRV-CFG`       | Drive command/limit-event contract; also a cross-cutting relationship from `SW-LIMIT`.                                          |
| `MECH-TRANS`    | Delivery sibling: transmission/calibration and load displacement.                                                               |
| `MECH-BACKLASH` | Existing, deliberately unlinked direction-reversal characterization.                                                            |
| `SW-FAULT`      | Fault family: latched indication and acknowledgement.                                                                           |
| `IF-FAULT`      | Fault family: distinguish a limit event from other faults; classification is unresolved.                                        |
| `TEST-VOLUME`   | Original observation with `SW-MOTION v2` and `MECH-TRANS v4` inputs.                                                            |
| `TEST-STOP`     | Original immediate-stop sequence observation with `SW-LIMIT v3` and `DRV-CFG v2` inputs.                                        |
| `TEST-FAULT`    | Original acknowledgement observation with `SW-FAULT v1` and `IF-FAULT v1` inputs.                                               |

The proposal changes immediate stopping to ramp-down before reporting a limit event. Its toy rationale is investigation of bench vibration; displacement, command-contract and stopping consequences need human assessment. No passing test result is supplied. A declared input wording difference is distinguishable from a relationship-only impact question, and neither proves evidence invalidity. The unknown classification of limit event versus fault is not resolved by drawing another arrow.

Canonical source: `fixture.js`. `model.js` applies local proposals without mutating that source. It is a tiny toy model, not a replacement engine or production import/export format.

## Historical walkthrough script — not the current next step

Retained to explain the original experiment and checks, not to request another owner walkthrough or continue this rejected layout. The script below does not supersede current collaborative discovery.

1. **Understand the family.** Under delivery intent, compare `SW-MOTION`, `SW-LIMIT`, `DRV-CFG` and `MECH-TRANS`. What does each contribute? What remains unspecified? Can you read enough together to judge the family?
2. **Edit and trace shared identity.** Open **Edit SW-LIMIT in this context**, change its statement, then use its `SYS-STOP` relationship button. Does the other parent's full intent help? Is it clear this is the same item, not a copy? Follow **uses command contract → DRV-CFG**.
3. **Author without losing ownership.** Start a contribution about limit-event recovery, browse the other family before submitting, and inspect the captured parent. Add it. Alternatively connect existing `MECH-BACKLASH` only if you can justify the relationship. Neither action demonstrates valid coverage.
4. **Explore a behavioral proposal.** Choose **Explore the change**, then **Use the illustrative ramp-down wording**. Existing wording drafts require confirmation before replacement. Identify the direct edit, unchanged intent, drive/mechanical questions and unmodeled fault classification. Where is the explanation too generic or missing?
5. **Inspect original evidence.** Read `TEST-STOP` and its captured inputs. Local proposed wording differs for `SW-LIMIT`; applicability remains unknown. Record what would need observation or engineering assessment. Unrelated `TEST-VOLUME` inputs are not automatically marked changed.
6. **Interrupt and resume.** Download the toy workspace, reset and resume from that file. Confirm edits, questions, new connections and unfinished author text remain. Nothing was committed to Tracer or approved.

Capture task step, lost context, misleading scope/identity, unnecessary navigation, unreadable content and missing next action. This fixture makes richer interaction possible, but real artifacts may expose different friction. No measured completion time or usability finding is claimed until someone performs the task.

## Repeatable checks

From the repository root, with the existing development dependencies and installed Playwright Chromium:

```sh
node --test docs/ux-artifacts/system-neighborhood/model.test.mjs
node docs/ux-artifacts/system-neighborhood/verify.mjs
```

Six model checks cover shared identity, unchanged originals, scoped observation inputs, duplicate-free linking, captured author parent, export/resume and malformed import rejection. The focused Chromium workflow checks in-context typing/focus, family/lens transitions, proposal replacement confirmation, author/link operations, download/reset/resume including unfinished text, cancelled/failed import retention, inert text markup, assessment retention, pinned desktop intent and narrow keyboard navigation without page errors/HTTP requests. Receipts and known limits are in [checkpoint.md](../../checkpoint.md). Scripted checks are not human usability validation or comprehensive screen-reader/browser testing.
