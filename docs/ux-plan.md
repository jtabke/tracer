# Tracer UX design plan

Tracer should make engineering information easy to create, connect, inspect and assess. The product is a configurable engineering knowledge workspace: project schemas supply domain terminology, while identity, relationship direction, revisions and evidence semantics remain consistent.

The [user needs](user-needs.md), [journeys](user-journeys.md), [architecture](architecture.md) and [implementation status](checkpoint.md) distinguish product goals, candidate tasks and delivered behavior.

## Shared workspace

The selected direction is the medical-device map experience shared across all examples (UR-55). Projects use one interaction system rather than separate domain-specific applications. The default Graph / Matrix / History application lives in `ui/workbench/`; the earlier `ui/map/` experience remains a retained Development map task. The [review launcher](ux-artifacts/product-identity/README.md) uses the same production workbench sources.

The workbench combines the Atlas layout and inspector, organized Precision dependency paths and compact temporal navigation. Its shell is dark, restrained and information-led. Light/Dark/System appearance preferences remain future work.

Graph, Matrix and History are perspectives on the same engineering state. Workspace navigation identifies the perspective; local controls configure that view; selection actions stay beside the selected object or in its inspector.

## Design principles

- Make the information primary: readable statements, meaningful short node titles and quiet technical metadata.
- Use spacing and alignment before adding boxes, toolbars or explanatory copy. Avoid decorative eyebrows and repeated titles.
- Show frequent actions directly; disclose optional fields and infrequent operations where they are needed.
- Keep identities and recorded direction explicit. Grouping and layout are projections, not new canonical hierarchies.
- Reserve strong emphasis for selection, changes, conflicts and review state. Use icons or shape for artifact categories rather than arbitrary saturated type colors.
- Preserve drafts, selection, revision and spatial context through navigation. Make read-only history and uncertain save outcomes clear.
- Support keyboard interaction and readable narrow layouts alongside pointer use.

## Discover, modify and assess

| Journey  | Intended outcome                                      | Interaction direction                                                                            |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Discover | Find an artifact and understand its connected context | Search, scoped graph exploration, readable paths and exact relationship inspection               |
| Modify   | Create or change information with little navigation   | Title-first rows, floating cell editors, compatible-artifact search and atomic create-and-link   |
| Assess   | Understand a saved change and document a judgment     | Semantic diff, recorded dependency paths, captured/current input comparison and immutable review |

An engineer should be able to modify a requirement, inspect its saved diff, investigate the same relationships in Graph and Matrix, review a declared evaluation and return without rebuilding context.

## Graph and scope

The graph starts with a useful bounded neighborhood. Expansion and branch collapse retain existing positions and the selected anchor. New investigations frame their relevant nodes once; ordinary selection and view returns retain the camera. Fit preserves readable titles. Distant zoom may reduce detail, but narrow viewport width alone must not hide meaningful node titles.

Layout, edge routing, stroke patterns and endpoint labels communicate relationship roles. Unrelated context can fade. Selecting a recorded path explains the exact source, relationship type, target and selected revision; it does not infer a technical impact assessment.

Categories and folders organize working scope without becoming engineering relationships. Mixed-detail groups should retain outside connections and support exact contributing-link inspection. Counts must distinguish loaded, omitted and total data. Dense scenes require bounded navigation rather than unfiltered global rendering.

There is one wheel interaction model: vertical scroll and pinch zoom at the pointer; horizontal-only or Shift-scroll pans. Blank-canvas, Space and middle-button dragging pan; normal node dragging moves the node. Inspector and Matrix scrolling remain independent.

## Matrix authoring

Grouped traceability paths show shared ancestor prefixes once and retain canonical shared targets. Flat paths support complete-path scanning and copying; adjacency is an advanced exact-link view.

Cell editing preserves table geometry and scroll. Click selects; Enter/F2 or double-click edits. Typing starts title editing or target search. Escape cancels; Command/Control-Enter submits structured fields. Arrows/Tab navigate cells, and Shift selection copies rectangular TSV text. Bulk mutation and spreadsheet paste remain separate capabilities.

A new artifact starts with its title and a suggested identifier. Schema-required fields appear before commit. Existing links can commit immediately when optional metadata is absent; required scope remains enforced. Creating a target and its relationship is atomic. Missing links in a configured projection are not automatically unmet requirements.

## Inspector and responsive behavior

The inspector shows identity/type/version, readable fields, direct connections, configured reachable trace paths and recent history. Known relationship types use role-aware labels such as Decomposed from and Decomposes into. Direct connections and reachable paths are distinct.

The panel docks only when enough usable canvas remains. Intermediate widths use a dismissible drawer; narrow graph work uses a compact or partial sheet. Partial details reserve at least 300px of graph workspace. A full artifact editor is a separate intentional task with an explicit return route.

At 680px, preserve usable graph area, stable node positions and selection when sheets expand or collapse. Longer edits use a task-specific sheet; short cell and link operations remain contextual. Matrix identity/headers stay anchored during horizontal scrolling. History should prioritize reading the selected change rather than shrinking every desktop column.

## History and assessment

Historical revision is shared application context. Every view identifies current versus historical state; historical writes are disabled. Changeset navigation, semantic diffs and revision-scale ticks should complement each other without redundant controls or misleading spacing.

Change investigation centers the changed statement and exact recorded paths. Literal changed-span emphasis supports scanning while retaining full before/after values. Connected artifacts are context or potential review candidates until declared evaluation inputs establish more specific facts.

Assessment keeps three concepts independent:

1. The immutable recorded outcome.
2. Whether declared captured inputs differ from current recorded inputs.
3. The engineer's recorded judgment and rationale.

A decision does not clear input drift or rewrite the original receipt. Stale comparison tokens retain the proposal and require explicit adoption of refreshed inputs. Unknown inputs cannot be accepted. Uncertain writes require inspection and acknowledgment without automatic replay.

The current workbench discovers evaluations in declared input/captured-output scope, not every reachable artifact or a baseline-wide impact census. Project tools exposes the existing receipt authoring owner for exact input capture and recorded outcomes in ordinary projects. Broader baseline investigation and arbitrary temporal comparison remain separate work.

## Model configuration

Project authors define artifact fields, permitted directed relationships and optional workflow presentation. Workflow order and native trace direction are different: requirement criteria can feed verification independently of the design-under-test input.

Visual, guided Text and JSON configuration share one captured draft and existing schema/version guards. Invalid drafts remain available for correction. Layout choices do not alter native relationships or imply project gates, completeness or readiness.

## Evaluation plan

Use realistic tasks in Aster and a contrasting domain such as Gatherline:

- Create a source artifact, connect design/evidence work and find a missing link in the configured view.
- Edit an artifact and relationship, then inspect the saved revision.
- Follow a historical change through Graph and Matrix, compare captured inputs, record a decision and return with context intact.
- Repeat navigation and editing at 680px, with keyboard-only operation and readable zoom.
- Exercise large projects through search, filtering, bounded expansion and paged evidence rather than loading every object into one scene.

Measure assistance, errors, context loss, unnecessary transitions and task completion. Scripted browser checks establish behavior; representative-user observations establish usefulness. AI-assisted critiques are design input, not participant evidence.

## Open design work

The remaining priorities are efficient spreadsheet interaction, unified temporal/selection context, contextual relationship operations, explainable change investigation and stable graph navigation. Named Matrix recipes now persist in the database; positions and investigation scope recover in the same browser/origin. Semantic zoom, bulk operations, portable workspace recovery and richer comparison should follow demonstrated task needs.

The [study index](ux-artifacts/README.md), [iteration summary](ux-iterations.md) and [quality review](qa-quality-review.md) retain the useful findings from earlier explorations. Earlier Studio layouts, image concepts and Trace/Explore variants are historical alternatives, not independent product directions.

## Main workflow milestone

The selected delivery slice is a fresh project completing create → connect → modify → investigate → assess → record decision through the normal launch, then reloading to recover the recorded decision and investigation context. Preserve database selection, historical read-only state, guarded saves and retained task drafts. Unsaved drafts are tab-local and deliberately excluded from reload recovery; warn before leaving, retain known-unsaved context in-session and never replay an uncertain proposal.

Automated verification includes an empty database with a small custom schema, UI-authored input receipt, changed field, recorded review, exact links and positions after reload, at desktop and 680px. This establishes implementation behavior. The unfamiliar-user session remains unrun: recruit someone new to Tracer, give the workflow goal without naming controls, and observe next-action choices, assistance, errors, context loss and completion time. Use Aster and a contrasting domain, then larger datasets and keyboard-only tasks. Do not count scripted completion or response timings as participant evidence.
