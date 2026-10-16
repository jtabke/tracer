# Engineering customer task review

Status: simulated customer perspective, observed native UI interactions on October 13, 2026. This is a usability critique, not customer research or owner acceptance.

Persona: medical-device systems engineer reviewing requirement/design/test coverage; hardware/software product lead investigating an unchanged historical result after a firmware change. I used the interface before reading implementation code.

Environment: Playwright CLI session `tracer-customer-review`, 1440 × 1000. Engineering starter on port 4343; read-only Orbit R1 on port 4340 for realistic evaluation evidence. No records, schema, reviews or configurations were saved. Configure was cancelled. Latest rebuilt workflow labels were rechecked.

## Tasks and findings

1. **P1 — A complete trace is not discoverable from the ordinary item graph.** I opened REQ-01 from All items and chose its Graph button. It showed requirement, design and intent, with no depth control. Clicking a design selects it but does not reveal its downstream tests. The instruction to use the table for loaded counts does not tell me how to continue the trace. Put visible depth and direction controls beside Fit; make the starting item distinct from selected inspection, and report omitted/limited scope.

2. **P1 — Opening properties loses the selected type offscreen.** In Configure Visual, clicking Test opens a roughly 330px properties panel. The canvas narrows while keeping its 100% arrangement, so Test disappears to the right. I had to discover and press Fit, which reduces the whole model to 73% and makes connection labels small. Auto-pan the selected node into view when the inspector opens; preserve readable scale where possible. A resizable side inspector or bottom drawer would serve this better than silently clipping the active object.

3. **P1 — Evidence review puts unchanged inputs before the changed design.** Orbit EVAL-R02 correctly reports changed/unreviewed and a captured build, but TGT-02 and REQ-R03 occupy most of the first comparison screen. DES-01, the change driving my review, is below them. Each input repeats direct dependency, native revisions, a matching statement and three disclosures. Lead with a compact comparison table and changed inputs: `Blower-control firmware · DES-01 · captured v1 → current v2`. Show current matches as short rows, with provenance expandable. Keep the original outcome and captured configuration near this comparison rather than above a long scroll. The status must continue to distinguish changed inputs from an invalid result.

4. **P2 — Native relationship vocabulary still distracts from development flow.** The corrected diagram is now conceptually clear: intent → requirement → design → test, with a separate acceptance-criteria branch from requirement to test. Rebuilt edge labels fixed my initial ambiguity. However, the chips above it still say contributes to/mapped to/tested by and their accessible names describe native directions, including requirement → intent. In Development flow, give each path its workflow label/direction; keep canonical trace relationship names in a selection inspector or Trace connections mode.

5. **P2 — Two different Graph/Table destinations have the same labels.** Sidebar Graph and Table are separate working views; the item context also has Graph and Table. As a customer I cannot predict whether a click preserves my current starting item/scope. Rename or unify the context/scope navigation so one visible Graph/Table switch operates the current working scope. If separate tools are retained, describe their different purpose concretely. The useful Relationships/Coverage/Reading views were behind More views even at 1440px; relationship scope controls were also hidden. Show frequent view and scope controls in a toolbar when space allows.

6. **P2 — The realistic project home has too much instruction in cards.** Orbit scopes are good task entry points, but seven large cards, a full 16-type library and repeated scope links in the rail compete. Some card descriptions teach technical cautions before I start a task. Use a short task title plus one-line purpose; retain detailed example guidance after opening a scope. Keep saved scopes prominent and show the library as compact type counts. The studio rail and current-page header provide a useful stable structure.

7. **P2 — Multilevel table supports the work but needs focus to prevent a wall of repeated text.** The home shortcut opens a real eight-column trace and the shared design/evaluation paths are valuable. It produced 76 paths. Full statements in every cell make long traversal expensive. Offer a compact key/title view with selected-row/path statement inspection, highlight the chosen path across columns, and filter to one goal/target or changed design. Do not remove the full statements from inspection or hide missing descendants.

8. **P3 — Configure Text is usable but the mode label is ambiguous.** Text initially presents a definition list and guided field forms; raw JSON is another checkbox. That is useful structured editing, but a user expecting a text source editor has another discovery step. Prefer `Visual / Definitions / JSON` or label the current second mode `Definitions`, with an explicit JSON entry. Both modes retained selection correctly in my non-mutating walkthrough.

## What is working

- The latest workflow edge labels clearly distinguish the requirement's acceptance criteria from the design under test. Intent no longer appears to develop backwards.
- Visual type selection, properties and the structured definition editor give a credible alternative to authoring raw schema JSON.
- Evaluations are outcome-first and the captured configuration/current drift distinction is technically meaningful. Keep this distinction while simplifying presentation.
- Ordinary item inspection remains beside the context instead of forcing a separate page. The stable project rail makes the main destinations visible.

## Next customer acceptance tasks

Use a fresh realistic medical-device or integrated product seed, rather than starter records titled design record 1/test record 1. From one requirement, display upstream intent and downstream design, test definition, actual run and finding at configurable depth. Inspect a sibling/shared design without changing the root, change depth without losing an item draft, and explain what the graph omits. Configure a test input visually while keeping the selected node visible, then inspect the equivalent definitions/JSON without saving. Finally find the changed firmware input in EVAL-R02 within one screen and distinguish its historical outcome from current applicability.

## Follow-up native acceptance walkthrough

Observed revised build on port 4344 (fresh realistic Orbit), plus revised UI against the engineering starter on port 4343. Same viewport and read-only policy; Configure cancelled without saving.

Verified improvements:

- DES-01 ordinary item Graph now offers visible depth. Depth 2 returned 45 items / 97 ordinary connections; depth 3 returned 61 / 145 and explicitly identified 16 depth-boundary items. Depth 6 returned 71 / 170 and stated that all ordinary connections reachable from this starting item were shown. The project library has 72 items, so this correctly avoids claiming all project items are reachable.
- The root stayed DES-01 while inspecting EVAL-R02. Overview provides an explicitly small whole-map orientation view; Center selection restores 100% readable detail. Changing depth retained the selected/root distinction.
- Configure now frames the selected Test/evaluation at 100% when properties opens. The original disappearance issue is resolved. Overview → Frame selection returns to readable detail; Text → Visual preserves selection. Larger diagrams still require panning, which is reasonable if selection remains visible.
- Workflow labels are now directly on paths, readable at detail scale; redundant native chips are removed in development mode. The requirement acceptance-criteria branch and design-under-test branch are understandable.
- Relationships/Coverage/Reading and family controls are visible at desktop width.

Remaining customer friction:

- **P1 space:** The family graph canvas starts around y579 at 1440 × 1000 because the title, representations, full-width family controls, scope disclosure, depth and scope counts occupy so much height. The centered root appears around y950, near the viewport bottom, and inspection needs a page scroll. This is not solved merely by a readable canvas camera. Use a compact workspace header and one/two purposeful control rows; give the canvas the remainder of the viewport.
- **P2 scope semantics:** In expanded depth, Family relationship remains `realized by` and Direction remains `Into the starting item`, while trace copy says both directions/all relationships. A customer can reasonably assume these active-looking controls constrain the expanded graph. Label them as family-only, disable them while exploring an ordinary trace, or clearly separate family scope from trace controls.
- **P2 dense traces:** 61 items and 145 ordinary links are semantically useful but visually dense. Default 100% preserves readable node text; it does not by itself make crossings navigable. Selecting a path/node should focus its adjacent edges and dim unrelated ones, with a way to show the complete graph again. An explicit direction/relationship filter would help purposeful engineering review. A tiny Overview is acceptable for orientation, not reading individual traces.
- **P2 evidence semantics:** Activating the dashed `EVAL-R02 → DES-01 (evaluated using)` dependency selects EVAL-R02's current output inspector. It does not directly show the captured DES-01 v1 input, while the visible design identity is current v2. Provide a clear route to the exact receipt/pinned versions from this edge so a reviewer can establish what was tested. Keep receipt dependencies visually distinct from ordinary `DES-01 → EVAL-R02` links. Explain that changed/review badges on input nodes flag dependent evidence review, not design approval.
- A mouse activation of a dense receipt edge did not complete in the walkthrough; keyboard focus + Enter worked. QA should check overlapping edge hit targets rather than treating accessible button existence as a sufficient mouse interaction test.

Assessment: core depth and selection/camera tasks now work. This is qualified usability progress, not acceptance of the whole application as polished. The family graph's available working area and receipt-edge meaning remain important next refinements.
