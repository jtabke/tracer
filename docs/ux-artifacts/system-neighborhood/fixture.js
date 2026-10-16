globalThis.TRACER_TOY_FIXTURE = {
  label: "Fictional bench model — not a medical-device specification",
  parents: ["SYS-DEL", "SYS-STOP"],
  items: [
    {
      id: "SYS-DEL",
      kind: "System intent",
      title: "Deliver the commanded volume",
      version: "v2",
      statement:
        "The bench demonstrator shall deliver the commanded volume within the declared bench-test tolerance across the specified operating range.",
      note: "Tolerance and operating range are deliberately unspecified. This is not a clinical requirement.",
    },
    {
      id: "SYS-STOP",
      kind: "System intent",
      title: "Stop motion on a drive fault",
      version: "v1",
      statement:
        "When a declared drive fault is detected, the bench demonstrator shall stop commanded motion and indicate the fault until the operator acknowledges it.",
      note: "Fault definitions and acceptable stopping behavior need engineering agreement.",
    },
    {
      id: "SW-MOTION",
      kind: "Software",
      title: "Translate a delivery request into motion",
      version: "v2",
      statement:
        "For each accepted delivery request, the controller shall translate the commanded volume into a motion sequence using the selected transmission calibration and report when the sequence finishes.",
    },
    {
      id: "SW-LIMIT",
      kind: "Software",
      title: "Handle the configured motor-command limit",
      version: "v3",
      statement:
        "When a motor command reaches the configured command limit, the controller shall stop issuing motion commands immediately and report a limit event.",
      note: "Toy proposal: ramp down commanded motion before reporting the limit event. This changes behavior, not system intent.",
    },
    {
      id: "DRV-CFG",
      kind: "Drive / interface",
      title: "Define the drive command contract",
      version: "v2",
      statement:
        "The drive configuration shall define the command limit, the meaning of a limit event, and the response expected when the controller stops issuing motion commands.",
      note: "Does a ramp-down sequence still match this contract? That is a question, not a computed violation.",
    },
    {
      id: "MECH-TRANS",
      kind: "Mechanical",
      title: "Transfer commanded motion to the bench load",
      version: "v4",
      statement:
        "The transmission shall convert the specified motor motion into load displacement using the declared calibration, accounting for the direction of travel and the declared mechanical operating range.",
      note: "A different stopping sequence might affect load displacement; the relationship alone does not establish that it will.",
    },
    {
      id: "MECH-BACKLASH",
      kind: "Mechanical",
      title: "Characterize direction-reversal effects",
      version: "v1",
      statement:
        "The bench characterization shall identify direction-reversal effects on load displacement and record the operating conditions under which they were observed.",
      note: "Existing information, not yet connected to either system intent. Decide whether a relationship is justified before adding one.",
    },
    {
      id: "SW-FAULT",
      kind: "Software",
      title: "Latch and acknowledge the drive fault",
      version: "v1",
      statement:
        "After a declared drive fault, the controller shall retain the fault indication and reject a new motion request until acknowledgement is received.",
    },
    {
      id: "IF-FAULT",
      kind: "Drive / interface",
      title: "Define the fault indication interface",
      version: "v1",
      statement:
        "The drive interface shall distinguish a configured-limit event from other drive faults and communicate the reason for commanded motion stopping.",
      note: "Unresolved question: should a configured-limit event be treated as a drive fault? No link is asserted.",
    },
    {
      id: "TEST-VOLUME",
      kind: "Evidence",
      title: "Bench displacement observation",
      version: "record 1",
      statement:
        "A bench observation recorded load displacement for the original command sequence using the selected calibration. No passing result or applicability to the proposed sequence is asserted.",
      inputs: ["SW-MOTION", "MECH-TRANS"],
    },
    {
      id: "TEST-STOP",
      kind: "Evidence",
      title: "Original limit-event sequence capture",
      version: "record 1",
      statement:
        "The original observation captured the immediate-stop command sequence and its reported limit event. It did not observe a ramp-down sequence.",
      inputs: ["SW-LIMIT", "DRV-CFG"],
    },
    {
      id: "TEST-FAULT",
      kind: "Evidence",
      title: "Fault acknowledgement observation",
      version: "record 1",
      statement:
        "An observation recorded the fault indication and rejection of a subsequent request before acknowledgement. Its applicability to a changed stopping policy remains unknown.",
      inputs: ["SW-FAULT", "IF-FAULT"],
    },
  ],
  links: [
    {
      from: "SYS-DEL",
      to: "SW-MOTION",
      meaning: "addressed by",
    },
    {
      from: "SYS-DEL",
      to: "SW-LIMIT",
      meaning: "constrained by",
    },
    {
      from: "SYS-DEL",
      to: "DRV-CFG",
      meaning: "addressed by",
    },
    {
      from: "SYS-DEL",
      to: "MECH-TRANS",
      meaning: "addressed by",
    },
    {
      from: "SYS-STOP",
      to: "SW-LIMIT",
      meaning: "constrained by",
    },
    {
      from: "SYS-STOP",
      to: "SW-FAULT",
      meaning: "addressed by",
    },
    {
      from: "SYS-STOP",
      to: "IF-FAULT",
      meaning: "addressed by",
    },
    {
      from: "SW-MOTION",
      to: "TEST-VOLUME",
      meaning: "observation recorded for",
    },
    {
      from: "MECH-TRANS",
      to: "TEST-VOLUME",
      meaning: "observation recorded for",
    },
    {
      from: "SW-LIMIT",
      to: "DRV-CFG",
      meaning: "uses command contract",
    },
    {
      from: "SW-LIMIT",
      to: "TEST-STOP",
      meaning: "observation recorded for",
    },
    {
      from: "DRV-CFG",
      to: "TEST-STOP",
      meaning: "observation recorded for",
    },
    {
      from: "SW-FAULT",
      to: "TEST-FAULT",
      meaning: "observation recorded for",
    },
    {
      from: "IF-FAULT",
      to: "TEST-FAULT",
      meaning: "observation recorded for",
    },
  ],
  proposal:
    "When a motor command reaches the configured command limit, the controller shall ramp down commanded motion before reporting a limit event.",
  unmodeled:
    "Whether a limit event is a drive fault is unresolved. Missing relationships do not establish no impact.",
};
