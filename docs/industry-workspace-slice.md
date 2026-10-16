# Engineering decisions configurations and change exploration

**Status:** owner-requested continuation. Seed refinements, guided example tasks, aligned family traces, inline captured-evaluation/configuration inspection, historical native input selection and reusable project views are implemented. The two workspace compositions are interactive proposals for comparison, not a fully implemented replacement UI. Capability changes below remain scoped proposals, not delivered assurance features.

The owner asks how the cross-industry development model should change examples and UI, whether the current foundation limits those changes, and to continue improving the work. The outcome is an engineer understanding a product decision in context: the intent, sibling responsibilities, shared implementation, evaluated configuration, findings and questions raised by a change. [Industry workflow guides](industry-workflows/README.md) own the workflow references; [checkpoint](checkpoint.md) owns current verification.

## Seed improvements

Keep the original small and scale workloads for regression and performance work. The realistic examples exercise engineering tasks rather than serving as a catalogue of item types.

| Example       | Development task                                               | Added context                                                                                                                                                |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Aster Home BP | Investigate passive release before changing the exhaust design | Retained versus higher-flow concepts, planned comparison, simulated finding, descriptive build manifests and explicit assessment subjects.                   |
| Gatherline    | Investigate retry behavior and volunteer feedback              | Alternative feedback concepts, unexecuted usability experiment, simulated admission finding, build manifests and retry-horizon assessment.                   |
| Orbit R1      | Investigate a suction-control change across disciplines        | Product goals, targets, shared functions, requirements, physical/software components, interfaces, alternatives, decisions, builds, evaluations and findings. |

Orbit includes a recorded baseline configuration and a proposed motor-option configuration without evaluations. Its acoustic and schedule evaluation definitions have no receipt. The recorded firmware input changes from v1 to v2 after receipts and configuration annotations are written. These cases expose uncertainty and scope rather than presenting every link as complete.

All project-specific targets, artifacts and results remain fictional. A configuration's JSON manifest describes selected entity identities and versions. Ordinary membership links lead to current identities. Those annotations remain navigation records. Each seed now also stores separately identified immutable native input captures, resolving actual revisions/schema provenance. Build-associated receipts name a capture and explicitly select evaluated members; the capture is not a complete BOM or readiness decision.

## Gaps exposed by the tasks

| Capability                       | Current foundation                                                                                | Gap and likely work                                                                                                                                                                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flexible engineering records     | Configurable types and fields, including JSON; typed directed relationships                       | No need to replace the core merely to describe concepts, experiments or assessments. Project vocabulary still needs deliberate definitions.                                                                                                                                                                                       |
| Evaluated configurations         | Native revisions, history, historical graph boundaries and immutable captured-input receipts      | Immutable native captures now enforce exact selected entity revisions. Explicit native relationship pins and named consistent native baselines now preserve selected topology and complete committed project state respectively. Uniform baseline-backed working views and exports remain planned.                                |
| Evaluating older released inputs | Current version guards, exact historical native selectors and configuration-backed receipt inputs | expectedVersion remains a concurrency guard. Explicit revision selectors and configuration-backed receipts now resolve real historical native inputs, including mixed hardware/software revisions. External source contents still need observations.                                                                              |
| Change exploration               | Scoped baseline/current investigation plus native traces and captured dependency comparisons      | Core/CLI/API now combine explicitly selected native context with separately scoped captured-input drift, both snapshot guards and paged evidence. A dedicated investigation UI and technical causation assessment remain separate; selected reachability is not proof of invalidation.                                            |
| Reusable working scopes          | Workspace family URLs, chain controls and explicit example guides with task/trace recipes         | User-authored family scopes and chain recipes now persist as bounded, version-checked presentation metadata. They open current records; they are not pinned configurations or readiness rules.                                                                                                                                    |
| Completeness and readiness       | Versioned expectations, current/baseline topology, receipt freshness and scoped reviews           | Project-authored structural expectations now evaluate distinct qualifying targets against current or baseline schema/data through service/CLI/API. Dedicated policy authoring/results UI, evidence-execution rules and product release readiness remain future work. Allowed links are still separate from authored expectations. |
| Quantitative allocations         | Text, numeric and JSON fields                                                                     | Units, compatible quantities, derived budgets and constraint evaluation are not an engineering calculation system. Orbit's energy allocation is an authored assumption.                                                                                                                                                           |
| External artifacts               | Explicit local Git/file identities, observations and receipts                                     | Hosted CI, CAD/PLM and deployment synchronization are not delivered integrations. Examples use native descriptions without suggesting otherwise.                                                                                                                                                                                  |

The practical distinction is between information that can be represented, semantics the engine guarantees, and work the UI makes understandable. A flexible JSON field addresses the first question only.

## Proposed working interactions

An engineer should be able to enter a recognizable engineering task without assembling a chain of schema dropdowns:

- Follow an objective through chosen allocation levels while keeping parent and sibling context.
- Compare several contributing disciplines with full statements and one shared identity per item.
- Inspect the exact input versions in a recorded evaluation, alongside the current revisions.
- Explore a change through explicitly scoped dependency paths and assessment subjects, with bounds and omissions disclosed.
- Compare alternatives, an experiment plan, a finding and a decision without implying that a plan was executed.

Model setup remains reachable. Relationship names and directions remain project-defined; there is no automatic equivalence between containment, allocation, dependence or evaluation. Actions to create or edit records must preserve expected-version checks and drafts. A changed receipt is a review signal, not a determination that a result is technically invalid.

The current coverage surface enumerates permitted schema slots. Richer schemas make that list broad; a useful task view should show a deliberately chosen relationship/evidence scope. The headless coverage evaluator now supports explicit expectations; this existing workspace surface has not yet adopted that contract. An arbitrary permitted slot still does not establish an obligation.

## Two workspace directions

The [interactive comparison](ux-artifacts/industry-workspace-concepts/workspace-directions.html) uses the same illustrative Orbit firmware-change case in two materially different compositions:

| Direction           | Working composition                                                                                       | Main question to evaluate                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Family and trace    | Aligned responsibility/design/evaluation rows, sibling navigation and record detail in context            | Can the engineer compare allocations and inspect evidence without losing the family?      |
| System and evidence | A bounded spatial neighborhood of constraints, shared design and evaluations, with selected-record detail | Can the engineer recognize cross-discipline dependencies and follow the changed evidence? |

Each has trace and change-investigation states. Selection and variant-local state are retained. The comparison also permits full versus compact statements and below versus alongside detail in the family composition. It uses illustrative presentation data, not live Tracer queries or writes. The original Excalidraw references remain relevant: Carbon's hierarchy/relationship context, Polarion's full statements, Notion's contextual detail and React Flow's local actions.

The owner selected Family and trace as the starting point for routine comparison, with system and evidence supporting shared-dependency investigation. Implement concrete tasks using the existing family workspace and guided traces. The scoped core/headless impact query is now implemented; the selected direction still does not imply that the entire study composition or a dedicated investigation UI has shipped.

## Delivered scoped UI improvement

Evidence now renders **Compare and review** before **Record an immutable evaluation receipt** and the external binding/observation forms. Existing task-jump buttons, field drafts, captured versions, comparison and review semantics remain. This removes setup forms from the first working position without adding a new assurance policy.

The default demo now opens Orbit. A collapsible **Explore this example** guide opens real family scopes or the prepared eight-column trace without recreating dropdowns. Task context appears only after the requested scope loads successfully. A cancelled selection preserves the current item and draft. Guide metadata is optional and explicitly supplied; ordinary projects receive no example records or guide. This is demo onboarding, not a generic saved-view store.

## Next implementation slices

1. Validate the implemented family traces and saved views with owner tasks across the three projects. Technical checks do not establish human usability.
2. Verify the delivered native configuration/historical-input workflow with owner tasks; relationship pins and whole-project baseline semantics remain separate future contracts.
3. Define a bounded recorded-path investigation query for changes, with direction, captured inputs and omission disclosures.
4. Define project-owned expectations only when a concrete completeness/release task establishes their meaning. Preserve unresolved judgments instead of inventing readiness scores.

No aerospace seed or certification evaluator is delivered in this slice. Aerospace remains a documented comparison direction; an example should exercise interface/safety allocations and baseline evidence after configuration semantics are specified.

## Current implementation slice — aligned family traces and reusable views

**Implemented and technically verified; owner task validation remains open.** The owner authorizes continuing the selected family-and-trace direction. The delivered slice provides a task-scoped table of full sibling statements beside explicitly chosen directed relationship/type columns, with connected-item inspection retaining its parent family. The existing broader Relationships, Coverage and Reading projections remain available. Columns are chosen display scopes, not required obligations. An empty cell distinguishes no recorded link in a complete incident read from links outside the loaded context. Shared targets retain canonical identities and disclose sharing within the loaded family only.

Record inspection exposes the item's paged captured evaluation receipts and compare captured versus current native statements without switching the working family. Receipt freshness, outcome and applicability remain distinct; creating receipts and recording reviews continue through the existing Evidence workflow.

Saved family scopes and chain recipes belong to a bounded project-owned presentation store in the same SQLite file, separate from engineering identities, changesets and evidence. Save/update use captured metadata versions and the current schema version; delete checks the captured metadata version; metadata is mutable and has no engineering audit-history claim. Opening a view reads current records, not a pinned snapshot. Store up to 50 named views; family trace scopes choose at most six columns and chains at most eight. Save neither page cursors nor unsaved item drafts. Removed records or changed schemas may invalidate a retained recipe; existing engineering edits must remain possible.

Acceptance tasks: compare Orbit's firmware requirements and their designs/evaluations; inspect Aster's shared valve/output/protocol traces; follow Gatherline's shared sync work and scenarios. Save an ordinary project's family scope and chain, reopen the database, and apply both. Cancel selection with an unsaved item draft, retain a failed/conflicting saved-view proposal, reject unsafe origin/token writes, and inspect desktop/narrow pixels. Automated technical receipts and owner task validation remain distinct. Revision-pinned configurations and historical inputs are not part of this UI/presentation slice.

## Current core continuation — exact native build inputs

Implemented the bounded [configuration/historical-input contract](architecture.md#immutable-native-configurations-and-historical-receipt-inputs). Aster and Gatherline now store two immutable captures each; Orbit stores its two starting captures plus a mixed-revision follow-up proposal, with real revision/schema provenance and configuration identities on associated receipts. Workspace exposes captures beside a subject; Evidence supports capture, recorded-version preview and evaluation of explicitly selected pinned members. Current drift, outcome and build readiness remain separate. The mixed hardware/software task is executable through ordinary project data, with conflict/unknown-outcome recovery and reopen checks. That original slice was members-only. The subsequent core/headless contract adds explicit relationship pins and named consistent native baselines; uniform baseline-backed working views, external artifact synchronization and certification evidence remain outside it.
