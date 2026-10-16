# Project studio: product and UX design recommendation

Status: independent simulated product-manager/UX recommendation, October 13, 2026. No implementation approval. The owner selected Project studio as a direction; page composition and interaction details still need a coherent review. Sources: the product vision in `docs/user-needs.md` (UN-001–005), `docs/user-journeys.md` (ND/SC, explicitly candidate stories), owner needs UR-17–22, and native engineering/Orbit walkthroughs in this review directory.

## The design problem

The product should help an engineer explain a design and its supporting evidence while working on it. The current collection of item, family, graph, table, evidence and model surfaces makes the engineer manage the tool's representations before answering the engineering question. Adding depth, selection framing and neighbor controls fixes real friction, but does not settle the product's information architecture.

The organizing unit should be a **working scope**: a product question, selected item/family or saved trace, with its current data and boundaries. Representations help work on that scope; they are not separate destinations with unrelated roots. Model configuration is a different task from inspecting a product's actual evidence, and historical capture inspection is a different state from editing the current record. These distinctions should determine the design before arranging individual controls.

## Proposed information architecture

This is a composition to review, not a requirement for exactly five implemented routes.

| Destination    | Primary user question                                                | Primary work area                                             | Secondary context                                                    |
| -------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| Project        | Where should I resume or begin?                                      | Saved/recent engineering scopes and a compact project summary | Project vocabulary, examples/help, configuration details             |
| Work           | How does this part of the product connect, and what should I change? | One scoped graph, table, matrix or reading representation     | Selection inspector, scope limits, contextual author/connect actions |
| Evaluations    | What was observed, using which inputs, and does it still apply?      | Searchable outcome list and selected comparison               | Exact capture, review rationale, provenance                          |
| Configurations | Which exact set of revisions did this build/evaluation use?          | Configuration list and pinned membership table                | Current drift and related evaluations                                |
| Model          | How does development information flow in this project?               | Visual type workflow with a readable focused context          | Selected type/link definition; explicit Configure entry              |

All items is the unfiltered library scope within Work. Graph/Table/Matrix/Reading switch its representation, retaining scope and selection. Do not also give Graph and Table independent primary rail destinations unless research demonstrates a distinct task that cannot be represented as a scope. The model belongs near the project work because it explains the conceptual structure, even though changing it is an administrative action.

The rail carries project identity and stable destinations. The global header carries search and project-level actions. The content header carries the current engineering scope and its representation. Neither the rail nor header needs to repeat a large page title, project title and explanatory paragraph already present in the working area.

## Composition and interaction contract

### Project overview

This is a launch/resume surface, not a marketing landing page or a giant catalogue. Lead with recognizable project name and a short purpose only when it adds context. Saved scopes are the primary content. Use short question-oriented titles such as “Review blower energy evidence,” with a compact origin/key and one meaningful qualifier. Recent work is desirable but should be depicted as a design proposal until actual state exists.

Keep New item and Find items easy to reach. A small library section can show type counts without displaying sixteen competing large cards. Example guidance should appear inside the relevant example scope, not as several paragraphs per home card. Empty projects need a simple first-item/start-from-template entry, not empty versions of every populated-project panel. Counts are library facts; they must not suggest readiness or design completeness.

### Scoped working page

The graph/table is the dominant surface. At desktop size it should occupy the viewport after a compact scope header, rather than starting beneath 500px of introductory material and control rows. A selected-object inspector is docked beside it; closing that inspector returns width to the work area. Use the same boundary, spacing and typography vocabulary across representations.

One compact scope header should identify the origin, selected relationship scope or expanded trace scope, representation, and necessary depth/filter controls. Show frequently used controls when there is room. Do not expose family-only direction controls as if they constrain an expanded all-relationship trace. Additional routes to advanced representations can remain visible in this header without turning every view into a new navigation hierarchy.

A selection is inspection, not a new scope. Navigating to a connected item retains the origin unless the user explicitly chooses to make it the new starting scope. The user should follow actual neighbors at readable scale, with a compact connection list in context and a visible way to return. Optional focus highlights or dims the loaded graph; it must not imply a one-hop subset is the owner's requested complete multilevel trace.

Shared designs remain one identity. Siblings and alternative routes remain available. Reading a route left-to-right does not reverse stored link meaning. A shortest path cannot stand in for an engineering trace: a direct requirement-to-test link can skip the design.

### One inspector, one primary object

| Inspection state          | Show first                                                                     | Explicit action                            | Secondary material                        |
| ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------ | ----------------------------------------- |
| Current item              | Key/title, type/revision, full statement, connected context                    | Edit item, Connect                         | Other fields, history, technical identity |
| Ordinary relationship     | Source, relationship meaning, target; scope/version qualifiers                 | Edit connection                            | Canonical IDs and provenance              |
| Captured evaluation input | Outcome, input title, captured/current revisions, difference and applicability | Review full receipt; inspect current input | Complete capture metadata/provenance      |
| Item editing              | Editable content and clear draft state                                         | Save / Cancel                              | Conflict/recovery detail when needed      |
| Captured revision         | Exact historical statement/version and capture identity                        | Return to current item                     | Historical provenance                     |

Editing replaces the read body, rather than adding an editor beneath a duplicate read card. Capture inspection replaces the primary read object rather than stacking an entire receipt comparison above the full current-item editor. Keep draft state alive behind mode changes and use guarded navigation where necessary. Historical read state must be visibly different from an editable current identity.

### Model and Configure

Model is an understandable map of type-level development inputs, outputs and feedback. It needs project terminology and labels on paths, not field counts or a paragraph explaining every edge. Requirements define acceptance criteria; designs provide the thing evaluated; tests/runs produce evidence. The project may use different words and several branches. Do not impose a medical-device lifecycle or invent gates from diagram position.

Development flow and native trace connections are distinct meanings. The default conceptual map can show declared workflow direction; exact canonical source/target definitions appear in a selected-path inspector or a clearly named trace view. This should be one intentional distinction, not duplicate chips and arrows with conflicting vocabulary.

Configure is an explicit editing state with one draft and one Save/Cancel pair. Give the canvas the working area and selected definition a compact properties inspector. Visual/Definitions/JSON can be alternative authoring representations of the same draft; choose final labels based on what each actually provides. Selection must remain readable when properties opens. Overview is orientation; returning to selection restores readable detail. Layout persistence must be described according to actual capability, not implied by Save model.

### Evaluations and Configurations

Evaluations should lead with human-readable outcome, evaluation identity and captured configuration. A compact result table/list scales better than a dashboard of equally large cards. Selecting a result shows the comparison with changed/missing inputs first and matching inputs compact. Historical outcome, current freshness and human review are separate facts. A changed design does not automatically invalidate prior results; a passing result does not establish release readiness.

Configurations show exact pinned membership in a clear version table. A current-vs-captured comparison belongs beside that membership, not intermixed as if the recorded configuration changes whenever the current design changes. Related evaluations are context. Creating a capture is an explicit task, not a permanent large form on the default read surface.

## What is visual and what is written

| Visual representation                                | Supporting copy                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| Branches, shared nodes, links and feedback           | Exact relationship label and relevant source/target meaning          |
| Selection, root/origin distinction, focused route    | Scope name and explicit loaded/bounded counts                        |
| Captured/current version comparison and changed rows | Actual before/after statement, rationale and evidence limitations    |
| Outcome/freshness/review status with accessible text | The recorded observation and human judgment, never inferred approval |
| Workflow geometry and visible input/output paths     | Type definitions and rules on selection                              |

Long statements belong in reading/inspector states, not as tiny graph-node paragraphs. Critical scope and capture qualifiers stay visible. Raw IDs, provenance detail and rare authoring options are secondary. Neither icon/color alone nor repeated warnings should carry engineering meaning.

## Journey 1: requirement → design → evaluation → changed capture

1. From Project or search, open an energy-allocation requirement in Work. Scope identity is immediately clear; Graph and Table are available in the same header.
2. See its implementing designs and direct evaluation criteria links. Select the shared blower design without replacing the origin. Its full statement is readable in the inspector; sibling designs and other requirement relationships remain apparent.
3. Follow the actual design-to-evaluation link. See the evaluation outcome and distinguish an ordinary trace link from the captured-input dependency.
4. Activate the captured-input edge. The inspector shows that the evaluation used design v1, the current design is v2, the captured build and the changed/unreviewed comparison. The current v2 graph node does not imply the evaluation used v2.
5. Compare the changed statement, open the whole receipt when needed, and inspect the finding. The product can show recorded consequences and unresolved questions without claiming all impact or readiness is known.
6. If the engineer edits the current design, the editor becomes the inspector's primary mode; Save/Cancel are local. Returning to the trace preserves scope and identity.

Review the composed states together: initial scope, selected shared design, selected captured input, current-item edit and return. A polished default screenshot alone cannot establish this journey.

## Journey 2: configure the development model

1. Open Model to understand the project's type vocabulary and development flow. Select Test and read its requirement criteria and design inputs together.
2. Enter Configure explicitly. The visual canvas retains orientation; editing controls and draft state are apparent.
3. Select a type to edit fields or link output/input ports to propose a connection. See exact endpoint constraints and workflow meaning without accidentally treating the diagram as executed work.
4. Switch to Definitions/JSON and inspect the same pending change; return visually with selection and draft intact.
5. Review a compact change summary and Save once, or Cancel. Return to the read-only model; actual recorded item connections are still a separate question.

## Minimal design rules to settle before further UI refinement

1. The scope is stable; representations and inspection states change around it.
2. Each page has one dominant work area and one primary contextual object.
3. Each fact has one primary presentation; additional detail expands meaning rather than repeating it.
4. Useful frequent controls stay visible; rare technical details use purposeful disclosure.
5. Visual geometry communicates relationships; copy names exact meaning and uncertainty.
6. Current items, ordinary links and captured evidence are visibly distinct states.
7. Read, edit and capture modes have clear transitions and preserve guarded drafts.
8. Counts and statuses express available facts, not unsupported completeness, impact or readiness.
9. The desktop composition must be usable before adding further controls; a narrow layout needs a deliberate stacked/focused state, not a shrunken canvas.
10. Review these journeys as a coherent prototype before treating local control polish or passing tests as approval of the design.

The next reviewable artifact should demonstrate this proposed contract using realistic records and several states. It should expose any capability that remains hypothetical. Implementation can follow the selected composition; the existing DOM and sunk engineering effort should not dictate it.
