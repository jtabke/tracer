# Tracer project context

Read only documents relevant to the current request:

| Context                            | Source                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| Product vision and needs           | [docs/development/user-needs.md](docs/development/user-needs.md)                     |
| Journeys/candidate stories         | [docs/development/user-journeys.md](docs/development/user-journeys.md)               |
| Current UX direction               | [docs/development/ux-plan.md](docs/development/ux-plan.md)                           |
| Development flow                   | [docs/development/development-flow.md](docs/development/development-flow.md)         |
| Industry workflows                 | [docs/guides/industry-workflows/README.md](docs/guides/industry-workflows/README.md) |
| Architecture/contracts             | [docs/architecture.md](docs/architecture.md)                                         |
| Latest engineering checkpoint      | [docs/checkpoint.md](docs/checkpoint.md)                                             |
| Native development status/recovery | [Private register guide](docs/development/register.md)                               |
| Development model/trace meanings   | [docs/development/development-model.md](docs/development/development-model.md)       |
| Usage and contributor checks       | [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md)                           |

- The current request determines scope. Candidate stories, historical prototypes and authored status fields do not authorize implementation. Do not infer requirements solely from existing screens.
- Keep decisions in their owning maintained documents and current technical evidence in the checkpoint; historical reports belong in the local archive, not duplicated public progress lists.
- For feature planning/delivery, inspect `node scripts/register.mjs status` and the relevant need/requirement/work records when the private register is available. It owns structured delivery/work selection. Update guarded records and export locally after a slice. If its database is missing, follow recovery guidance; never silently reseed or block ordinary product contribution on private data. A fresh clone intentionally has no private register.
- Keep `.local/`, generated exports, per-run reports and experiments out of commits. Only deliberately retained specifications/templates and selected documentation images belong in the public tree. Preserve immutable source/evidence meanings when archiving paths.
- UI direction: the selected medical-device/Atlas workspace is shared across examples. Follow the maintained UX plan; older Orbit/Studio experiments are historical, not independent product directions.
