# Tracer development evidence

Use this index to find retained specifications, executed checks and recovery
evidence. The [live register](README.md) owns current delivery selection and
status; this page is a navigation aid, not another status board.

## Find the evidence for each area

| Area                                    | Specification or analysis                                                                                                 | Performed checks                                                                                                                  | Preservation                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Core primitives                         | [Reducibility audit](primitive-reducibility-audit.json)                                                                   | [Foundation checks](foundation-verification.json), [typed evidence contract](evidence-contract-verification.json)                 | See the exact candidate and limits inside each report                         |
| Application model and scoped assessment | [Application model analysis](application-model-analysis.json)                                                             | [Assessment completion](assessment-completion-verification.json)                                                                  | [Assessment preservation](assessment-completion-preservation.json)            |
| Requirement verification                | [Selected specification](requirement-verification-specification.json)                                                     | [Workspace verification](verification-ui-verification.json), [performed walkthrough](verification-ui-walkthrough.json)            | [Final register preservation](verification-final-register-preservation.json)  |
| Configuration-aware change              | [Selected specification](configuration-change-specification.json)                                                         | [Full goal audit](configuration-final-goal-audit.json), [performed verification](configuration-full-verification-execution.json)  | [Final register preservation](configuration-final-register-preservation.json) |
| Concurrent local reliability            | [Selected specification](concurrent-local-specification.json), [explicit workload budgets](concurrent-local-budgets.json) | [Full goal audit](concurrent-local-final-goal-audit.json), [performed verification](concurrent-local-verification-execution.json) | [Final register preservation](concurrent-local-final-preservation.json)       |
| Documentation and task navigation       | [Bounded readiness plan](../../docs/navigation-readiness-plan.md)                                                         | [Navigation verification](navigation-readiness-verification.json)                                                                 | [Register preservation](navigation-readiness-preservation.json)               |

These reports concern their declared candidates and scope. A passing local check
does not establish representative-human validation, physical engineering truth,
regulatory conformance, authentication or parity with an unimplemented backend.

## Read the file's evidence role

- Specifications and methods describe planned acceptance; they are not executed
  outcomes. Read the report's own status and qualifications.
- Phase reports, initial baselines and walkthrough attempts retain what was known
  at that stage. A later complete-scope audit can supersede a progress claim
  without rewriting its historical evidence.
- Procedure archives retain exact driver sources and, where stated, original
  command intents/outcomes. They are evidence, not instructions to replay a live
  mutation.
- Preservation reports identify the exact exported state, backup, history and
  durable outcomes that were checked. `project-export.json` is a review snapshot,
  not a supported restore format.

Keep existing report paths and bytes stable: native artifacts, captured hashes and
other reports reference them. Add a new report when evidence changes. Do not move
or delete older files solely because a more recent report exists.

## Local files and generated output

`tracer.sqlite` and `backups/` hold the local persistent project and recovery
copies. They are ignored by Git and must be preserved separately; follow the
[backup/recovery instructions](README.md#preservation-and-first-setup).

Repository-root `output/` contains local logs, captures and probe drivers, some
referenced by retained reports. Keep those until their evidence can be deliberately
archived. The [repository cleanup command](../../CONTRIBUTING.md#clean-generated-files)
removes named reproducible builds/caches while preserving project databases,
backups, report files, local evidence and historical source snapshots.
