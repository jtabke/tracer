(() => {
  function nodes(data, narrow) {
    const layout = [
      ["product", "Product", 20, 30, 10, 14],
      ["goal", "Goal", 200, 30, 182, 14],
      ["target", "Target", 380, 30, 182, 154],
      ["function", "Function", 560, 30, 182, 294],
      ["requirement", "Requirement", 740, 30, 182, 434],
      ["design", "Design", 740, 180, 182, 574],
      ["evaluation", "Evaluation", 380, 180, 10, 574],
      ["evaluation_configuration", "Evaluation inputs", 20, 180, 10, 714],
    ];
    return layout.map(([key, label, x, y, phoneX, phoneY]) => ({
      key,
      label,
      x: narrow ? phoneX : x,
      y: narrow ? phoneY : y,
      kind: key === "evaluation" ? "verification" : "normal",
      count: data.entities.filter((item) => item.type === key).length,
    }));
  }
  function intentEdges(narrow) {
    const routes = [
      ["product", "goal", "has_goal", "has goal", "M148 60 H200", "M138 44 H182", 174, 160, 14, 12],
      [
        "goal",
        "target",
        "has_target",
        "has target",
        "M328 60 H380",
        "M246 74 V154",
        354,
        205,
        14,
        116,
      ],
      [
        "target",
        "function",
        "allocated_to_function",
        "allocates to",
        "M508 60 H560",
        "M246 214 V294",
        534,
        204,
        14,
        256,
      ],
      [
        "function",
        "requirement",
        "specified_by_requirement",
        "specified by",
        "M688 60 H740",
        "M246 354 V434",
        714,
        204,
        14,
        396,
      ],
      [
        "requirement",
        "design",
        "realized_by",
        "realized by",
        "M804 90 V180",
        "M246 494 V574",
        846,
        204,
        138,
        536,
      ],
    ];
    return routes.map((route) => routeEdge(route, narrow, "hierarchy"));
  }
  function evidenceEdges(narrow) {
    const routes = [
      [
        "target",
        "evaluation",
        "evaluated_by",
        "target criteria",
        "M444 90 V180",
        "M182 184 H154 V554 H74 V574",
        396,
        96,
        143,
        266,
      ],
      [
        "requirement",
        "evaluation",
        "evaluated_by",
        "requirement criteria",
        "M804 90 V126 H444 V180",
        "M182 464 H166 V554 H106 V574",
        620,
        91,
        116,
        474,
      ],
      [
        "evaluation",
        "design",
        "examines_design",
        "examines design",
        "M508 210 H740",
        "M138 604 H154 V662 H246 V634",
        624,
        224,
        199,
        683,
      ],
      [
        "evaluation",
        "evaluation_configuration",
        "evaluated_configuration",
        "uses inputs",
        "M380 210 H148",
        "M74 634 V714",
        264,
        112,
        199,
        687,
      ],
    ];
    return routes.map((route) => routeEdge(route, narrow, "verification"));
  }
  function routeEdge(route, narrow, kind) {
    const [source, target, relationship, label, widePath, phonePath, wideX, phoneX, wideY, phoneY] =
      route;
    return {
      source,
      target,
      relationship,
      label,
      kind,
      path: narrow ? phonePath : widePath,
      x: narrow ? phoneX : wideX,
      y: narrow ? phoneY : wideY,
    };
  }
  window.tracerOrbitOverview = (data, narrow) => ({
    width: narrow ? 320 : 1000,
    height: narrow ? 800 : 300,
    totalTypeCount: Object.keys(data.schema.entityTypes).length,
    nodes: nodes(data, narrow),
    edges: [...intentEdges(narrow), ...evidenceEdges(narrow)],
    legend:
      "Intent and evaluation model. Architecture, discovery and change/release are available in Project model. Evaluation links describe scope; receipts record outcomes.",
  });
})();
