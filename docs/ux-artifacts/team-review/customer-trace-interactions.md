# Customer task: follow a purposeful engineering trace

Status: simulated engineering customer critique, October 13, 2026. Independently observed native Orbit on port 4344 using Playwright CLI `tracer-customer-next`, 1440 × 1000. Read-only interactions; no database writes. This is a design recommendation, not owner acceptance or evidence of actual customer research.

## Task and current behavior

I opened the shared blower-control design scope, chose Graph, increased depth to 3, then selected REQ-R03 (whole-product energy allocation). The graph returned 61 items / 145 ordinary connections with 16 depth-boundary items. Selected-node edges now stand out while unrelated edges dim; node revisions and receipt-input capture versions are helpful additions.

At readable detail scale, the requirement and nearby functions are visible, while its designs and evaluations are offscreen. To locate the next item I have to use Overview, search tiny nodes, select one and Center selection. This is orientation work repeated for each engineering step. Showing fewer edge labels helps the picture, but does not provide a purposeful way to follow the product's reasoning.

The engineering question is: **Which designs implement this requirement, what evaluated them, and what findings resulted?** It needs shared and sibling designs, the direct requirement-to-evaluation criteria link, and the implementation-to-evaluation link together. It is not necessarily a tree, a directed dependency chain, or an impact calculation.

## Recommended interaction

Keep one compact graph toolbar: depth, Overview, Center selection and the existing zoom controls. Put task-specific navigation beside the selected item's inspector rather than adding another global toolbar row.

1. Selecting a node shows **Follow recorded connections**: compact rows of actual connected key/title/type, native arrow and relationship. Group rows by relationship, not invented development phase. Selecting a row inspects and centers that neighbor while preserving the starting item and loaded scope.
2. Let the reviewer maintain a short **trace being followed** sequence. Starting from REQ-R03, explicitly choose DES-01, then EVAL-R02, then FIND-R02. The chosen sequence highlights its actual edges; adjacent alternatives remain visible but dim. Offer one Clear focus action. Do not create or change recorded links by following them.
3. Show alternative paths around a shared item: REQ-R03 also connects to DES-04; EVAL-R02 has direct criteria and captured-input connections. A reviewer should be able to compare these branches without replacing the root or hiding the rest of the loaded map completely.
4. Display the selected path in a compact strip or inspector list, using human titles and exact link meanings. Reading left-to-right does not reverse stored arrows. A finding's `finding_from` link may point back toward evaluation even though the user reads evaluation followed by finding.

**Do not equate shortest path with full trace.** REQ-R03 → EVAL-R02 is a legitimate direct link that bypasses the design. A shortest-path-only focus would exclude the implementation the owner explicitly wants to inspect. Either let the reviewer select an intermediate (`via DES-01`) or show multiple loaded alternatives within a clearly declared path bound. Label automatic connectivity results as recorded routes, not complete development flow or all affected items.

## Receipt edge activation

I activated the dashed `EVAL-R02 → DES-01 (evaluated using · captured v1)` edge by keyboard. It selected EVAL-R02's generic current-item inspector. The corresponding receipt remains behind Recorded evaluations, so the clicked evidence itself is still hidden. The captured-v1 edge label improves meaning, but the connected design node represents current v2.

Activating this edge should open a read-only **Evaluated input** inspector immediately containing:

- Evaluation title, recorded outcome and date.
- Input title/key, captured v1 and current v2.
- The exact captured configuration, when present.
- Changed/unreviewed comparison status, kept separate from technical validity or release readiness.
- Captured and current statements for this changed input; unchanged detail can be compact.
- A clear action to review the complete receipt. Canonical IDs and capture provenance can be secondary.

This differs intentionally from activating an ordinary `DES-01 → EVAL-R02` relationship, which should inspect the actual recorded link. Receipt activation must retain graph root, depth and camera. It must not silently replace the current design identity with its historical revision or imply a test evaluated current v2.

## Acceptance criteria for the next iteration

- From REQ-R03, follow DES-01 → EVAL-R02 → FIND-R02 without repeatedly searching the tiny Overview.
- The direct REQ-R03 → EVAL-R02 criteria route and the route via DES-01 are both discoverable. DES-04 remains a visible comparable alternative.
- Root, depth and honest 61/145 scope information remain stable while selection/path focus changes. Clearing focus restores the same loaded graph.
- Native arrow meanings and receipt dependency meanings remain distinct. The user cannot mistake a focused route for exhaustive impact or verified coverage.
- Canvas occupies the working area; the added interaction does not create another tall row of global controls.
- Receipt edge activation immediately explains captured v1 versus current v2 and links to its complete receipt.
- Any pending item draft survives depth, focus, neighbor navigation and receipt inspection, using the existing unsaved-change handling when changing editable selection requires it.
