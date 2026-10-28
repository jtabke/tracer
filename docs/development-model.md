# Tracer development model

Selected by the owner on 2026-10-23: use Tracer to organize its own lasting product definition, component structure, verification and delivery work. This is the project convention for developing Tracer, not a mandatory schema for every Tracer project. The [register](../projects/tracer/README.md) owns the actual records and status; the [earlier audit](development-model-plan.md) explains the reorganization.

## Product definition and system structure

Needs describe outcomes in a working context. Requirements describe bounded observable behavior with numbered acceptance criteria. Capability areas group requirements by what the product does; they are an `area` field, not another mandatory chain of records.

Components describe implementation responsibilities. `COMP-TRACER` is the system root. Its immediate parts are Domain model, Application services, Persistence, Interfaces and User interface. Smaller components identify responsibilities within those boundaries. Components are not requirements or capability groups: a behavior can involve several components and a component can contribute to several behaviors.

`part_of` records child component → parent component. `allocated_to` records requirement → responsible component, with a scope statement. Allocation is design responsibility, not evidence of implementation. `realized_by` records a component's source artifact; the initial file references locate implementation ownership without claiming conformance. Component boundaries follow existing repository ownership and can evolve without changing requirement identity.

## Information roles

| Native type        | Meaning                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------- |
| goal               | Broad product direction; existing UN identities remain stable                                 |
| user_need          | Concise outcome with context, rationale and evidence kept separately                          |
| story              | Scenario exercising several requirements; existing ND/SC/Q/R identities remain stable         |
| requirement        | Lasting product behavior, acceptance, applicability, area and independent status              |
| component          | System or subcomponent responsibility and boundaries                                          |
| verification_plan  | Method, expected result, criterion scope and intended article under test                      |
| artifact           | Exact design/source/test/report reference; its role and version are explicit                  |
| work_item          | Bounded discovery, implementation, verification or maintenance activity                       |
| source             | Captured support for a claim or owner direction                                               |
| decision           | Chosen direction and rationale                                                                |
| application_model  | Versioned native application-role/policy definition selected by an exact record pin           |
| change_assessment  | Independently managed assessment scope and completion data for the selected application model |
| impact_disposition | Candidate-specific rationale and action data belonging to an assessment                       |

Schema v6 adds the three application types above and `has_disposition` membership for the selected build-out. `MODEL-CHANGE-ASSESSMENT` is the installed native model record; its selected native version, rather than the installation template file, governs interpretation. [Pinned application-model resolution](architecture.md#pinned-application-model-resolution) owns descriptor/schema compatibility. Assessment lifecycle/closure services remain under implementation, so record-type presence and an authored status value do not establish controlled completion.

Executed results remain native immutable receipts, with output references and declared inputs. A verification-plan record is not an executed test, and a report artifact is not a fresh result. Results already recorded before this reorganization retain their original identities and inputs.

## Trace meanings

- A requirement `addresses` a need; its criteria describe the contribution.
- A requirement `allocated_to` components identifies responsibility. Component `part_of` links define the system structure independently of requirement refinement.
- A requirement `verified_by` a verification plan identifies the criteria to check. The plan `evaluates` components and can `uses_artifact` a specific test implementation. A run must capture actual implementation versions; the component name alone is insufficient.
- A requirement `refines` another requirement only when it develops the same obligation. Refinement and component containment are acyclic project conventions, not a restriction on all engineering relationships.
- A work item `advances` its actual subject: a need, requirement, component, scenario, plan or decision. Completing a task does not automatically verify that subject.
- A replacement `supersedes` an earlier summary. Historical links and fields remain readable. `sourced_from` preserves claim support.

Authored workflow paths show Need → Requirement → Component → Verification plan, with criteria feeding verification separately. A goal explains why a need matters; a source supplies its evidence. Those are supporting relationships, not development stages. Sources, goals, scenarios, decisions and delivery work remain outside the primary flow and are available in **Trace connections**, which shows all project types and native permission directions. Executed results remain available in Evaluations. The reading order does not impose a one-way lifecycle or convert a goal/source into a need.

## Status and evidence

`lifecycle=active` identifies the current product requirements; `superseded` identifies retained legacy summaries. `specificationStatus` distinguishes ready acceptance from draft candidate behavior. Selection, implementation, verification and validation remain separate.

Newly split requirements begin with `deliveryStatus=unassessed` and `verificationStatus=not_verified` until their exact acceptance is checked. This does not mean existing code disappeared. Original documentation claims remain on their superseded records, reachable through the migration links. Candidate quantitative, bulk-authoring, portability and team work remains candidate scope; adopting this model does not authorize building those features.

Number criteria AC-1, AC-2 and so on within each requirement. A planned check states method, setup, expected result and the criteria evaluated. A result must identify the requirement version, implementation candidate, check version and outcome. Changed inputs, failed execution and a reviewer judgment are different facts. Need validation requires evidence of usefulness in a stated context.

Structural policies apply to active requirements and check need links, component allocations and verification plans. They do not infer implementation, successful execution or product readiness. The initial plans are planned work, not claimed test coverage. Missing results must remain missing.

## References versus managed records

The source/artifact types above are current conventions for Tracer's own project, not a requirement that every document, excerpt or citation become a separately managed engineering object. UR-64 recommends contextual references using the existing qualified-relationship semantics, reusable resource identity and explicit version/capture distinctions. The [implemented local slice](architecture.md#native-resources-and-contextual-references--implemented-local-slice) now supports resource capability, qualified references and explicit evaluation inputs. The [usage guide](developer-reference.md#local-resources-and-contextual-references) describes authoring. This register retains its existing source/artifact conventions; no automatic consolidation or migration of those records was performed. The [UX proposal](ux-plan.md#contextual-references-and-resource-state) retains broader exploration.

The development register now has a `contextual_reference` family for requirements and verification plans, with explicitly resource-capable targets. Use it for a specific definition passage, implementation locator or check procedure, with role, explanation and deliberate state selection. Several uses can share one file identity; each reference retains its own scope and native identity. The Model overview keeps this supporting material outside its primary development stages. Existing `sourced_from` section/claim records, component allocations and `verified_by` plan links retain their meanings. This is incremental adoption for new uses, not a bulk consolidation of historical records.

For current authoring, keep statements separate from rationale; use fields for item-local attributes, independent records for independently managed objects, typed links with scope for references and native receipts for executed conclusions. Preserve original source observations and receipt inputs. A reference link does not declare an evaluation dependency or prove an outcome. Existing source/artifact identities must survive any later adoption of a resource/reference capability.

## Starting work

Run `node projects/tracer/project.mjs status`, then inspect the relevant need, requirement, component and work records with `show KEY`. The output separates active requirements from preserved summaries and lists component ownership. Use saved Matrix views for requirements/components/plans and component containment. The Model page shows the type-level schema; component records are inspected in Graph or Matrix.

Choose a bounded task, confirm that the model fits it, refine acceptance and the check plan, then implement and verify. Record actual results and limitations, update affected status deliberately, export and make a SQLite backup. Do not create a new product requirement merely to justify internal maintenance work.

The migration manifest is [model-v2.json](../projects/tracer/model-v2.json). It is a guarded one-time transformation from native revision 6, not a replacement seed or restore format. Schema extension and data transformation are separate guarded transactions; rehearsal and live verification check the intermediate state and preserved identities. Use SQLite backups to recover the project.
