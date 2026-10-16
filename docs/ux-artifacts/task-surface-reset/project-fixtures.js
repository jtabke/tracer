(() => {
  const profiles = {
    aster: {
      key: "aster-clean-v1",
      file: "medical-clean-data.json",
      name: "Aster Home BP",
      description:
        "Adult home upper-arm blood-pressure monitor traced from user needs through design and recorded verification.",
      anchor: "DEV-01",
      selection: "UN-02",
      relationship: "has_user_need",
      direction: "outgoing",
      implementation: "implemented_by",
      implementationTypes: [
        "user_need",
        "product_requirement",
        "subsystem_requirement",
        "component_requirement",
      ],
      hierarchy: ["addressed_by_requirement", "allocated_to_subsystem", "allocated_to_component"],
      criteria: ["verified_by", "validated_by"],
      article: "examines_output",
      execution: "produces_result",
      plans: ["verification_protocol", "validation_protocol"],
      context: "protocol",
      inheritedEvidence: "verification",
      resultsLabel: "Verification results",
      resultsDescription: "verification receipts · no validation runs",
    },
    orbit: {
      key: "orbit-clean-v1",
      file: "orbit-clean-data.json",
      name: "Orbit R1",
      description:
        "Robot vacuum development across mechanics, electronics, embedded control, navigation and the companion app.",
      anchor: "DES-01",
      selection: "REQ-R03",
      relationship: "realized_by",
      direction: "incoming",
      implementation: "realized_by",
      implementationTypes: ["product", "goal", "target", "function", "requirement"],
      hierarchy: ["has_goal", "has_target", "allocated_to_function", "specified_by_requirement"],
      criteria: ["evaluated_by"],
      article: "examines_design",
      execution: "",
      plans: ["evaluation"],
      context: "evaluation",
      inheritedEvidence: "evaluation results",
      resultsLabel: "Captured results",
      resultsDescription: "recorded evaluation outcomes",
    },
  };
  window.tracerProject = profiles[document.body.dataset.project];
})();
