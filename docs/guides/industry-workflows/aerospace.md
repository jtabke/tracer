# Aerospace product development

[Product development across industries](README.md)

Aerospace includes civil aircraft, spacecraft, launch vehicles and experimental hardware with different missions and assurance obligations. Certified aviation and NASA program practices provide concrete examples of formal requirements and evidence structures. They do not establish one mandatory process for every aerospace project.

## Aircraft and systems assurance

FAA AC 20-174 recognizes ARP4754A as an acceptable development-assurance method for civil aircraft and systems, including requirements validation and verification of implementation. FAA AC 20-115D recognizes DO-178C for airborne software. AC 20-152A recognizes DO-254 and supplies additional guidance for airborne electronic hardware. The circulars describe acceptable means of compliance; they are not themselves regulations or the only available means. [FAA systems guidance](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_20-174.pdf), [software guidance](https://www.faa.gov/airports/resources/advisory_circulars/index.cfm/go/document.information/documentNumber/20-115D), [electronic hardware guidance](https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentID/1041323).

For an illustrative aircraft model, operational needs lead to aircraft functions and requirements, then system and equipment allocations, followed by hardware and software responsibilities. Safety and interface records connect across those levels. The applicable assurance approach must be established for the actual program and certification basis.

## Space program workflow and reviews

NASA's systems-engineering guidance connects operational concepts, requirements allocation, architecture, trade studies, interfaces and verification/validation. These activities coordinate a mission across its engineering elements. [NASA systems-engineering fundamentals](https://www.nasa.gov/reference/2-0-fundamentals-of-systems-engineering/).

NASA's spaceflight lifecycle includes concept work, preliminary design, final design/fabrication, integration and test, operation and closeout. Requirements, designs and evaluation plans become controlled baselines as development progresses. [NASA program and project lifecycle](https://www.nasa.gov/reference/3-0-nasa-program-project-life-cycle/).

NASA technical reviews assess defined maturity and readiness questions. Findings can retain open actions with a closure plan. The following are examples from [NASA NPR 7123.1C, Appendix G](https://nodis3.gsfc.nasa.gov/displayAll.cfm?Internal_ID=N_PR_7123_001C_&page_name=all).

| Review | Name and focus                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------- |
| SRR    | System Requirements Review: requirements definition.                                           |
| PDR    | Preliminary Design Review: preliminary design and the basis for detailed design.               |
| CDR    | Critical Design Review: design maturity for fabrication, assembly, integration and test.       |
| TRR    | Test Readiness Review: test article, facilities, personnel and procedures.                     |
| FRR    | Flight Readiness Review: readiness of hardware, software and supporting operations for flight. |
| ORR    | Operational Readiness Review: readiness for intended operation.                                |

## Evidence across engineering levels

Verification can occur at several levels of a product hierarchy and use test, analysis, inspection or demonstration. Integration and end-to-end evaluations address combinations that individual element evaluations do not establish. A trace needs the requirement, method, conditions and evaluated product scope. [NASA product verification](https://www.nasa.gov/reference/5-3-product-verification/).

NASA's requirements verification matrix guidance calls for identifiable requirements and their source. This supports a connection between the requirement record and the work used to demonstrate it. [NASA verification matrix guidance](https://www.nasa.gov/reference/appendix-d-requirements-verification-matrix/).

## Illustrative trace model

| Connected structure               | Example records                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------- |
| Operational intent and allocation | Mission goal → vehicle requirement → system requirement → equipment requirement |
| Implementation                    | Actuator design, electronics, software requirements and implementations         |
| Interfaces                        | Mechanical attachment, electrical supply, commands and position feedback        |
| Safety                            | Failure condition, mitigation, allocated requirement and assessment             |
| Configuration                     | Hardware revisions, software builds and evaluation setup                        |
| Evidence and reviews              | Procedure, result, anomaly, review finding and disposition                      |

These are illustrative connections, not an approved certification plan. For example, an actuator response requirement might divide responsibility among a motor, gear train, power electronics and control software. A motor change could affect timing, thermal behavior, power demand and fault response. The reviewer needs the shared interfaces and evaluated configurations as well as the parent requirements.

## Implications for Tracer exploration

An aerospace example would exercise deeper allocation, requirement-to-interface connections, safety-driven inputs and review findings tied to baseline configurations. It should distinguish exploratory prototype findings from evidence offered for a release or certification decision. The [company practices guide](company-practices.md#spacex) describes a public example of differing failure tolerance within SpaceX programs.

An aerospace seed is a possible next example, not a delivered feature or approval workflow. The existing generic engine does not evaluate airworthiness, mission readiness or assurance compliance.
