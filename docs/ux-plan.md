# Tracer UX design plan

Tracer should make engineering information easy to create, connect, inspect and assess. The product is a configurable engineering knowledge workspace: project schemas supply domain terminology, while identity, relationship direction, revisions and evidence semantics remain consistent.

See [needs](user-needs.md) for goals/evidence, [journeys](user-journeys.md) for candidate tasks, [architecture](architecture.md) for contracts and [checkpoint](checkpoint.md) for progress.

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

Focus follows all recorded relationship kinds unless the visible relationship filter selects one kind; direction and depth remain explicit. Potential-impact exploration follows all recorded kinds downstream for up to two steps and describes that scope. Neither establishes technical impact.

There is one wheel interaction model: vertical scroll and pinch zoom at the pointer; horizontal-only or Shift-scroll pans. Blank-canvas, Space and middle-button dragging pan; normal node dragging moves the node. Inspector and Matrix scrolling remain independent.

## Workspace search

Search shares the selected revision across Graph, Matrix and History. Group commands and artifacts distinctly; prioritize exact identifiers, identifier prefixes and title matches before statement-only matches. Trim surrounding query whitespace and disclose the twelve-artifact display bound with the full matching count. An empty result explains how to recover and offers Clear search.

Keep keyboard focus in the search field while Up/Down navigates suggestions and Enter opens the active result. Expose the active result through combobox/listbox semantics; composition input must not activate a result. Keep the search field in a stable position as results change, and keep the input, result count and keyboard guidance visible while results scroll, including narrow layouts. Escape, the close button and a search-backdrop click dismiss the palette; dismissal restores a usable workspace control even if a resize replaced the opener. Editing dialogs retain explicit close/Escape behavior.

## Matrix authoring

Grouped traceability paths show shared ancestor prefixes once and retain canonical shared targets. Flat paths support complete-path scanning and copying; adjacency is an advanced exact-link view.

On entering a selected-artifact Matrix, initialize rows from that artifact’s type. New columns use schema-compatible outgoing relationship/endpoint pairs; stop at a type with no legal outgoing connection. Preserve valid authored/saved paths. Empty results offer direct selected-artifact and project-scope recovery actions.

Cell editing preserves table geometry and scroll. Click selects; Enter/F2 or double-click edits. Typing starts title editing or target search. Escape cancels; Command/Control-Enter submits structured fields. Arrows/Tab navigate cells, and Shift selection copies rectangular TSV text. Bulk mutation and spreadsheet paste remain separate capabilities.

A new artifact starts with its title and a suggested identifier. Schema-required fields appear before commit. Existing links can commit immediately when optional metadata is absent; required scope remains enforced. Creating a target and its relationship is atomic. Missing links in a configured projection are not automatically unmet requirements.

## Inspector and responsive behavior

Text editing is offered only for schema-declared string fields. Unsupported stored values can remain readable. An unchanged draft reports no change and adds no history revision. A successful model save adopts its returned schema/version and clears pending changes; competing changes retain explicit recovery.

Inline and full text editors show actual draft state and keep Save/Cancel explicit. Command/Control-Enter saves; Escape cancels and returns focus to the edited control. During a pending save, text is read-only and cancellation/submission is locked. Unchanged optional fields stay absent. A confirmed single-field save retains other pending fields with the version from that same save; a later intervening edit must still cause explicit conflict recovery. Cancelling a field retains other proposals without advancing their captured version. Retained edits offer Resume editing and Discard edits when the reader is shown again. These drafts remain tab-local.

Inspector reading positions belong to their artifact or exact relationship, with separate full-editor/read contexts. Rerenders and perspective returns retain those positions; resizing an active editor retains focus and caret. Relationship inspection provides an explicit return to the artifact and restores its connection control. On narrow sheets, compact text editing keeps Save/Cancel visible while retaining the graph; the full artifact editor remains available for longer work.

Relationship creation shows source and chosen target identities, titles and types. Target search matches identifiers/titles only among schema-compatible artifacts, shows at most six suggestions with the complete matching count, and supports arrow keys plus Enter to choose an exact key before committing. Titles never resolve identity implicitly. Required/optional scope is visible, incompatible targets cannot commit, and Cancel returns to the initiating control. Scope editing follows declared string fields and avoids unchanged revisions.

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

Evaluation discovery uses declared input/captured-output scope. Project tools supports exact receipt authoring in ordinary projects. Broader baseline investigation and arbitrary temporal comparison remain separate work.

## Onboarding paths

Main onboarding offers two choices: **Explore an example** opens Orbit alone; **Start your own project** opens a persistent database and uses the editable Engineering starter. The CO₂ walkthrough is the primary first-project tutorial. Both paths use the shared Graph / Matrix / History workspace.

Additional domain examples, custom-model exercises, the retained Development map and development/scale/review fixtures belong in secondary reference guides. Existing launch commands remain available, while seeded launches create only the chosen project. Multiple-project exploration requires explicitly configured databases. Documentation in the application follows the same guide hierarchy.

## Fresh Engineering setup

A new project may choose an editable Engineering starter with intent, requirement, design and test records. Acceptance text, verification method/expected result and subsystem/build references are optional; title-first creation stays lightweight. Subsystem/build strings are ordinary references, not versioned build identities or configuration captures. Four explicit policies check structural intent/design/verification links without claiming successful execution or satisfaction.

The first model save can include three named Matrix recipes in the same database transaction. The author may opt out while customizing the draft. Invalid paths reject the whole setup. Existing projects are never upgraded or reseeded by reopening. An empty project with saved chain views opens its longest configured outgoing trace unless a recovered workspace or explicit view takes precedence. Returning from first setup offers New requirement directly and explains the empty trace.

Model, creation and item editors report actual draft state so a confirmed setup save does not trigger a false unsaved warning. Model fields, coverage and named recipes persist in SQLite; spatial/selection recovery remains browser/origin-local, and unsaved forms remain tab-local. The launcher prints an exact command for reopening the same database, guides, companion project and origin port.

## Separate next-work queues

The owner-selected next-work slice is available in the shared workspace header and Project tools. Five named queue choices show independent complete counts, with one retained paged list and explanation visible at a time. Missing statements, zero-target allocation/plan gaps, confirmed input changes and unresolved judgments are not collapsed into a readiness score. Items may appear in several queues. Unconfigured rules display Not configured; failed reads display an error rather than zero work.

Engineering model/policy choices work immediately. Queue definitions allow explicit choices for custom models without guessing relationship semantics or modifying the schema. Current record/link editing and exact receipt comparison/review are direct actions with an explicit return. Hidden item/review drafts stay mounted and recoverable; selecting another item/receipt cannot silently replace them. Returning refreshes counts, while saved decisions never clear independent input drift. The captured native/model/evidence context is visible; refresh includes changes made elsewhere.

The [next-work guide](next-work.md) owns membership, supersession, token applicability, zero-target versus minimum-count semantics and bounds. Assignment, linked review follow-ups and closure criteria remain separate scope.

## Deterministic project export

The owner-selected export slice enters through **Project tools → Export project**. Explain contents and external-file preservation before **Prepare current export**. Preparation shows the exact native revision, model version, evidence sequence, complete collection counts and size. **Download JSON** uses those prepared bytes even after later edits or a return to the map; explicit preparation includes newer work. A failed preparation removes the old download and shows its error. Empty projects are exportable. Preparation/download are read-only and create no engineering drafts or revisions.

Current objects, all recorded native history and immutable evidence/captures preserve original versions and provenance. Explain that native revision and evidence sequence cover different stores and that export does not recalculate freshness. External references are included while contents require separate preservation. CLI, API and UI share deterministic JSON; exact semantics and engineering bounds belong in the [export guide](project-export.md). Human-readable review packages, baseline-only export and restore remain separate tasks.

## Practical CSV import

The owner-selected CSV slice enters through **Project tools → Import CSV** after a model exists. Upload/paste supplies headers; one declared record type and explicit field mappings create new records, with optional outgoing key-column links. A separate link mode connects existing keys with mapped relationship attributes. Keys are project-wide, exact and case-sensitive; neither titles nor UUID-looking text receive special lookup semantics. Existing records are never implicitly overwritten. Cross-file types are imported separately; later rows in one file may be targets.

Preview reads a fresh complete snapshot, shows typed values, resolved key-to-key links, ignored columns and physical CSV line/column errors, and blocks the entire commit while any error exists. Data/mapping edits invalidate the preview. Duplicate keys/links, unsupported endpoint types, missing targets and required/invalid fields are errors. Empty cells omit fields; empty optional targets omit links, while orphaned link attributes reject. Paging the preview does not truncate its validation population.

Commit uses the shared mutation owner and one native guarded changeset, with explicit IDs and captured model/endpoint versions and the exact project head. A failed operation rolls back the full file and history revision. Any intervening native change requires a new preview; an uncertain outcome pauses writes for inspection and never triggers replay. CSV/mapping drafts stay tab-local. Bounds and exact formats belong in the [import guide](csv-import.md); workbook import, overwrites/merges, saved mapping recipes and receipt/file import remain separate scope.

## Model configuration

Project authors define artifact fields, permitted directed relationships and optional workflow presentation. Workflow order and native trace direction are different: requirement criteria can feed verification independently of the design-under-test input.

Visual, guided Text and JSON configuration share one captured draft and existing schema/version guards. Invalid drafts remain available for correction. Layout choices do not alter native relationships or imply project gates, completeness or readiness.

## Evaluation plan

Use Aster and a contrasting domain such as Gatherline to test:

- Create/connect artifacts, find a configured trace gap, edit fields/links and inspect the saved revision.
- Follow a historical change across Graph/Matrix, compare captured inputs, record a decision and return with context intact.
- Repeat at 680px, keyboard-only and readable zoom.
- Explore larger projects through search, filtering, bounded expansion and paged evidence.

Observe completion, assistance, errors, context loss and unnecessary transitions. Browser checks establish behavior; representative-user observations establish usefulness. AI critique is design input, not participant evidence.

## Open design work

The remaining priorities are efficient spreadsheet interaction, unified temporal/selection context, contextual relationship operations, explainable change investigation and stable graph navigation. Named Matrix recipes now persist in the database; positions and investigation scope recover in the same browser/origin. Semantic zoom, bulk operations, portable workspace recovery and richer comparison should follow demonstrated task needs.

The [study index](ux-artifacts/README.md), [iteration summary](ux-iterations.md) and [quality review](qa-quality-review.md) retain the useful findings from earlier explorations. Earlier Studio layouts, image concepts and Trace/Explore variants are historical alternatives, not independent product directions.

## Main workflow milestone

Complete create → connect → modify → investigate → assess → record decision from a fresh project's normal launch, then reload the decision and investigation context. Preserve database selection, historical read-only state, guarded saves and in-session drafts. Reload recovery excludes unsaved drafts; leaving warns and uncertain proposals are never replayed.

The fresh-project journey passes automated desktop/680px checks with a custom schema, UI-authored receipt, changed field, review and exact links/positions after reload; details belong in [checkpoint](checkpoint.md#integrated-workflow).

### Fresh-user walkthrough script

Give a participant a disposable project and this goal without naming controls: **Add an engineering requirement and connect it to an appropriate design or verification plan. Improve its statement, inspect the saved change, investigate its connected context, review a declared evaluation affected by that change, record your judgment, and return to where you were working.** Ask them to explain their next action and what they believe has been saved.

Observe next-action choices, completion time, assistance, errors, accidental edits and loss of selection/reading position. After the main task, ask them to start a second edit, inspect another artifact and return to finish or discard it. Repeat the relevant task at 680px and with keyboard-only navigation. Keep unknown outcomes and structural links distinct from engineering judgments in the observations. Browser automation and agent walkthroughs are supporting inspection evidence; they do not substitute for this participant session.

The unfamiliar-user session remains unrun. Give someone new to Tracer the workflow goal without naming controls, then observe next-action choices, assistance, errors, context loss and completion time. Extend to both domains, larger datasets and keyboard tasks. Scripted completion/timings are not participant evidence.
