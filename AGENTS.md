# Tracer project context

Read only the documents relevant to the current task:

| Context                                   | Source                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| Product vision                            | [docs/user-needs.md](docs/user-needs.md#product-vision)                |
| User needs and evidence                   | [docs/user-needs.md](docs/user-needs.md)                               |
| Journeys and candidate stories            | [docs/user-journeys.md](docs/user-journeys.md)                         |
| UX exploration and evaluation             | [docs/ux-plan.md](docs/ux-plan.md)                                     |
| Development flow and design principles    | [docs/development-flow.md](docs/development-flow.md)                   |
| Industry product development workflows    | [docs/industry-workflows/README.md](docs/industry-workflows/README.md) |
| Existing architecture and invariants      | [docs/architecture.md](docs/architecture.md)                           |
| Current progress and next actions         | [docs/checkpoint.md](docs/checkpoint.md)                               |
| Live product requirements and work status | [Headless development register](projects/tracer/README.md)             |
| Development model and trace meanings      | [Tracer development model](docs/development-model.md)                  |
| Commands and usage                        | [README.md](README.md)                                                 |

- The current request determines scope. Respect each document's evidence/status labels; candidate stories and hypotheses are not automatic implementation approval.
- Do not infer product requirements solely from existing prototype screens.
- Keep decisions in their owning documents and progress in the checkpoint, rather than duplicating them here.
- For feature planning and delivery, inspect `node projects/tracer/project.mjs status` and the relevant need/requirement/work records. The register owns current structured delivery status and work selection; the checkpoint retains dated engineering evidence. Update affected records and export after a slice. Follow the register's backup/recovery guidance if its local database is missing; do not silently reseed it. Candidate records do not authorize implementation.

- UI direction: use the selected medical-device map experience as the shared UI across all examples. Follow the current unified direction in `docs/ux-plan.md`; do not treat the older Orbit/Studio shell or historical demos as independent product directions.
