import assert from "node:assert/strict";
import type { Tracer } from "../../../src/application/service.ts";
import type { Entity, Relationship } from "../../../src/core/model.ts";

/** Current-link corrections applied AFTER baseline capture and receipts. Never rewrite pins. */
const removals: [string, string, string, string][] = [
  ...[
    ["SYS-01", "OUT-01"],
    ["SYS-02", "OUT-01"],
    ["SYS-01", "OUT-02"],
    ["SYS-02", "OUT-02"],
    ["SYS-08", "OUT-04"],
    ["SYS-06", "OUT-05"],
    ["SYS-05", "OUT-07"],
    ["SYS-09", "OUT-08"],
    ["SYS-10", "OUT-09"],
    ["SYS-11", "OUT-09"],
    ["SYS-13", "OUT-10"],
  ].map(([source, target]): [string, string, string, string] => [
    "implemented_by",
    source,
    target,
    "Remove generic ancestor roll-up; retained direct component contributions remain reachable through the recorded allocation hierarchy. No independent integration contribution was scoped on this link.",
  ]),
  [
    "implemented_by",
    "CMP-12",
    "OUT-09",
    "STORE-03 preserves clock validity but does not define clock initialization after backup-state loss.",
  ],
  [
    "implemented_by",
    "CMP-06",
    "OUT-06",
    "CYCLE-05 describes supervisor transitions, not switch debounce or its 100 ms delivery implementation.",
  ],
  [
    "verified_by",
    "CMP-06",
    "VER-06",
    "End-to-end Stop/release timing does not define measurement of the independent 100 ms debounce delivery criterion.",
  ],
  [
    "verified_by",
    "CMP-10",
    "VER-08",
    "Behavioral profile isolation does not establish the specified per-record profile-ID storage representation.",
  ],
  [
    "verified_by",
    "SYS-01",
    "VER-01",
    "Pressure-error characterization does not define sample-rate measurement; move this criterion to VER-02 timestamp instrumentation.",
  ],
  [
    "depends_on",
    "OUT-06",
    "OUT-05",
    "Shared pneumatic use does not establish supervisor dependence on independent hardware protection.",
  ],
  [
    "depends_on",
    "OUT-03",
    "OUT-01",
    "Estimator consumes converted pressure through OUT-02; no separate raw acquisition interface is described. Acquisition dependence is derived through conversion.",
  ],
];

const implementationScopes: Record<string, string> = {
  "CMP-01/OUT-01":
    "CAL-02 defines sensor offset/span table format; checksum rejection is a separate firmware contribution, not supplied by the acquisition board alone.",
  "CMP-01/OUT-02":
    "pressure_conversion.c defines calibration checksum validation; no passing fault result is established by this design link.",
  "CMP-02/OUT-02":
    "pressure_conversion.c defines temperature compensation. Characterization over the expanded operating band remains open.",
  "CMP-03/OUT-02":
    "pressure_conversion.c defines pressure-sample timing; the ±1 ms timing allocation still requires evaluation.",
  "SYS-03/OUT-03":
    "estimate_bp.c defines invalid-signal output and the estimator quality gate; clinical performance is not established.",
  "SYS-04/OUT-04":
    "PNEU-03 supplies pump, valve, tubing and exhaust actuation. This is the pneumatic contribution, not a definition of controller profile logic or telemetry.",
  "CMP-05/OUT-04":
    "PNEU-03 defines the release valve and exhaust restriction shared by active and passive venting; meeting worst-volume time limits remains a verification question.",
  "CMP-04/OUT-05":
    "SAFE-02 defines comparator threshold components and hardwired pump inhibition independent of firmware; tolerance qualification is not inferred.",
  "SYS-04/OUT-06":
    "CYCLE-05 coordinates inflation, acquisition and venting phases. It contributes cycle sequencing, not the detailed pneumatic controller profiles or pressure telemetry implementation.",
  "SYS-07/OUT-06":
    "CYCLE-05 defines the supervisor Stop-to-vent transition. This contribution excludes switch debounce and does not establish exhaustive active-state handling or independence from estimator response.",
  "CMP-07/OUT-07":
    "CUFF-07 defines fabric seam, bladder dimensions and retention overlap for the proposed range; endpoint retention is evaluated separately.",
  "SYS-11/OUT-08":
    "UI-06 defines selected-profile and recall/empty-state presentation. Record retrieval and profile storage are separate contributions.",
  "CMP-08/OUT-08":
    "UI-06 defines result numeral geometry and fixed SYS/DIA/PULSE positions; intended-user readability is outside this design link.",
  "CMP-09/OUT-09":
    "STORE-03 defines journaled slots, CRC and commit marker for excluding incomplete records after interruption.",
  "CMP-10/OUT-09":
    "STORE-03 defines profile-specific records. The required profile-ID representation needs direct inspection; behavioral isolation alone does not establish it.",
  "SYS-12/OUT-09":
    "STORE-03 records clock validity alongside measurement values, contributing the storage-status facet only. Clock initialization, status generation and recall-screen rendering are separate responsibilities.",
  "CMP-11/OUT-10":
    "PWR-04 defines divider calibration and low/start thresholds; the voltage-error allocation requires characterization.",
  "SYS-14/OUT-11":
    "QSG-08 supplies preparation, placement and retry instructions; user comprehension is a separate validation question.",
  "SYS-15/OUT-12":
    "MECH-02 proposes resin and printed label method only. Cleaning compatibility and qualification are unresolved.",
};
const verificationScopes: Record<string, string> = {
  "PRS-02/VER-01":
    "Compare static cuff-pressure channel error with the product accuracy budget at declared bench points. Captured RUN-01 evaluated the old 15–35 °C input, not current 10–40 °C.",
  "SYS-02/VER-01":
    "Characterize allocated calibration/conversion error contributions separately from the product total. The input allocation remains 15–35 °C; wider-band characterization is not claimed.",
  "CMP-01/VER-02":
    "Inject missing and checksum-invalid calibration tables and observe refusal to start. Offset/span calibration accuracy is outside this fault-injection method.",
  "CMP-03/VER-02":
    "Instrument pressure-sample timestamps and compare schedule deviation with the ±1 ms timing allocation.",
  "PRS-01/VER-03":
    "For specified invalid-signal scenarios, check no completed/new result or newly stored reading. Valid-cycle SYS/DIA/pulse presentation is outside this protocol.",
  "PRS-03/VER-03":
    "Replay the declared motion/noise scenarios and check retry presentation plus absence of a newly stored numeric reading; unlisted signal conditions remain unevaluated.",
  "SYS-03/VER-03":
    "Exercise invalid-quality propagation that prevents completion and storage for the selected replay scenarios.",
  "PRS-04/VER-04":
    "Inspect fit, range markings and retention at the declared 22/32/42 cm fixtures. The simulated receipt lacks the 42 cm endpoint; unaided application is not established.",
  "SYS-05/VER-04":
    "Inspect cuff overlap, visible alignment/range markings and retention under the specified inflation sequences at available fixtures.",
  "CMP-07/VER-04":
    "Inspect seam/bladder/overlap retention after specified inflation sequences at the declared arm-range endpoints; missing fixtures limit coverage.",
  "PRS-06/VER-05":
    "Under declared stalled-supervisor/stuck-command faults, monitor peak reference pressure and the protection response against the 300 mmHg limit; other fault combinations are outside scope.",
  "SYS-06/VER-05":
    "Observe pump inhibition and pressure-release response during the declared supervisor faults; the protocol does not establish all possible independence failure modes.",
  "CMP-04/VER-05":
    "Observe hardware pump cutoff and resulting peak pressure in the declared faults. Separate comparator tolerance characterization is not defined by this method.",
  "PRS-07/VER-06":
    "Measure Stop-to-below-15 mmHg release time against the 5 s allocation at the stated worst-case cuff volume.",
  "PRS-08/VER-06":
    "Remove power during inflation and measure passive release below 15 mmHg against the 10 s allocation at worst-case cuff volume.",
  "SYS-07/VER-06":
    "Exercise the Stop-to-vent response in the declared protocol conditions. Exhaustive active-state handling and estimator-wait independence are not established by end-to-end timing alone.",
  "SYS-08/VER-06":
    "Exercise the unpowered passive vent path by removing power and observing residual pressure.",
  "CMP-05/VER-06":
    "Measure active and passive valve/exhaust release-time contributions at worst-case cuff volume; switch debounce is a separate criterion.",
  "PRS-09/VER-07":
    "Inspect fixed result labels, numeral height and declared result/error screens. Photometric readability and intended-user comprehension are excluded.",
  "SYS-09/VER-07":
    "Exercise result, retry/error and profile screens and inspect distinct layouts/labels against UI-06; user success is not evaluated.",
  "CMP-08/VER-07":
    "Inspect nominal numeral dimensions and fixed SYS/DIA/PULSE geometry against the drawing.",
  "PRS-10/VER-08":
    "Check complete-record recovery and two-profile isolation after interruption. Capacity of 60 readings and visible profile-change presentation are not evaluated by this method.",
  "SYS-10/VER-08":
    "Interrupt record commits, restart and check exclusion of partial readings; this targets atomic complete-record behavior.",
  "SYS-11/VER-08":
    "Recall both profiles after interruption and check isolation. Visible-selection and empty-history presentation are outside this method.",
  "CMP-09/VER-08":
    "Interrupt slot commits and check that incomplete slots are excluded after restart; direct CRC/commit-marker representation inspection is not defined.",
  "PRS-11/VER-09":
    "Remove clock backup state, save a reading and confirm unset-time indication through recall; no executed result exists.",
  "SYS-12/VER-09":
    "Check propagation of unset-clock status through save and recall after backup-state removal; no executed result exists.",
  "CMP-12/VER-09":
    "After backup-state loss, check unset-state propagation in the declared scenario. Transition to valid only after explicit setup is not addressed by this method.",
  "PRS-12/VER-10":
    "Sweep simulated battery conditions and check low/unavailable/start threshold decisions. The method does not define user-facing warning presentation inspection; no result exists.",
  "SYS-13/VER-10":
    "Assess voltage/state decisions under declared pump load with characterized measurement error; no executed result exists.",
  "CMP-11/VER-10":
    "Compare low/start threshold decisions with characterized divider/ADC error; no characterization result is captured.",
  "PRS-05/VER-11":
    "Inspect preparation and cuff-placement instructions in the guide. Cuff artwork and user comprehension are outside this guide-content inspection.",
  "SYS-14/VER-11":
    "Inspect guide content for preparation, positioning, retry and Stop instructions; no executed inspection or user study exists.",
  "PRS-13/VER-12":
    "Proposed cleaning exposure followed by legibility/function checks. Agent, cycle count and executable method remain unresolved; no result exists.",
  "SYS-15/VER-12":
    "Proposed housing/marking compatibility checks after cleaning parameters are selected. This is a blocked draft, not an executable protocol or qualification result.",
};
const dependencyScopes: Record<string, string> = {
  "OUT-03/OUT-02":
    "The estimator consumes the converted/calibrated pressure channel described by pressure_conversion.c. Acquisition dependence is indirect through OUT-02; no separate raw board interface is stated.",
  "OUT-03/OUT-04":
    "Estimator input quality depends on the pressure-deflation profile produced by the pneumatic actuation path; this is a direct signal-condition dependency, not proof of performance.",
  "OUT-06/OUT-04":
    "Cycle supervisor inflation/venting transitions require pump and valve actuation supplied by PNEU-03. This does not make independent protection depend on firmware.",
};
const additions: [string, string, string, string][] = [
  [
    "verified_by",
    "SYS-01",
    "VER-02",
    "Instrument sample timestamps to assess the declared 100 samples/s acquisition schedule. Pressure-error calibration remains a separate VER-01 criterion.",
  ],
  [
    "depends_on",
    "OUT-02",
    "OUT-01",
    "Pressure conversion uses the transducer/ADC acquisition interface and offset/span calibration-table specification defined by PAB-04/CAL-02.",
  ],
  [
    "depends_on",
    "OUT-05",
    "OUT-04",
    "Independent hardware protection inhibits the pump and commands release through the pneumatic pump/valve path. Its action remains independent of supervisor/estimator firmware.",
  ],
];
const actor = "medical-dependency-review";
const scopes: Record<string, Record<string, string>> = {
  implemented_by: implementationScopes,
  verified_by: verificationScopes,
  depends_on: dependencyScopes,
};

export async function cleanupMedicalLinks(tracer: Tracer, items: Entity[], links: Relationship[]) {
  const byKey = new Map(items.map((item) => [item.key!, item]));
  const removed = await removeLinks(tracer, byKey, links);
  const retained = links.filter((link) => !removed.has(link.id));
  const updated = await scopeLinks(tracer, items, retained);
  const added = await addLinks(tracer, byKey);
  return [...updated, ...added];
}
async function removeLinks(tracer: Tracer, items: Map<string, Entity>, links: Relationship[]) {
  const removed = new Set<string>();
  for (const [type, source, target, reason] of removals) {
    const link = findLink(links, type, items.get(source)!.id, items.get(target)!.id);
    await tracer.removeRelationship(link.id, link.version, 1, { actor, reason });
    removed.add(link.id);
  }
  return removed;
}
function findLink(links: Relationship[], type: string, source: string, target: string) {
  const matches = links.filter(
    (link) => link.type === type && link.source === source && link.target === target,
  );
  assert.equal(matches.length, 1, `Cleanup needs one native ${type} connection`);
  return matches[0];
}
async function scopeLinks(tracer: Tracer, items: Entity[], links: Relationship[]) {
  const keys = new Map(items.map((item) => [item.id, item.key]));
  const result: Relationship[] = [];
  for (const link of links) result.push(await scopeLink(tracer, keys, link));
  return result;
}
async function scopeLink(
  tracer: Tracer,
  keys: Map<string, string | undefined>,
  link: Relationship,
) {
  const scope = scopes[link.type]?.[`${keys.get(link.source)}/${keys.get(link.target)}`];
  if (scope === undefined) return link;
  return tracer.updateRelationship(
    link.id,
    link.version,
    {
      type: link.type,
      source: link.source,
      target: link.target,
      fields: { ...link.fields, scope: scopeText(link.type, scope) },
    },
    1,
    {
      actor,
      reason:
        "Scope the direct design contribution or exact protocol criterion from the existing statements; no new executed work or result is asserted.",
    },
  );
}
function scopeText(type: string, scope: string) {
  return type === "verified_by" ? "Planned criterion: " + scope : scope;
}
async function addLinks(tracer: Tracer, items: Map<string, Entity>) {
  const links: Relationship[] = [];
  for (const [type, source, target, scope] of additions)
    links.push(
      await tracer.createRelationship(
        {
          type,
          source: items.get(source)!.id,
          target: items.get(target)!.id,
          fields: { scope: scopeText(type, scope) },
        },
        1,
        { actor, reason: scope },
      ),
    );
  return links;
}
