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

Graph cards reserve space for their metadata and title within each density's card geometry. Identifiers stay on one line with ellipsis when necessary; the full identifier and title remain available through the card's accessible name, hover text and inspection. Titles wrap within their two-line compact or three-line expanded budget, including unbroken text. Expanded type labels stay on one line so metadata cannot push titles outside the card. Fit reserves space for all three expanded title lines; distant zoom reserves one readable identifier line.

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

**Owner-selected direction, 2026-10-21 (UR-63):** starting or adapting a project begins with understanding and checking its development model. Use a small representative trace to explain record types, relationship meanings, incomplete work and evidence before bulk authoring. Model review must remain lightweight and task-specific; a starter is an editable proposal. The [development model plan](development-model-plan.md) defines the first manual pilot. A guided model-review interaction is not implemented or specified by this direction alone.

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

The default Development flow shows only types participating in authored workflow paths. Supporting context remains explicitly available through Trace connections; switching views does not rewrite the schema or recorded links. For Tracer's own development project, goals and sources provide rationale/evidence rather than upstream process stages. Requirement criteria and the implementation under test remain distinct verification inputs.

2026-10-23 owner-selected correction: model configuration is a dedicated full-canvas page, opened directly from **Model** in the workspace navigation or the `#model` URL. Project tools → Configure model opens the same page. The graph workspace stays mounted while inactive; Return to workspace retains the model draft, and Cancel explicitly discards it. The existing shared Visual/Text draft, schema/version guards and conflict recovery remain authoritative. Browser back/forward changes the page without rewriting data. The model canvas fits the available viewport when the page first opens; zoom and selection remain deliberate controls.

Project authors define artifact fields, permitted directed relationships and optional workflow presentation. Workflow order and native trace direction are different: requirement criteria can feed verification independently of the design-under-test input.

Visual, guided Text and JSON configuration share one captured draft and existing schema/version guards. Invalid drafts remain available for correction. Layout choices do not alter native relationships or imply project gates, completeness or readiness.

## Contextual references and resource state

**Status, 2026-10-23:** owner-authorized specification work (WORK-013) refines the UR-64 conceptual direction. [The primitive contract](architecture.md#reference-primitives--specified-not-implemented) owns identity, qualified-reference, state and evaluation-input decisions. The broader interaction direction below remains a design proposal; WORK-014 now implements a [bounded local slice](architecture.md#native-resources-and-contextual-references--implemented-local-slice); broader integrations and richer passage behavior remain unimplemented. The live register owns implementation work selection. Current implemented contracts remain in [architecture](architecture.md#offline-provenance--implemented-vertical-slice).

Model independently managed engineering information; reference other material; preserve the context and exact inputs needed to explain decisions. Importance is contextual: a report can be central to verification work and supporting material beside a requirement. Ownership, reference role and lifecycle are independent choices. Engineering records can be externally owned; referenced resources can be native.

### Concepts and identity

- **Engineering record:** an independently identifiable requirement, component, decision, risk, plan or other managed object. Independent revision, relationships or lifecycle justify making it a record.
- **Resource:** a reusable identity for information, such as a specification, repository file, interview, CAD document or report. A title, external locator or reference does not imply a separate user-managed engineering lifecycle. A resource may also be managed as an engineering record without duplicating its identity. The primitive contract specifies resource-only identities and optional managed classification in the same native identity stream; wire/storage syntax and migration need the first implementation slice.
- **Relationship:** a semantic connection with native identity, fields, endpoint validation, version guards and history. Domain relationships such as implements, satisfies and supersedes keep their distinct meanings.
- **Contextual reference:** a qualified use of that relationship machinery, connecting an engineering object to defining, supporting or background material. Role, passage/fragment selector, explanation and optional state selection belong to the connection, not globally to the document. No user-managed excerpt or citation record is required. Reusing a resource must retain independent references and scopes.
- **Evaluation:** a recorded activity result or conclusion with identified subjects, criteria, inputs and provenance. A report citation or relationship alone is not an executed verification or organizational approval. Reuse immutable receipts and reviews; do not introduce another mutable result store.
- **Captured state:** the exact native revision or externally observed content state used. Resource identity answers what; state selection answers which version. A version label, locator, timestamp or hash alone does not guarantee retrievable bytes. Preservation policy must disclose whether content is retained, externally recoverable or unavailable.

These are conceptual responsibilities, not six new universal record types. Existing source/artifact records remain valid project conventions. Contextual references should be first-class authoring/query capabilities without becoming first-class engineering record types users must create individually.

### Reference behavior and change

A reference can follow the current source or select an identified source version. An evaluation separately captures what was actually used; capture is not a third mutable reference mode. A live reference resolves only as recently as the last successful observation, never an implied continuously checked source. A pinned reference stays pinned when a new revision appears; retargeting creates a deliberate native relationship revision. An evaluation must capture the reference's relevant version/role/scope as well as the resource content state when those facts justify its conclusion.

Keep source changed, selected passage changed, passage resolution unknown/ambiguous, and possible evaluation impact separate. Whole-resource hashes can establish resource drift, not whether a passage changed. A resolved or textually unchanged passage does not prove semantic independence from surrounding changes. Missing access, unsupported comparison and ambiguous selectors must remain unknown. Automatic reanchoring may propose a new target but must not silently rewrite pinned references or captured evaluations.

References express definition/support/background; only explicitly declared evaluation inputs and dependencies participate in receipt comparison. Adding a reference must not silently invalidate evaluations, create a passing verification result or satisfy execution coverage. Source drift identifies potential review work. The prior outcome remains a fact about its captured inputs; applicability to a current design is assessed separately. Organizational approval authority remains separate from a local recorded review.

Stable identity cannot rely on URL equality. The primitive contract specifies provider namespace plus stable source ID, provisional unresolved resources and deliberate reuse; implementation must preserve those rules for mutable locations, duplicates and aliases. Existing Git/file external bindings are immutable and project-unique; broad resource identity and relocation may need an explicit migration. Do not silently reinterpret those bindings. Resource reuse and contextual-reference changes must use the same guarded application commands as other authoring, including concurrent creation and uncertain-save recovery. Public URLs do not imply permission to fetch or retain content.

### Authoring and guidance

Present the engineering statement first, with rationale, References and Evaluations available in context. Add reference should accept a locator or existing resource and ask why it matters, with optional section/passage and current/pinned choice. Create or reuse the underlying identity without requiring users to configure a Source type. Simple references should not require evaluation setup; evaluation recording must deliberately identify the criteria, article under test, conditions, outcome and actual input states.

Use a field for an attribute or short explanation belonging only to one item. Use an independent record when the thing needs its own revision, reuse, ownership, relationships or assessment. Use a contextual reference for the material establishing or supporting an item. Use an evaluation for what was actually checked or concluded. A managed document can be both an independent object and a referenced resource.

Requirement, document, Matrix, impact and Graph views project the same identities, relationships and captures. Supporting references are available on demand in the map; hiding them from a development overview does not erase their engineering importance or change native direction. Exact controls and layouts remain exploratory within the shared medical-device map experience.

### Three specification exercises

1. **Definition source:** a product requirement derives its 20 W limit from customer specification revision C, section 4.2. Reuse the resource, explain authority on this reference and pin the selected source state. A move should preserve identity; a later revision should expose potential review without retargeting C. If only the document hash is known to differ, passage impact remains unknown.
2. **Supporting interview:** two needs cite different passages of one transcript with separate interpretations. Reuse the resource, retain each selector/explanation and distinguish evidence from inferred need wording. Deleted, repeated or ambiguous quoted text must not silently attach to a different passage. No excerpt lifecycle is required.
3. **Verification report:** an evaluation records product revision B, the exact requirement/criteria, check definition, conditions, report state and actual outcome. The requirement may also reference the same report. Editing that reference does not rewrite the evaluation. Revised inputs expose applicability questions; missing captured report content cannot be presented as fully reproducible.

Specify create/reuse, reopen/export, reference editing, source movement, source drift, unknown access, pinned-state recovery and evaluation capture for these exercises before selecting an implementation slice. Representative-user tasks must test whether users can explain what is managed, referenced, captured and still applicable; design reasoning alone is not validation.

### Sequence and standards input

First specify identity reuse, native reference semantics, minimal role/scope/explanation and live/pinned/captured-state behavior with a thin end-to-end record-detail authoring flow. Then extend observed-change assessment using existing receipts/reviews. Rich selectors/reanchoring, document-system integrations and AI assistance remain later candidates. Immutable receipts are existing infrastructure, not a new P1 capability; their adequacy for reference-state capture must be checked. Do not build a broad ontology or finish backend primitives before testing one understandable authoring task.

The following sources support conceptual patterns, not Tracer conformance claims:

- [W3C Web Annotation Data Model, Specific Resources](https://www.w3.org/TR/annotation-model/#specific-resources) separates source, selector and state. [Text Quote Selector](https://www.w3.org/TR/annotation-model/#text-quote-selector) carries exact text with optional prefix/suffix; [Text Position Selector](https://www.w3.org/TR/annotation-model/#text-position-selector) warns of sensitivity to resource edits. Borrow a small subset; this standard does not guarantee automatic reanchoring, immutable retention or unchanged engineering meaning.
- [W3C PROV-O, qualified terms](https://www.w3.org/TR/prov-o/#description-qualified-terms) provides a pattern for qualifying how an activity used an entity. Reuse the idea of scoped usage without imposing RDF/OWL storage or claiming Tracer implements PROV.
- [OSLC Core 3.0 overview](https://docs.oasis-open-projects.org/oslc-op/core/v3.0/oslc-core.html) supplies cross-tool linked-resource and preview patterns. Stable source identity and available content remain provider-specific contracts. Tracer currently observes local Git/files; this research adds no OSLC or document-system connector.

The [standards applicability inventory](../projects/tracer/standards-applicability.json) now distinguishes design references from candidate exchange/integration targets and records reviewed editions, requirement mappings and gaps. ISO public summaries do not establish clause-level coverage. INCOSE/PLM comparisons remain research leads; no universal compliance workflow or SysML implementation is selected. The development-flow policy owns standards/conformance decisions.

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

**Independent agent inspection, 2026-10-24:** the owner selected a fresh agent with no conversation history for a disposable copy of the real REQ-001 audit. It found the requirement/components/plan, created and improved a draft requirement, linked a component and recovered/discarded an interrupted edit. Its first assessment attempt was blocked by a working-context response-validation defect. After correction, the same agent completed a separately labeled follow-up: read the historical pass, identified changed observed content despite an unchanged native version, saved a needs-reevaluation judgment, reloaded it and returned to REQ-001. The original outcome/inputs were preserved. [The inspection report](../projects/tracer/agent-walkthrough.json) owns observations, tool assistance, limits and candidate checks. This is agent inspection, not representative-human validation; first-use failure and assisted follow-up stay separate.

The inspection identified a focused presentation issue: show resource identity, native annotations, selected observed content and reference scope in readable evidence views. At inspection, a short UUID, v1 → v1 and empty annotation panes made a content-state change harder to interpret; exact source/reference state required detailed disclosures. WORK-017 addresses that bounded finding below. Draft defaults/status vocabulary, result discoverability and inspector overlap also need task evidence before broader changes. Snapshot timeouts and a requested 680px resize that did not match the measured viewport are tool limitations; keyboard actions worked, while automated browser checks establish their own actual desktop/phone geometry.

### Resource and content state in evidence review

**Owner-selected bounded slice, 2026-10-24, WORK-017:** show captured resource labels and source identities in assessment; distinguish native record/annotation versions from captured and latest observed content; present reference role, declared selector/scope and current/pinned selection without requiring receipt JSON. Prioritize the selected content comparison, with matching relationship assertions available in compact disclosures. Preserve each independently declared use and its state. A reference pin and an evaluation content input may differ; show an observation hash for a reference pin only when that exact observation was explicitly captured for that resource. Do not infer endpoint dependencies or fetch live content to fill historical context.

External observations show availability when observed, locator, time, hash/commit and a clear missing-content explanation. Empty native annotation fields are not the contents of the external document. Unsupported selectors remain declared data with unresolved passage relevance; source drift is not proof of a passage change or a changed engineering outcome. The original outcome and review decision remain separate. Native-only comparisons retain their fields/statements and captured labels. Verify shared review surfaces at desktop and phone widths, ordinary relationship inputs, multiple references to one resource, pin/input mismatches, missing observations and read-only preservation. No content retention, automatic diff/reanchoring, schema migration or new primitive is selected by this presentation slice.

The unfamiliar-user session remains unrun. Give someone new to Tracer the workflow goal without naming controls, then observe next-action choices, assistance, errors, context loss and completion time. Extend to both domains, larger datasets and keyboard tasks. Scripted completion/timings are not participant evidence.
