# First UI decision: working structure

**Status:** three low-fidelity, static alternatives for walkthrough 3. None is selected or implemented. The owner requests several choices at each design step; this round only compares the arrangement of information, not navigation, editing controls or visual branding.

## Compare

- [A — Coverage grid](a.png): scan requirements against implementation and tests. Fast comparison is the hypothesis; shared/many-to-many mappings may become harder to read.
- [B — Relationship lanes](b.png): see realizing artifacts and their connections. Shared code appears once. Relationship legibility is the hypothesis; dense networks and long statements remain untested.
- [C — Expand in context](c.png): keep siblings compact and expand the selected requirement in place. Focused work is the hypothesis; wider relationship context can be hidden.

All use the same fixture, parent intent and selected requirement. These are drawings of possible interactions, not working controls. Choose the organizing structure first; next compare detail/editing approaches within it. The owner may reject all three. No final delivery journey, navigation model, component library or product architecture is implied.

## Same illustrative material

Intent: find suitable services. Three requirement labels are approved in the toy scenario: browse categories, filter results and handle sparse results. The same `discovery.ts` artifact is linked to the first and third; a `discovery.spec.ts` mapping addresses only the first. The selected second requirement has no implementation/test links. There is one missing code link and two missing test links, not a proven census of unimplemented/untested behavior.

EventSculpt supplies the reference domain and real discovery filenames, not these approved statuses or trace mappings. This is not a coverage audit of EventSculpt. Short labels stand in for requirement statements; long text, partial mappings, versions, result evidence, multiple parents and source drift need later exploration. Linked code is not proof of full realization, and a test link is not a passing result. Existing-but-unlinked code remains possible.

Grounding: [journey discussion set](../../user-journeys.md#discussion-set--three-task-walkthroughs-before-layout), UR-10 and UR-14–15 in [needs](../../user-needs.md), and the current [UX plan](../../ux-plan.md). No third-party UI assets were copied.

## Open and edit

Open https://excalidraw.com/ and load [working-structure.excalidraw](working-structure.excalidraw). It contains three grouped boards; ungroup a board to edit its individual shapes/text. Importing/editing a drawing is not running Tracer or configuring a shared live canvas. Use toy material only.

[a.svg](a.svg), [b.svg](b.svg), [c.svg](c.svg) and their PNG previews are static companions from the same initial drawing primitives, **not native Excalidraw exports**. Editing the native scene does not regenerate previews. The native scene is the editable source; static companions are initial comparison snapshots.

## Checks and limits

Native-scene metadata and board/element identity checks, SVG XML parsing, local PNG dimensions, file-only browser rendering, no HTTP requests/page errors and visual inspection cover artifact integrity only. All PNGs are 1100 × 560. New-scene editor import/edit/export round-trip, responsive behavior, keyboard/screen-reader interaction and task usability have not been tested. The older tool-proof round-trip is not evidence for this particular scene.

These native/vector sketches are static design studies. Current direction and verification are summarized in the [UX plan](../../ux-plan.md) and [status](../../checkpoint.md).
