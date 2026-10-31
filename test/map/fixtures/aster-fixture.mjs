import { asterTopics } from "./aster-content.mjs";
import { asterFolders } from "./organization.mjs";

const prefixes = {
  user_need: "UN",
  product_requirement: "PRS",
  subsystem_requirement: "SYS",
  component_requirement: "CMP",
  design_output: "OUT",
  verification_protocol: "VER",
  validation_protocol: "VAL",
  risk: "RSK",
  risk_control: "RC",
  design_change: "CHG",
};
const subjectNames = {
  Quality: "Signal quality",
  "Pressure control": "Pressure protection",
  "Cuff & preparation": "Cuff preparation",
  "Results & recall": "Result review",
};
const lower = (text) => text[0].toLowerCase() + text.slice(1);
const draftNote =
  "Fictional Aster UX example; draft allocation only. No device, clinical study or execution evidence is supplied.";

function asterAssignments(byKey) {
  const organization = {};
  for (const [folder, keys] of Object.entries(asterFolders)) {
    const [area, subject] = folder.split("/");
    for (const key of keys) {
      const entity = byKey.get(key);
      if (entity)
        organization[entity.id] = { path: [area, subjectNames[subject] ?? subject], areas: [area] };
    }
  }
  return organization;
}

export function makeAsterFixture(base) {
  const entities = [...base.entities],
    relationships = [...base.relationships];
  const byKey = new Map(base.entities.map((entity) => [entity.key, entity]));
  const organization = asterAssignments(byKey);
  const branches = new Map();
  function add(type, topic, suffix, title, statement, fields = {}) {
    const key = `${prefixes[type]}-${topic.code}-${suffix}`;
    const entity = {
      id: `aster-expanded:${key}`,
      key,
      type,
      version: 1,
      fields: {
        title,
        statement,
        status: type.endsWith("protocol") ? "planned; not executed" : "draft example",
        notes: draftNote,
        ...fields,
      },
      studyFolder: [topic.area, topic.subject],
      studyAreas: [topic.area, ...(["BAT", "SUP", "SIG"].includes(topic.code) ? ["Safety"] : [])],
    };
    entities.push(entity);
    return entity;
  }
  function link(type, source, target, scope) {
    relationships.push({
      id: `aster-expanded:link:${relationships.length + 1}`,
      version: 1,
      type,
      source: source.id,
      target: target.id,
      fields: { scope },
    });
  }
  const device = byKey.get("DEV-01");
  for (const topic of asterTopics) {
    const needs = topic.needs.map(([title, statement, task], i) => {
      const need = add("user_need", topic, String(i + 1).padStart(2, "0"), title, statement);
      link(
        "has_user_need",
        device,
        need,
        "Additional intended-use need for the fictional Aster monitor.",
      );
      const validation = add(
        "validation_protocol",
        topic,
        String(i + 1).padStart(2, "0"),
        `${title} — intended-use evaluation plan`,
        task,
        {
          method:
            "Planned intended-use task evaluation; representative users, product configuration and specialist-reviewed methods remain to be defined.",
          acceptance:
            "Draft plan: assess the linked need using the stated task; define acceptance rationale before execution. This is not an executed or approved validation.",
        },
      );
      link(
        "validated_by",
        need,
        validation,
        "Intended-use criterion is this user need; the plan is not evidence of successful validation.",
      );
      return need;
    });
    const cases = topic.cases.map(
      ([title, requirement, allocationA, allocationB, detailA, detailB, exercise], i) => {
        const suffix = String(i + 1).padStart(2, "0");
        const prs = add("product_requirement", topic, suffix, title, requirement, {
          acceptance: `Draft criterion: ${exercise} Assess the specified product behavior; method details and limits require review.`,
        });
        link(
          "addressed_by_requirement",
          needs[Math.floor(i / 2)],
          prs,
          "One of two product obligations addressing this user need.",
        );
        const allocations = [allocationA, allocationB].map((text, j) => {
          const sys = add(
            "subsystem_requirement",
            topic,
            `${suffix}${j ? "B" : "A"}`,
            text.replace(/\.$/, ""),
            `The ${topic.subject.toLowerCase()} subsystem shall ${lower(text)}`,
          );
          link(
            "allocated_to_subsystem",
            prs,
            sys,
            "A distinct allocated behavior; organizational folder containment is not this engineering allocation.",
          );
          const detail = j ? detailB : detailA;
          const component = add(
            "component_requirement",
            topic,
            `${suffix}${j ? "B" : "A"}`,
            detail.replace(/\.$/, ""),
            `The allocated component shall ${lower(detail)}`,
          );
          link(
            "allocated_to_component",
            sys,
            component,
            "Component detail supporting this specific subsystem obligation.",
          );
          return { sys, component };
        });
        const output = add(
          "design_output",
          topic,
          suffix,
          `${title} — design specification`,
          `Draft ${topic.artifact.toLowerCase()} for ${lower(title)}. Defines the interfaces and detailed behavior named by the linked component requirements; the referenced artifact is illustrative, not a supplied design file.`,
          {
            artifact: `Illustrative reference: aster/${topic.code.toLowerCase()}/${suffix}-design.md (not an attached file).`,
          },
        );
        // One deliberately unfinished allocation makes the Service exit review meaningful.
        for (const [j, { component }] of allocations.entries())
          if (!(topic.code === "SRV" && i === 5 && j === 1))
            link(
              "implemented_by",
              component,
              output,
              "Direct design contribution to the linked component behavior. No inherited parent implementation or completion is asserted.",
            );
        const verification = add(
          "verification_protocol",
          topic,
          suffix,
          `${title} — verification plan`,
          exercise,
          {
            method: `Proposed exercise: ${exercise} Record each linked criterion independently and identify the examined design revision before execution.`,
            acceptance:
              "Draft: compare observations with each linked product, subsystem and component statement separately. No pass/fail result exists for this plan.",
          },
        );
        link("verified_by", prs, verification, `Planned product-level criterion: ${requirement}`);
        for (const { sys, component } of allocations) {
          link(
            "verified_by",
            sys,
            verification,
            `Separate allocated criterion: ${sys.fields.statement}`,
          );
          if (!(topic.code === "SRV" && i === 5 && component === allocations[1].component))
            link(
              "verified_by",
              component,
              verification,
              `Separate component criterion: ${component.fields.statement}`,
            );
        }
        link(
          "examines_output",
          verification,
          output,
          "This plan names the illustrative design to examine; it does not report execution.",
        );
        return { prs, allocations, output, verification };
      },
    );
    for (const [i, caseIndex] of [1, 4].entries()) {
      const subject = cases[caseIndex];
      const risk = add(
        "risk",
        topic,
        String(i + 1).padStart(2, "0"),
        `${subject.prs.fields.title} — failure scenario`,
        `Illustrative failure scenario: the specified behavior is absent or misleading during the task '${topic.needs[Math.floor(caseIndex / 2)][0]}'.`,
        {
          hazardous_situation: `The user proceeds without the expected ${topic.subject.toLowerCase()} behavior or receives misleading state information.`,
          harm: "Potential inappropriate reliance, delayed follow-up or physical discomfort depending on the scenario; fictional preliminary analysis only.",
          residual_review: "Open; no acceptability or effectiveness determination is recorded.",
        },
      );
      const control = add(
        "risk_control",
        topic,
        String(i + 1).padStart(2, "0"),
        `${subject.prs.fields.title} — proposed control`,
        `Proposed control is the explicit product behavior: ${subject.prs.fields.statement} Its effectiveness and residual risk remain unassessed.`,
      );
      link("controlled_by", risk, control, "Proposed control, not demonstrated risk reduction.");
      link(
        "specified_as_requirement",
        control,
        subject.prs,
        "The control is specified as this product requirement; no extra implementation rollup is added.",
      );
    }
    branches.set(topic.code, { topic, needs, cases });
  }
  const item = (code, i, kind = "output") => branches.get(code).cases[i][kind];
  const dependencies = [
    [
      "REC",
      2,
      "SUP",
      3,
      "Reading commits depend on the power-fail and incomplete-slot recovery contract.",
    ],
    [
      "BAT",
      2,
      "REC",
      2,
      "Battery-removal retention uses the shared committed-reading storage design.",
    ],
    [
      "REC",
      3,
      "BAT",
      3,
      "Post-insertion recall must distinguish retained readings from reinitialized clock state.",
    ],
    [
      "PNE",
      4,
      "SUP",
      1,
      "Passive release and pump disable depend on actuator off states during reset.",
    ],
    ["FLT", 1, "PNE", 4, "Watchdog recovery relies on the controller-loss release path."],
    [
      "ACQ",
      4,
      "SRV",
      2,
      "Acquisition integrity checking uses the sensor identity and calibration-payload format produced by service.",
    ],
    [
      "SRV",
      5,
      "CUF",
      5,
      "Service exit reuses the fresh-Start edge qualification specified for help exit.",
    ],
    ["SIG", 5, "REC", 2, "Only accepted attempts may enter the shared committed-reading history."],
    [
      "CLN",
      4,
      "SRV",
      0,
      "Post-cleaning damage instructions use the shared service-message identifiers.",
    ],
  ];
  for (const [a, ai, b, bi, scope] of dependencies)
    link("depends_on", item(a, ai), item(b, bi), scope);
  link(
    "addressed_by_requirement",
    branches.get("BAT").needs[1],
    item("REC", 2, "prs"),
    "Battery replacement retention also depends on the shared reading commit/order obligation.",
  );
  link(
    "addressed_by_requirement",
    branches.get("CUF").needs[1],
    item("PNE", 3, "prs"),
    "Cuff setup recovery includes termination of a stalled/disconnected inflation attempt.",
  );
  // A shared bench plan has distinct criteria across power and storage, not cloned test identities.
  for (const [code, i] of [
    ["SUP", 3],
    ["REC", 2],
  ])
    link(
      "verified_by",
      item(code, i, "prs"),
      item("BAT", 2, "verification"),
      "Shared power-interruption exercise; evaluate this product criterion independently from battery retention.",
    );
  const changeSpecs = [
    [
      "BAT",
      "Battery replacement during a reading save",
      "Explore loss of power during a reading commit; assess the energy monitor, power supervisor and recall transaction together.",
      [
        ["BAT", 2],
        ["SUP", 3],
        ["REC", 2],
      ],
    ],
    [
      "ACQ",
      "Replace the pressure sensor assembly",
      "Review calibration identity handling, acquisition integrity checks and service replacement instructions together.",
      [
        ["ACQ", 4],
        ["SRV", 2],
        ["SIG", 1],
      ],
    ],
    [
      "SRV",
      "Review the service-exit Start behavior",
      "The fresh-Start component allocation has neither a direct design contribution nor an assigned component verification plan. Review that explicit gap before changing service exit.",
      [
        ["SRV", 5],
        ["CUF", 5],
        ["PNE", 5],
      ],
    ],
  ];
  for (const [code, title, statement, subjects] of changeSpecs) {
    const branch = branches.get(code);
    const change = add("design_change", branch.topic, "REVIEW", title, statement, {
      disposition: "Proposed review; no change applied and no confirmed impact determination.",
      scope: "Recorded review subjects across the named areas.",
      rationale:
        "Explore cross-folder dependencies and incomplete allocations using one shared record identity.",
    });
    for (const [subjectCode, i] of subjects)
      for (const target of [
        item(subjectCode, i, "prs"),
        item(subjectCode, i),
        item(subjectCode, i, "verification"),
      ])
        link(
          "requires_review_of",
          change,
          target,
          "Explicit review subject for this proposed change, not an automatically confirmed impact.",
        );
    if (code === "SRV")
      link(
        "requires_review_of",
        change,
        branches.get("SRV").cases[5].allocations[1].component,
        "Unimplemented/unassigned component criterion is an explicit review subject.",
      );
  }
  return {
    ...base,
    title: "Aster Home BP monitor",
    entities,
    relationships,
    studyOrganization: organization,
    study: {
      kind: "expanded-aster",
      note: "Authored fictional development example. Original 99 records and 219 links retained unchanged; additions have no execution results.",
    },
  };
}
