# Hardware and integrated product development

[Product development across industries](README.md)

An integrated product combines a physical design with software behavior and a way to manufacture and support it. A robotic vacuum, thermostat or industrial robot can have several engineering disciplines contributing to the same capability. For Tracer exploration, the useful unit is a product goal connected to allocations, interfaces, decisions and evaluated configurations.

## Prototype and manufacturing progression

One published consumer-hardware pattern uses engineering, design and production verification stages, often abbreviated EVT, DVT and PVT. Fictiv describes prototypes and testing becoming more representative of the final design and manufacturing process through those stages. Names and exit criteria should be read in the context of a particular program. [Fictiv pre-production testing guidance](https://www.fictiv.com/articles/pre-production-hardware-testing-methods).

| Stage in that pattern    | Main question                                                | Example work                                                                      |
| ------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Engineering verification | Does the integrated design function?                         | Functional, thermal, fit and early reliability evaluations.                       |
| Design verification      | Does a more representative product meet design expectations? | Product evaluations, assembly refinements and defined acceptance characteristics. |
| Production verification  | Can the intended process build the product consistently?     | Manufacturing and packaging trials close to the production workflow.              |

This progression gives hardware iteration a different rhythm from a code-only release. Findings can change the next design or build; a prototype is useful evidence only for the questions its configuration and evaluation conditions address. [Fictiv testing guidance](https://www.fictiv.com/articles/pre-production-hardware-testing-methods).

Embedded software also has its own release progression. Particle's documented workflow moves firmware from developers' devices to a product test fleet, selected device groups and broader release. It separately describes programming and testing devices during initial setup. A connected product therefore has relationships between physical units, firmware versions and rollout groups. [Particle product and firmware workflow](https://docs.particle.io/getting-started/products/introduction-to-products/).

## Illustrative combined workflow

The following is an illustrative model for a robotic vacuum, not an account of a particular company's process:

1. Define the intended experience: effective cleaning with little intervention.
2. Establish targets and constraints: pickup, runtime, noise, obstacle handling, size and cost.
3. Compare concepts: brush layouts, air paths, motors, batteries and navigation approaches.
4. Allocate responsibility across mechanical, electrical, firmware and software work; define their interfaces.
5. Assemble a known configuration and run experiments addressing the current uncertainties.
6. Record findings, resolve tradeoffs and choose the next revisions or manufacturing changes.
7. Evaluate a release configuration and learn from operation and support.

There is both a breakdown of the product and a loop of experiments and decisions. The loop can revisit targets or concepts as well as implementation.

## Working artifacts and relationships

| Structure                | Illustrative artifacts                                    | Relationship worth preserving                             |
| ------------------------ | --------------------------------------------------------- | --------------------------------------------------------- |
| Product behavior         | Cleaning functions and performance targets                | Capability → target → allocated responsibility            |
| Physical design          | Assemblies, parts, CAD, drawings and bill of materials    | Assembly → component; revision → selected part            |
| Electronics and firmware | Schematics, PCB revisions, drivers and control logic      | Signal/interface → hardware and firmware responsibilities |
| Software experience      | Navigation modules, app flows and service contracts       | Feature → component → interface                           |
| Engineering decisions    | Alternatives, experiments and trade studies               | Finding → decision → affected design                      |
| Build and evaluation     | Prototype configuration, procedure, conditions and result | Result → exact configuration and input versions           |
| Manufacturing            | Assembly process, fixtures and inspection criteria        | Process change → design or production evaluation          |

These artifacts are suggestions for the illustrative model. They do not prescribe a tool, file format or universal hierarchy.

## Change example for Tracer

A proposed increase in suction can connect to the motor, duct, driver electronics, firmware control, power budget, thermal behavior and acoustic behavior. Those are related sibling responsibilities. The physical assembly hierarchy alone does not express all the consequences.

A test should also identify the configuration it evaluated: for example, motor revision B, duct revision C, PCB revision D and firmware build 0.8. A later firmware change may preserve some evidence while raising questions about another result. A different motor might affect both production assembly and control behavior.

The delivered [Orbit R1 seed](../realistic-examples.md#integrated-product-orbit-r1) explores these combined-product tasks with fictional records and simulated outcomes. The [Gatherline seed](../realistic-examples.md#technology-gatherline) remains a software example. Orbit's configuration manifests describe selected revisions; they do not supply enforced baseline semantics.
