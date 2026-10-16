import { exampleLinks, exampleSchema } from "./realistic-model.ts";
import type { ExampleDefinition, ExampleItem } from "./realistic-model.ts";

const items: ExampleItem[] = [
  [
    "product",
    "ROBOT-01",
    "Orbit R1 robotic vacuum",
    "Fictional battery-powered floor-cleaning robot with suction, brush, navigation firmware and a companion app. Product targets, experiments and results are invented for engineering exploration.",
  ],
  [
    "goal",
    "GOAL-01",
    "Pick up ordinary household debris",
    "Clean the defined example hard-floor debris set with little intervention; learn which brush and suction combination is worth developing.",
  ],
  [
    "goal",
    "GOAL-02",
    "Finish a useful cleaning session",
    "Complete the intended cleaning task on one charge while maintaining predictable navigation and recovery.",
  ],
  [
    "goal",
    "GOAL-03",
    "Fit into household routines",
    "Allow understandable scheduling and quiet operation without making routine maintenance difficult.",
  ],
  [
    "target",
    "TGT-01",
    "Draft debris pickup target",
    "Collect at least 90% by mass of the fictional test debris set in the defined two-pass hard-floor task.",
    {
      acceptance:
        "Invented design target; debris distribution, floor condition and procedure are controlled assumptions.",
    },
  ],
  [
    "target",
    "TGT-02",
    "Draft cleaning runtime target",
    "Complete 60 minutes of the defined mixed navigation and cleaning profile on the selected battery configuration.",
    {
      acceptance:
        "Invented duty profile; compare whole-product consumption and usable battery energy.",
    },
  ],
  [
    "target",
    "TGT-03",
    "Draft acoustic target",
    "Remain within the fictional 65 dBA product target under the stated acoustic evaluation setup.",
    {
      acceptance:
        "A draft target only; distance, room, operating mode and microphone setup must be recorded.",
    },
  ],
  [
    "target",
    "TGT-04",
    "Recover from obstacles",
    "Detect the defined obstacles and recover without repeated user rescue during the example cleaning task.",
  ],
  [
    "target",
    "TGT-05",
    "Simple schedule editing",
    "A user can set a cleaning schedule and understand whether it has been delivered to the robot.",
  ],
  [
    "target",
    "TGT-06",
    "Maintain the cleaning path",
    "A user can remove collected debris and inspect the brush without specialist tools.",
  ],
  [
    "function",
    "FUN-01",
    "Move air through the cleaning head",
    "Provide the suction flow required by the selected brush and duct concept across the defined debris conditions.",
  ],
  [
    "function",
    "FUN-02",
    "Agitate and collect debris",
    "Use the brush and collection path to move the defined debris into the bin while avoiding the selected entanglement scenarios.",
  ],
  [
    "function",
    "FUN-03",
    "Supply energy within the duty budget",
    "Allocate usable battery energy among suction, traction, computation and reserve for the intended session.",
  ],
  [
    "function",
    "FUN-04",
    "Limit heat during cleaning",
    "Keep motor and driver conditions within their selected design limits throughout the duty profile.",
  ],
  [
    "function",
    "FUN-05",
    "Follow and recover the route",
    "Maintain pose and obstacle recovery while coordinating traction and cleaning actuators.",
  ],
  [
    "function",
    "FUN-06",
    "Coordinate local and remote schedules",
    "Store a usable local schedule and explain pending or confirmed remote schedule changes.",
  ],
  [
    "function",
    "FUN-07",
    "Provide maintenance access",
    "Provide accessible bin, brush and filter interfaces while retaining the air-path assembly.",
  ],
  [
    "function",
    "FUN-08",
    "Control sound-producing operation",
    "Coordinate blower selection, mounting and speed behavior with the selected acoustic target.",
  ],
  [
    "requirement",
    "REQ-R01",
    "Blower operating envelope",
    "Operate the selected blower within the recorded duty envelope while providing the flow used by the example pickup profile.",
  ],
  [
    "requirement",
    "REQ-R02",
    "Brush and duct contribution",
    "The brush geometry and duct path shall support the specified pickup task without assuming suction alone determines cleaning performance.",
  ],
  [
    "requirement",
    "REQ-R03",
    "Whole-product energy allocation",
    "Allocate a draft average 60 W across the defined cleaning profile using the fictional 60 Wh usable-energy assumption; preserve reserve and profile assumptions.",
    {
      acceptance:
        "Engineering allocation to investigate, not an engine-computed runtime guarantee.",
    },
  ],
  [
    "requirement",
    "REQ-R04",
    "Driver thermal monitoring",
    "Monitor the selected driver temperature indication and use an explicit derating behavior before the recorded component limit is reached.",
  ],
  [
    "requirement",
    "REQ-R05",
    "Actuator command timing",
    "Deliver the recorded blower and traction commands without violating the navigation controller's allocated timing budget.",
  ],
  [
    "requirement",
    "REQ-R06",
    "Shared power-rail transient response",
    "The shared rail shall retain the required controller supply during the defined blower-start and traction-transient scenarios.",
  ],
  [
    "requirement",
    "REQ-R07",
    "Obstacle recovery state",
    "Record obstacle recovery and retry behavior so a failed route is distinguishable from completed cleaning.",
  ],
  [
    "requirement",
    "REQ-R08",
    "Persist schedule and delivery state",
    "Persist schedule edits locally and distinguish a proposed app edit from the schedule acknowledged by the robot.",
  ],
  [
    "requirement",
    "REQ-R09",
    "Brush and bin access",
    "Permit bin emptying and brush inspection while preserving the selected seals and duct alignment.",
  ],
  [
    "requirement",
    "REQ-R10",
    "Acoustic operating profile",
    "Evaluate the selected blower, mounting and speed profile together against the acoustic target; no motor-only result represents the whole robot.",
  ],
  [
    "component",
    "PART-01",
    "Cleaning assembly",
    "Physical assembly contains the selected blower, brush, duct and removable bin; its functions overlap with power, thermal and acoustic work.",
  ],
  [
    "component",
    "PART-02",
    "Baseline blower motor",
    "Fictional blower option A used by the initial simulated build; retained as a distinct option from the higher-headroom concept.",
  ],
  [
    "component",
    "PART-03",
    "Brush and duct assembly",
    "Fictional brush, air path and seals support pickup and maintenance access.",
  ],
  [
    "component",
    "PART-04",
    "Battery and power assembly",
    "Fictional pack and shared supply electronics provide energy and handle actuator transients.",
  ],
  [
    "component",
    "PART-05",
    "Motor-driver board",
    "Shared board provides blower actuation and monitoring, interacting with power supply and firmware timing.",
  ],
  [
    "component",
    "PART-06",
    "Navigation and control firmware",
    "Native description of embedded pose, route, obstacle and actuator coordination; no source repository is connected.",
  ],
  [
    "component",
    "PART-07",
    "Companion application",
    "Native description of scheduling, delivery-state feedback and maintenance guidance; no deployed app exists.",
  ],
  [
    "component",
    "PART-08",
    "Higher-headroom blower option",
    "Alternative fictional motor option for a proposed build; changed load, mounting and acoustic behavior need evaluation.",
  ],
  [
    "interface",
    "IF-01",
    "Actuator power interface",
    "Record supply limits, expected transients and controller supply needs between battery/power and motor-driver work.",
  ],
  [
    "interface",
    "IF-02",
    "Blower command and monitoring interface",
    "Record command timing, duty representation and temperature feedback between firmware and driver work.",
  ],
  [
    "interface",
    "IF-03",
    "Schedule delivery contract",
    "Record schedule version and acknowledgment behavior between the app and the robot's persistent schedule service.",
  ],
  [
    "design",
    "DES-01",
    "Blower-control firmware design",
    "Example control design uses the baseline duty profile and retains command timing while monitoring driver temperature.",
    { artifact: "Invented artifact controls/blower-profile.ts" },
  ],
  [
    "design",
    "DES-02",
    "Baseline blower installation drawing",
    "Example drawing specifies motor option A, mounting and the selected duct interface.",
    { artifact: "Invented drawing AIR-02" },
  ],
  [
    "design",
    "DES-03",
    "Brush duct and service-access drawing",
    "Example assembly drawing defines brush geometry, bin release, filter access and seal location.",
    { artifact: "Invented drawing CLEAN-03" },
  ],
  [
    "design",
    "DES-04",
    "Battery and power schematic",
    "Example schematic and energy allocation describe pack use, shared rail and transient supply needs.",
    { artifact: "Invented schematic PWR-04" },
  ],
  [
    "design",
    "DES-05",
    "Driver board and thermal design",
    "Example board design covers blower switching, monitoring and thermal path; limits remain selected assumptions.",
    { artifact: "Invented board DRV-05" },
  ],
  [
    "design",
    "DES-06",
    "Navigation scheduling design",
    "Example firmware design coordinates route recovery with control-task timing and reports incomplete cleaning.",
    { artifact: "Invented artifact navigation/task-scheduler.ts" },
  ],
  [
    "design",
    "DES-07",
    "Schedule persistence and app feedback",
    "Example client/robot design captures schedule revisions and acknowledgment, retaining proposed changes during offline periods.",
    { artifact: "Invented artifacts app/schedule.ts and firmware/schedule-store.ts" },
  ],
  [
    "design",
    "DES-08",
    "Acoustic mounting and speed-profile plan",
    "Example mounting and operating profile define the configuration to be evaluated; no acoustic result exists.",
  ],
  [
    "design",
    "DES-09",
    "Alternative blower installation proposal",
    "Proposed option-B installation differs in mounting and electrical loading; it has not been incorporated into an evaluated build.",
    { artifact: "Invented proposed drawing AIR-09", status: "proposed" },
  ],
  [
    "concept",
    "CON-R01",
    "Baseline blower and existing duct",
    "Keep the initial integrated concept and investigate the pickup shortfall through brush and duct changes.",
  ],
  [
    "concept",
    "CON-R02",
    "Higher-headroom blower",
    "Increase available suction by changing motor selection, accepting potential energy, thermal, acoustic and mounting consequences.",
  ],
  [
    "concept",
    "CON-R03",
    "Variable suction by cleaning condition",
    "Investigate adaptive speed behavior to preserve runtime; this adds sensing, control and evaluation work before any benefit is established.",
  ],
  [
    "experiment",
    "EXP-R01",
    "Compare pickup concepts",
    "Plan controlled comparisons of brush/duct refinement and higher suction using the same defined debris and floor conditions.",
    { status: "planned; no comparison results", purpose: "Resolve concept uncertainty." },
  ],
  [
    "experiment",
    "EXP-R02",
    "Characterize combined power and heat",
    "Plan simultaneous logging of supply, driver temperature and commanded duty for the proposed blower concept.",
    { status: "planned", purpose: "Investigate allocation and interface behavior." },
  ],
  [
    "experiment",
    "EXP-R03",
    "Evaluate schedule feedback comprehension",
    "Plan user tasks comparing pending/confirmed schedule feedback; no representative users have been observed.",
    {
      status: "planned",
      purpose: "Investigate whether the proposed interaction is understandable.",
    },
  ],
  [
    "decision",
    "DEC-R01",
    "Hold blower selection pending combined evidence",
    "Keep baseline option A as the recorded starting design and compare alternatives before selecting option B.",
    {
      alternatives: "Brush/duct refinement; higher-headroom motor; adaptive suction.",
      consequences:
        "Motor-only pickup evidence will not resolve runtime, thermal or acoustic tradeoffs.",
      status: "open decision",
    },
  ],
  [
    "decision",
    "DEC-R02",
    "Keep schedules locally usable",
    "Use local schedule persistence with visible remote acknowledgment state in the fictional product design.",
    {
      alternatives:
        "Require a live connection for every edit; silently treat app edits as confirmed.",
      consequences: "Needs version conflict and delivery-state evaluation.",
      status: "provisional decision",
    },
  ],
  [
    "decision",
    "DEC-R03",
    "Separate configuration evidence from release judgment",
    "Review findings against the selected build and targets before recording a release decision; connected evidence alone is insufficient.",
    { status: "fictional project review practice" },
  ],
  [
    "build_configuration",
    "BUILD-R01",
    "Prototype A — recorded configuration",
    "Fictional starting build combines the baseline blower, physical design, driver and firmware records. Its manifest records selected native revisions before the blower-profile edit.",
    { manifest: [], status: "recorded example configuration" },
  ],
  [
    "build_configuration",
    "BUILD-R02",
    "Prototype B — proposed configuration",
    "Proposed configuration substitutes the option-B installation design. No assembled prototype or result is represented.",
    { manifest: [], status: "proposed; no evaluations" },
  ],
  [
    "evaluation",
    "EVAL-R01",
    "Simulated baseline pickup evaluation",
    "SIMULATED: the invented baseline task collected 84% of the defined debris mass against the 90% draft target. This is a configuration-specific shortfall.",
    {
      outcome: "SIMULATED target not met",
      method: "Invented two-pass task and weighing record",
      purpose: "Evaluate draft pickup target.",
    },
  ],
  [
    "evaluation",
    "EVAL-R02",
    "Simulated baseline energy evaluation",
    "SIMULATED: the invented duty-profile observation supports the old baseline allocation only. The later blower-control change has not been evaluated.",
    {
      outcome: "SIMULATED within old allocation",
      method: "Invented whole-product power trace",
      purpose: "Evaluate energy allocation.",
    },
  ],
  [
    "evaluation",
    "EVAL-R03",
    "Simulated driver thermal evaluation",
    "SIMULATED: an invented sustained-load scenario reached the selected derating condition; combined high-suction thermal behavior remains unresolved.",
    {
      outcome: "SIMULATED partial coverage",
      method: "Invented load and temperature record",
      purpose: "Investigate thermal response.",
    },
  ],
  [
    "evaluation",
    "EVAL-R04",
    "Simulated power-interface evaluation",
    "SIMULATED: a combined blower-start and traction transient produced a controller reset in the invented scenario.",
    {
      outcome: "SIMULATED fail",
      method: "Invented combined-load transient record",
      purpose: "Evaluate shared power interface.",
    },
  ],
  [
    "evaluation",
    "EVAL-R05",
    "Acoustic evaluation definition",
    "Define the whole-robot acoustic setup and operating profile. No run or observed sound level is present.",
    {
      outcome: "No result",
      status: "defined; unexecuted",
      purpose: "Evaluate draft acoustic target.",
    },
  ],
  [
    "evaluation",
    "EVAL-R06",
    "Schedule delivery evaluation definition",
    "Define interrupted-delivery, restart and revision-conflict checks for the local/remote schedule behavior. No executed result exists.",
    {
      outcome: "No result",
      status: "defined; unexecuted",
      purpose: "Evaluate implementation behavior, separate from EXP-R03 usability work.",
    },
  ],
  [
    "finding",
    "FIND-R01",
    "Baseline pickup below the draft target",
    "The simulated pickup finding motivates comparing concepts; it does not establish which motor or air-path change is best.",
  ],
  [
    "finding",
    "FIND-R02",
    "Energy evidence predates profile change",
    "The stored energy receipt captures the baseline firmware design. The edited duty profile creates a reason to review that evidence.",
  ],
  [
    "finding",
    "FIND-R03",
    "Shared-rail reset remains open",
    "The simulated transient failure connects motor loading to controller behavior and navigation recovery.",
  ],
  [
    "finding",
    "FIND-R04",
    "Acoustic evidence is absent",
    "A defined acoustic evaluation has no result. Increasing suction leaves an unresolved quiet-operation question.",
  ],
  [
    "change_assessment",
    "CHG-R01",
    "Blower-profile change assessment",
    "Review recorded connections from the blower-control edit to pickup, runtime, heat, sound, command timing and prior evidence. These are explicit assessment subjects, not inferred technical consequences.",
    { status: "open", scope: "Selected connected functions, interfaces, design and evidence." },
  ],
  [
    "change_assessment",
    "CHG-R02",
    "Option-B motor substitution assessment",
    "Assess mounting, driver loading, supply transients, control envelope and production setup before adopting the proposed motor configuration.",
    { status: "open", scope: "No release or manufacturing qualification recorded." },
  ],
  [
    "release",
    "REL-R01",
    "Orbit R1 engineering release candidate",
    "Fictional candidate remains open because pickup, shared-rail behavior, updated energy evidence, acoustics and user interaction have unresolved work.",
    {
      status: "not released",
      disposition: "A human review is required; no automatic readiness score exists.",
    },
  ],
];

const { links, connect } = exampleLinks();
connect("breaks_down_into", "ROBOT-01", ["GOAL-01", "GOAL-02", "GOAL-03"]);
for (const [goal, targets] of [
  ["GOAL-01", ["TGT-01"]],
  ["GOAL-02", ["TGT-02", "TGT-04"]],
  ["GOAL-03", ["TGT-03", "TGT-05", "TGT-06"]],
] as const)
  connect("breaks_down_into", goal, targets);
for (const [target, functions] of [
  ["TGT-01", ["FUN-01", "FUN-02"]],
  ["TGT-02", ["FUN-01", "FUN-03", "FUN-04"]],
  ["TGT-03", ["FUN-01", "FUN-08"]],
  ["TGT-04", ["FUN-05"]],
  ["TGT-05", ["FUN-06"]],
  ["TGT-06", ["FUN-02", "FUN-07"]],
] as const)
  connect(
    "breaks_down_into",
    target,
    functions,
    "Shared functional responsibility; one canonical item across targets.",
  );
for (const [fn, requirements] of [
  ["FUN-01", ["REQ-R01", "REQ-R05"]],
  ["FUN-02", ["REQ-R02"]],
  ["FUN-03", ["REQ-R03", "REQ-R06"]],
  ["FUN-04", ["REQ-R04"]],
  ["FUN-05", ["REQ-R05", "REQ-R06", "REQ-R07"]],
  ["FUN-06", ["REQ-R08"]],
  ["FUN-07", ["REQ-R09"]],
  ["FUN-08", ["REQ-R10", "REQ-R01"]],
] as const)
  connect("breaks_down_into", fn, requirements);
connect("contains", "ROBOT-01", ["PART-01", "PART-04", "PART-05", "PART-06", "PART-07"]);
connect("contains", "PART-01", ["PART-02", "PART-03"]);
for (const [requirement, designs] of [
  ["REQ-R01", ["DES-01", "DES-02"]],
  ["REQ-R02", ["DES-03"]],
  ["REQ-R03", ["DES-01", "DES-04"]],
  ["REQ-R04", ["DES-01", "DES-05"]],
  ["REQ-R05", ["DES-01", "DES-06"]],
  ["REQ-R06", ["DES-04", "DES-05"]],
  ["REQ-R07", ["DES-06"]],
  ["REQ-R08", ["DES-07"]],
  ["REQ-R09", ["DES-03"]],
  ["REQ-R10", ["DES-01", "DES-02", "DES-08"]],
] as const)
  connect(
    "realized_by",
    requirement,
    designs,
    "Allocated design contribution; extent and implementation are fictional.",
  );
for (const [design, components] of [
  ["DES-01", ["PART-05", "PART-06"]],
  ["DES-02", ["PART-02"]],
  ["DES-03", ["PART-03"]],
  ["DES-04", ["PART-04"]],
  ["DES-05", ["PART-05"]],
  ["DES-06", ["PART-06"]],
  ["DES-07", ["PART-06", "PART-07"]],
  ["DES-08", ["PART-01", "PART-02"]],
  ["DES-09", ["PART-08"]],
] as const)
  connect("defines", design, components);
connect("provides", "PART-04", ["IF-01"]);
connect("consumes", "PART-05", ["IF-01"]);
connect("consumes", "PART-06", ["IF-01"]);
connect("provides", "PART-06", ["IF-02", "IF-03"]);
connect("consumes", "PART-05", ["IF-02"]);
connect("consumes", "PART-07", ["IF-03"]);
connect("depends_on", "DES-01", ["DES-04", "DES-05", "DES-06"]);
connect("considers", "DEC-R01", [
  "CON-R01",
  "CON-R02",
  "CON-R03",
  "EXP-R01",
  "EXP-R02",
  "FIND-R01",
  "FIND-R03",
]);
connect("considers", "DEC-R02", ["EXP-R03", "EVAL-R06"]);
connect("explores", "EXP-R01", ["CON-R01", "CON-R02", "CON-R03"]);
connect("explores", "EXP-R02", ["CON-R02", "CON-R03"]);
for (const [evaluation, subjects] of [
  ["EVAL-R01", ["TGT-01", "REQ-R01", "REQ-R02", "DES-01", "DES-02", "DES-03"]],
  ["EVAL-R02", ["TGT-02", "REQ-R03", "DES-01", "DES-04"]],
  ["EVAL-R03", ["REQ-R04", "DES-01", "DES-05"]],
  ["EVAL-R04", ["REQ-R06", "IF-01", "DES-04", "DES-05"]],
  ["EVAL-R05", ["TGT-03", "REQ-R10", "DES-01", "DES-02", "DES-08"]],
  ["EVAL-R06", ["TGT-05", "REQ-R08", "IF-03", "DES-07"]],
] as const)
  for (const subject of subjects)
    connect(
      "evaluated_by",
      subject,
      [evaluation],
      "Evaluation scope; consult outcome and receipt. A definition alone is not an executed result.",
    );
for (const [finding, evaluation] of [
  ["FIND-R01", "EVAL-R01"],
  ["FIND-R02", "EVAL-R02"],
  ["FIND-R03", "EVAL-R04"],
  ["FIND-R04", "EVAL-R05"],
] as const)
  connect("finding_from", finding, [evaluation]);
for (const [change, subjects] of [
  [
    "CHG-R01",
    [
      "DES-01",
      "TGT-01",
      "TGT-02",
      "TGT-03",
      "REQ-R04",
      "REQ-R05",
      "IF-02",
      "EVAL-R02",
      "EVAL-R05",
      "BUILD-R01",
    ],
  ],
  ["CHG-R02", ["PART-08", "DES-09", "DES-04", "DES-05", "IF-01", "BUILD-R02", "EVAL-R04"]],
] as const)
  connect("assessment_references", change, subjects);
connect("release_considers", "REL-R01", [
  "DEC-R01",
  "DEC-R02",
  "BUILD-R01",
  "BUILD-R02",
  "FIND-R01",
  "FIND-R02",
  "FIND-R03",
  "FIND-R04",
]);

const schema = exampleSchema(
  {
    product: [],
    goal: [],
    target: ["acceptance"],
    function: [],
    requirement: ["acceptance"],
    component: [],
    interface: [],
    design: ["artifact"],
    concept: [],
    experiment: ["purpose"],
    decision: ["alternatives", "consequences"],
    build_configuration: ["scope"],
    evaluation: ["outcome", "method", "purpose"],
    finding: [],
    change_assessment: ["scope"],
    release: ["disposition"],
  },
  {
    breaks_down_into: [
      ["product", "goal", "target", "function"],
      ["goal", "target", "function", "requirement"],
    ],
    contains: [["product", "component"], ["component"]],
    realized_by: [["requirement"], ["design"]],
    defines: [["design"], ["component"]],
    provides: [["component"], ["interface"]],
    consumes: [["component"], ["interface"]],
    depends_on: [["design"], ["design"]],
    considers: [["decision"], ["concept", "experiment", "finding", "evaluation"]],
    explores: [["experiment"], ["concept"]],
    evaluated_by: [["target", "requirement", "design", "interface"], ["evaluation"]],
    finding_from: [["finding"], ["evaluation"]],
    assessment_references: [
      ["change_assessment"],
      [
        "target",
        "requirement",
        "interface",
        "design",
        "component",
        "evaluation",
        "build_configuration",
      ],
    ],
    configuration_includes: [["build_configuration"], ["design", "requirement"]],
    evaluated_configuration: [["evaluation"], ["build_configuration"]],
    release_considers: [["release"], ["decision", "build_configuration", "finding"]],
  },
);
schema.entityTypes.build_configuration.fields.manifest = { type: "json", required: true };
const configurations = [
  {
    key: "BUILD-R01",
    members: [
      "DES-01",
      "DES-02",
      "DES-03",
      "DES-04",
      "DES-05",
      "DES-06",
      "DES-07",
      "DES-08",
      "REQ-R03",
    ],
    scope:
      "Selected native revisions for fictional baseline prototype; an immutable native input set is captured separately; no physical build exists.",
  },
  {
    key: "BUILD-R02",
    members: [
      "DES-01",
      "DES-09",
      "DES-03",
      "DES-04",
      "DES-05",
      "DES-06",
      "DES-07",
      "DES-08",
      "REQ-R03",
    ],
    scope: "Proposed option-B configuration; no executed evidence.",
  },
];
for (const build of configurations)
  for (const member of build.members)
    connect(
      "configuration_includes",
      build.key,
      [member],
      "Identity connection; recorded version is in the configuration manifest.",
    );
for (const evaluation of ["EVAL-R01", "EVAL-R02", "EVAL-R03", "EVAL-R04"])
  connect(
    "evaluated_configuration",
    evaluation,
    ["BUILD-R01"],
    "Invented result references the selected baseline configuration.",
  );

export const integratedProductExample: ExampleDefinition = {
  title: "Orbit R1 — fictional integrated product development",
  description:
    "Orbit R1 is a fictional robot vacuum combining hardware, embedded control, navigation and an app. Explore shared engineering constraints, compare captured build revisions, and investigate a proposed firmware change. All product targets, artifacts and outcomes are invented.",
  sources: [
    {
      title: "Tracer industry development synthesis",
      url: "https://www.fictiv.com/articles/pre-production-hardware-testing-methods",
      use: "Hardware build/evaluation progression; product details and thresholds here are invented.",
    },
    {
      title: "Particle firmware product workflow",
      url: "https://docs.particle.io/getting-started/products/introduction-to-products/",
      use: "Combined device/firmware evaluation and rollout context; no Particle integration or actual devices.",
    },
  ],
  schema,
  items,
  links,
  configurations,
  followUpConfiguration: {
    subject: "BUILD-R01",
    name: "Orbit follow-up · hardware v1 + control firmware v2",
    members: ["DES-02", "DES-04", "DES-05", "DES-01", "REQ-R03"],
    reason:
      "Fictional proposal retains hardware design v1 and selects revised control firmware v2 after the duty-profile edit. This is a separate native input capture associated with the starting build; its old navigation manifest does not define this proposal. No evaluation receipt exists for this capture.",
  },
  receipts: [
    {
      output: "EVAL-R01",
      inputs: ["TGT-01", "DES-01", "DES-02", "DES-03", "BUILD-R01"],
      outcome: "SIMULATED pickup target not met",
    },
    {
      output: "EVAL-R02",
      inputs: ["TGT-02", "REQ-R03", "DES-01", "DES-04", "BUILD-R01"],
      outcome: "SIMULATED within old allocation; predates firmware edit",
    },
    {
      output: "EVAL-R03",
      inputs: ["REQ-R04", "DES-01", "DES-05", "BUILD-R01"],
      outcome: "SIMULATED partial thermal coverage",
    },
    {
      output: "EVAL-R04",
      inputs: ["REQ-R06", "IF-01", "DES-04", "DES-05", "BUILD-R01"],
      outcome: "SIMULATED fail — shared rail reset",
    },
  ],
  changes: [
    {
      key: "DES-01",
      statement:
        "Example blower-control design increases the proposed maximum duty from its baseline profile to improve pickup. Review energy, thermal, acoustic and command-timing effects before adoption; earlier baseline results remain captured against v1.",
      reason: "CHG-R01: illustrative firmware profile revision, with assessment still open.",
    },
  ],
  tasks: [
    {
      title: "Follow goals into shared functional allocations",
      root: "ROBOT-01",
      relationship: "breaks_down_into",
      inspect: ["GOAL-01", "GOAL-02", "GOAL-03"],
      explanation:
        "Descend through targets, functions and requirements, comparing siblings. FUN-01 and DES-01 contribute to several targets rather than belonging to one exclusive tree.",
    },
    {
      title: "Compare sibling cleaning responsibilities",
      root: "TGT-01",
      relationship: "breaks_down_into",
      inspect: ["FUN-01", "FUN-02", "REQ-R01", "REQ-R02"],
      explanation:
        "Pickup depends on suction plus brush/duct work. Physical containment is a separate relation.",
    },
    {
      title: "Shared design across engineering constraints",
      presentation: {
        layout: "trace",
        columns: [
          { relationshipType: "realized_by", targetType: "design", direction: "outgoing" },
          { relationshipType: "evaluated_by", targetType: "evaluation", direction: "outgoing" },
        ],
      },
      root: "DES-01",
      relationship: "realized_by",
      direction: "incoming",
      inspect: ["REQ-R01", "REQ-R03", "REQ-R04", "REQ-R05", "REQ-R10"],
      explanation:
        "One firmware design is shared across flow, energy, thermal, timing and acoustic responsibilities. Inspect its v1/v2 history and changed receipts.",
    },
    {
      title: "Compare concepts before choosing a motor",
      root: "DEC-R01",
      relationship: "considers",
      inspect: ["CON-R01", "CON-R02", "CON-R03", "EXP-R01", "EXP-R02"],
      explanation:
        "Compare air-path refinement, motor substitution and adaptive suction. The experiments are plans, not executed evidence or approved implementation.",
    },
    {
      title: "Examine an exact recorded configuration",
      root: "BUILD-R01",
      relationship: "configuration_includes",
      inspect: ["DES-01", "DES-02", "DES-04", "DES-05"],
      explanation:
        "Expand Captured configurations to read the exact native input set, including DES-01 v1 while the current identity is v2. Ordinary links open current records; the separate immutable capture and its receipts retain evaluated versions. Current drift does not change the recorded build.",
    },
    {
      title: "Investigate the proposed control change",
      root: "CHG-R01",
      relationship: "assessment_references",
      inspect: ["TGT-01", "TGT-02", "TGT-03", "IF-02", "EVAL-R02"],
      explanation:
        "The assessment lists explicit review subjects. Energy receipts compare as changed; acoustic evaluation remains unexecuted. No all-affected-items or automatic-invalidity claim.",
    },
    {
      title: "Keep release questions unresolved",
      root: "REL-R01",
      relationship: "release_considers",
      inspect: ["DEC-R01", "BUILD-R01", "BUILD-R02", "FIND-R01", "FIND-R03", "FIND-R04"],
      explanation:
        "A proposed build, failed evaluation, changed input and missing result coexist. Connection counts cannot establish release readiness.",
    },
  ],
  chains: [
    {
      title: "Goal-to-finding trace across eight columns",
      query: {
        type: "product",
        search: "ROBOT-01",
        steps: [
          { type: "goal", relationshipType: "breaks_down_into" },
          { type: "target", relationshipType: "breaks_down_into" },
          { type: "function", relationshipType: "breaks_down_into" },
          { type: "requirement", relationshipType: "breaks_down_into" },
          { type: "design", relationshipType: "realized_by" },
          { type: "evaluation", relationshipType: "evaluated_by" },
          { type: "finding", relationshipType: "finding_from", direction: "incoming" },
        ],
      },
    },
  ],
};
