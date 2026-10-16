# Artifact-link design prototype

**Status:** owner-authorized, isolated visual/interaction study. Selected visual direction for this study only, not the production Tracer UI or a successor to the rejected system-neighborhood experiment. The owner found the Excalidraw studies bland/unintentional and approved trying one small task in code to judge real typography, spacing, hover, focus and transitions.

## Open

Open [index.html](index.html) directly in your browser. On macOS, from the repository root:

```sh
open docs/ux-artifacts/link-design-prototype/index.html
```

Keep `index.html`, `style.css` and `app.js` together. No server, build, installation, account or network access is needed. Nothing connects to Tracer, EventSculpt or an actual repository.

The browser opens only the selected **Precision** design: compact sans/monospace information hierarchy, squared controls and a right-hand focused picker. There is no A/B comparison switch. [Current initial-state preview](precision.png). The [Contextual preview](contextual.png) is historical reference only, not a current review option.

**The selected design uses the owner's palette in dark mode:** `#0D0D0D` sidebar, `#262626` raised surfaces, `#D9D3C1` warm foreground text, `#268EA6` action fills/selection borders, and `#29CDF2` small active/focus accents. Nearby dark neutrals provide surface separation. Primary action labels use near-black rather than white on teal; amber/violet mapping labels remain distinct semantic colors, not branding or success conclusions. The design stays dark regardless of OS preference; no light/dark toggle yet.

The same requirement identities, mappings, selected requirement and recorded session links survive switching Coverage/Relationships views. Source inspection opens only when requested and can be hidden again. Fonts are system fallbacks, not downloaded brand assets. These are concrete visual hypotheses, not final branding.

## Workbench layout

The owner found the previous page too landing-page-like and approved a layout-only pass. The current design has a compact **Service discovery** header with breadcrumb/scope, one Coverage/Relationships toolbar with the scoped count and reset, and a continuous full-width working surface with a docked right inspector. The large headline/subtitle, top study banner, rounded floating workspace, oversized outer padding and reserved footer spacing are removed. The fictional/session-only notice remains in a quiet bottom status strip. Actions stay near the selected item rather than being pushed to the inspector's bottom. On narrow screens the inspector still stacks; this pass adds no navigation, data or feature behavior.

## Contribution lanes

Open **Relationships** for the new bounded family experiment. An explicitly illustrative `INT-01` parent intent explains why the three requirements are shown together: each **contributes to** that intent in this toy model. All full statements and unresolved scope are visible side by side, with aligned comparison rows. Select a requirement to emphasize its recorded artifact mappings. Select an artifact filename to emphasize the requirements mapped to it and show the artifact's description, requirement-specific qualifiers and optional fictional source in the docked inspector. Unrelated contributions stay visible with quieter headings/backgrounds; this indicates recorded mappings only, not impact or proven realization. **Return to REQ-…** restores the prior requirement focus. Coverage switching retains that requirement and the Relationships artifact focus.

Recorded code is grouped by identity below the contributions: `discovery.ts` appears once in the central view, with separate requirement/version/extent mappings aligned to their corresponding lanes. Click a mapping to inspect it. REQ-02 initially has no code mapping and no fabricated connection. Recording a link adds the corresponding mapping; undo removes only that addition. Other linked artifacts receive their own single identity group. On narrow screens contributions and mappings stack with explicit IDs; this is a desktop-oriented comparison, not a proven mobile workflow.

The parent/contribution annotation is human-authored fixture context, not inferred hierarchy, a complete decomposition, satisfaction, or impact analysis. In Relationships, the inspector no longer repeats full requirement statements or unresolved-work paragraphs already visible in the lanes. Fixture/storage/result limitations are consolidated into the bottom status strip. **Find existing code** opens the captured requirement's candidate picker; **Review covered scope** opens its existing partial mapping read-only. **Compare linked version** explains current v2 versus the test mapping's v1; historical statement/results are unavailable, so it does not fabricate a prose diff or infer failure. Existing requirements, candidate source, mapping semantics and Coverage data are unchanged. [Initial contribution view](precision-contributions.png) · [after recording a shared mapping](precision-relationships.png).

## Try the slice

1. Select **Filter results / REQ-02**, or another requirement. Coverage shows its statement in the inspector; Relationships keeps all statements in the comparison lanes.
2. Switch **Coverage / Relationships** without losing that selection. Relationships compares one illustrative parent's requirement contributions, unresolved scope and shared artifact mappings; it is not a complete traversable graph or automatic impact analysis.
3. Click **Find existing code** for an untraced requirement, or **Link artifact** when adding another mapping, search by filename/path, and select `discovery.ts` or another toy candidate. The complete target statement and version stay inside the picker, so you can compare the exact obligation with the candidate.
4. Use **Inspect source** to show a clearly labeled fictional snippet and the candidate's current session mapping context. This does not inspect any real source file or establish that the candidate implements the requirement.
5. **Cancel**, the close control, or **Escape** discards the candidate without recording a link. **Record link** explicitly adds one code mapping with **extent unreviewed** to the captured selected requirement. Counts/table/context update together; no implemented, approved or passing status is inferred.
6. After recording, **What needs attention** in Coverage, and unresolved-scope text in Relationships, still show unreviewed mapping extent and missing/outdated test mappings. The scoped count measures only requirements without recorded code mappings, not realization or completion.
7. Click a cyan underlined code filename in Coverage/the inspector, or a requirement-specific mapping beneath its artifact in Relationships, to inspect that recorded mapping directly. This read-only mode shows the full target/version, mapping qualifier and fictional source; **Done / Escape / close** returns to the original control without changing selection or adding a link. Initial test mappings remain non-interactive.
8. Use **Undo this session link** beside a session-added mapping to remove only that addition. Fixture mappings and other additions remain intact; selection/view remain. Reset still prompts before discarding all session additions.

**Session-only:** reload/close loses all recorded toy links. There is no localStorage, database, file export, backend or autosave. The visible session notice is intentional. Source snippets, filenames, requirements, statuses and mappings are invented fixture data, not EventSculpt findings. Do not treat a zero-link count as proof of absent code or a recorded mapping as proof of realization.

Current review snapshots: [shared artifact focus](precision-artifact-focus.png), [candidate inspection](precision-picker.png), [recorded-mapping inspection](precision-recorded-inspection.png), and [after recording, with remaining work and undo](precision-linked.png).

## Scope and limits

One fictional service-discovery scope, three requirements and three code candidates. REQ-01's initial code mapping is partial (browsing only), its test mapping points to v1 while the requirement is v2, REQ-03 shares `discovery.ts` with extent unreviewed, and REQ-02 starts untraced. Initial test mappings cannot be edited here. Link kind is code mapping only; no test-result workflow, real search/index, imports, source execution, approvals, persisted schema/status, reference-board edits or production implementation.

The owner prefers the sidebar direction for the web; its detailed navigation remains provisional. This is deliberately a thin experiment, not an approved application navigation shell. The rail/breadcrumbs are static context, not dead navigation buttons. Recorded-mapping inspection is read-only; candidate inspection precedes explicit recording. Session undo affects only the selected addition, not fixture data. Hover/pressed/focus states, native modal semantics, keyboard focus trapping/return, explicit confirmation and a reduced-motion preference are implemented; broad accessibility/usability/browser certification is not claimed. The narrow layout stacks the inspector and lets dialog content scroll; 1024/1440/1920px desktop layouts and 390/720px bounds are checked, not every device/browser. Source descriptions and session mapping context are separate, and context updates when links are recorded.

The proposed workspace slash-command menu remains deferred in favor of a clearer mapping decision. The existing `/` shortcut only focuses search inside an already-open picker; visible buttons remain the entry points.

**Selected direction: A / Precision.** The owner prefers its sans/monospace typography, tighter controls and right-hand picker with the dark palette and web sidebar. Precision is the only design exposed on open. The old comparison controls and switching behavior are removed; B remains a historical preview only. Refine A in small slices rather than extending both directions. Evaluate whether selection, candidate inspection, confirmation and return feel deliberate, readable and understandable—not whether a screenshot alone looks polished. No measured task validation has occurred.

## Checks

With the existing project development dependencies and Playwright Chromium:

```sh
node --check docs/ux-artifacts/link-design-prototype/app.js
node docs/ux-artifacts/link-design-prototype/verify.mjs
```

The focused file-only Chromium check covers absence of the old comparison controls, full target/version in the picker, direct read-only mapping inspection/focus return, unresolved-work context, scoped counts on narrow layouts, individual undo preserving fixture/other session links, dynamic result/draft status semantics, selected-design state retention, requirement/view selection, search/no matches and inert user text, fictional source inspection, modal Tab containment/Escape/focus return, cancellation, explicit captured-requirement linking, duplicate protection, live candidate mapping context, reset accept/cancel, 390px horizontal bounds and reload loss. It fails on page errors or HTTP requests.

Current direction: [UX plan](../../ux-plan.md). Implementation status: [checkpoint](../../checkpoint.md).
