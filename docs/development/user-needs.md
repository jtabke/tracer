# Tracer user needs

**Status:** discovery baseline, not a validated requirements specification or approved feature backlog.

This document owns product goals and need evidence. [Journeys](user-journeys.md) describe candidate tasks; [UX planning](ux-plan.md) owns selected interactions; [architecture](../architecture.md) owns implemented contracts; [checkpoint](../checkpoint.md) owns progress.

## Product vision

**Status:** owner-authored direction from the initial brief; not representative-user evidence or implementation approval.

Make structured engineering information as easy to create, connect and edit as a spreadsheet, with typed relationships, traceability, history and meaningful change context. The owner's experience of navigation and process overhead in enterprise requirements tools motivates this hypothesis.

Use one domain-independent model for humans and agents. Begin locally with a project database, minimal setup and no cloud account. Deeper traceability and team use should grow from the same semantics without complicating ordinary authoring. Shared servers, PostgreSQL, permissions and broad collaboration remain future work.

The original need IDs remain stable:

### UN-001 — Organize structured information

Configure familiar information types—requirements, designs, components, tests, risks, decisions, tasks, experiments and evidence—without changing Tracer's source. Templates are optional; a task tracker should not require requirements-management vocabulary.

### UN-002 — Connect information

Create typed, directed relationships with their own identity, fields and history. Navigate in either direction across hierarchies, shared contributions and cross-domain networks without forcing a tree.

### UN-003 — Understand completeness and impact

Find gaps and possible change consequences under explicit project expectations. Reachability, structural completeness, assessed impact and successful execution are distinct; links and coverage counts do not establish satisfaction or readiness.

### UN-004 — Track changes and preserve history

Explain what changed, when, why and by whom, including relationships. Reconstruct reproducible baselines and compare logical states through semantic and deterministic textual differences. Full export/diff/restoration workflows remain undelivered.

### UN-005 — Work through the most appropriate interface

Use tables, graphs, matrices or document-like views over the same information, validation and history. The selected map experience is shared across examples. This goal does not imply every view currently supports every edit.

### Scope, generality and limits

Medical devices, software, aerospace, manufacturing/quality, research and regulatory evidence use the same primitives and may coexist in one project. Optional schemas express vocabulary and policy; they neither establish compliance nor impose universal approval stages. See [industry workflows](../guides/industry-workflows/README.md).

Start with a useful local engineering foundation. Enterprise requirements-tool parity, PLM/ERP, specialized compliance, distributed storage, comprehensive workflow automation and an elaborate plugin ecosystem are outside initial scope. Add infrastructure when its value is demonstrated.

[Vision scenarios](user-journeys.md#vision-scenarios-and-remaining-proof) make the ambition testable; [validation milestones](development-flow.md#validation-milestones) define the required evidence.

## 1. Users, context and scope

Compare documentation-heavy medical-device/aerospace tasks and lighter software work from the outset (UR-13). Rigor depends on team, task and risk. Shared intent, relationships, change consequences and decision evidence are candidate common needs to test, not grounds for industry modes or mandatory approvals.

The owner reports two primary contexts:

- **New design:** author requirements, develop successive levels, establish coverage and choose next work.
- **Sustaining:** assess modification or removal in an established design.

Author, connector and reviewer are working roles, not researched personas; one engineer may fill all three. Team responsibilities, authority, tools, frequency, operating constraints and administration needs remain unknown. Include a frequent author and a consumer/reviewer in the first study. No representative-user observations or regulatory-compliance claims are established.

## 2. Evidence convention

- **UR — user-reported:** directly stated by the product owner; meaningful input but not representative-user validation.
- **VI — vision:** desired outcome in [the product vision](#product-vision); unverified as a particular user's need.
- **HY — hypothesis:** interpretation or proposed capability requiring investigation.
- **OB — observed:** supported by a recorded task observation or artifact. **No OB findings yet.**

Source records for this baseline:

| Source | What was supplied                                                                                                                                                                                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UR-64  | Distinguish independently managed engineering records, reusable resources, contextual references, evaluations and captured states. Reference supporting/defining material without requiring a managed record per document or excerpt; preserve meaning, version scope and reassessment after change (owner discussion and recommendation, 2026-10-23). |
| UR-63  | Establish a suitable development model first when using Tracer; audit the confused organization of Tracer's own needs/requirements and plan a clearer basis for development and verification (owner request, 2026-10-21).                                                                                                                              |
| UR-60  | Practical CSV import with column mapping, links resolved by stable keys, an error preview and atomic commit (owner request, 2026-10-17).                                                                                                                                                                                                               |
| UR-61  | Deterministic export of records, links, schema and evidence references with exact versions and provenance (owner request, 2026-10-17).                                                                                                                                                                                                                 |
| UR-62  | Separate next-work queues for missing requirement statements, unallocated requirements, missing verification plans, changed evidence inputs and unresolved reviews (owner request, 2026-10-17).                                                                                                                                                        |
| UR-59  | Simplify onboarding to explore an example or start a project; retain other examples and fixtures in secondary reference (owner request, 2026-10-17).                                                                                                                                                                                                   |
| UR-58  | Make the Engineering starter useful out of the box and keep fresh-project setup persistent (owner request, 2026-10-17).                                                                                                                                                                                                                                |
| UR-57  | Reported fresh-project trust failures and workflow priorities; [evaluation details](#reported-fresh-project-evaluation).                                                                                                                                                                                                                               |
| UR-56  | Integrate that UI over the headless core with two distinct project databases.                                                                                                                                                                                                                                                                          |
| UR-55  | Use the selected medical-device map UI across projects; reject cluttered Orbit/Studio and separate demo experiences.                                                                                                                                                                                                                                   |
| UR-1   | Parent/child columns, clickable information and visible siblings.                                                                                                                                                                                                                                                                                      |
| UR-2   | Work at high and low levels across representations.                                                                                                                                                                                                                                                                                                    |
| UR-3   | Investigate actual use; current screens feel unintentional.                                                                                                                                                                                                                                                                                            |
| UR-4   | Medical-device reference: new-design authoring/coverage and sustaining-change impact.                                                                                                                                                                                                                                                                  |
| UR-5   | Show derived numerical meaning while preserving free text and avoiding overconstraint.                                                                                                                                                                                                                                                                 |
| UR-6   | A medication-delivery motor/software-limit change can affect mechanical design and system requirements.                                                                                                                                                                                                                                                |
| UR-7   | Jama feels record-at-a-time; show parents, siblings, children and shared system context.                                                                                                                                                                                                                                                               |
| UR-8   | Use realistic concepts and critique PLM/traceability references, including Carbon, without copying legacy patterns.                                                                                                                                                                                                                                    |
| UR-9   | Reject system-neighborhood prototype: text walls, weak hierarchy, unclear actions and screen purpose.                                                                                                                                                                                                                                                  |
| UR-10  | Choose task, hierarchy, layout, interaction and visual options together before another coded prototype.                                                                                                                                                                                                                                                |
| UR-11  | A motor-load increase should expose the already-related maximum move-time requirement.                                                                                                                                                                                                                                                                 |
| UR-12  | Independently research engineering workflows and their coordination purposes.                                                                                                                                                                                                                                                                          |
| UR-13  | Support formal medical/aerospace and lighter tech work with task-appropriate rigor.                                                                                                                                                                                                                                                                    |
| UR-14  | Use sibling EventSculpt to trace needs → requirements → actual code → tests without imposed regulated process.                                                                                                                                                                                                                                         |
| UR-15  | Approval is not implementation: show absent realization links while allowing existing-but-unlinked code.                                                                                                                                                                                                                                               |
| UR-16  | Reconsider incoherent home and illegible model links; preserve useful Graph/Table interactions.                                                                                                                                                                                                                                                        |
| UR-17  | Show development inputs/outputs, branches and loops visually; text rules alone are insufficient.                                                                                                                                                                                                                                                       |
| UR-18  | Visual and text model configuration should share a draft; consider n8n linking/context.                                                                                                                                                                                                                                                                |
| UR-19  | Tests evaluate design against requirements; native trace direction must not reverse displayed intent.                                                                                                                                                                                                                                                  |
| UR-20  | Keep useful view/scope controls visible; avoid indiscriminate collapsibles.                                                                                                                                                                                                                                                                            |
| UR-21  | Expose multiple hierarchy/trace levels with configurable depth and shared identities.                                                                                                                                                                                                                                                                  |
| UR-22  | Challenge assumptions through independent product/UX, design-engineering, customer-task and QA perspectives.                                                                                                                                                                                                                                           |
| UR-23  | Review coherent composition and flows before production layout refinement.                                                                                                                                                                                                                                                                             |
| UR-24  | Default dark mode; define navigation/tool placement, reduce duplication and use actual Excalidraw references.                                                                                                                                                                                                                                          |
| UR-25  | Project switching belongs top left; medical model needs user needs, PRS, verification and validation.                                                                                                                                                                                                                                                  |
| UR-26  | Start with project counts, connected model graph and genuinely recorded recent updates.                                                                                                                                                                                                                                                                |
| UR-27  | Edit definitions in the model graph rather than separate read-only lanes/selectors.                                                                                                                                                                                                                                                                    |
| UR-28  | Clean example types, relationship meanings, constraints and duplicated records.                                                                                                                                                                                                                                                                        |
| UR-29  | Remove redundant cross-links; distinguish direct contributions, calculated hierarchy paths and criterion-specific verification; retain history.                                                                                                                                                                                                        |
| UR-30  | Review Orbit R1 model quality after medical cleanup.                                                                                                                                                                                                                                                                                                   |
| UR-31  | Center model establishment, optional requirement levels, V&V outputs and proposed-change investigation; align incrementally.                                                                                                                                                                                                                           |
| UR-32  | Redesign destinations and flows; retain linking/graph/table inspiration, not the current execution.                                                                                                                                                                                                                                                    |
| UR-33  | Select Map entry: visual data model, double-click expansion, filtering and deliberate granularity at scale.                                                                                                                                                                                                                                            |
| UR-34  | Restore organized layout after manual dragging.                                                                                                                                                                                                                                                                                                        |
| UR-35  | Show record traces in expanded groups; investigate validation hierarchy against FDA/DHF guidance.                                                                                                                                                                                                                                                      |
| UR-36  | Offer horizontal and vertical graph layout.                                                                                                                                                                                                                                                                                                            |
| UR-37  | Categorize related items within any type and isolate them; research comparable applications.                                                                                                                                                                                                                                                           |
| UR-38  | Explore categories and Jama folder hierarchy without adopting its limiting sidebar.                                                                                                                                                                                                                                                                    |
| UR-39  | Demonstrate dense multi-granularity item/trace work; research open-source network mapping.                                                                                                                                                                                                                                                             |
| UR-40  | Consider Blender nodes and n8n flows as references; n8n scale and grouping remain unproven.                                                                                                                                                                                                                                                            |
| UR-41  | Filter panel mixes thirteen types and fifteen connection kinds without clear organization/explanation.                                                                                                                                                                                                                                                 |
| UR-42  | Apply discussed category, folder, dense-network and node-editor findings to selected Map entry.                                                                                                                                                                                                                                                        |
| UR-43  | Expansion should retain working place; offer simpler context when fewer links/items suffice.                                                                                                                                                                                                                                                           |
| UR-44  | Remove Aster's redundant singleton nesting (User needs → Measurement → Acquisition → UN-01).                                                                                                                                                                                                                                                           |
| UR-45  | Enlarge Aster with realistic distinct items and branches for drilling, paging and tracing.                                                                                                                                                                                                                                                             |
| UR-46  | Follow traces across folders without expanding everything or losing place.                                                                                                                                                                                                                                                                             |
| UR-47  | Default drilled scope to direct downstream item traces; expose depth and retain return context.                                                                                                                                                                                                                                                        |
| UR-48  | Reveal a linked item's next level while retaining origin, positions and camera.                                                                                                                                                                                                                                                                        |
| UR-49  | Consider editing/history/baselines together and inspect core primitives before authoring; full change control is not authorized.                                                                                                                                                                                                                       |
| UR-50  | Prioritize viewing: find, follow/branch, understand shown/filtered/omitted data and return before adding authoring.                                                                                                                                                                                                                                    |
| UR-51  | Replace empty-looking Product → Unfiled singleton with meaningful product context.                                                                                                                                                                                                                                                                     |
| UR-52  | Unassigned items should be directly accessible, not placed behind an artificial Unfiled folder.                                                                                                                                                                                                                                                        |
| UR-53  | Remove redundant presentation layers while preserving useful organization and trace meaning.                                                                                                                                                                                                                                                           |
| UR-54  | Emphasize the followed trace, quiet surrounding links and allow line isolation without losing layout.                                                                                                                                                                                                                                                  |
| VI-1   | Owner-authored [product vision](#product-vision): UN-001–005, interactive views and progressive complexity                                                                                                                                                                                                                                             |

These are conversation-derived summaries, not interview transcripts, field observations or measured pain points. Append evidence references when actual work is observed; do not silently promote HY or UR to OB.

### Reported fresh-project evaluation

**UR-57 — user-supplied evaluation, 2026-10-17; reported execution on cloud Linux at `0b877505`, not independently observed here.** The evaluator started with empty databases, authored a portable CO₂-monitor need → requirement → design → verification trace, saved/reopened a two-hop Matrix, recorded explicitly simulated evidence with exact versions, tightened a requirement, reviewed stale inputs, captured a configuration and exercised CLI/browser consistency, conflicts and restart. Separately reported: 66 CLI calls, 15 HTTP requests, direct API/batch/backup/locking/forced-termination checks, 372 passing core tests, typecheck and lint. Full checks/Playwright were not run; no product source was changed during that evaluation.

Reported trust failures: acceptance editing offered without a schema field discarded input after success feedback; fixed-name focus/impact traversal omitted starter links; successful first model save retained the old draft version; selection/row/path defaults produced unexplained empty Matrix results; schema typos and unsupported simple CLI properties were accepted. These strengthen PN-02/03/04/05/08/09 and require concrete regressions, while preserving immutable evidence, separate change/failure/review states, guarded concurrent writes and atomic history.

Requested future capabilities remain candidate scope: mapped CSV/spreadsheet import with stable-key links and atomic preview/commit; deterministic record/link/schema/evidence-reference export; editable engineering starters with optional subsystem/build identity, acceptance, verification and explicit coverage policy; distinct actionable gap/review queues; review follow-up work with responsibility and closure criteria; portable provenance-rich review packages with external-file preservation instructions; spreadsheet paste, bulk guarded edits, keyboard navigation and reusable views. Proposed order: trust → fresh-project setup/tutorial → project-volume workflows → complete change review. None is implemented or authorized merely by this evidence record. The proposed value milestone is a small real engineering project completed without lost input, misleading dependency results or implementation knowledge needed for recovery.

## 3. Need catalog

PN IDs refine UN-001–005 without replacing them. Frequency, severity and priority remain unvalidated. Each entry states the desired outcome, its basis and open questions.

### PN-01 — Start from recognizable engineering work

Begin useful work in familiar terminology with little setup; know what information is present or missing. **Basis:** VI-1; onboarding preference is HY. Investigate scratch authoring, import/paste, templates, type ownership and inconsistent source data before selecting an entry flow.

**Owner clarification, UR-63:** establishing a suitable model of the development work is the first task, including the meaning of records, relationships and completion evidence. Saving a valid schema alone does not establish suitability. The [model audit and plan](archive.md) uses Tracer's own project as the first exercise; a specific guided UI and general user comprehension remain to be evaluated.

**Owner clarification, UR-64:** model establishment must help users choose fields, independently managed records and contextual references. Resource ownership (native/external) is independent of its role (definition/support/background) in a particular connection. The owner recommends qualified references using the existing relationship semantics rather than a second link system or universal Evidence/Source record type. [The UX proposal](ux-plan.md#contextual-references-and-resource-state) records the conceptual direction and unresolved contracts; implementation and representative-user validation remain unselected.

### PN-02 — Author and revise coherent design information

Express intent with surrounding rationale, revise related items and distinguish drafts from established information. **Basis:** UR-2/4/14; VI-1. Investigate statement length, cell/batch versus long-form work, attributes and review states. Preserve existing software source artifacts; compulsory grammar and per-item editors are unproven.

### PN-03 — Understand and manipulate relationships across levels

Work with parents, children, siblings and cross-cutting relationships together; explain contributions, navigate whole/detail and recognize shared identity. **Basis:** UR-1/2/4/7/14; VI-1. Investigate direction, multiple parents, link attributes, dense branches and branch-level actions. Software may connect needs, modules and tests without successive requirement levels; no strict tree is required. The Jama criticism is owner experience, not a claim about every version.

### PN-04 — Identify meaningful completeness gaps and next work

Explain an unresolved obligation under declared project expectations and choose the next action. **Basis:** UR-4/15; VI-1. An approved requirement lacking an implementation link is a candidate gap: code may exist but be unlinked. Planned, partial, outdated and current realization must remain distinguishable, including relevant requirement/version scope. Approval, implementation coverage, test coverage and execution results are separate. Investigate applicability and priority; automatic scheduling/ownership remain HY.

### PN-05 — Understand a proposed change before committing it

Start from one modification/removal, compare intent and see candidate consequences with recorded paths or stated reasoning. Retain system requirements whether preserved or explicitly revised. **Basis:** UR-4/6/11/14; VI-1. Motor/load/timing examples are user reports without supplied design/test artifacts. Investigate proposal staging, review, removal, old evidence and unaffected links; no impact algorithm or approval workflow is selected. Missing paths cannot prove no impact.

### PN-06 — Track important quantitative meaning without forcing formalization

Explain limits, allocations and derivations while preserving prose and judgment. Avoid coupling identical numbers or silently rewriting children. **Basis:** UR-5; structured parameters/computation are HY; no real quantitative artifact yet. Investigate references, inheritance, budgets, formulas, independent choices, units, overhead, uncertainty and conditions. Formula editing and extraction are not requirements.

### PN-07 — Judge evidence and record a defensible decision

Inspect relevant inputs/evidence, understand changed or unknown conditions and retain reasoning. **Basis:** VI-1, existing evidence semantics, UR-14; detailed reviewer tasks are HY. Investigate review packages, comparisons, handoffs and authority. A test file, code link and revision-specific result are separate facts; none alone proves need satisfaction. Local review does not imply organizational or medical sign-off.

**Owner clarification, UR-64:** distinguish source changes, changes in the referenced passage and possible effects on an evaluation. Preserve the historical outcome for captured inputs; assess current applicability separately. An authoritative specification, an interview passage and a verification report exercise different roles of the same reference capability. This is owner-reported need and recommended design, not observed user evidence or a standards-conformance finding.

### PN-08 — Trust history and recover safely

Know what changed/saved, preserve attempted proposals and reconcile interruptions or conflicts without silent loss. Distinguish current, draft and historical information. **Basis:** VI-1, UR-2; preferred recovery is HY. Investigate undo scope, autosave, offline work, interruptions and restoration; history is not undo.

### PN-09 — Keep orientation while changing working level or representation

Retain scope, selection, drafts and a return path across overview, branch, item and evidence work. **Basis:** UR-1–3/7–8/33/37; VI-1. Investigate persistent state, simultaneous context, keyboard/accessibility, narrow layouts, categorization and direct/contextual actions. Tabs, panels and styling are solutions to evaluate.

## 4. Boundaries and unresolved questions

- Hypotheses and prototypes do not authorize features or prove need satisfaction.
- Do not invent time savings, task frequency, competitor deficiencies or representative-user evidence.
- Match process rigor to the task. Formal examples do not prescribe all projects; lightweight work still needs truthful identity, history and evidence.
- Permissions, collaboration, import/export, organizational approvals and deployment need separate evidence and scope decisions.

## 5. Next evidence to collect

Use the [three task walkthroughs](user-journeys.md#discussion-set--three-task-walkthroughs-before-layout) to compare formal and lightweight contexts, then evaluate information arrangement through the [UX plan](ux-plan.md). Owner examples and sourced guidance support exploration; neither substitutes for observations.

Seek sanitized new-design/sustaining-change artifacts and representative task observations, including a quantitative relationship when relevant. Record tools and workarounds. Missing artifacts need not block provisional exploration, but never invent observations. Update needs and journeys with evidence, retain stable IDs and explicitly record retirements.
