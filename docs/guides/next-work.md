# Next work

Choose **Next work** in the sidebar, or find **Next work** in Search / ⌘K. Five queues retain separate counts. An item can appear in several queues because writing its statement, allocating it, planning verification and reviewing evidence are different tasks.

| Queue                           | What belongs here                                                                                                      | Action                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Requirements missing statements | Selected requirement records with an absent, whitespace-only or non-text statement value.                              | Edit the statement.                                                                  |
| Unallocated requirements        | Requirements in the allocation policy's population with **zero qualifying targets**.                                   | Inspect and connect an allocation.                                                   |
| Missing verification plans      | Requirements in the verification policy's population with **zero qualifying targets**.                                 | Inspect and connect a verification plan.                                             |
| Changed evidence inputs         | Non-superseded results with a confirmed difference in declared input content or dependency links.                      | Compare captured/current inputs and record a judgment.                               |
| Unresolved reviews              | Non-superseded results with no currently applicable review, or a currently applicable **Needs reevaluation** decision. | Review the inputs, or carry out reevaluation before recording a new decision/result. |

**Edit item and connections** opens the current record using existing guarded editing and connection controls. **Compare inputs and review** opens the exact immutable receipt and review owner. **Return to next work** refreshes the list and retains its selected queue. Item/review drafts remain mounted in this tab; resume buttons return to them. Choosing another item or receipt never silently replaces a draft. Confirmed edits, links and decisions persist in SQLite; unsaved drafts do not survive reload.

## Queue definitions

The Engineering starter supplies the initial requirement type, `statement` field, `requirement_design` allocation policy and `requirement_verification` plan policy. These come from the stored model; opening the list never modifies or upgrades it.

Expand **Queue definitions** to choose a requirement type, one of its declared text fields and saved coverage policies whose subject has that type. Choices remain in this tab; the underlying model/policies remain persistent project data. Custom models have no guessed relationship meanings. Missing choices show **Not configured**, with an explanation and **Configure model and policies** action, rather than a misleading zero. Empty projects can still inspect evidence/review queues.

Allocation and verification use the selected policy's stored relationship type, direction, subject/target types and exact population filters. They inspect complete active connections, not the visible graph. Duplicate links do not create extra distinct targets. These queues identify **zero-target** gaps: a requirement with one allocation is allocated even if a policy asks for two. Inspect other minimum-count deficits through Coverage. A plan link is structural evidence of a plan, not evidence of execution, success or satisfaction. An indirect requirement → design → test path does not replace a direct requirement-to-plan policy.

## Evidence and reviews stay separate

The list reuses existing declared-input comparison and review-applicability logic. Selected-field receipts ignore unrelated field changes. Captured paths compare their exact recorded links. File/Git inputs compare their last recorded observations; opening or refreshing queues never reads external content or creates an observation.

Unknown availability alone is not a confirmed change, so it does not enter Changed evidence inputs. Unknown and changed inputs can coexist and are counted separately. Unknown evidence without an applicable decision still appears in Unresolved reviews; it cannot be accepted through the review editor.

Applicable **Accepted** or **Acknowledged** decisions resolve review work, while confirmed input drift remains in Changed evidence inputs. A decision that no longer matches the current comparison returns the result to Unresolved reviews, with the previous decision explained. **Needs reevaluation** stays unresolved after it is recorded. A replacement result that explicitly supersedes an old receipt removes the old receipt from both work queues; original results and reviews remain readable. A failed technical outcome alone is not input drift or an unresolved decision.

Assignment, linked follow-up tasks and closure criteria remain separate scope. These queues do not establish release readiness.

## Snapshot, refresh and limits

All five queues use **one read transaction**, with an explicit native revision, model version and separate evidence sequence. Counts cover complete selected populations; paging ten rows only changes local display. **Refresh queues**, return from an action or a confirmed local change obtains a new snapshot. Later CLI/external edits are included on refresh. Row actions read current records/comparisons before editing; existing version, schema and review-token guards remain authoritative. Historical workspaces and uncertain saves retain their write pause.

A failed read displays an error and disables queue actions instead of claiming no work. The complete result is bounded to **10,000 records per structural queue, 2,000 recorded receipts, 10,000 declared inputs, 20,000 captured dependency links, 32 MiB of receipt payloads and 8 MiB of response data**. These are implementation budgets, not observed user workloads. Exceeding a limit rejects the complete list without truncation; existing paged record, coverage and evidence queries remain available for larger projects.

## CLI and API

```sh
node src/interfaces/cli.ts --db project.sqlite next-work get
node src/interfaces/cli.ts --db project.sqlite next-work get '{"requirementType":"need","statementField":"description","allocationExpectationId":"allocations","verificationExpectationId":""}'
```

`Tracer.getNextWork(query?)` and typed **`GET /api/next-work`** use the same selection and result contract. Optional query properties are `requirementType`, `statementField`, `allocationExpectationId` and `verificationExpectationId`. Each is text; an empty string explicitly leaves that choice unconfigured. Omission uses compatible defaults. Unknown properties, invalid fields and policies for another subject type reject with an error. The HTTP route uses the existing selected-project context and origin checks. Reads create no native revision or evidence.
