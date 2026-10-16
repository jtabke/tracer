# Cross-domain engineering tasks for the studio design

Status: source-grounded design scenarios, October 13, 2026. These are simulated customer-role tasks for a prototype, not transcripts from human participants or approval to change the examples. Read-only grounding in the three existing seed definitions; no application writes. Proposed authoring steps below are deliberately identified as drafts, not records already present in the seed.

The design should support establishing new information as well as reviewing an existing change. A prepared five-node read example cannot establish that contract. Each scenario below has actual siblings/shared work, actual evidence limitations and a contextual author/connect task.

## 1. Medical device: expand pressure scope without confusing bench and clinical evidence

Source: [medical-device-example.ts](../../../examples/medical-device-example.ts).

**Engineering task:** Starting from dependable home measurement, review the expanded pressure operating range, compare the existing allocations and evidence, then express the still-missing clinical planning requirement without duplicating the pressure-channel work.

**Meaningful scope:** `UN-01` (dependable measurement) → `PRS-02` (pressure-channel accuracy), beside its actual siblings `PRS-01`, `PRS-03`, `PRS-14` and shared `PRS-09`.

**Actual trace:**

- `UN-01 —decomposes_into→ PRS-02 —decomposes_into→ SYS-01 / SYS-02`.
- Both `SYS-01` (acquisition) and `SYS-02` (error budget) `—realized_by→ OUT-01 / OUT-02`. These hardware/calibration and pressure-conversion outputs are shared identities, not one copied design per requirement.
- `PRS-02`, `SYS-01`, `SYS-02`, `OUT-01`, `OUT-02 —verified_by→ VER-01 —executed_as→ RUN-01`.
- `RUN-01`'s receipt captures `PRS-02` v1 and the old 15–35 °C scope. Current `PRS-02` v2 expands it to 10–40 °C. The simulated old bench result remains recorded; it does not establish the expanded scope.
- Clinical sibling `PRS-14` has no subsystem breakdown or executable clinical verification protocol. `VAL-04` is a planning outline and `UN-01 —validated_by→ VAL-04`; static calibration is not clinical validation.

**Contextual authoring task, proposed:** Select `PRS-14` and begin a draft subsystem requirement for the clinical evaluation population/acceptance basis. First search existing subsystem requirements and inspect `OUT-03` (estimator, clinical performance unevaluated) and `VAL-04`; retain these as existing context, not duplicate them. The draft must leave unresolved acceptance/clinical choices explicit rather than invent thresholds or declare a study approved. Saving a future `decomposes_into` connection would organize the draft; it would not resolve the clinical gap. Meanwhile, review/revise existing `VER-01` when extending pressure testing rather than reflexively creating an identical bench protocol.

**First screen:** The selected need/product scope, sibling PRS statements, the shared hardware/firmware allocations, and visible changed-range versus missing-clinical-evidence distinctions. A reviewer should be able to see requirements and design inputs to the protocol together.

**Deliberate modes:** Captured/current comparison for the expanded range; contextual child authoring under `PRS-14`; protocol/validation planning inspection. Keep clinical qualifications and capture provenance beside the relevant record as secondary detail, not a wall of warnings above the trace. Do not label every requirement without a run as failed.

## 2. Software: extend offline retries while preserving shared queue behavior

Source: [technology-example.ts](../../../examples/technology-example.ts).

**Engineering task:** Review the 72-hour retry proposal across client/server behavior and sibling features, distinguish existing short-retry evidence from missing long-outage testing, then define the separate missing privacy scenario using existing instrumentation.

**Meaningful scope:** `WORK-03` (retry worker/acknowledgment reconciliation), with its actual incoming implementation links from `STORY-02`, `STORY-03`, `STORY-06`, `STORY-09`. `CAP-02 —breaks_down_into→ STORY-02 / STORY-03`; bookmarks and agenda refresh are other consumers of the same implementation, not copies of it.

**Actual trace:**

- `STORY-03 —implemented_by→ WORK-02 / WORK-03`. `WORK-03 —changes→ COMP-03`; the sync component consumes `API-01`, provided by check-in component `COMP-04`.
- `STORY-03`, `WORK-03`, `WORK-04`, `API-01 —checked_by→ TEST-02 / TEST-10`.
- `TEST-02 —exercised_as→ RUN-TECH-02`; its receipt captures `STORY-03` v1 and supports immediate retry only. Current `STORY-03` v2 proposes 72 hours offline and demands alignment with replay-disposition retention.
- `TEST-10` explicitly has unresolved expiry behavior and no run. `INC-01 —reveals→ STORY-03 / WORK-03 / API-01 / TEST-10` supplies recorded incident context, not computed impact.
- Nearby privacy work is real: `STORY-12 —implemented_by→ WORK-10`, which changes the same `COMP-03` plus `COMP-08`. `WORK-10` is partial, and `STORY-12` has no executable redaction test link. Do not imply the retry change caused this separate privacy gap.

**Contextual authoring task, proposed:** Select `STORY-12` and search existing test scenarios before creating a draft redaction scenario (`test_scenario`, `checked_by` from the story and existing `WORK-10`). Existing `TEST-08` is authorization expiry and `TEST-09` is publishing roles; neither establishes redaction behavior. The scenario expresses attendee-data exclusions already stated in `STORY-12`; test data and method remain a draft. There is no executed run or passing outcome. For retry work, reuse/open existing `TEST-10`, rather than creating a duplicate “long outage” test.

**First screen:** Shared worker identity and the contributing stories; client/server contract context; old short-retry result versus open long-outage test. Show privacy work as a selectable neighboring obligation, not an automatic consequence or release score. A library/search entry must let the engineer find existing work before adding something.

**Deliberate modes:** Story v1/v2 and captured-run comparison; contract/replay retention inspection; new test-scenario authoring; release review (`REL-01` already has mixed simulated results). Implementation artifact paths are fictional native descriptions, not imported or verified source code. Keep full paths/provenance secondary to human titles and exact behavior.

## 3. Integrated hardware/software: assess an alternative motor before adopting it

Source: [integrated-product-example.ts](../../../examples/integrated-product-example.ts).

**Engineering task:** Work from the proposed motor substitution, compare baseline and alternative design contexts, reuse relevant evaluation planning and preserve the distinction between an added scope link and evaluated configuration evidence.

**Meaningful scope:** `CHG-R02` (option-B motor assessment). Its explicit `assessment_references` are `PART-08`, `DES-09`, `DES-04`, `DES-05`, `IF-01`, `BUILD-R02`, `EVAL-R04`. These are stored review subjects, not all inferred affected items.

**Actual trace:**

- `DES-09 —defines→ PART-08` is proposed alternative installation/motor; baseline `DES-02 —defines→ PART-02` remains separate. The proposal has not been incorporated into an evaluated build.
- Shared supply/driver designs `DES-04 / DES-05`, `REQ-R06`, and power interface `IF-01 —evaluated_by→ EVAL-R04`. Its simulated receipt records a shared-rail reset against baseline `BUILD-R01`; it does not include `DES-09`.
- `FIND-R03 —finding_from→ EVAL-R04` preserves the unresolved reset. `DEC-R01` considers alternative concepts and planned `EXP-R02` (combined power/heat), so a relevant experiment already exists.
- Acoustics remains separately unresolved: `TGT-03`, `REQ-R10`, `DES-01`, `DES-02`, `DES-08 —evaluated_by→ EVAL-R05`; there is no receipt, and `FIND-R04 —finding_from→ EVAL-R05` states absence of evidence.
- Existing firmware `DES-01` v2 also causes old energy receipts to compare as changed. Keep that recorded firmware change separate from proving motor option B acceptable. The follow-up hardware-v1/firmware-v2 capture has no receipt.

**Contextual connect task, proposed:** From `DES-09`, find existing `EVAL-R04` before creating another power-interface evaluation. Inspect its method, baseline inputs and failed result. If an engineer decides to extend its planned scope to the proposed design, draft `DES-09 —evaluated_by→ EVAL-R04` with the unresolved extension clear. That permitted link is currently absent. It must not retroactively add `DES-09` to the old receipt or make its v1 proposal tested. If the method must change, make that a deliberate revision/new plan decision. Inspect/reuse existing `EXP-R02` rather than create a duplicate power/heat experiment.

**First screen:** The assessment's named subjects; proposed alternative and baseline design identities; supply/driver/interface context; old failed result and missing acoustic evaluation. The planned build's exact captured members must be inspectable without treating current identities as the capture.

**Deliberate modes:** Search/connect existing evaluation in context; edit a proposed evaluation plan; inspect an immutable configuration and its receipts; compare baseline versus proposal. Geometry can explain shared constraints, but claimed motor performance and adoption decisions belong in human-authored reasoning/evidence. Do not use a readiness percentage.

## Cross-domain design checks

- Start with the engineering question and selected scope, not a whole-project graph or a forced medical-document hierarchy.
- New item/Connect existing must be available in context. Search and inspect actual candidates before authoring; never create an implicit child and link without showing the proposal.
- “Child” is task language. Use the project's exact connection (`decomposes_into`, `checked_by`, `evaluated_by`) rather than invent a universal parent tree.
- Medical and software seeds separate protocol/scenario from run. Orbit uses evaluation records plus explicit receipts. The UI should represent those actual structures instead of silently normalizing them to one fixed lifecycle.
- A definition, ordinary link, run record, immutable receipt and captured configuration are different objects. Their presence must not substitute for a result or applicability judgment.
- Preserve siblings/shared identities and explicit boundaries across representations. Missing linked evidence is scoped absence, not proof that evidence cannot exist elsewhere.
- Show the new-design authoring and changed-evidence review states in the prototype. Do not claim that a read-only prepared trace proves either journey.
