import type { ExampleDefinition, ExampleItem, ExampleLink } from "./realistic-model.ts";

/** Project-specific records only. Manifest fields are navigation annotations; the seeder also records immutable native pins. */
export function withDevelopmentContext(
  example: ExampleDefinition,
  domain: "medical" | "technology",
): ExampleDefinition {
  const definition = structuredClone(example);
  const medical = domain === "medical";
  const configuration = medical ? "BUILD-MED-A" : "BUILD-TECH-A";
  for (const type of [
    "build_configuration",
    "concept",
    "experiment",
    "finding",
    "change_assessment",
  ])
    definition.schema.entityTypes[type] = {
      fields: {
        title: { type: "string", required: true },
        statement: { type: "string", required: true },
        status: { type: "string" },
        owner: { type: "string" },
        notes: { type: "string" },
        scope: { type: "string" },
        ...(type === "build_configuration" ? { manifest: { type: "json", required: true } } : {}),
      },
    };
  const projectTypes = Object.keys(definition.schema.entityTypes);
  const relation = (source: string[], target: string[]) =>
    ({
      source,
      target,
      fields: {
        scope: { type: "string", required: true },
        source_version: { type: "number", required: true },
        review: { type: "string", required: true },
      },
    }) as const;
  definition.schema.relationshipTypes.configuration_includes = relation(
    ["build_configuration"],
    medical ? ["design_output", "product_requirement"] : ["implementation", "contract", "story"],
  );
  definition.schema.relationshipTypes.evaluated_configuration = relation(
    ["test_run"],
    ["build_configuration"],
  );
  definition.schema.relationshipTypes.explores = relation(["experiment"], ["concept"]);
  definition.schema.relationshipTypes.finding_from = relation(
    ["finding"],
    ["test_run", "experiment"],
  );
  definition.schema.relationshipTypes.assessment_references = relation(
    ["change_assessment"],
    projectTypes,
  );
  definition.schema.relationshipTypes.considers = relation(
    [medical ? "design_change" : "decision"],
    ["concept", "experiment", "finding", "change_assessment"],
  );
  const items: ExampleItem[] = medical
    ? [
        [
          "build_configuration",
          "BUILD-MED-A",
          "Prototype A — recorded input configuration",
          "Fictional prototype configuration used by the simulated bench reports. The manifest captures native item identities and versions before the operating-temperature edit; references do not follow later versions automatically.",
          {
            manifest: [],
            status: "recorded example configuration",
            scope:
              "Selected pressure and release artifacts plus accuracy input; not a complete production bill of materials.",
          },
        ],
        [
          "build_configuration",
          "BUILD-MED-B",
          "Proposed high-flow valve comparison configuration",
          "Proposed comparison build retains the existing pneumatic drawing as its starting point. A higher-flow concept is under investigation; no new drawing or assembled build is represented.",
          {
            manifest: [],
            status: "proposed; no evaluation",
            scope: "Planning configuration only. Existing outputs have not been revised.",
          },
        ],
        [
          "concept",
          "CON-MED-01",
          "Retain the existing exhaust restriction",
          "Retain the existing passive exhaust path while investigating the simulated slow-release finding. It has existing deflation behavior but fails the largest-volume passive-release example.",
        ],
        [
          "concept",
          "CON-MED-02",
          "Increase exhaust flow",
          "Investigate a larger passive flow path. The tradeoff includes release speed, deflation-profile control, acoustic behavior and pressure-estimation quality; none is established by this proposal.",
        ],
        [
          "experiment",
          "EXP-MED-01",
          "Compare release speed and deflation stability",
          "Plan a bench comparison of the two exhaust concepts at representative cuff volumes, recording release curves and estimator input profiles. No executed comparison exists.",
          {
            status: "planned",
            scope: "Investigative experiment; final verification remains a separate activity.",
          },
        ],
        [
          "finding",
          "FIND-MED-01",
          "Largest-volume passive release remains unresolved",
          "The invented RUN-06 report records slow passive release while active Stop meets its draft allocation. This finding motivates comparing concepts; it does not identify an accepted corrective design.",
          { status: "simulated finding; unresolved" },
        ],
        [
          "change_assessment",
          "ASSESS-MED-01",
          "Exhaust-change assessment draft",
          "Review mechanical flow, control-loop deflation, BP signal quality, Stop timing, passive timing and risk controls for CHG-02. The links list recorded review subjects; no automatic impact conclusion or approval is recorded.",
          { status: "open", scope: "Explicit scope selected by the fictional team." },
        ],
      ]
    : [
        [
          "build_configuration",
          "BUILD-TECH-A",
          "Pilot 0.6 — recorded implementation configuration",
          "Fictional coordinated mobile/backend/web configuration referenced by the simulated runs. The manifest captures implementation, contract and retry-story versions before the 72-hour edit.",
          {
            manifest: [],
            status: "recorded example configuration",
            scope:
              "Native descriptions of selected artifacts; no real commit, binary or deployed environment is bound.",
          },
        ],
        [
          "build_configuration",
          "BUILD-TECH-B",
          "Proposed pilot follow-up configuration",
          "Planning configuration for the follow-up pilot. Long-retention handling and the organizer conflict UI remain unfinished; no new run or deployment exists.",
          {
            manifest: [],
            status: "proposed; no deployment",
            scope: "Same native starting artifacts; not an implemented follow-up release.",
          },
        ],
        [
          "concept",
          "CON-TECH-01",
          "Visible pending count at the gate",
          "Hypothesis: showing the queued-scan count and last confirmation will help volunteers recognize delivery problems without interrupting normal scanning.",
        ],
        [
          "concept",
          "CON-TECH-02",
          "Interrupt scanning for every delivery warning",
          "Alternative: show a blocking warning after a timeout. It makes delivery failure noticeable but may slow admissions when the network is temporarily unavailable.",
        ],
        [
          "experiment",
          "EXP-TECH-01",
          "Compare volunteer warning comprehension",
          "Plan prototype tasks comparing persistent pending-state feedback with blocking warnings during an invented connectivity outage. Observe recognition, task interruption and recovery behavior.",
          {
            status: "planned; no users observed",
            scope: "Product/usability discovery; no implementation or reliability result.",
          },
        ],
        [
          "finding",
          "FIND-TECH-01",
          "Two-gate admission behavior needs revision",
          "The simulated RUN-TECH-03 result exposes duplicate confirmed admissions for independent scans. This implementation finding is distinct from the unexecuted warning-comprehension experiment.",
          { status: "simulated finding; open" },
        ],
        [
          "change_assessment",
          "ASSESS-TECH-01",
          "72-hour retry horizon assessment draft",
          "Assess client queue persistence, server replay-key retention, independent admission conflicts, expired authorization and missing long-outage scenarios. Preserve the distinction between connected tests and demonstrated scope.",
          {
            status: "open",
            scope:
              "Explicit review subjects for the edited STORY-03; not computed release readiness.",
          },
        ],
      ];
  const links: ExampleLink[] = medical
    ? [
        ["considers", "CHG-02", "CON-MED-01"],
        ["considers", "CHG-02", "CON-MED-02"],
        ["considers", "CHG-02", "EXP-MED-01"],
        ["considers", "CHG-02", "FIND-MED-01"],
        ["considers", "CHG-02", "ASSESS-MED-01"],
        ["explores", "EXP-MED-01", "CON-MED-01"],
        ["explores", "EXP-MED-01", "CON-MED-02"],
        ["finding_from", "FIND-MED-01", "RUN-06"],
        ...["OUT-04", "OUT-03", "SYS-04", "SYS-08", "VER-06", "RSK-03", "BUILD-MED-A"].map(
          (key): ExampleLink => ["assessment_references", "ASSESS-MED-01", key],
        ),
      ]
    : [
        ["considers", "ADR-02", "CON-TECH-01"],
        ["considers", "ADR-02", "CON-TECH-02"],
        ["considers", "ADR-02", "EXP-TECH-01"],
        ["considers", "ADR-02", "FIND-TECH-01"],
        ["considers", "ADR-02", "ASSESS-TECH-01"],
        ["explores", "EXP-TECH-01", "CON-TECH-01"],
        ["explores", "EXP-TECH-01", "CON-TECH-02"],
        ["finding_from", "FIND-TECH-01", "RUN-TECH-03"],
        ...["STORY-03", "API-01", "WORK-03", "WORK-04", "TEST-10", "STORY-10", "BUILD-TECH-A"].map(
          (key): ExampleLink => ["assessment_references", "ASSESS-TECH-01", key],
        ),
      ];
  definition.items.push(...items);
  definition.links.push(...links);
  const members = medical
    ? [
        "OUT-01",
        "OUT-02",
        "OUT-03",
        "OUT-04",
        "OUT-05",
        "OUT-06",
        "OUT-07",
        "OUT-08",
        "OUT-09",
        "PRS-02",
      ]
    : [
        "WORK-01",
        "WORK-02",
        "WORK-03",
        "WORK-04",
        "WORK-05",
        "WORK-06",
        "WORK-07",
        "WORK-09",
        "API-01",
        "API-03",
        "STORY-03",
      ];
  definition.configurations = [
    {
      key: configuration,
      members,
      scope:
        "Selected native records captured before the subsequent input edit. The immutable native input capture is stored separately from this navigation manifest.",
    },
    {
      key: medical ? "BUILD-MED-B" : "BUILD-TECH-B",
      members,
      scope: "Proposed starting configuration; no new implementation or evaluated build.",
    },
  ];
  for (const build of definition.configurations)
    for (const member of build.members)
      definition.links.push([
        "configuration_includes",
        build.key,
        member,
        "Current identity connection; use the stored manifest for the recorded version.",
      ]);
  definition.receipts = definition.receipts.map((receipt) => ({
    ...receipt,
    inputs: [...receipt.inputs, configuration],
  }));
  for (const receipt of definition.receipts)
    definition.links.push([
      "evaluated_configuration",
      receipt.output,
      configuration,
      "Simulated result references a selected native configuration; consult its scope and captured receipt inputs.",
    ]);
  definition.tasks.push({
    title: "Concepts, configuration and explicit change assessment",
    root: medical ? "CHG-02" : "ADR-02",
    relationship: "considers",
    inspect: items.slice(2).map((item) => item[1]),
    explanation:
      "Compare alternatives and the planned experiment, then inspect the recorded finding and assessment subjects. Inspect Captured configurations for actual selected native revision pins; ordinary links open current records. A proposed build has no evaluation. Capture does not approve a build or infer change impact.",
  });
  return definition;
}
