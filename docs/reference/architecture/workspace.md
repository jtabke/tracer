# Workspace ownership

## One retained investigation

[ui/main.tsx](../../../ui/main.tsx) opens [ui/workbench/app.js](../../../ui/workbench/app.js). Graph, Matrix and History share selected identities, revision, exact relationships and investigation scope. The retained Development map under [ui/map/](../../../ui/map/) is another presentation over the same native contracts, not an independent engineering model.

`workspace-session.ts` owns loaded snapshots, derived head and revision caches. Adoption reasons distinguish confirmed saves, manual refresh and uncertain-save inspection. `workspace-navigation.ts` owns perspective/selection/revision transitions and draft capture order. Graph layout/input and Matrix geometry/input remain separate view owners; navigation does not reset a user's camera.

## Retained task pages and drafts

`project-navigation.ts` projects one task catalog into the desktop sidebar and modal mobile drawer. Search remains available. Mobile navigation owns containment, dismissal, scrolling and focus restoration.

`project-tools.tsx` and `NativeTasks` retain visited editors rather than constructing duplicate task state. Verification and Change assessments share the stable workspace portal/page infrastructure, with independent reading positions. Back to investigation restores the retained workspace; navigating between tasks retains in-session drafts. Model is a separate full-page owner with its existing draft and hash/history handling. Other tasks keep their existing surfaces.

Controlled scopes are separate from proposals. Contextual entry is a request, not permission to replace a dirty draft, choose a target or open a controlled record. Cancel retains the original draft; stale inputs require explicit adoption. Historical restrictions and failed-read locks remain authoritative. The shared mutation context guards nested tasks against pending/unknown saves.

## Bindings and boundaries

`dom-bindings.ts` aborts direct listeners when replacing workbench DOM. Effects release subscriptions/listeners/frames on cleanup; caret/focus and scroll restore only to the appropriate retained surface. Transport identity is document/project-bound: switching databases reloads it, respects save locks and confirms discard when drafts exist.

`workspace.css` composes ordered styles using Atlas theme tokens. Production components cannot import fixtures or the test harness. Browser-local recovery excludes drafts/proposals and does not promise cross-client continuation.

## Checks and examples

Production scenarios live under [test/](../../../test/). [test/workbench/](../../../test/workbench/README.md) owns disposable fixture servers, static-export loading checks and paired desktop/narrow screenshots. Its small shims re-export production owners; passing its checks does not validate a separate prototype UI.

The complete browser snapshot is bounded to 10,000 records / 100,000 relationships; view-specific projection and rendering bounds are disclosed separately. See [workspace usage](../../guides/workspace-guide.md) and [contributor checks](../../../CONTRIBUTING.md).
