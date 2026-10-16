import { exampleLinks, exampleSchema } from "./realistic-model.ts";
import type { ExampleDefinition, ExampleItem } from "./realistic-model.ts";

const requirements = ["product_requirement", "subsystem_requirement", "component_requirement"];
const items: ExampleItem[] = [
  [
    "device",
    "DEV-01",
    "Aster Home BP monitor",
    "Fictional battery-powered upper-arm blood-pressure monitor for an adult taking spot measurements at home. Reports systolic pressure, diastolic pressure and pulse; does not diagnose a condition or recommend treatment.",
    {
      intended_use:
        "Adult home spot measurements; pediatric, ambulatory and emergency use excluded from this example.",
      status: "illustrative development baseline",
    },
  ],
  [
    "user_need",
    "UN-01",
    "Take a dependable home measurement",
    "An adult needs to obtain a usable reading at home and distinguish a completed measurement from an unsuccessful attempt.",
  ],
  [
    "user_need",
    "UN-02",
    "Fit the cuff without assistance",
    "An adult needs to choose, apply and position the cuff on their own arm using the supplied instructions.",
  ],
  [
    "user_need",
    "UN-03",
    "Remain in control during inflation",
    "A user needs to stop an uncomfortable measurement promptly and have the cuff release pressure even if normal control fails.",
  ],
  [
    "user_need",
    "UN-04",
    "Read and discuss previous measurements",
    "A user needs to read the current result and retrieve their own dated readings when discussing them with a clinician.",
  ],
  [
    "user_need",
    "UN-05",
    "Maintain readiness between uses",
    "A user needs to recognize when batteries or cleaning are required and prepare the monitor without specialist tools.",
  ],

  [
    "product_requirement",
    "PRS-01",
    "Report a completed measurement",
    "After a valid cycle, display systolic and diastolic pressure in mmHg and pulse in beats per minute together; never display an aborted cycle as a new result.",
    {
      acceptance:
        "Bench signal scenarios produce all three labeled values; aborted-cycle scenarios retain no new result.",
    },
  ],
  [
    "product_requirement",
    "PRS-02",
    "Pressure-channel accuracy budget",
    "The static cuff-pressure channel shall have error no greater than ±3 mmHg over 0–300 mmHg at 15–35 °C.",
    {
      acceptance:
        "Compare the pressure channel against a calibrated reference across the stated range. This draft target is not a clinical BP-accuracy criterion.",
    },
  ],
  [
    "product_requirement",
    "PRS-03",
    "Detect unsuitable measurement conditions",
    "When the algorithm identifies excessive movement or inadequate signal quality, end the attempt with a retry message and do not store a numeric blood-pressure result.",
  ],
  [
    "product_requirement",
    "PRS-04",
    "Fit the intended arm range",
    "The supplied cuff shall fit an adult upper-arm circumference from 22 to 42 cm, with visible placement and range indications.",
    {
      acceptance:
        "Draft product population assumption; assess fit at both endpoints and representative intermediate sizes.",
    },
  ],
  [
    "product_requirement",
    "PRS-05",
    "Teach cuff placement",
    "The quick-start guide and cuff markings shall describe arm position, cuff alignment, tightening and preparation before a measurement.",
  ],
  [
    "product_requirement",
    "PRS-06",
    "Limit cuff pressure",
    "An independent protective function shall command pressure release before cuff pressure exceeds 300 mmHg under the defined single-fault scenarios.",
    {
      acceptance:
        "Fictional safety allocation; final thresholds and fault set require risk review.",
    },
  ],
  [
    "product_requirement",
    "PRS-07",
    "Stop and release pressure",
    "Pressing Stop during inflation or measurement shall stop the pump and reduce cuff pressure below 15 mmHg within 5 seconds.",
  ],
  [
    "product_requirement",
    "PRS-08",
    "Release on power loss",
    "Loss of battery power during a measurement shall leave a passive release path that reduces cuff pressure below 15 mmHg within 10 seconds.",
  ],
  [
    "product_requirement",
    "PRS-09",
    "Readable result presentation",
    "The result screen shall use distinct SYS, DIA and PULSE labels and digits at least 12 mm high; error screens shall explain the next action without showing a new BP result.",
  ],
  [
    "product_requirement",
    "PRS-10",
    "Keep readings assigned to a user",
    "The monitor shall store up to 60 completed readings for each of two user profiles, including measurement time; a profile change shall be visible before recall.",
  ],
  [
    "product_requirement",
    "PRS-11",
    "Handle clock uncertainty",
    "After clock reset or an unset clock, label new records as time-unset; do not silently assign an invented date.",
  ],
  [
    "product_requirement",
    "PRS-12",
    "Warn before battery exhaustion",
    "Show a low-battery indication before the next measurement becomes unavailable, and prevent a new cycle when the remaining battery state is below the defined start threshold.",
  ],
  [
    "product_requirement",
    "PRS-13",
    "Support routine cleaning",
    "User-accessible housing surfaces shall tolerate the specified cleaning method without loss of legibility or function over the proposed service life.",
    {
      acceptance:
        "Cleaning agent, cycle count and service-life basis are unresolved; this requirement is deliberately not ready for verification.",
      status: "open acceptance criteria",
    },
  ],
  [
    "product_requirement",
    "PRS-14",
    "Establish clinical measurement performance",
    "Establish blood-pressure measurement performance for the intended adult population using an applicable clinical evaluation plan.",
    {
      acceptance:
        "Study design, reference method, population and acceptance criteria require a qualified clinical/regulatory review. Static sensor calibration is insufficient.",
      status: "planned; protocol missing",
    },
  ],

  [
    "subsystem_requirement",
    "SYS-01",
    "Acquire calibrated pressure samples",
    "The pressure acquisition subsystem shall provide calibrated cuff-pressure samples to the estimator at 100 samples per second.",
  ],
  [
    "subsystem_requirement",
    "SYS-02",
    "Allocate pressure error",
    "At 15–35 °C, sensor calibration residual shall be within ±1.5 mmHg and conversion/compensation contribution within ±1.0 mmHg; retain 0.5 mmHg integration margin.",
  ],
  [
    "subsystem_requirement",
    "SYS-03",
    "Reject motion-corrupted estimates",
    "The measurement estimator shall expose an invalid-quality state that prevents completion and storage when the motion rejection rule is triggered.",
  ],
  [
    "subsystem_requirement",
    "SYS-04",
    "Control pressure ramps",
    "The pneumatic controller shall execute the requested inflation and deflation profiles while reporting pressure and actuator state to the cycle supervisor.",
  ],
  [
    "subsystem_requirement",
    "SYS-05",
    "Provide cuff geometry and markings",
    "The cuff assembly shall provide overlap and retention across the intended arm range and keep artery alignment and range marks visible when applied.",
  ],
  [
    "subsystem_requirement",
    "SYS-06",
    "Independent overpressure response",
    "A protection channel independent of the estimator shall inhibit the pump and open the release valve when its overpressure threshold is reached.",
  ],
  [
    "subsystem_requirement",
    "SYS-07",
    "Prioritize Stop input",
    "The cycle supervisor shall handle Stop in every active measurement state and enter the venting state without waiting for an estimator response.",
  ],
  [
    "subsystem_requirement",
    "SYS-08",
    "Provide passive venting",
    "The pneumatic assembly shall vent through a normally open path when its valve drive is unpowered.",
  ],
  [
    "subsystem_requirement",
    "SYS-09",
    "Separate results from errors",
    "The presentation layer shall render completed-result and retry/error states using distinct layouts and labels.",
  ],
  [
    "subsystem_requirement",
    "SYS-10",
    "Persist a complete reading atomically",
    "The record store shall commit profile, pressure values, pulse, clock-state flag and timestamp as one record; interrupted writes shall not create a partly populated reading.",
  ],
  [
    "subsystem_requirement",
    "SYS-11",
    "Recall only the active profile",
    "The recall controller shall return records for the visible active profile and explicitly indicate an empty history.",
  ],
  [
    "subsystem_requirement",
    "SYS-12",
    "Preserve clock-state provenance",
    "The clock service shall expose valid/unset status; the store and recall screen shall preserve and show that status for each saved reading.",
  ],
  [
    "subsystem_requirement",
    "SYS-13",
    "Evaluate battery state under load",
    "The power supervisor shall assess battery voltage under the proposed pump load before permitting a cycle and provide low/unavailable states to the display.",
  ],
  [
    "subsystem_requirement",
    "SYS-14",
    "Supply preparation instructions",
    "The labeling set shall illustrate seated posture, rest, supported arm and cuff positioning; clarify that a retry message is not a clinical reading.",
  ],
  [
    "subsystem_requirement",
    "SYS-15",
    "Qualify housing and printed labels",
    "The enclosure and printed markings shall retain functional and reading characteristics after the selected cleaning regimen.",
    { status: "blocked by PRS-13 acceptance criteria" },
  ],

  [
    "component_requirement",
    "CMP-01",
    "Pressure transducer calibration table",
    "Store sensor offset and span calibration with a checksum; reject an absent or corrupt table before measurement.",
  ],
  [
    "component_requirement",
    "CMP-02",
    "Temperature compensation",
    "Apply the characterized temperature compensation to the pressure conversion over the specified operating band.",
  ],
  [
    "component_requirement",
    "CMP-03",
    "Sample timing budget",
    "Pressure-sample timestamps shall remain within ±1 ms of the 10 ms schedule during measurement.",
  ],
  [
    "component_requirement",
    "CMP-04",
    "Pump cutoff comparator",
    "The independent comparator shall inhibit pump drive without relying on a firmware task; threshold tolerance shall be included in the 300 mmHg protection budget.",
  ],
  [
    "component_requirement",
    "CMP-05",
    "Release valve flow",
    "The selected valve and exhaust restriction shall meet active and passive release-time allocations at the worst-case cuff volume.",
  ],
  [
    "component_requirement",
    "CMP-06",
    "Stop switch debounce",
    "A stable Stop-switch assertion shall be delivered to the supervisor within 100 ms without multiple-trigger side effects.",
  ],
  [
    "component_requirement",
    "CMP-07",
    "Cuff retention seam",
    "The cuff fabric, bladder seam and hook-and-loop overlap shall retain the applied cuff through the defined inflation sequence at arm-range endpoints.",
  ],
  [
    "component_requirement",
    "CMP-08",
    "LCD numeral geometry",
    "Result numerals shall use the specified 12 mm character height and fixed positions for SYS, DIA and PULSE.",
  ],
  [
    "component_requirement",
    "CMP-09",
    "Journaled record slot",
    "Each record slot shall carry a checksum and commit marker; incomplete slots shall be excluded from recall after restart.",
  ],
  [
    "component_requirement",
    "CMP-10",
    "Profile field in each record",
    "Store the selected profile ID in each record rather than deriving it from the current UI setting.",
  ],
  [
    "component_requirement",
    "CMP-11",
    "Battery divider calibration",
    "Characterize divider and ADC error at the proposed low/start thresholds and include tolerance in the power-state decision.",
  ],
  [
    "component_requirement",
    "CMP-12",
    "Clock validity flag",
    "The clock module shall initialize as unset after loss of backup state and become valid only after explicit clock setup.",
  ],

  [
    "design_output",
    "OUT-01",
    "Pressure acquisition board and calibration spec",
    "Fictional schematic PAB-04 and calibration procedure CAL-02 define the transducer, ADC path and offset/span table format.",
    { artifact: "Example document references only; no CAD files or released drawings exist." },
  ],
  [
    "design_output",
    "OUT-02",
    "Pressure conversion firmware",
    "Module pressure_conversion.c describes sample timing, checksum validation and temperature compensation for the pressure channel.",
  ],
  [
    "design_output",
    "OUT-03",
    "Measurement estimator and quality gate",
    "Module estimate_bp.c describes the oscillometric estimator and invalid-signal output. Algorithm/clinical performance remains unevaluated.",
  ],
  [
    "design_output",
    "OUT-04",
    "Pneumatic assembly drawing",
    "Drawing PNEU-03 describes pump, normally open release valve, tubing and exhaust restriction shared by Stop, power-loss and pressure-control functions.",
  ],
  [
    "design_output",
    "OUT-05",
    "Independent protection schematic",
    "Schematic SAFE-02 describes comparator threshold components and hardwired pump inhibition with release command.",
  ],
  [
    "design_output",
    "OUT-06",
    "Cycle supervisor state machine",
    "Design CYCLE-05 covers preparation, inflation, acquisition, invalid-signal, result, Stop and venting transitions.",
  ],
  [
    "design_output",
    "OUT-07",
    "Cuff pattern and printing artwork",
    "Pattern CUFF-07 defines bladder dimensions, fabric seam, retention overlap and artery/range markings for the proposed adult arm range.",
  ],
  [
    "design_output",
    "OUT-08",
    "LCD and screen specification",
    "UI-06 defines result, retry, recall, selected-profile, unset-time and battery screens; larger numeral layout consumes the lower prompt line.",
  ],
  [
    "design_output",
    "OUT-09",
    "Record-store format",
    "STORE-03 defines profile-specific journaled records, CRC and commit marker, with time validity recorded alongside values.",
  ],
  [
    "design_output",
    "OUT-10",
    "Power supervision circuit and thresholds",
    "PWR-04 describes pump-load assessment, divider calibration and low/unavailable battery thresholds.",
  ],
  [
    "design_output",
    "OUT-11",
    "Quick-start guide draft",
    "QSG-08 illustrates preparation, cuff placement, stopping an attempt, retry behavior, profile recall and the limits of the displayed measurement.",
  ],
  [
    "design_output",
    "OUT-12",
    "Enclosure material and label draft",
    "MECH-02 proposes an enclosure resin and printed label method; cleaning compatibility has not been selected or qualified.",
    { status: "draft; cleaning method unresolved" },
  ],

  [
    "verification_protocol",
    "VER-01",
    "Pressure-channel bench characterization",
    "Use a calibrated pressure reference at defined pressure points and temperatures; compare the complete channel and characterize allocated sensor/conversion errors.",
    {
      acceptance:
        "Assess PRS-02 and SYS-02 separately; draft bench method does not validate clinical BP estimates.",
      method: "Controlled bench comparison; calibration and uncertainty assessment required.",
    },
  ],
  [
    "verification_protocol",
    "VER-02",
    "Sample timing and calibration fault injection",
    "Instrument sample timestamps and inject missing/checksum-invalid calibration tables; assess timing and refusal to start.",
  ],
  [
    "verification_protocol",
    "VER-03",
    "Invalid-signal state tests",
    "Replay specified motion/noise traces and confirm retry presentation plus absence of a newly stored reading; coverage limited to the chosen signal scenarios.",
  ],
  [
    "verification_protocol",
    "VER-04",
    "Cuff fit and retention inspection",
    "Use circumference fixtures at 22, 32 and 42 cm, inspect range markings and retention after the specified inflation sequences; does not establish unaided user success.",
  ],
  [
    "verification_protocol",
    "VER-05",
    "Independent overpressure fault tests",
    "Inject a stalled supervisor and stuck pump command while monitoring reference pressure and protection-channel response; record fault coverage and peak pressure.",
  ],
  [
    "verification_protocol",
    "VER-06",
    "Stop and passive-release timing",
    "At worst-case cuff volume, activate Stop and separately remove power during inflation. Measure time to the stated residual-pressure threshold.",
  ],
  [
    "verification_protocol",
    "VER-07",
    "Display content and geometry inspection",
    "Inspect numeral dimensions and exercise result/error/profile screens against UI-06; photometric readability and intended-user success are outside this protocol.",
  ],
  [
    "verification_protocol",
    "VER-08",
    "Interrupted-write and profile isolation",
    "Interrupt writes at commit stages, restart, and recall both profiles; confirm complete records only and no cross-profile recall.",
  ],
  [
    "verification_protocol",
    "VER-09",
    "Clock reset and unset-time recall",
    "Remove clock backup state, save an example reading and confirm unset-time indication survives storage and recall.",
  ],
  [
    "verification_protocol",
    "VER-10",
    "Battery-load boundary tests",
    "Sweep simulated battery conditions under pump load and confirm low/unavailable thresholds include characterized voltage-measurement error.",
  ],
  [
    "verification_protocol",
    "VER-11",
    "Labeling content inspection",
    "Check the guide against the preparation, retry and Stop requirements; inspection of content does not establish that users understand it.",
  ],
  [
    "verification_protocol",
    "VER-12",
    "Cleaning durability protocol draft",
    "Placeholder for repeated cleaning exposure followed by inspection and function checks; no executable method exists until agent and cycle count are selected.",
    { status: "blocked; no run" },
  ],
  [
    "validation_protocol",
    "VAL-01",
    "Unaided home-use workflow study",
    "Plan representative intended adult users performing preparation, cuff placement, measurement, retry and Stop with representative product and supplied labeling in a simulated home setting.",
    {
      acceptance:
        "Document critical tasks, participants, use errors and root causes. Study plan and acceptance rationale require human-factors review.",
      status: "planned; not executed",
    },
  ],
  [
    "validation_protocol",
    "VAL-02",
    "Result and recall comprehension study",
    "Plan tasks where users distinguish unsuccessful attempts from completed readings, select their profile and identify an unset date before discussing records.",
    { status: "planned; not executed" },
  ],
  [
    "validation_protocol",
    "VAL-03",
    "Readiness and maintenance study",
    "Plan intended-user tasks recognizing battery state and following the finalized cleaning instructions.",
    { status: "blocked by cleaning definition" },
  ],
  [
    "validation_protocol",
    "VAL-04",
    "Clinical performance plan placeholder",
    "Clinical evaluation of estimated BP is a separate planned activity from usability and static pressure calibration. Study approach and applicable standards are unresolved.",
    { status: "outline only; no approval or run" },
  ],

  [
    "test_run",
    "RUN-01",
    "Simulated pressure bench report",
    "SIMULATED: 15–35 °C draft data were within the old pressure-channel target. This invented report has no physical measurements and does not evaluate a subsequently expanded temperature range.",
    {
      outcome: "SIMULATED within old target",
      build: "Fictional prototype A / PAB-04 / pressure_conversion v0.4",
    },
  ],
  [
    "test_run",
    "RUN-02",
    "Simulated calibration fault report",
    "SIMULATED: checksum-invalid and missing calibration tables blocked measurement in the invented test scenarios.",
    { outcome: "SIMULATED pass", build: "Fictional prototype A / firmware v0.4" },
  ],
  [
    "test_run",
    "RUN-03",
    "Simulated invalid-signal report",
    "SIMULATED: excessive-motion examples ended in retry without new records; one low-amplitude scenario is absent from the fixture test set.",
    { outcome: "SIMULATED partial coverage", build: "Fictional estimator v0.3" },
  ],
  [
    "test_run",
    "RUN-04",
    "Simulated cuff fixture inspection",
    "SIMULATED: fixture retention and marks were checked at 22 and 32 cm; the 42 cm fixture was unavailable. Endpoint coverage remains incomplete.",
    { outcome: "SIMULATED incomplete", build: "Fictional cuff CUFF-07 sample A" },
  ],
  [
    "test_run",
    "RUN-05",
    "Simulated protective-channel fault report",
    "SIMULATED: stalled-controller and stuck-pump-command cases triggered the protective response within the draft threshold; other fault combinations are not claimed.",
    { outcome: "SIMULATED pass for listed cases", build: "Fictional SAFE-02 assembly" },
  ],
  [
    "test_run",
    "RUN-06",
    "Simulated release-timing report",
    "SIMULATED: Stop met the draft timing allocation; power-loss release at the largest cuff volume exceeded its allocation and remains unresolved.",
    { outcome: "SIMULATED fail — passive venting", build: "Fictional PNEU-03 assembly" },
  ],
  [
    "test_run",
    "RUN-07",
    "Simulated record persistence report",
    "SIMULATED: interrupted slots were excluded and both profiles retained separate complete records under the scripted examples.",
    { outcome: "SIMULATED pass", build: "Fictional STORE-03 implementation" },
  ],
  [
    "test_run",
    "RUN-08",
    "Simulated display inspection report",
    "SIMULATED: fixed SYS/DIA/PULSE labels and nominal numeral dimensions matched the draft screen drawing. No intended-user readability result is present.",
    { outcome: "SIMULATED drawing inspection only", build: "Fictional UI-06 display" },
  ],

  [
    "risk",
    "RSK-01",
    "Incorrect result mistaken for a valid reading",
    "Pressure-channel or estimation errors may produce a misleading result used in a care discussion.",
    {
      hazardous_situation: "User relies on an inaccurate displayed value.",
      harm: "Inappropriate follow-up or delayed care; example analysis only.",
      residual_review: "Open; requires clinical performance evaluation and full risk review.",
    },
  ],
  [
    "risk",
    "RSK-02",
    "Poor cuff application corrupts measurement",
    "A cuff outside its fit range or misaligned on the arm may produce an unusable or misleading result.",
    { residual_review: "Open; fixture inspection does not resolve use-related risk." },
  ],
  [
    "risk",
    "RSK-03",
    "Sustained cuff pressure",
    "Control or valve failure may leave excessive or prolonged cuff pressure while the user cannot release it normally.",
    {
      harm: "Pain or tissue injury; example risk analysis only.",
      residual_review: "Open; RUN-06 exposes unresolved passive release.",
    },
  ],
  [
    "risk",
    "RSK-04",
    "Another user's reading recalled",
    "An incorrect profile association may cause a user to discuss someone else's readings as their own.",
    {
      residual_review: "Open; software isolation and user comprehension need separate assessment.",
    },
  ],
  [
    "risk",
    "RSK-05",
    "Unsuccessful cycle treated as a reading",
    "A user may mistake stale numbers or an error state for a newly completed measurement.",
    { residual_review: "Open pending intended-user comprehension study." },
  ],
  [
    "risk",
    "RSK-06",
    "Cleaning damages function or labels",
    "An incompatible cleaner may damage the enclosure or erase important labels.",
    { residual_review: "Open; cleaning method and lifetime basis unresolved." },
  ],
  [
    "risk_control",
    "RC-01",
    "Pressure calibration and quality gate",
    "Allocate pressure-channel error, reject calibration faults and suppress results when signal quality is unsuitable; does not replace clinical evaluation.",
  ],
  [
    "risk_control",
    "RC-02",
    "Fit-range markings and preparation guide",
    "Supply cuff geometry, visible range/alignment marks and task instructions; assess both physical fit and user application.",
  ],
  [
    "risk_control",
    "RC-03",
    "Independent pressure protection",
    "Use a hardware protection channel to inhibit the pump and command venting independently of normal firmware.",
  ],
  [
    "risk_control",
    "RC-04",
    "Stop and unpowered vent path",
    "Provide a prioritized Stop transition and normally open passive release path.",
  ],
  [
    "risk_control",
    "RC-05",
    "Profile-specific records and visible selection",
    "Store a profile ID per record and keep current profile visible during recall.",
  ],
  [
    "risk_control",
    "RC-06",
    "Distinct retry and completed-result states",
    "Prevent invalid-result storage and visually distinguish retry instructions from completed measurements.",
  ],
  [
    "risk_control",
    "RC-07",
    "Qualified cleaning materials and method",
    "Select and qualify compatible housing, labels and user cleaning instructions; presently a proposed control.",
  ],

  [
    "dhf_record",
    "DHF-01",
    "Development plan and trace index",
    "Example file index: user needs, PRS, subsystem/component allocations, design outputs, risk records, V&V plans and simulated reports, reviews, changes and transfer preparation. Native links point to records; this is not a complete quality system.",
    { section: "Planning", status: "illustrative" },
  ],
  [
    "dhf_record",
    "DHF-02",
    "Intended use and population assumptions",
    "Records adult home-use assumptions and excluded uses; cuff range and operating band are draft design choices rather than facts obtained from user research.",
    { section: "Inputs" },
  ],
  [
    "dhf_record",
    "DHF-03",
    "Design review — architecture allocations",
    "Fictional review notes: separate static pressure accuracy from clinical estimation; examine independent protection and the shared exhaust path; resolve cleaning and clinical plan before claiming completeness.",
    { section: "Review", status: "open actions" },
  ],
  [
    "dhf_record",
    "DHF-04",
    "Risk-management review draft",
    "Example review calls out incomplete cuff endpoint coverage, failed passive venting and unexecuted usability/clinical studies. No residual-risk acceptance is recorded.",
    { section: "Risk review", status: "open" },
  ],
  [
    "dhf_record",
    "DHF-05",
    "Verification plan index",
    "Lists bench, firmware and inspection protocols plus simulated reports. Missing or incomplete work remains visible through individual traces.",
    { section: "Verification" },
  ],
  [
    "dhf_record",
    "DHF-06",
    "Validation plan index",
    "Separately lists home-use workflow, result comprehension, maintenance and clinical-performance planning; no actual validation is recorded.",
    { section: "Validation", status: "planned" },
  ],
  [
    "dhf_record",
    "DHF-07",
    "Transfer readiness checklist",
    "Example handoff checklist references drawings, calibration and inspection instructions. Clinical evaluation, final cleaning and release-valve correction are open; production release is not recorded.",
    { section: "Transfer", status: "not ready" },
  ],
  [
    "dhf_record",
    "DHF-08",
    "Design-change log",
    "Example changes record an expanded temperature band and a proposed exhaust restriction revision. Linked dependencies show what needs review; no automatic requalification decision is made.",
    { section: "Changes" },
  ],
  [
    "design_change",
    "CHG-01",
    "Expand home operating temperature band",
    "Fictional product review expands the pressure-channel accuracy condition from 15–35 °C to 10–40 °C. Existing bench evidence and allocations were captured before this edit.",
    { disposition: "Input edited; allocations, design and V&V assessment open." },
  ],
  [
    "design_change",
    "CHG-02",
    "Increase passive exhaust flow",
    "Proposed restriction change addresses simulated passive-release failure; review impact on controlled deflation, estimation quality, noise and Stop timing before adopting it.",
    { disposition: "Proposed; output not revised." },
  ],
];

const { links, connect } = exampleLinks();
connect("decomposes_into", "DEV-01", ["UN-01", "UN-02", "UN-03", "UN-04", "UN-05"]);
for (const [need, prs] of [
  ["UN-01", ["PRS-01", "PRS-02", "PRS-03", "PRS-14"]],
  ["UN-02", ["PRS-04", "PRS-05"]],
  ["UN-03", ["PRS-06", "PRS-07", "PRS-08"]],
  ["UN-04", ["PRS-09", "PRS-10", "PRS-11"]],
  ["UN-05", ["PRS-12", "PRS-13"]],
] as const)
  connect("decomposes_into", need, [...prs]);
connect(
  "decomposes_into",
  "UN-01",
  ["PRS-09"],
  "Shared readable-result requirement also contributes to reliable measurement; one canonical record.",
);
for (const [prs, systems] of [
  ["PRS-01", ["SYS-03", "SYS-04", "SYS-09", "SYS-10"]],
  ["PRS-02", ["SYS-01", "SYS-02"]],
  ["PRS-03", ["SYS-03", "SYS-09"]],
  ["PRS-04", ["SYS-05"]],
  ["PRS-05", ["SYS-05", "SYS-14"]],
  ["PRS-06", ["SYS-06", "SYS-08"]],
  ["PRS-07", ["SYS-07", "SYS-08"]],
  ["PRS-08", ["SYS-08"]],
  ["PRS-09", ["SYS-09"]],
  ["PRS-10", ["SYS-10", "SYS-11"]],
  ["PRS-11", ["SYS-10", "SYS-12"]],
  ["PRS-12", ["SYS-13"]],
  ["PRS-13", ["SYS-15"]],
] as const)
  connect("decomposes_into", prs, [...systems]);
for (const [system, components] of [
  ["SYS-01", ["CMP-01", "CMP-03"]],
  ["SYS-02", ["CMP-01", "CMP-02"]],
  ["SYS-05", ["CMP-07"]],
  ["SYS-06", ["CMP-04", "CMP-05"]],
  ["SYS-07", ["CMP-06", "CMP-05"]],
  ["SYS-08", ["CMP-05"]],
  ["SYS-09", ["CMP-08"]],
  ["SYS-10", ["CMP-09", "CMP-10", "CMP-12"]],
  ["SYS-11", ["CMP-10"]],
  ["SYS-12", ["CMP-12"]],
  ["SYS-13", ["CMP-11"]],
] as const)
  connect("decomposes_into", system, [...components]);
for (const [output, allocated] of [
  ["OUT-01", ["SYS-01", "SYS-02", "CMP-01"]],
  ["OUT-02", ["SYS-01", "SYS-02", "CMP-01", "CMP-02", "CMP-03"]],
  ["OUT-03", ["SYS-03"]],
  ["OUT-04", ["SYS-04", "SYS-08", "CMP-05"]],
  ["OUT-05", ["SYS-06", "CMP-04"]],
  ["OUT-06", ["SYS-04", "SYS-07", "CMP-06"]],
  ["OUT-07", ["SYS-05", "CMP-07"]],
  ["OUT-08", ["SYS-09", "SYS-11", "CMP-08"]],
  ["OUT-09", ["SYS-10", "SYS-11", "SYS-12", "CMP-09", "CMP-10", "CMP-12"]],
  ["OUT-10", ["SYS-13", "CMP-11"]],
  ["OUT-11", ["SYS-14"]],
  ["OUT-12", ["SYS-15"]],
] as const)
  for (const requirement of allocated)
    connect(
      "realized_by",
      requirement,
      [output],
      "Allocated design contribution; implementation extent requires review.",
    );
for (const [protocol, records] of [
  ["VER-01", ["PRS-02", "SYS-01", "SYS-02", "OUT-01", "OUT-02"]],
  ["VER-02", ["CMP-01", "CMP-03", "OUT-02"]],
  ["VER-03", ["PRS-01", "PRS-03", "SYS-03", "OUT-03", "OUT-06"]],
  ["VER-04", ["PRS-04", "SYS-05", "CMP-07", "OUT-07"]],
  ["VER-05", ["PRS-06", "SYS-06", "CMP-04", "OUT-05"]],
  ["VER-06", ["PRS-07", "PRS-08", "SYS-07", "SYS-08", "CMP-05", "CMP-06", "OUT-04", "OUT-06"]],
  ["VER-07", ["PRS-09", "SYS-09", "CMP-08", "OUT-08"]],
  ["VER-08", ["PRS-10", "SYS-10", "SYS-11", "CMP-09", "CMP-10", "OUT-09"]],
  ["VER-09", ["PRS-11", "SYS-12", "CMP-12", "OUT-09"]],
  ["VER-10", ["PRS-12", "SYS-13", "CMP-11", "OUT-10"]],
  ["VER-11", ["PRS-05", "SYS-14", "OUT-11"]],
  ["VER-12", ["PRS-13", "SYS-15", "OUT-12"]],
] as const)
  for (const record of records)
    connect(
      "verified_by",
      record,
      [protocol],
      "Defined verification scope only; consult protocol and simulated report for limits.",
    );
for (const [need, protocols] of [
  ["UN-01", ["VAL-01", "VAL-04"]],
  ["UN-02", ["VAL-01"]],
  ["UN-03", ["VAL-01"]],
  ["UN-04", ["VAL-02"]],
  ["UN-05", ["VAL-03"]],
] as const)
  connect(
    "validated_by",
    need,
    [...protocols],
    "Planned intended-use assessment; no executed validation result.",
  );
for (const [protocol, run] of [
  ["VER-01", "RUN-01"],
  ["VER-02", "RUN-02"],
  ["VER-03", "RUN-03"],
  ["VER-04", "RUN-04"],
  ["VER-05", "RUN-05"],
  ["VER-06", "RUN-06"],
  ["VER-08", "RUN-07"],
  ["VER-07", "RUN-08"],
] as const)
  connect(
    "executed_as",
    protocol,
    [run],
    "Invented execution record for UI exploration; no device was tested.",
  );
for (const [risk, controls] of [
  ["RSK-01", ["RC-01"]],
  ["RSK-02", ["RC-02"]],
  ["RSK-03", ["RC-03", "RC-04"]],
  ["RSK-04", ["RC-05"]],
  ["RSK-05", ["RC-06"]],
  ["RSK-06", ["RC-07"]],
] as const)
  connect(
    "mitigated_by",
    risk,
    [...controls],
    "Proposed controls; link does not establish effectiveness or residual-risk acceptance.",
  );
for (const [control, inputs] of [
  ["RC-01", ["PRS-02", "PRS-03", "PRS-14"]],
  ["RC-02", ["PRS-04", "PRS-05"]],
  ["RC-03", ["PRS-06"]],
  ["RC-04", ["PRS-07", "PRS-08"]],
  ["RC-05", ["PRS-10"]],
  ["RC-06", ["PRS-01", "PRS-03", "PRS-09"]],
  ["RC-07", ["PRS-13"]],
] as const)
  connect("specified_by", control, [...inputs]);
connect(
  "depends_on",
  "OUT-03",
  ["OUT-01", "OUT-02", "OUT-04"],
  "Estimator depends on calibrated acquisition and the pressure-deflation profile.",
);
connect(
  "depends_on",
  "OUT-06",
  ["OUT-04", "OUT-05"],
  "Supervisor shares pneumatic hardware with the independent protection path.",
);
connect("contains", "DEV-01", [
  "DHF-01",
  "DHF-02",
  "DHF-03",
  "DHF-04",
  "DHF-05",
  "DHF-06",
  "DHF-07",
  "DHF-08",
]);
connect("references", "DHF-01", ["UN-01", "PRS-01", "RSK-01", "DHF-05", "DHF-06"]);
connect("references", "DHF-02", ["DEV-01", "UN-02", "PRS-04", "PRS-14"]);
connect("references", "DHF-03", ["PRS-02", "SYS-02", "OUT-04", "RSK-03"]);
connect("references", "DHF-04", ["RSK-01", "RSK-02", "RSK-03", "RSK-04", "RSK-05", "RSK-06"]);
connect("references", "DHF-05", ["VER-01", "VER-04", "VER-06", "VER-12"]);
connect("references", "DHF-06", ["VAL-01", "VAL-02", "VAL-03", "VAL-04"]);
connect("references", "DHF-07", ["OUT-01", "OUT-04", "OUT-07", "OUT-11", "RUN-06"]);
connect("references", "DHF-08", ["CHG-01", "CHG-02"]);
connect("affects", "CHG-01", ["PRS-02", "SYS-02", "CMP-02", "OUT-02", "VER-01", "RUN-01"]);
connect("affects", "CHG-02", [
  "OUT-04",
  "SYS-04",
  "SYS-08",
  "CMP-05",
  "OUT-03",
  "VER-06",
  "RSK-03",
]);

export const medicalDeviceExample: ExampleDefinition = {
  title: "Aster Home BP — fictional design-and-development file",
  description:
    "Aster Home BP is a fictional home blood-pressure monitor. Follow user needs through product and subsystem requirements, design outputs, risk controls and captured verification/validation evidence. All targets and outcomes are invented; no clinical, usability or physical testing was performed.",
  sources: [
    {
      title: "FDA QMSR design and development training",
      url: "https://www.fda.gov/media/189041/download",
      use: "Workflow grounding: inputs, outputs, risk, review, separate verification and validation, transfer, changes and file indexing (pages 13–31). Device details and thresholds are fictional.",
    },
    {
      title: "FDA QMSR",
      url: "https://www.fda.gov/medical-devices/postmarket-requirements-devices/quality-management-system-regulation-qmsr",
      use: "Current terminology and February 2, 2026 effective date; not a compliance assessment.",
    },
    {
      title: "FDA applying human factors and usability engineering",
      url: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/applying-human-factors-and-usability-engineering-medical-devices",
      use: "Intended-user, task and use-environment framing; study content here is an invented outline.",
    },
  ],
  schema: exampleSchema(
    {
      device: ["intended_use"],
      user_need: [],
      product_requirement: ["acceptance"],
      subsystem_requirement: [],
      component_requirement: [],
      design_output: ["artifact"],
      verification_protocol: ["acceptance", "method"],
      validation_protocol: ["acceptance", "method"],
      test_run: ["outcome", "build"],
      risk: ["hazardous_situation", "harm", "residual_review"],
      risk_control: [],
      dhf_record: ["section"],
      design_change: ["disposition"],
    },
    {
      decomposes_into: [
        ["device", "user_need", "product_requirement", "subsystem_requirement"],
        ["user_need", ...requirements],
      ],
      realized_by: [requirements, ["design_output"]],
      verified_by: [[...requirements, "design_output"], ["verification_protocol"]],
      validated_by: [["user_need"], ["validation_protocol"]],
      executed_as: [["verification_protocol", "validation_protocol"], ["test_run"]],
      mitigated_by: [["risk"], ["risk_control"]],
      specified_by: [["risk_control"], ["product_requirement"]],
      depends_on: [["design_output"], ["design_output"]],
      contains: [["device"], ["dhf_record"]],
      references: [
        ["dhf_record"],
        [
          "device",
          "user_need",
          ...requirements,
          "design_output",
          "risk",
          "verification_protocol",
          "validation_protocol",
          "test_run",
          "dhf_record",
          "design_change",
        ],
      ],
      affects: [
        ["design_change"],
        [...requirements, "design_output", "verification_protocol", "test_run", "risk"],
      ],
    },
  ),
  items,
  links,
  receipts: [
    {
      output: "RUN-01",
      inputs: ["VER-01", "PRS-02", "SYS-02", "OUT-01", "OUT-02"],
      outcome: "SIMULATED within old target; not clinical validation",
    },
    {
      output: "RUN-02",
      inputs: ["VER-02", "CMP-01", "CMP-03", "OUT-02"],
      outcome: "SIMULATED pass; native fixture only",
    },
    {
      output: "RUN-03",
      inputs: ["VER-03", "PRS-03", "OUT-03"],
      outcome: "SIMULATED partial signal-scenario coverage",
    },
    {
      output: "RUN-04",
      inputs: ["VER-04", "PRS-04", "OUT-07"],
      outcome: "SIMULATED incomplete; 42 cm endpoint absent",
    },
    {
      output: "RUN-05",
      inputs: ["VER-05", "PRS-06", "OUT-05"],
      outcome: "SIMULATED pass for listed fault cases",
    },
    {
      output: "RUN-06",
      inputs: ["VER-06", "PRS-07", "PRS-08", "OUT-04"],
      outcome: "SIMULATED fail; passive release unresolved",
    },
    {
      output: "RUN-07",
      inputs: ["VER-08", "PRS-10", "OUT-09"],
      outcome: "SIMULATED pass; native fixture only",
    },
    {
      output: "RUN-08",
      inputs: ["VER-07", "PRS-09", "OUT-08"],
      outcome: "SIMULATED inspection only; no user validation",
    },
  ],
  changes: [
    {
      key: "PRS-02",
      statement:
        "The static cuff-pressure channel shall have error no greater than ±3 mmHg over 0–300 mmHg at 10–40 °C. Expanded operating band requires review of earlier allocations, compensation design and bench evidence.",
      reason:
        "CHG-01: expand draft home operating temperature band; retain earlier evidence and mapping versions.",
    },
  ],
  tasks: [
    {
      title: "Start at intended use and compare user needs",
      root: "DEV-01",
      relationship: "decomposes_into",
      inspect: ["UN-01", "UN-02", "UN-03", "UN-04", "UN-05"],
      explanation:
        "Select a need, choose Show relationships for that item, then its outgoing decomposes into scope. Repeat down PRS, subsystem and component levels. Compare siblings in Relationships and Reading.",
    },
    {
      title: "Accuracy allocation and changed evidence",
      root: "PRS-02",
      relationship: "decomposes_into",
      inspect: ["SYS-01", "SYS-02", "CMP-01", "CMP-02", "RUN-01"],
      explanation:
        "Compare acquisition and error-budget siblings. PRS-02 is v2; the old bench receipt captured v1 and compares as changed. Other current inputs do not make the old result sufficient.",
    },
    {
      title: "Shared release path and failure",
      presentation: {
        layout: "trace",
        columns: [
          { relationshipType: "realized_by", targetType: "design_output", direction: "outgoing" },
          {
            relationshipType: "verified_by",
            targetType: "verification_protocol",
            direction: "outgoing",
          },
        ],
      },
      root: "CMP-05",
      relationship: "decomposes_into",
      direction: "incoming",
      inspect: ["SYS-06", "SYS-07", "SYS-08", "OUT-04", "VER-06", "RUN-06"],
      explanation:
        "One component belongs to three allocations. Follow the shared pneumatic drawing to the simulated failed run; inspect CHG-02 for explicit cross-discipline impact links.",
    },
    {
      title: "Risk to control to requirement",
      root: "RSK-03",
      relationship: "mitigated_by",
      inspect: ["RC-03", "RC-04", "PRS-06", "PRS-07", "PRS-08"],
      explanation:
        "Independent protection and Stop/passive venting are sibling controls with different design and test traces; no residual-risk acceptance is recorded.",
    },
    {
      title: "Separate validation from verification",
      root: "UN-02",
      relationship: "validated_by",
      inspect: ["VAL-01", "VER-04", "RUN-04"],
      explanation:
        "Cuff fixture inspection is incomplete and is not unaided-use validation. The planned user study has no execution link or receipt.",
    },
    {
      title: "Find unresolved work",
      root: "UN-05",
      relationship: "decomposes_into",
      inspect: ["PRS-12", "PRS-13", "VER-10", "VER-12"],
      explanation:
        "Battery tests have a definition but no run; cleaning lacks executable acceptance criteria. PRS-14 elsewhere has no subsystem breakdown or linked executable clinical verification protocol.",
    },
    {
      title: "Browse the development-file index",
      root: "DEV-01",
      relationship: "contains",
      inspect: ["DHF-03", "DHF-04", "DHF-05", "DHF-06", "DHF-07", "DHF-08"],
      explanation:
        "Planning, reviews, V&V, transfer and change records reference the same canonical engineering items instead of copies.",
    },
  ],
  chains: [
    {
      title: "Eight-column need-to-result trace",
      query: {
        type: "device",
        search: "DEV-01",
        steps: [
          { type: "user_need", relationshipType: "decomposes_into" },
          { type: "product_requirement", relationshipType: "decomposes_into" },
          { type: "subsystem_requirement", relationshipType: "decomposes_into" },
          { type: "component_requirement", relationshipType: "decomposes_into" },
          { type: "design_output", relationshipType: "realized_by" },
          { type: "verification_protocol", relationshipType: "verified_by" },
          { type: "test_run", relationshipType: "executed_as" },
        ],
      },
    },
  ],
};
