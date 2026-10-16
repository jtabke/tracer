# Tracer user needs

**Status:** discovery baseline, not a validated requirements specification or approved feature backlog.

This document describes problems and outcomes. [User journeys](user-journeys.md) make them concrete; [UX planning](ux-plan.md) compares solutions; [development flow](development-flow.md) connects discovery to specifications and checks. The product vision below supplies direction, not proof of user behavior.

## Product vision

**Status: owner-authored direction, distilled from the initial brief; not representative-user evidence, a delivered-feature list or automatic implementation approval.** Current capabilities and limits belong in [architecture](architecture.md); selected interaction decisions belong in [the UX plan](ux-plan.md), and progress belongs in [the checkpoint](checkpoint.md).

Tracer aims to make structured engineering information as approachable to create, connect and edit as a spreadsheet, while retaining typed relationships, traceability, history and meaningful change context. The motivation is the owner's experience of enterprise requirements tools adding navigation and process overhead to simple work. This is a product hypothesis, not a comparative claim about every competing tool or user.

One canonical, domain-independent model should serve humans and agents through appropriate interactive projections. Start locally with a project database, minimal setup and no required cloud account. Broader organizational use should grow from the same semantics rather than a separate product or industry-specific core. Shared-server deployment, PostgreSQL, permissions and broad collaboration remain future work. Sophisticated capabilities must not make ordinary authoring and connection tasks harder.

The five original need identifiers remain stable:

### UN-001 — Organize structured information

Create and organize configurable kinds of information: requirements, designs, components, tests, risks, decisions, tasks, experiments and evidence. Users should recognize their own terminology, start with optional templates and extend a project without changing Tracer's source. A simple task tracker should not require requirements-management vocabulary.

### UN-002 — Connect information

Create meaningful, typed and directed relationships, navigate them in either direction and understand hierarchy, shared contributions, networks and cross-domain dependencies without forcing everything into a tree. Relationships have identity, fields and history of their own.

### UN-003 — Understand completeness and impact

Find missing relationships, orphaned work, coverage gaps and potential consequences of a change under explicit project expectations. Recorded reachability, structural completeness, assessed technical impact and evidence of successful execution are distinct facts. Neither a drawn connection nor a coverage count establishes satisfaction or readiness.

### UN-004 — Track changes and preserve history

Understand what changed, when, why and by whom, including relationships. Reconstruct reproducible historical baselines and compare logical states. Readable semantic changes and deterministic textual comparisons are complementary goals; full export/diff/restoration workflows are not yet delivered.

### UN-005 — Work through the most appropriate interface

Read and manipulate the same information through a table, graph, matrix or document-like representation appropriate to the task, with consistent validation and history. This is a goal for applicable interactions, not a claim that every current view supports every edit. The selected map experience supplies one shared interface across examples; alternative representations must fit that experience rather than become separate demo applications.

### Scope, generality and limits

Medical-device, software, aerospace/systems, manufacturing/quality, research and regulatory-evidence work are reference contexts for the same primitives. Projects may combine them: a requirement can connect to a software module, manufacturing process and quality record without crossing artificial domain boundaries. Optional schemas/templates express vocabulary and policy; they do not establish compliance or prescribe universal approval stages. [Industry workflows](industry-workflows/README.md) provide context, not separate data models.

The initial scope is a useful local engineering foundation. It is not a complete enterprise requirements-tool replacement, PLM/ERP system, specialized medical compliance product, distributed database, cloud-only service, comprehensive workflow engine, proprietary AI assistant or elaborate plugin ecosystem. These are scope limits rather than permanent prohibitions. New infrastructure and abstractions need demonstrated value.

Success means one engineer can begin useful work immediately and retain a credible path to deeper traceability, change control and team use as needs grow. The candidate scenarios in [user journeys](user-journeys.md#vision-scenarios-and-remaining-proof) make that ambition testable. The [development flow](development-flow.md#validation-milestones) owns the evidence needed to establish it.

## 1. Users, context and scope

**Reference contexts:** medical-device engineering remains a familiar example, but discovery must compare documentation-heavy medical-device/aerospace work with lighter, faster software/technology workflows from the outset (UR-13). These are not fixed industry categories: rigor varies by team, task and risk. Tracer must be useful for both without making regulated documentation or approval stages the default. Shared intent, relationships, change consequences, evidence and decision context are candidate common needs; their expression must be tested, not assumed identical. This does not select industry modes, integrations, templates or a new configuration mechanism.

**Primary contexts reported by the product owner:**

- **New design:** author requirements for the first time, build successive layers, establish coverage and identify the next work.
- **Sustaining:** understand the consequences of modifying or removing information in an established design.

**Working roles, not researched personas:** author, connector and reviewer. One engineer may fill several roles. Project/schema administration and organizational governance need investigation but are not the central daily journey by default. Individual versus team work, responsibilities, approval authority, tools, frequency and operating constraints are still unknown.

The first study should include a frequent author and someone reviewing or consuming that work. Do not substitute fabricated demographic personas for observations. This plan does not establish that Tracer is a regulated medical device, satisfy a quality-system requirement or claim regulatory compliance.

## 2. Evidence convention

- **UR — user-reported:** directly stated by the product owner; meaningful input but not representative-user validation.
- **VI — vision:** desired outcome in [the product vision](#product-vision); unverified as a particular user's need.
- **HY — hypothesis:** interpretation or proposed capability requiring investigation.
- **OB — observed:** supported by a recorded task observation or artifact. **No OB findings yet.**

Source records for this baseline:

| Source | What was supplied                                                                                                                                                                                                                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UR-56  | Owner explicitly requests integrating the selected medical-device UI over the headless core for every example, with two distinct project databases rather than separate demo UI implementations.                                                                                                                              |
| UR-55  | Owner requires one unified UI/UX using the medical-device map experience across all projects. The older Orbit/Studio interface is rejected as unclear and too cluttered; independent demo implementations must not be treated as separate product experiences.                                                                |
| UR-1   | Parent/child columns across design levels, clickable information, easy sibling visibility                                                                                                                                                                                                                                     |
| UR-2   | Different representations should allow work at high and low levels, rather than restricting operations                                                                                                                                                                                                                        |
| UR-3   | Existing screens feel unintentional; investigate actual use and avoid locking into the prototype                                                                                                                                                                                                                              |
| UR-4   | Medical-device reference domain; new-design authoring/coverage and sustaining-change impact                                                                                                                                                                                                                                   |
| UR-5   | Important numerical values may be derived across requirements; preserve free-text flexibility and avoid overconstraint                                                                                                                                                                                                        |
| UR-6   | One software/motor-limit change in an electromechanical medication-delivery device can affect multiple system parts; assess consequences and continued satisfaction of system-level requirements                                                                                                                              |
| UR-7   | Jama feels like one requirement/relationship at a time; the owner needs an understandable big picture of complex systems with parents, siblings, children and shared context                                                                                                                                                  |
| UR-8   | Generated concepts feel insufficiently impactful/realistic; critique PLM/traceability UX including Carbon without overfitting to legacy patterns, and pursue modern interaction rather than cosmetic copying                                                                                                                  |
| UR-9   | After opening the system-neighborhood prototype, the owner reports walls of text, poor visual hierarchy, unclear interactions and no clear screen goal; rejects this direction as detached from user needs                                                                                                                    |
| UR-10  | Make UI decisions together, one step at a time, choosing among several task/hierarchy/layout/interaction/component/visual options before another coded prototype                                                                                                                                                              |
| UR-11  | See affected information rather than manually reconstruct/explain impact; an allowable motor-load increase should expose an already-related maximum move-time requirement                                                                                                                                                     |
| UR-12  | Independently source realistic engineering workflows and understand their coordination/engineering purposes instead of relying on owner examples or copying existing tools                                                                                                                                                    |
| UR-13  | Support documentation-heavy medical-device/aerospace and lighter, faster tech workflows; shared engineering context first, with process rigor appropriate to the work                                                                                                                                                         |
| UR-14  | Use the growing sibling EventSculpt codebase as a concrete lighter software case: trace user needs to requirements, actual code and tests without adopting a regulated documentation process                                                                                                                                  |
| UR-15  | Approval does not mean implementation: link an approved requirement to its realizing artifact, such as code; absent implementation links should expose likely outstanding work, while allowing for existing-but-unlinked code                                                                                                 |
| UR-16  | The entire application feels unprofessional and uninspired; model connections are illegible and home is incoherent. Preserve useful Graph/Table interactions while reconsidering overall layout and pursue a beautiful intentional design unconstrained by the current screens.                                               |
| UR-17  | The project model must visually show development workflow and linking: how inputs and outputs feed into one another, including branches and loops. Textual connection rules alone do not communicate the model.                                                                                                               |
| UR-18  | Configure the model visually and in text over the same draft; workflow-editor references such as n8n inform direct linking and context.                                                                                                                                                                                       |
| UR-19  | Tests evaluate the design made against requirements. Development flow must not show intent backward solely because the native trace relation points that way.                                                                                                                                                                 |
| UR-20  | Useful view/scope controls should be visible when space permits; reconsider indiscriminate collapsibles and use intentional toolbars.                                                                                                                                                                                         |
| UR-21  | Graphs should expose several hierarchy/trace levels, including tests related through requirements and designs, with configurable depth and shared identities.                                                                                                                                                                 |
| UR-22  | Use balanced independent product/UX, creative design-engineering, customer-task and QA perspectives to challenge assumptions and avoid design ruts.                                                                                                                                                                           |
| UR-23  | Settle the design before optimizing the UI. An accepted direction is not enough: review coherent page composition and task flows before further production layout refinement.                                                                                                                                                 |
| UR-24  | Default to dark mode. Define the overall application navigation, toolbar/sidebar placement and useful data views; reduce duplicate information and use the actual Excalidraw application references. Rejected studies have decorative eyebrows, poor hierarchy and unclear page actions.                                      |
| UR-25  | Put database/project switching at the very top left. The medical-device example must use its appropriate model, including user needs, PRS, verification and validation.                                                                                                                                                       |
| UR-26  | Start on a project overview with item counts, the connected data-model graph as the default focus, and recent updates where supported by actual project records.                                                                                                                                                              |
| UR-27  | Project model must be a graph editor: select and edit type/relationship definitions in the connected model rather than repeated read-only lane diagrams and a separate definition selector.                                                                                                                                   |
| UR-28  | The graph editor exposes that the example model itself is not clean. Reconsider its types, relationship meanings, constraints and duplicated records rather than arranging or hiding an incoherent schema.                                                                                                                    |
| UR-29  | Check that dependencies follow the requirement hierarchy without redundant cross-links, then clean the model. Keep direct contributions, calculated hierarchy paths and criterion-specific verification distinct, preserving recorded history.                                                                                |
| UR-30  | Review the other example model, Orbit R1, after the medical cleanup; the model-quality concern applies to both examples.                                                                                                                                                                                                      |
| UR-31  | Reframe Tracer around establishing a product-development model, authoring needs and requirements across optional levels, tracing verification/validation outputs, and investigating an existing requirement's proposed change. Build alignment piece by piece.                                                                |
| UR-32  | The overall UI does not communicate an actual workflow: sidebar destinations, landing points and per-view interactions need a ground-up redesign. Retain the useful node-linking, graph and table inspiration in the Excalidraw references; their current execution is not an accepted foundation.                            |
| UR-33  | Select Map entry: begin with the data model as a visual graph and double-click to expand groups. Plan for growing record/trace counts with useful filtering, clean layout and deliberate levels of granularity suited to the current job.                                                                                     |
| UR-34  | Needs an easy way to restore an organized graph after manually dragging its nodes.                                                                                                                                                                                                                                            |
| UR-35  | Expanded groups must show how individual records trace to one another. Questions whether validation should follow verification through the whole hierarchy, then asks to check that interpretation against FDA/DHF guidance.                                                                                                  |
| UR-36  | Choose horizontal or vertical graph layout.                                                                                                                                                                                                                                                                                   |
| UR-37  | Improve usability as items scale: categorize related items within any entity type and isolate those items for work. Investigate how applications with similar graph and information-management challenges handle this.                                                                                                        |
| UR-38  | Prefers the category route and wants to explore it further. Jama's folders provide a useful directory-hierarchy reference for grouping items, while its sidebar feels limiting; do not lock the interaction to that sidebar pattern.                                                                                          |
| UR-39  | Tracer's value should include easy work with many items and traces at different granularities. Investigate open-source networking/network-mapping applications with dense node/link problems; a few fully visible items do not demonstrate the intended experience.                                                           |
| UR-40  | Adds Blender's node editor and n8n's complex flows as interaction references, while explicitly questioning whether n8n handles scale well. This is a reference suggestion, not acceptance of either tool's grouping semantics or proof of scalability.                                                                        |
| UR-41  | The current filter panel is confusing: it exposes too many choices together, with insufficient organization and explanation of what each choice represents. Supplies a screenshot of thirteen model types followed by fifteen connection kinds.                                                                               |
| UR-42  | Authorizes improving the UI/UX using the strongest findings from the category, folder, dense-network and node-editor references discussed together. Builds on selected map entry and the category preference.                                                                                                                 |
| UR-43  | Expanding a group must retain the working place instead of rearranging the whole map. Allow a simpler view with fewer items and connections when the current task does not need the complete context.                                                                                                                         |
| UR-44  | The Aster example has redundant folder-in-folder nesting with one child/record (User needs → Measurement → Acquisition → UN-01). Improve the example so each shown hierarchy level earns its place.                                                                                                                           |
| UR-45  | Enlarge Aster with realistic, distinct items in each folder and meaningful branches so drilling down, paging and tracing can be explored at a useful scale.                                                                                                                                                                   |
| UR-46  | With the larger Aster example, follow a trace across folders without expanding every branch or losing the current working place.                                                                                                                                                                                              |
| UR-47  | Deeply nested folder containers obscure useful item relationships. On drilling into a folder or item, default to individual direct downstream traces and make the number of connection levels easy to configure while retaining the return context.                                                                           |
| UR-48  | Click a linked item to reveal its next connection level while retaining the original item, existing positions and camera, building out only the branch being followed.                                                                                                                                                        |
| UR-49  | Deep item inspection exposes no engineering-data editor in the map prototype. Consider editing, revision history and baseline tracking together, and verify the core primitives before extending a view-only UX into authoring. This raises a scope/design question rather than authorizing a complete change-control system. |
| UR-50  | Stay focused on viewing. Walk through finding an item in expanded Aster, following and branching traces, understanding shown/filtered/omitted content, and backing out to the same working context; fix confusion and context loss before adding authoring.                                                                   |
| UR-51  | The Full development Product → Unfiled singleton looks empty and its purpose is unclear. Expose meaningful product context rather than redundant organizational wrappers.                                                                                                                                                     |
| UR-52  | Unfiled must not become an artificial child folder. Use organizational hierarchy only when an actual folder assignment gives it meaning; unassigned items should be directly accessible without extra drilldown.                                                                                                              |
| UR-53  | Audit the rest of the model and remove redundant presentation layers. Each required level should help organize items or follow traces rather than add a click. Preserve useful hierarchy and trace meaning.                                                                                                                   |
| UR-54  | With several branches expanded, make the trace being followed clear while surrounding connections recede. Preserve the starting path and context, with an easy way to isolate its lines without losing the working layout.                                                                                                    |
| VI-1   | Owner-authored [product vision](#product-vision): UN-001–005, interactive views and progressive complexity                                                                                                                                                                                                                    |

These are conversation-derived summaries, not interview transcripts, field observations or measured pain points. Append evidence references when actual work is observed; do not silently promote HY or UR to OB.

## 3. Need catalog

IDs identify stable needs, not implementation modules. The catalog refines the vision rather than replacing its UN-001–005 identifiers. Frequency, measured severity and priority remain unvalidated. The two anchor journeys are discovery priorities, not a ranking of all features.

### PN-01 — Start from recognizable engineering work

**Context:** an engineer begins a project or moves existing work into Tracer.

**Need:** organize information using familiar concepts without excessive setup or learning a tool-specific ontology.

**Outcome:** the engineer recognizes their work, can begin a meaningful task and knows what has or has not been brought into the project.

**Basis:** VI-1; HY about the preferred onboarding path. Existing approach and actual setup burden are unknown.

**Investigate:** author from scratch versus spreadsheet/document import or paste; who defines types; how to handle incomplete or inconsistent source data. Do not presume a large schema editor is the correct entry point.

### PN-02 — Author and revise coherent design information

**Context:** a new design, or an established design needing clarification.

**Need:** write and revise requirements/design information while seeing the necessary surrounding rationale and structure.

**Outcome:** the engineer can express intent, work across related items and distinguish unfinished drafting from established information.

**Basis:** UR-2, UR-4, UR-14; VI-1. Long-form versus cell/batch authoring is unresolved. Existing software needs/specifications should remain recognizable source artifacts, not require wholesale rewriting into formal requirements.

**Investigate:** typical statement length, attributes, batch work, templates/EARS assistance, reference material, and whether drafting/review states are needed. Neither a compulsory grammar nor a separate editor for every item is established.

### PN-03 — Understand and manipulate relationships across levels

**Context:** an engineer decomposes intent, connects design information, or explores an existing branch.

**Need:** understand and work with parents, children, siblings and cross-cutting relationships together as a meaningful system context, rather than repeatedly reconstructing that context from isolated records.

**Outcome:** the engineer can explain how an item and its family relate to the design, move between whole and detail without losing orientation, and recognize shared identity rather than mistake repeated appearances for copies.

**Basis:** UR-1, UR-2, UR-4, UR-7, UR-14; VI-1. Software relationships may connect needs, specifications, modules/functions and tests rather than successive requirement levels. The owner's Jama complaint is user-reported experience, not proof that every Jama version lacks multi-item views. A strict tree, full-project graph or fixed medical-device hierarchy is not required.

**Investigate:** what users mean by parent/sibling, relationship direction, multiple parents, relationship attributes, dense branches and actions at branch versus item level.

### PN-04 — Identify meaningful completeness gaps and next work

**Context:** developing or reviewing an incomplete design.

**Need:** understand what remains unresolved and why, rather than merely count existing links.

**Outcome:** the engineer identifies a relevant gap and chooses an appropriate next action under the project's declared expectations.

**Basis:** UR-4, UR-15; VI-1. An approved requirement without a linked implementation artifact is a concrete candidate gap, not merely an approval-status question. Automatic prioritization, owners, schedules and exact completeness rules remain HY.

**Investigate:** absent content, missing implementation trace, partial realization, planned versus existing artifacts, outdated mappings and unresolved review; which expectations apply and who decides priority. Missing implementation links should surface likely outstanding work, with the possibility that existing code has not been tagged. A link must state what it realizes for the relevant requirement/version; a planned artifact or unrelated code must not close the gap. Approval, implementation coverage, test coverage and result evidence are distinct. Connected information alone does not prove correct, complete or verified design.

### PN-05 — Understand a proposed change before committing it

**Context:** sustaining an established product, including modification or removal of a requirement or specification.

**Need:** start from one proposed change and see the relevant information that may be affected, together with before/after intent and the existing relationships or other stated reasons for attention. Do not require the engineer to reconstruct impact manually. Software and mechanical contributions may need reassessment; an existing system-level requirement must remain visible, whether ultimately retained or explicitly revised.

**Outcome:** the engineer can scope the proposal, identify relevant consequences and unresolved judgments, and distinguish direct changes from possible impact.

**Basis:** UR-4, UR-6, UR-11, UR-14; VI-1. The motor-limit/software and load/move-time examples are user-reported, not observed tasks or supplied design/test artifacts. A persisted proposal/workspace, approval process or impact algorithm is not selected.

**Investigate:** how changes begin, who reviews them, whether work must remain uncommitted, removal semantics, old evidence and unaffected relationships. No path or absence of modeled links guarantees no engineering impact.

### PN-06 — Track important quantitative meaning without forcing formalization

**Context:** requirements contain limits, specifications, ranges, tolerances or allocated/derived values.

**Need:** make important quantitative relationships understandable where useful, while retaining ordinary prose and engineering judgment.

**Outcome:** the engineer can explain a value's role and assess relevant changes without identical numbers being falsely coupled or children being silently rewritten.

**Basis:** UR-5; HY about optional structured parameters and computation. No real quantitative artifact supplied yet.

**Investigate:** shared references versus inherited limits versus budgets versus explicit formulas versus independent choices; units, overhead, uncertainty, conditions and changes in either direction. Formula editing and automatic text extraction are not requirements.

### PN-07 — Judge evidence and record a defensible decision

**Context:** assessing coverage, a completed activity or a sustaining change.

**Need:** see the evidence and inputs relevant to a decision, understand changed or unknown conditions and retain reasoning.

**Outcome:** the reviewer explains what supports the decision and what still needs attention, without mistaking coverage links or recorded acceptance for proof of validity.

**Basis:** VI-1 and existing evidence semantics; UR-14 for need-to-code-to-test context; HY about detailed reviewer tasks. Their actual review package and handoffs are unknown. A test file, a test-to-code link and an actual result for a particular revision are separate facts; none alone proves that a user need is satisfied.

**Investigate:** what reviewers inspect together, what they need to compare, decision/rationale requirements and who has authority. No medical V&V sign-off or organizational approval workflow is implied by a local review record.

### PN-08 — Trust history and recover safely

**Context:** editing, interruptions, mistakes, concurrent changes or later investigation.

**Need:** know what changed, preserve an attempted proposal, and recover or reconcile without silent loss or overwrite.

**Outcome:** users distinguish current, drafted and historical information and understand what was saved. Immutable history remains explainable.

**Basis:** VI-1; UR-2 about usable interaction; HY about preferred recovery/autosave/undo behavior.

**Investigate:** expected undo scope, interruptions, offline behavior, conflicts and restoration. History is not undo; desired restoration is not an implemented capability.

### PN-09 — Keep orientation while changing working level or representation

**Context:** moving between overall coverage, a branch, siblings, an item and detailed evidence.

**Need:** retain the relevant working context and reach applicable actions without artificial view restrictions or excessive navigation.

**Outcome:** the engineer understands what is selected, which scope is displayed and how to return, without losing drafts or starting the task again.

**Basis:** UR-1–3, UR-7–8, UR-33, UR-37; VI-1. Named tabs, side panels and a default representation are solutions, not needs. Modern visual styling alone does not establish reduced context loss or useful system-level interaction. UR-37 adds explicit categorization and focused-scope work as scale grows; its exact classification scheme remains open.

**Investigate:** state that must persist, simultaneous information needs, keyboard use and accessibility, narrow layouts, and which actions deserve direct versus contextual exposure.

## 4. Boundaries and unresolved questions

- These needs do not authorize implementing every hypothesized capability.
- No fabricated time savings, task frequency, competitor deficiencies or representative-user evidence.
- Medical/aerospace terminology and governance can guide examples, not dictate every project's structure. Lighter workflows must remain useful without an approval-system setup detour; stronger controls must carry meaningful evidence/decisions, not cosmetic compliance badges.
- Compare domains and levels of formality from the outset, including non-hierarchical relationships. Lightweight coordination does not mean weak identity, history or truthful evidence semantics.
- Permissions, collaboration, import/export, organizational approvals and deployment conditions require their own observed use and scope decisions.
- The existing prototype and scale tests demonstrate behavior, not need satisfaction or product validity.

## 5. Next evidence to collect

Use the prepared [task walkthroughs](user-journeys.md#discussion-set--three-task-walkthroughs-before-layout) and the first visual comparison for walkthrough 3 to agree on the needed context and an organizing structure, one decision at a time. They compare formal and lightweight contexts with workflow purposes, handoffs and useful outcomes; source guidance, illustrative adaptations and observed work remain distinct. Owner examples are useful checks, not the sole discovery input. Follow the immediate sequence in [ux-plan.md](ux-plan.md).

Seek sanitized real ND/SC artifacts and representative task observations alongside this work; unavailable owner artifacts must not block provisional exploration or be replaced by fabricated observations. Investigate a quantitative relationship where relevant, without requiring arithmetic or a parent/child hierarchy for every task. Record actual tools and workarounds when known.

Use this evidence to revise the needs and [journeys](user-journeys.md), then compare concepts in [ux-plan.md](ux-plan.md). A need's wording may evolve while its ID remains stable; retire obsolete needs explicitly and preserve the reason.
