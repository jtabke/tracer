# Model configuration and recorded connections

The shared application presents authored workflow order separately from exact native trace permissions. Visual, guided Text and Advanced JSON configuration share one captured schema draft, with explicit save/cancel and conflict recovery.

This document summarizes the model-first exploration and the contracts retained in the shared map-led application. Current implementation and validation limits are recorded in [architecture](architecture.md#development-flow-and-trace-direction), [UX planning](ux-plan.md#model-configuration) and [status](checkpoint.md).

## Interaction contracts

- Browse actual project-defined artifact and relationship types, including isolated types.
- Render only explicitly authored workflow paths; do not reverse native relationships based on names.
- Keep criteria-to-verification and design-under-test inputs distinct.
- Open recorded connections through bounded, snapshot-consistent reads with exact endpoint identities.
- Retain invalid JSON and local drafts across configuration representations until corrected or explicitly cancelled.
- Keep the selected type readable when inspection opens; distinguish whole-map orientation from framing the selection.
- Use captured schema/object versions for writes; layout changes alone do not modify engineering records.

## Source boundaries

`ui/schema-editor.tsx` and the guided/definition controls own captured configuration editing. Model-flow policies and rendering distinguish workflow presentation from permitted directed links. The application and persistence layers validate schema changes against existing records and preserve atomic rollback on rejection.

Historical Model/Workspace components under `test/legacy-ui/` remain test fixtures. They are not alternate production interfaces.

## Evaluation findings

Earlier scripted reviews identified duplicate type navigation, unreadable overview framing, API-shaped forms and a narrow starter overflow. Subsequent revisions use a single configuration draft, readable selected definitions, bounded controls and contextual native actions. The same interaction patterns must remain usable across medical, software and integrated-product schemas.

Project-owned stage gates, workflow execution, automatic schema repair and readiness inference are outside this slice. Scripted fixture checks do not establish user comprehension or general scale performance.
