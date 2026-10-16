(() => {
  const controllers = new WeakMap();
  const nodeWidth = 160,
    nodeHeight = 72;
  const fieldTypes = ["string", "number", "boolean", "json"];
  const verificationTypes = ["verification_protocol", "test_scenario", "test_run", "evaluation"];
  const relationshipCategories = Object.fromEntries(
    [
      [
        "design",
        [
          "has_user_need",
          "addressed_by_requirement",
          "allocated_to_subsystem",
          "allocated_to_component",
          "implemented_by",
          "decomposes_into",
          "realized_by",
          "has_goal",
          "has_target",
          "allocated_to_function",
          "specified_by_requirement",
          "contains",
          "defines",
          "provides",
          "consumes",
          "depends_on",
        ],
      ],
      ["risk", ["controlled_by", "specified_as_requirement", "mitigated_by", "specified_by"]],
      ["change", ["requires_review_of", "affects", "release_considers"]],
      [
        "evidence",
        [
          "includes_input",
          "investigated_by",
          "evaluated_by",
          "examines_design",
          "finding_from",
          "evaluated_configuration",
          "configuration_includes",
        ],
      ],
    ].flatMap(([category, keys]) => keys.map((key) => [key, category])),
  );
  const coreRelationshipLabels = {
    has_user_need: "has need",
    addressed_by_requirement: "addressed by",
    allocated_to_subsystem: "allocates to subsystem",
    allocated_to_component: "allocates to component",
    implemented_by: "implemented by",
    verified_by: "verified by",
    examines_output: "examined by",
    validated_by: "validated by",
    produces_result: "produces result",
    has_goal: "has goal",
    has_target: "has target",
    allocated_to_function: "allocates to function",
    specified_by_requirement: "specified by requirement",
    realized_by: "realized by",
    consumes: "consumed by",
    considers: "informs decision",
    explores: "explored by",
    investigated_by: "investigated by",
    evaluated_by: "evaluated by",
    examines_design: "examined by",
    finding_from: "produces finding",
    configuration_includes: "included in configuration",
    evaluated_configuration: "evaluated by",
    requires_review_of: "requires review of",
    release_considers: "informs release",
  };
  const topRowCoreRelationships = new Set([
    "has_user_need",
    "addressed_by_requirement",
    "allocated_to_subsystem",
    "allocated_to_component",
    "has_goal",
    "has_target",
    "allocated_to_function",
    "specified_by_requirement",
  ]);
  const portraitFamilyLanes = {
    implemented_by: 130,
    verified_by: 160,
    evaluated_by: 174,
    examines_design: 180,
    configuration_includes: 186,
    requires_review_of: 174,
    release_considers: 186,
  };
  const orbitRelationshipLabelStrategies = {
    wide: {
      provides: "above",
      consumes: "below",
      explores: "above",
      configuration_includes: "configuration-above",
      requires_review_of: "below",
      release_considers: "above",
    },
    portrait: {
      provides: "above",
      consumes: "below",
      explores: "above",
      evaluated_by: "evaluation-above",
      configuration_includes: "configuration-above",
      evaluated_configuration: "below",
      requires_review_of: "review-above",
      release_considers: "above",
    },
  };
  const orbitLabelPositions = {
    natural: (_state, geometry) => geometry,
    above: (_state, geometry, points) => ({
      x: geometry.x,
      y: Math.min(...points.map((point) => point.y)) - 10,
    }),
    below: (_state, geometry, points) => ({
      x: geometry.x,
      y: Math.max(...points.map((point) => point.y + nodeHeight)) + 18,
    }),
    "configuration-above": (state, geometry) => ({
      x: state.layouts[mode()].evaluation_configuration.x + nodeWidth / 2,
      y: state.layouts[mode()].evaluation_configuration.y - 20,
    }),
    "evaluation-above": (state, geometry) => ({
      x: state.layouts[mode()].evaluation.x + nodeWidth / 2,
      y: state.layouts[mode()].evaluation.y - 20,
    }),
    "review-above": (state) => ({
      x: state.layouts[mode()].change_assessment.x + nodeWidth / 2,
      y: state.layouts[mode()].change_assessment.y - 10,
    }),
  };
  const portrait = matchMedia("(max-width: 720px)");

  function html(value = "") {
    return String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
    );
  }

  function words(value) {
    return String(value).replaceAll("_", " ");
  }

  function clone(value) {
    return structuredClone(value);
  }

  function mode() {
    return portrait.matches ? "portrait" : "wide";
  }

  function dimensions(state) {
    const points = Object.values(state.layouts[mode()] ?? {});
    const width = Math.max(...points.map((point) => point.x + nodeWidth + 80), 0);
    const height = Math.max(...points.map((point) => point.y + nodeHeight + 80), 0);
    return portrait.matches
      ? { width: Math.max(360, width), height: Math.max(760, height) }
      : { width: Math.max(1160, width), height: Math.max(760, height) };
  }

  function positions(schema, narrow) {
    const preset = presetPositions(schema, narrow);
    if (preset) return extendPositions(schema, preset, narrow);
    const columns = narrow ? 2 : 5,
      step = narrow ? 178 : 216;
    return Object.fromEntries(
      Object.keys(schema.entityTypes).map((key, index) => [
        key,
        { x: 12 + (index % columns) * step, y: 34 + Math.floor(index / columns) * 142 },
      ]),
    );
  }
  function presetPositions(schema, narrow) {
    if (Object.hasOwn(schema.entityTypes, "product_requirement")) return medicalPositions(narrow);
    if (isCleanOrbitSchema(schema)) return cleanOrbitPositions(narrow);
    if (Object.hasOwn(schema.entityTypes, "evaluation")) return orbitPositions(narrow);
    return null;
  }
  function medicalPositions(narrow) {
    if (narrow)
      return pointMap({
        device: [10, 20],
        user_need: [190, 20],
        validation_protocol: [10, 150],
        product_requirement: [190, 150],
        risk: [10, 280],
        subsystem_requirement: [190, 280],
        risk_control: [10, 410],
        component_requirement: [190, 410],
        design_change: [10, 540],
        design_output: [190, 540],
        evaluation_configuration: [10, 670],
        build_configuration: [10, 670],
        verification_protocol: [190, 670],
        test_run: [100, 800],
      });
    return pointMap({
      device: [20, 40],
      user_need: [210, 40],
      product_requirement: [400, 40],
      subsystem_requirement: [590, 40],
      component_requirement: [780, 40],
      validation_protocol: [210, 240],
      design_output: [780, 210],
      verification_protocol: [590, 360],
      test_run: [400, 520],
      risk: [20, 240],
      risk_control: [210, 390],
      design_change: [20, 520],
      evaluation_configuration: [780, 520],
      build_configuration: [780, 520],
    });
  }
  function orbitPositions(narrow) {
    if (narrow)
      return rowPositions([
        ["product", "goal"],
        ["concept", "target"],
        ["experiment", "function"],
        ["finding", "requirement"],
        ["decision", "design"],
        ["evaluation", "component"],
        ["change_assessment", "interface"],
        ["build_configuration", "release"],
      ]);
    return pointMap({
      product: [20, 30],
      goal: [200, 30],
      target: [380, 30],
      function: [560, 30],
      requirement: [740, 30],
      design: [650, 180],
      component: [850, 180],
      interface: [950, 300],
      evaluation: [560, 360],
      concept: [20, 360],
      experiment: [200, 360],
      finding: [380, 360],
      decision: [200, 520],
      change_assessment: [560, 520],
      build_configuration: [740, 520],
      release: [950, 520],
    });
  }
  function cleanOrbitPositions(narrow) {
    if (narrow)
      return rowPositions([
        ["product", "goal"],
        ["target", "function"],
        ["requirement", "design"],
        ["component", "interface"],
        ["concept", "experiment"],
        ["finding", "decision"],
        ["evaluation", "evaluation_configuration"],
        ["change_assessment", "release"],
      ]);
    return pointMap({
      product: [20, 40],
      goal: [210, 40],
      target: [400, 40],
      function: [590, 40],
      requirement: [780, 40],
      design: [590, 210],
      component: [210, 240],
      interface: [20, 240],
      concept: [20, 400],
      experiment: [210, 400],
      evaluation: [780, 540],
      finding: [780, 680],
      decision: [210, 680],
      change_assessment: [590, 540],
      release: [400, 680],
      evaluation_configuration: [400, 540],
    });
  }
  function pointMap(points) {
    return Object.fromEntries(Object.entries(points).map(([key, [x, y]]) => [key, { x, y }]));
  }
  function rowPositions(rows) {
    return Object.fromEntries(
      rows.flatMap((row, y) =>
        row.flatMap((key, x) => (key ? [[key, { x: 10 + x * 180, y: 20 + y * 130 }]] : [])),
      ),
    );
  }
  function extendPositions(schema, preset, narrow) {
    const result = Object.fromEntries(
      Object.keys(schema.entityTypes)
        .filter((key) => preset[key])
        .map((key) => [key, preset[key]]),
    );
    const missing = Object.keys(schema.entityTypes).filter((key) => !preset[key]);
    const bottom = Math.max(0, ...Object.values(result).map((point) => point.y)) + 142,
      columns = narrow ? 2 : 5;
    missing.forEach((key, index) => {
      result[key] = {
        x: 12 + (index % columns) * (narrow ? 178 : 216),
        y: bottom + Math.floor(index / columns) * 142,
      };
    });
    return result;
  }

  function makeState(schema, saved) {
    if (saved?.draft) return normalizeState(clone(saved));
    return initialState(schema);
  }

  function initialState(schema) {
    const layouts = { wide: positions(schema, false), portrait: positions(schema, true) };
    return {
      base: clone(schema),
      draft: clone(schema),
      layouts,
      savedLayouts: clone(layouts),
      cameras: { wide: null, portrait: null },
      savedCameras: { wide: null, portrait: null },
      endpointModes: {},
      pendingFields: {},
      view: defaultView(schema),
      selection: emptySelection(),
      form: null,
      dirty: false,
      notice: "",
      error: "",
    };
  }

  function defaultView(schema) {
    return supportsViews(schema) ? "development" : "all";
  }

  function normalizeState(state) {
    const defaults = {
      form: null,
      notice: "",
      error: "",
      savedCameras: clone(state.cameras),
      endpointModes: {},
      pendingFields: {},
      view: defaultView(state.draft),
      selection: emptySelection(),
    };
    Object.entries(defaults).forEach(([key, value]) => stateDefault(state, key, value));
    return state;
  }
  function stateDefault(state, key, value) {
    if (state[key] == null) state[key] = value;
  }

  function emptySelection() {
    return { kind: "none", key: "" };
  }

  function define(object, key, value) {
    Object.defineProperty(object, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  function names(state) {
    return Object.keys(state.draft.entityTypes);
  }

  function isMedicalSchema(schema) {
    return Object.hasOwn(schema.entityTypes, "product_requirement");
  }

  function isCleanOrbitSchema(schema) {
    const entities = schema.entityTypes ?? {};
    const relationships = schema.relationshipTypes ?? {};
    return (
      [
        "product",
        "goal",
        "target",
        "function",
        "requirement",
        "design",
        "component",
        "interface",
        "evaluation_configuration",
        "evaluation",
        "release",
      ].every((key) => Object.hasOwn(entities, key)) &&
      ["has_goal", "has_target", "allocated_to_function", "specified_by_requirement"].every((key) =>
        Object.hasOwn(relationships, key),
      )
    );
  }

  function supportsViews(schema) {
    return isMedicalSchema(schema) || isCleanOrbitSchema(schema);
  }

  function medicalViews(state) {
    const relationshipSets = {
      development: [
        "has_user_need",
        "addressed_by_requirement",
        "allocated_to_subsystem",
        "allocated_to_component",
        "implemented_by",
        "verified_by",
        "examines_output",
        "validated_by",
        "produces_result",
        "decomposes_into",
        "realized_by",
        "executed_as",
      ],
      risk: ["controlled_by", "specified_as_requirement", "mitigated_by", "specified_by"],
      changes: ["requires_review_of", "affects"],
      evaluation: ["includes_input", "evaluated_configuration", "configuration_includes"],
    };
    const coreTypes = [
      "device",
      "user_need",
      "product_requirement",
      "subsystem_requirement",
      "component_requirement",
      "design_output",
      "verification_protocol",
      "validation_protocol",
      "test_run",
    ];
    const relationshipTypes = Object.keys(state.draft.relationshipTypes);
    const view = (key, label, typeKeys, relationshipKeys) => ({
      key,
      label,
      types: typeKeys.filter((type) => names(state).includes(type)),
      relationships: relationshipKeys.filter((relationship) =>
        relationshipTypes.includes(relationship),
      ),
    });
    const riskTypes = endpointTypes(state, relationshipSets.risk);
    const changeTypes = endpointTypes(state, relationshipSets.changes);
    const evaluationTypes = endpointTypes(state, relationshipSets.evaluation);
    return [
      view("development", "Development", coreTypes, relationshipSets.development),
      view("risk", "Risk", riskTypes, relationshipSets.risk),
      view("changes", "Changes", changeTypes, relationshipSets.changes),
      view("evaluation", "Evaluation inputs", evaluationTypes, relationshipSets.evaluation),
      view("all", "All definitions", names(state), relationshipTypes),
    ];
  }

  function orbitViews(state) {
    const relationshipSets = {
      development: [
        "has_goal",
        "has_target",
        "allocated_to_function",
        "specified_by_requirement",
        "realized_by",
      ],
      architecture: ["contains", "defines", "provides", "consumes", "depends_on"],
      discovery: ["considers", "explores", "investigated_by", "finding_from"],
      evaluation: [
        "evaluated_by",
        "examines_design",
        "finding_from",
        "configuration_includes",
        "evaluated_configuration",
      ],
      change: ["requires_review_of", "configuration_includes", "release_considers"],
    };
    const relationshipTypes = Object.keys(state.draft.relationshipTypes);
    const view = (key, label, typeKeys, relationshipKeys) => ({
      key,
      label,
      types: typeKeys.filter((type) => names(state).includes(type)),
      relationships: relationshipKeys.filter((relationship) =>
        relationshipTypes.includes(relationship),
      ),
    });
    const contextualView = (key, label, relationshipKeys) =>
      view(key, label, endpointTypes(state, relationshipKeys), relationshipKeys);
    return [
      view(
        "development",
        "Development",
        ["product", "goal", "target", "function", "requirement", "design"],
        relationshipSets.development,
      ),
      view(
        "architecture",
        "Architecture",
        ["product", "design", "component", "interface"],
        relationshipSets.architecture,
      ),
      contextualView("discovery", "Discovery", relationshipSets.discovery),
      contextualView("evaluation", "Evaluation", relationshipSets.evaluation),
      contextualView("change", "Change & release", relationshipSets.change),
      view("all", "All definitions", names(state), relationshipTypes),
    ];
  }

  function endpointTypes(state, keys) {
    return [...new Set(keys.flatMap((key) => relationshipEndpointTypes(state, key)))];
  }

  function relationshipEndpointTypes(state, key) {
    const relationship = state.draft.relationshipTypes[key];
    if (!relationship) return [];
    const endpoints = Object.assign({ source: [], target: [], workflow: [] }, relationship);
    return [
      ...endpoints.source,
      ...endpoints.target,
      ...endpoints.workflow.flatMap((path) => [path.source, path.target]),
    ];
  }

  function views(state) {
    if (isMedicalSchema(state.draft)) return medicalViews(state);
    if (isCleanOrbitSchema(state.draft)) return orbitViews(state);
    return [
      {
        key: "all",
        label: "All definitions",
        types: names(state),
        relationships: Object.keys(state.draft.relationshipTypes),
      },
    ];
  }

  function currentView(state) {
    return views(state).find((view) => view.key === state.view) ?? views(state)[0];
  }

  function visibleNames(state) {
    return currentView(state).types;
  }

  function preferredViewForType(state, key) {
    if (!supportsViews(state.draft)) return "all";
    return (
      views(state).find((view) => view.key !== "all" && view.types.includes(key))?.key ?? "all"
    );
  }

  function preferredViewForRelationship(state, key) {
    if (!supportsViews(state.draft)) return "all";
    return (
      views(state).find((view) => view.key !== "all" && view.relationships.includes(key))?.key ??
      "all"
    );
  }

  function definition(state) {
    const collections = {
      type: state.draft.entityTypes,
      relationship: state.draft.relationshipTypes,
    };
    return collections[state.selection.kind]?.[state.selection.key];
  }

  function ensurePositions(state) {
    const defaults = {
      wide: positions(state.draft, false),
      portrait: positions(state.draft, true),
    };
    ["wide", "portrait"].forEach((layout) =>
      names(state).forEach((key) => ensurePosition(state, defaults, layout, key)),
    );
  }

  function ensurePosition(state, defaults, layout, key) {
    if (!state.layouts[layout][key]) state.layouts[layout][key] = defaults[layout][key];
  }

  function countFor(config, key) {
    return config.counts?.[key] ?? 0;
  }

  function changed(state) {
    return schemaChanged(state) || Object.values(state.pendingFields).some((value) => value.trim());
  }
  function schemaChanged(state) {
    return (
      JSON.stringify(state.draft) !== JSON.stringify(state.base) ||
      JSON.stringify(state.layouts) !== JSON.stringify(state.savedLayouts)
    );
  }

  function render(config) {
    const state = makeState(config.schema, config.state);
    ensurePositions(state);
    return markup(state, config);
  }

  function markup(state, config) {
    const world = dimensions(state);
    const visibleHeight = Math.ceil(visibleBounds(state).height * 0.85 + 64);
    return `<section class="model-editor"><header class="catalogue-header"><h1>Project model</h1><span>${names(state).length} types · ${Object.keys(state.draft.relationshipTypes).length} relationships</span></header>
      ${toolbar(state)}${messages(state)}<div class="model-editor-workspace"><div class="model-editor-frame" tabindex="0" aria-label="Editable project model" style="--model-editor-world-height:${world.height}px;--model-editor-visible-height:${visibleHeight}px"><div class="model-editor-canvas" data-editor-width="${world.width}" data-editor-height="${world.height}" style="width:${world.width}px;height:${world.height}px">${graph(state, config, world)}</div></div>${inspector(state, config)}</div>
      <p class="model-editor-legend">Solid arrows show authored workflow in this view. Dashed arrows show selected endpoint permissions. Views share one set of type and relationship definitions.</p></section>`;
  }

  function button(label, action, value = "", className = "quiet-button", disabled = false) {
    return `<button type="button" class="${className}" data-editor-action="${action}" data-editor-value="${html(value)}" ${disabled ? "disabled" : ""}>${html(label)}</button>`;
  }

  function toolbar(state) {
    const view = currentView(state);
    const viewControl = supportsViews(state.draft)
      ? `<label>View<select data-editor-view>${views(state)
          .map((candidate) => option(candidate.key, candidate.label, view.key))
          .join(
            "",
          )}</select></label><span class="model-editor-filter-count">${viewStatus(state, view)}</span>`
      : "";
    const selectedType = state.selection.kind === "type" ? state.selection.key : "";
    return `<div class="model-editor-toolbar"><span class="model-editor-draft-note">${state.dirty ? "Unsaved tab-session draft · project data unchanged" : "Session model · project data unchanged"}</span>${viewControl}<label>Find type<select data-editor-type-finder>${option("", "Choose type", selectedType)}${names(
      state,
    )
      .map((key) => option(key, words(key), selectedType))
      .join(
        "",
      )}</select></label><div class="model-editor-primary-actions">${button("Add type", "add-type")}${button("Add relationship", "add-relationship")}${button("Save draft", "save", "", "solid-button", !draftActive(state))}${button("Cancel", "cancel", "", "quiet-button", !draftActive(state))}</div><div class="model-editor-camera">${button("Fit", "fit")}${button("−", "zoom", "0.8")}<span data-editor-scale></span>${button("+", "zoom", "1.25")}</div></div>`;
  }

  function viewStatus(state, view) {
    if (view.key !== "all")
      return `${view.types.length} of ${names(state).length} types · ${view.relationships.length} of ${Object.keys(state.draft.relationshipTypes).length} relationships`;
    if (state.selection.kind !== "relationship")
      return `${view.types.length} types · select a relationship to show its paths`;
    const pathCount = edges(state).length;
    return `${view.types.length} types · ${pathCount} ${pathCount === 1 ? "path" : "paths"} shown`;
  }

  function draftActive(state) {
    return state.dirty || Boolean(state.form);
  }

  function messages(state) {
    if (state.error) return `<p class="model-editor-message" role="alert">${html(state.error)}</p>`;
    return state.notice
      ? `<p class="model-editor-message" role="status">${html(state.notice)}</p>`
      : "";
  }

  function authoredEdges(key, definition) {
    return (definition.workflow ?? []).map((path, index) => ({
      key,
      index,
      source: path.source,
      target: path.target,
      reverse: path.direction === "reverse",
      label: path.label,
      permission: false,
    }));
  }

  function permissionEdges(key, definition) {
    if (!definition.source || !definition.target) return [];
    return definition.source.flatMap((source) =>
      definition.target.map((target) => ({
        key,
        source,
        target,
        label: words(key),
        permission: true,
      })),
    );
  }

  function relationshipEdges(state, key, value) {
    if (value.workflow !== undefined) return authoredEdges(key, value);
    if (state.selection.kind !== "relationship") return [];
    return state.selection.key === key ? permissionEdges(key, value) : [];
  }

  function edges(state) {
    const view = currentView(state);
    const keys =
      view.key === "all" && supportsViews(state.draft)
        ? state.selection.kind === "relationship"
          ? [state.selection.key]
          : []
        : view.relationships;
    return keys.flatMap((key) => {
      const value = state.draft.relationshipTypes[key];
      return value ? relationshipEdges(state, key, value) : [];
    });
  }

  function graph(state, config, world) {
    const lines = edges(state);
    const families = Object.groupBy(lines, (edge) => edge.key);
    const wires = lines
      .map((edge) => {
        const family = families[edge.key];
        return edgeMarkup(state, edge, family, edge === labelOwner(state, family));
      })
      .join("");
    return `<svg class="model-editor-wires" viewBox="0 0 ${world.width} ${world.height}" aria-hidden="true"><defs><marker id="editor-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="currentColor"/></marker></defs>${wires}</svg>${names(
      state,
    )
      .filter((key) => visibleNames(state).includes(key))
      .map((key) => nodeMarkup(state, config, key))
      .join("")}`;
  }

  function labelOwner(state, family) {
    if (state.selection.kind === "type")
      return (
        family.find((edge) => [edge.source, edge.target].includes(state.selection.key)) ?? family[0]
      );
    return family[0];
  }

  function related(state, key) {
    if (state.selection.kind === "type")
      return edges(state).some(
        (edge) =>
          [edge.source, edge.target, state.selection.key].includes(key) &&
          [edge.source, edge.target].includes(state.selection.key),
      );
    return edges(state).some(
      (edge) => edge.key === state.selection.key && [edge.source, edge.target].includes(key),
    );
  }

  function nodeState(state, key) {
    if (state.selection.kind === "none") return "";
    if (selectedType(state, key)) return "is-selected";
    return contextualState(related(state, key));
  }

  function selectedType(state, key) {
    return state.selection.kind === "type" && state.selection.key === key;
  }

  function contextualState(isRelated) {
    return isRelated ? "is-related" : "is-dimmed";
  }

  function nodeMarkup(state, config, key) {
    const point = state.layouts[mode()][key];
    const count = countFor(config, key);
    return `<button type="button" class="model-editor-node ${nodeState(state, key)}" data-model-node="${html(key)}" style="left:${point.x}px;top:${point.y}px;width:${nodeWidth}px;height:${nodeHeight}px"><strong>${html(words(key))}</strong><small>${html(count)} recorded ${count === 1 ? "item" : "items"}</small></button>`;
  }

  function edgeCategory(edge) {
    const types = [edge.source, edge.target];
    return typeEdgeCategory(types) ?? relationshipCategories[edge.key] ?? "context";
  }

  function typeEdgeCategory(types) {
    if (types.includes("validation_protocol")) return "validation";
    if (types.some((type) => verificationTypes.includes(type))) return "verification";
    return null;
  }

  function edgeState(state, edge) {
    if (state.selection.kind === "none") return "";
    if (state.selection.kind === "relationship")
      return selectedEdgeState(state.selection.key, edge.key);
    return contextualState([edge.source, edge.target].includes(state.selection.key));
  }

  function selectedEdgeState(selectedKey, edgeKey) {
    return selectedKey === edgeKey ? "is-selected" : "is-dimmed";
  }

  function edgeEnds(state, edge) {
    const endpoints = edge.reverse ? [edge.target, edge.source] : [edge.source, edge.target];
    return endpoints.map((key) => state.layouts[mode()][key]);
  }

  function border(point, toward) {
    const center = { x: point.x + nodeWidth / 2, y: point.y + nodeHeight / 2 };
    const target = { x: toward.x + nodeWidth / 2, y: toward.y + nodeHeight / 2 };
    const dx = target.x - center.x,
      dy = target.y - center.y;
    const scale = Math.min(
      dx === 0 ? Infinity : nodeWidth / (2 * Math.abs(dx)),
      dy === 0 ? Infinity : nodeHeight / (2 * Math.abs(dy)),
    );
    return { x: center.x + dx * scale, y: center.y + dy * scale };
  }

  function displayEndpointKeys(edge) {
    return edge.reverse ? [edge.target, edge.source] : [edge.source, edge.target];
  }

  function edgeGeometry(state, edge, family) {
    const [from, to] = edgeEnds(state, edge);
    if (![from, to].every(Boolean)) return null;
    if (edge.source === edge.target) return schemaLoopGeometry(state, from);
    if (isCleanOrbitIntentRoute(state, edge)) return verticalEdgeGeometry(from, to, family);
    return routedGeometry(from, to, edge, family);
  }

  function schemaLoopGeometry(state, from) {
    return isCleanOrbitSchema(state.draft) ? topLoopGeometry(from) : loopGeometry(from);
  }

  function isCleanOrbitIntentRoute(state, edge) {
    return !portrait.matches && isCleanOrbitSchema(state.draft) && edge.key === "realized_by";
  }

  function verticalEdgeGeometry(from, to, family) {
    return verticalGeometry(border(from, to), border(to, from), familyShape(family));
  }

  function routedGeometry(from, to, edge, family) {
    const start = border(from, to),
      end = border(to, from);
    const shape = familyShape(family);
    const lane = portraitFamilyLane(edge.key);
    if (lane !== undefined) return sideLaneGeometry(start, end, lane);
    if (horizontalEdge(start, end)) return horizontalGeometry(start, end, shape);
    return verticalGeometry(start, end, shape);
  }

  function portraitFamilyLane(key) {
    return portrait.matches ? portraitFamilyLanes[key] : undefined;
  }

  function loopGeometry(from) {
    return {
      path: `M${from.x + 150} ${from.y + 20} H${from.x + 205} V${from.y - 34} H${from.x - 24} V${from.y + 20} H${from.x + 10}`,
      x: from.x + 80,
      y: from.y - 30,
    };
  }

  function topLoopGeometry(from) {
    return {
      path: `M${from.x + 30} ${from.y} V${from.y - 34} H${from.x + 130} V${from.y}`,
      x: from.x + 80,
      y: from.y - 38,
    };
  }

  function familyShape(family) {
    const endpoints = family.map(displayEndpointKeys);
    return {
      sameSource: endpoints.every(([source]) => source === endpoints[0][0]),
      sameTarget: endpoints.every(([, target]) => target === endpoints[0][1]),
      size: endpoints.length,
    };
  }

  function horizontalEdge(start, end) {
    return Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  }

  function busCoordinate(start, end, sameSource, sameTarget) {
    const direction = Math.sign(end - start) || 1;
    if (sameTarget) return end - direction * 44;
    if (sameSource) return start + direction * 44;
    return (start + end) / 2;
  }

  function horizontalGeometry(start, end, shape) {
    const bus = busCoordinate(start.x, end.x, shape.sameSource, shape.sameTarget);
    const segments = [
      [
        { x: start.x, y: start.y },
        { x: bus, y: start.y },
      ],
      [
        { x: bus, y: start.y },
        { x: bus, y: end.y },
      ],
      [
        { x: bus, y: end.y },
        { x: end.x, y: end.y },
      ],
    ];
    return {
      path: `M${start.x} ${start.y} H${bus} V${end.y} H${end.x}`,
      ...familyLabelPosition(segments, shape),
    };
  }

  function verticalGeometry(start, end, shape) {
    const bus = busCoordinate(start.y, end.y, shape.sameSource, shape.sameTarget);
    const segments = [
      [
        { x: start.x, y: start.y },
        { x: start.x, y: bus },
      ],
      [
        { x: start.x, y: bus },
        { x: end.x, y: bus },
      ],
      [
        { x: end.x, y: bus },
        { x: end.x, y: end.y },
      ],
    ];
    return {
      path: `M${start.x} ${start.y} V${bus} H${end.x} V${end.y}`,
      ...familyLabelPosition(segments, shape),
    };
  }

  function sideLaneGeometry(start, end, lane) {
    const segments = [
      [
        { x: start.x, y: start.y },
        { x: lane, y: start.y },
      ],
      [
        { x: lane, y: start.y },
        { x: lane, y: end.y },
      ],
      [
        { x: lane, y: end.y },
        { x: end.x, y: end.y },
      ],
    ];
    return {
      path: `M${start.x} ${start.y} H${lane} V${end.y} H${end.x}`,
      ...routeLabelPosition([segments[1]]),
    };
  }

  function familyLabelPosition(segments, shape) {
    if (shape.size === 1) return routeLabelPosition(segments);
    if (!shape.sameTarget) return routeLabelPosition(segments);
    return routeLabelPosition([segments[1]]);
  }

  function routeLabelPosition(segments) {
    const segment = [...segments].sort(
      (left, right) => segmentLength(right) - segmentLength(left),
    )[0];
    return {
      x: (segment[0].x + segment[1].x) / 2,
      y: (segment[0].y + segment[1].y) / 2 - 7,
    };
  }

  function segmentLength([start, end]) {
    return Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
  }

  function edgeMarkup(state, edge, family = [edge], showLabel = true) {
    const geometry = edgeGeometry(state, edge, family);
    if (!geometry) return "";
    const classes = `${edgeCategory(edge)} ${edgeState(state, edge)} ${edge.permission ? "is-permission" : ""}`;
    return `<g class="model-editor-edge ${classes}"><path class="model-editor-edge-line" d="${geometry.path}" marker-end="url(#editor-arrow)"/><path class="model-editor-edge-hit" data-model-edge="${html(edge.key)}" d="${geometry.path}"/>${showLabel ? edgeLabel(state, edge, geometry) : ""}</g>`;
  }

  function edgeLabel(state, edge, geometry) {
    if (!edgeLabelVisible(state, edge)) return "";
    const core = persistentLabelView(state);
    const className = core ? "model-editor-edge-label is-core-label" : "model-editor-edge-label";
    const position = coreLabelPosition(state, edge, geometry);
    return `<text class="${className}" data-model-edge="${html(edge.key)}" x="${position.x}" y="${position.y}" text-anchor="middle">${html(edgeLabelText(state, edge))}</text>`;
  }

  function coreLabelPosition(state, edge, geometry) {
    if (isCleanOrbitSchema(state.draft)) return orbitLabelPosition(state, edge, geometry);
    return medicalCoreLabelPosition(state, edge, geometry);
  }

  function medicalCoreLabelPosition(state, edge, geometry) {
    if (state.view !== "development") return geometry;
    const moveAbove = portrait.matches
      ? edge.key === "has_user_need"
      : topRowCoreRelationships.has(edge.key);
    if (!moveAbove) return portraitLabelAdjustment(edge, geometry);
    const points = edgeEnds(state, edge);
    return { x: geometry.x, y: Math.min(...points.map((point) => point.y)) - 10 };
  }

  function orbitLabelPosition(state, edge, geometry) {
    const points = edgeEnds(state, edge);
    const strategy = orbitLabelStrategy(state, edge, points);
    return orbitLabelPositions[strategy](state, geometry, points);
  }

  function orbitLabelStrategy(state, edge, points) {
    if (state.view === "development" && points.every((point) => point.y === points[0].y))
      return "above";
    return orbitRelationshipLabelStrategies[mode()][edge.key] ?? "natural";
  }

  function portraitLabelAdjustment(edge, geometry) {
    if (!portrait.matches) return geometry;
    if (edge.key === "produces_result") return { x: geometry.x, y: geometry.y + 10 };
    return geometry;
  }

  function edgeLabelVisible(state, edge) {
    return persistentLabelView(state) || selectedRelationship(state, edge);
  }

  function persistentLabelView(state) {
    return (
      state.view === "development" || (isCleanOrbitSchema(state.draft) && state.view !== "all")
    );
  }

  function selectedRelationship(state, edge) {
    return state.selection.kind === "relationship" && state.selection.key === edge.key;
  }

  function edgeLabelText(state, edge) {
    if (!selectedRelationship(state, edge))
      return coreRelationshipLabels[edge.key] ?? words(edge.key);
    return `${edge.label}${edge.reverse ? " (reverse flow)" : ""}`;
  }

  function inspector(state, config) {
    if (state.form) return additionInspector(state);
    const value = definition(state);
    if (!value) return emptyInspector(state);
    return `<aside class="model-editor-inspector"><header class="model-editor-inspector-header"><h2>${html(words(state.selection.key))}</h2></header><div class="model-editor-inspector-body">${definitionPicker(state)}${relationshipProperties(state)}${fieldsMarkup(state, value)}${definitionFooter(state, config)}</div></aside>`;
  }

  function emptyInspector(state) {
    const message =
      currentView(state).key === "all"
        ? "All types are shown. Choose a relationship to draw its paths and inspect its definition."
        : "Select a type on the graph or choose a relationship to inspect and edit its definition.";
    return `<aside class="model-editor-inspector"><div class="model-editor-inspector-body">${definitionPicker(state)}<p class="model-editor-empty"><strong>Nothing selected</strong>${message}</p></div></aside>`;
  }

  function definitionPicker(state) {
    return `<label>Inspect relationship<select data-editor-inspect>${option("", "Select relationship", state.selection.kind === "relationship" ? state.selection.key : "")}${Object.keys(
      state.draft.relationshipTypes,
    )
      .map((key) => option(key, words(key), state.selection.key))
      .join("")}</select></label>`;
  }

  function option(value, label, current) {
    return `<option value="${html(value)}" ${value === current ? "selected" : ""}>${html(label)}</option>`;
  }

  function relationshipProperties(state) {
    if (state.selection.kind !== "relationship") return "";
    const value = definition(state);
    return `<div class="model-editor-endpoints">${["source", "target"].map((side) => endpointMarkup(state, value, side)).join("")}</div>${workflowMarkup(state, value)}`;
  }

  function endpointMode(value) {
    if (value === undefined) return "any";
    return value.length ? "selected" : "none";
  }

  function endpointMarkup(state, value, side) {
    const current =
      state.endpointModes[`${state.selection.key}:${side}`] ?? endpointMode(value[side]);
    return `<fieldset><legend>Native ${side} types</legend><label>Constraint<select data-editor-endpoint-mode="${side}">${["any", "selected", "none"].map((choice) => option(choice, { any: "Any type", selected: "Selected types", none: "No types" }[choice], current)).join("")}</select></label>${endpointChoices(state, value, side, current)}</fieldset>`;
  }

  function endpointChoices(state, value, side, current) {
    if (current !== "selected") return "";
    return names(state)
      .map(
        (key) =>
          `<label><input type="checkbox" data-editor-endpoint="${side}" value="${html(key)}" ${value[side].includes(key) ? "checked" : ""}>${html(words(key))}</label>`,
      )
      .join("");
  }

  function workflowMarkup(state, value) {
    return `<section class="model-editor-workflow"><h3>Authored workflow paths</h3>${workflowNote(value)}${(value.workflow ?? []).map((path, index) => workflowRow(state, path, index)).join("")}${button("Add workflow path", "add-path")}<small>Flow direction changes the drawing, not the stored endpoint direction.</small></section>`;
  }

  function workflowNote(value) {
    if (value.workflow !== undefined) return "";
    return "<p>No authored workflow paths. Any permits every configured type; None permits no types. Explicit endpoint permissions are drawn with dashed arrows.</p>";
  }

  function workflowRow(state, path, index) {
    return `<fieldset data-editor-path-row="${index}"><legend>Path ${index + 1}</legend>${pathTypeSelect(state, path, index, "source")}${pathTypeSelect(state, path, index, "target")}<label>Display direction<select data-editor-path="${index}" data-editor-property="direction">${["forward", "reverse"].map((direction) => option(direction, direction, path.direction)).join("")}</select></label><label>Flow label<input data-editor-path="${index}" data-editor-property="label" value="${html(path.label)}" required></label><label><input type="checkbox" data-editor-path="${index}" data-editor-property="feedback" ${path.feedback ? "checked" : ""}>Feedback path</label>${button("Remove path", "remove-path", index)}</fieldset>`;
  }

  function pathTypeSelect(state, path, index, side) {
    return `<label>Native ${side}<select data-editor-path="${index}" data-editor-property="${side}">${option("", "Select type", path[side])}${names(
      state,
    )
      .map((key) => option(key, words(key), path[side]))
      .join("")}</select></label>`;
  }

  function fieldsMarkup(state, value) {
    return `<section class="model-editor-field-list"><h3>Fields</h3>${Object.entries(
      value.fields ?? {},
    )
      .map(([key, field]) => fieldMarkup(key, field))
      .join(
        "",
      )}<form data-editor-form="field"><label>New field name<input name="name" value="${html(state.pendingFields[definitionKey(state)] ?? "")}" required></label><button type="submit" class="quiet-button">Add field</button></form></section>`;
  }

  function fieldMarkup(key, field) {
    return `<div class="model-editor-field"><strong>${html(key)}</strong><label>Type<select data-editor-field="${html(key)}" data-editor-field-property="type" aria-label="${html(key)} field type">${fieldTypes.map((type) => option(type, type, field.type)).join("")}</select></label><label><input type="checkbox" data-editor-field="${html(key)}" data-editor-field-property="required" ${field.required ? "checked" : ""}>Required</label>${button("Remove field", "remove-field", key)}</div>`;
  }

  function definitionFooter(state, config) {
    const populated = state.selection.kind === "type" && countFor(config, state.selection.key) > 0;
    return `<footer><button type="button" class="quiet-button" data-editor-action="delete-definition" ${populated ? "disabled" : ""}>Delete ${html(state.selection.kind)}</button>${populated ? "<small>Type has recorded items.</small>" : ""}</footer>`;
  }

  function additionInspector(state) {
    const form = state.form;
    return `<aside class="model-editor-inspector"><header class="model-editor-inspector-header"><h2>Add ${html(form.kind)}</h2></header><div class="model-editor-inspector-body"><form data-editor-form="addition">${additionStatus(form)}<label>Unique key<input name="name" value="${html(form.name)}" required></label>${additionEndpoints(state, form)}<button type="submit" class="solid-button">Add to draft</button></form></div></aside>`;
  }

  function additionStatus(form) {
    if (form.kind !== "relationship") return "";
    return `<p>Source: ${html(form.source || "Choose source")} → Target: ${html(form.target || "Choose target")} · Choose ${html(form.pickStep)} on the graph</p>`;
  }

  function additionEndpoints(state, form) {
    if (form.kind !== "relationship") return "";
    return `${["source", "target"]
      .map(
        (side) =>
          `<label>Native ${side}<select name="${side}" required>${option("", "Select type", form[side])}${names(
            state,
          )
            .map((key) => option(key, words(key), form[side]))
            .join("")}</select></label>`,
      )
      .join(
        "",
      )}<label><input type="checkbox" name="workflow" ${form.workflow ? "checked" : ""}>Add an authored forward workflow path</label><label>Workflow label<input name="label" value="${html(form.label)}"></label>`;
  }

  function mount(root, config) {
    const previous = controllers.get(root);
    if (previous) previous.destroy();
    const state = makeState(config.schema, config.state);
    ensurePositions(state);
    const context = { root, config, state, drag: null, moved: false, busy: false, active: true };
    context.destroy = bind(context);
    controllers.set(root, context);
    fitInitial(context);
    notify(context);
  }

  function unmount(root) {
    const context = controllers.get(root);
    if (!context) return;
    context.active = false;
    context.destroy();
    controllers.delete(root);
  }

  function capture(root) {
    const context = controllers.get(root);
    return context ? clone(context.state) : null;
  }

  function bind(context) {
    const events = {
      click: (event) => clicked(context, event),
      input: (event) => input(context, event),
      change: (event) => change(context, event),
      submit: (event) => submitted(context, event),
      pointerdown: (event) => pointerStart(context, event),
      pointermove: (event) => pointerMove(context, event),
      pointerup: () => pointerEnd(context),
      pointercancel: () => pointerEnd(context),
      keydown: (event) => keyboard(context, event),
      wheel: (event) => wheel(context, event),
    };
    Object.entries(events).forEach(([name, handler]) =>
      context.root.addEventListener(name, handler, { passive: false }),
    );
    const resized = () => viewportChanged(context);
    portrait.addEventListener("change", resized);
    return () => {
      Object.entries(events).forEach(([name, handler]) =>
        context.root.removeEventListener(name, handler),
      );
      portrait.removeEventListener("change", resized);
    };
  }

  function notify(context) {
    if (!context.active) return;
    context.state.dirty = changed(context.state);
    updateDraftLabel(context);
    context.config.onState?.(clone(context.state));
  }

  function paint(context, focus) {
    if (!context.active) return;
    ensurePositions(context.state);
    context.state.dirty = changed(context.state);
    context.root.querySelector(".model-editor").outerHTML = markup(context.state, context.config);
    fitInitial(context);
    notify(context);
    if (focus) context.root.querySelector(focus)?.focus();
  }

  function camera(context) {
    return context.state.cameras[mode()];
  }

  function fitInitial(context) {
    if (!camera(context)) initialCamera(context);
    draw(context);
  }
  function initialCamera(context) {
    context.state.cameras[mode()] = fittedCamera(context, true);
    if (!context.state.savedCameras[mode()])
      context.state.savedCameras[mode()] = clone(camera(context));
  }
  function fittedCamera(context, readable) {
    const frame = context.root.querySelector(".model-editor-frame"),
      bounds = visibleBounds(context.state),
      padding = 32;
    const fitted = Math.min(
      (frame.clientWidth - padding * 2) / bounds.width,
      (frame.clientHeight - padding * 2) / bounds.height,
      1,
    );
    const scale = readable ? Math.max(fitted, 0.85) : fitted;
    return {
      x: (frame.clientWidth - bounds.width * scale) / 2 - bounds.x * scale,
      y: initialCameraY(frame, bounds, scale, readable),
      scale,
    };
  }

  function initialCameraY(frame, bounds, scale, readable) {
    if (readable && portrait.matches) return 32 - bounds.y * scale;
    return (frame.clientHeight - bounds.height * scale) / 2 - bounds.y * scale;
  }

  function visibleBounds(state) {
    const points = visibleNames(state)
      .map((key) => state.layouts[mode()][key])
      .filter(Boolean);
    if (!points.length) return { x: 0, y: 0, width: nodeWidth, height: nodeHeight };
    const left = Math.min(...points.map((point) => point.x));
    const top = Math.min(...points.map((point) => point.y));
    const right = Math.max(...points.map((point) => point.x + nodeWidth));
    const bottom = Math.max(...points.map((point) => point.y + nodeHeight));
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  function fit(context) {
    context.state.cameras[mode()] = fittedCamera(context, false);
    draw(context);
    notify(context);
  }

  function draw(context) {
    const current = camera(context);
    context.root.querySelector(".model-editor-canvas").style.transform =
      `translate(${current.x}px,${current.y}px) scale(${current.scale})`;
    context.root.querySelector("[data-editor-scale]").textContent =
      `${Math.round(current.scale * 100)}%`;
  }

  function zoom(context, factor) {
    const current = camera(context),
      next = Math.max(0.3, Math.min(2, current.scale * factor));
    const frame = context.root.querySelector(".model-editor-frame");
    const center = { x: frame.clientWidth / 2, y: frame.clientHeight / 2 };
    current.x = center.x - ((center.x - current.x) * next) / current.scale;
    current.y = center.y - ((center.y - current.y) * next) / current.scale;
    current.scale = next;
    draw(context);
    notify(context);
  }

  function selected(context, kind, key) {
    if (context.state.form) return blockedAddition(context);
    const nextView =
      kind === "relationship"
        ? preferredViewForRelationship(context.state, key)
        : context.state.view;
    const viewChanged = context.state.view !== nextView;
    context.state.view = nextView;
    context.state.selection = { kind, key };
    context.state.error = "";
    if (viewChanged) context.state.cameras[mode()] = null;
    paint(context, selectionFocus(kind, key));
  }

  function selectionFocus(kind, key) {
    return kind === "type" ? `[data-model-node="${CSS.escape(key)}"]` : "[data-editor-inspect]";
  }

  function blockedAddition(context) {
    context.state.error = "Finish adding this definition to the draft, or Cancel the draft first.";
    paint(context);
  }

  function clicked(context, event) {
    if (context.moved) {
      context.moved = false;
      event.preventDefault();
      return;
    }
    const node = event.target.closest("[data-model-node]");
    if (node) return nodeClick(context, node.dataset.modelNode);
    clickOther(context, event);
  }

  function nodeClick(context, key) {
    if (context.state.form) return graphAdditionPick(context, key);
    selected(context, "type", key);
  }
  function graphAdditionPick(context, key) {
    const form = context.state.form;
    if (form.kind !== "relationship") return blockedAddition(context);
    form[form.pickStep] = key;
    form.pickStep = form.pickStep === "source" ? "target" : "source";
    paint(context);
  }
  function focusType(context, key) {
    if (context.state.form) return graphAdditionPick(context, key);
    context.state.view = preferredViewForType(context.state, key);
    context.state.selection = { kind: "type", key };
    context.state.cameras[mode()] = null;
    paint(context);
    centerType(context, key);
    draw(context);
    notify(context);
    context.root.querySelector("[data-editor-type-finder]")?.focus();
  }
  function centerType(context, key) {
    const point = context.state.layouts[mode()][key],
      frame = context.root.querySelector(".model-editor-frame"),
      current = camera(context);
    current.scale = Math.max(current.scale, 0.85);
    current.x = frame.clientWidth / 2 - (point.x + nodeWidth / 2) * current.scale;
    current.y = frame.clientHeight / 2 - (point.y + nodeHeight / 2) * current.scale;
  }

  function clickOther(context, event) {
    const edge = event.target.closest("[data-model-edge]");
    if (edge) return selected(context, "relationship", edge.dataset.modelEdge);
    const control = event.target.closest("[data-editor-action]");
    if (control) action(context, control.dataset.editorAction, control.dataset.editorValue);
  }

  function action(context, name, value) {
    const actions = {
      "add-type": () => beginAddition(context, "type"),
      "add-relationship": () => beginAddition(context, "relationship"),
      save: () => save(context),
      cancel: () => cancel(context),
      fit: () => fit(context),
      zoom: () => zoom(context, Number(value)),
      "add-path": () => addPath(context),
      "remove-path": () => removePath(context, Number(value)),
      "remove-field": () => removeField(context, value),
      "delete-definition": () => deleteDefinition(context),
    };
    actions[name]?.();
  }

  function beginAddition(context, kind) {
    if (context.state.form) return blockedAddition(context);
    const source = context.state.selection.kind === "type" ? context.state.selection.key : "";
    context.state.form = {
      kind,
      name: "",
      source,
      target: "",
      label: "",
      workflow: false,
      pickStep: source ? "target" : "source",
    };
    context.state.error = "";
    paint(context, "[data-editor-form='addition'] input");
  }

  function cancel(context) {
    context.state.draft = clone(context.state.base);
    context.state.layouts = clone(context.state.savedLayouts);
    context.state.cameras = clone(context.state.savedCameras);
    context.state.pendingFields = {};
    context.state.endpointModes = {};
    context.state.form = null;
    context.state.error = "";
    context.state.notice = "Draft cancelled. Last saved session model restored.";
    repairSelection(context.state);
    paint(context);
    context.state.cameras[mode()] = fittedCamera(context, false);
    draw(context);
    notify(context);
  }

  function repairSelection(state) {
    if (state.selection.kind === "none") return;
    if (!definition(state)) state.selection = emptySelection();
  }

  function input(context, event) {
    const addition = event.target.closest("[data-editor-form='addition']");
    if (addition) retainAddition(context, addition);
    retainPendingField(context, event.target);
    updateInput(context, event.target);
    notify(context);
  }

  function definitionKey(state) {
    return `${state.selection.kind}:${state.selection.key}`;
  }
  function retainPendingField(context, element) {
    if (!element.closest("[data-editor-form='field']")) return;
    context.state.pendingFields[definitionKey(context.state)] = element.value;
  }

  function retainAddition(context, form) {
    const values = Object.fromEntries(new FormData(form));
    context.state.form = {
      ...context.state.form,
      ...values,
      workflow: form.elements.namedItem("workflow")?.checked ?? false,
    };
  }

  function updateInput(context, element) {
    if (element.dataset.editorPath !== undefined) updatePath(context, element);
    if (element.dataset.editorField !== undefined) updateField(context, element);
  }

  function change(context, event) {
    const element = event.target;
    if (element.matches("[data-editor-view]")) return switchView(context, element.value);
    if (element.matches("[data-editor-inspect]"))
      return relationshipFinderChanged(context, element.value);
    if (element.matches("[data-editor-type-finder]")) return typeFinderChanged(context, element);
    changeDefinition(context, element);
  }

  function relationshipFinderChanged(context, key) {
    if (key) return selected(context, "relationship", key);
    context.state.selection = emptySelection();
    paint(context, "[data-editor-inspect]");
  }

  function typeFinderChanged(context, element) {
    if (!element.value) return;
    focusType(context, element.value);
  }

  function switchView(context, key) {
    const view = viewForKey(context.state, key);
    if (!view) return;
    context.state.view = key;
    context.state.selection = selectionForView(context.state, view);
    context.state.cameras[mode()] = null;
    paint(context, "[data-editor-view]");
  }

  function viewForKey(state, key) {
    return views(state).find((view) => view.key === key);
  }

  function selectionForView(state, view) {
    if (selectionVisible(state.selection, view)) return state.selection;
    return emptySelection();
  }

  function selectionVisible(selection, view) {
    const visible = { type: view.types, relationship: view.relationships };
    return visible[selection.kind]?.includes(selection.key) ?? false;
  }

  function changeDefinition(context, element) {
    if (element.dataset.editorEndpointMode) return endpointChanged(context, element);
    if (element.dataset.editorEndpoint) return endpointChecked(context, element);
    updateInput(context, element);
    repaintChangedControl(context, element);
  }
  function repaintChangedControl(context, element) {
    if (!element.matches("select,input[type='checkbox']")) return;
    const selector = controlSelector(element);
    paint(context, selector);
  }
  function controlSelector(element) {
    const attributes = [...element.attributes].filter((attribute) =>
      attribute.name.startsWith("data-editor-"),
    );
    if (!attributes.length)
      return `[data-editor-form="addition"] [name="${CSS.escape(element.name)}"]`;
    return attributes
      .map((attribute) => `[${attribute.name}="${CSS.escape(attribute.value)}"]`)
      .join("");
  }

  function updateField(context, element) {
    const fields = definition(context.state).fields;
    const field = fields[element.dataset.editorField];
    const property = element.dataset.editorFieldProperty;
    field[property] = property === "required" ? element.checked : element.value;
  }

  function updatePath(context, element) {
    const path = definition(context.state).workflow[Number(element.dataset.editorPath)];
    const property = element.dataset.editorProperty;
    path[property] = property === "feedback" ? element.checked : element.value;
  }

  function endpointChanged(context, element) {
    const value = definition(context.state),
      side = element.dataset.editorEndpointMode;
    context.state.endpointModes[`${context.state.selection.key}:${side}`] = element.value;
    if (element.value === "any") delete value[side];
    else value[side] = value[side] ?? [];
    if (element.value === "none") value[side] = [];
    paint(context, controlSelector(element));
  }

  function endpointChecked(context, element) {
    const value = definition(context.state),
      side = element.dataset.editorEndpoint;
    const choices = new Set(value[side]);
    if (element.checked) choices.add(element.value);
    else choices.delete(element.value);
    value[side] = [...choices];
    paint(context, `${controlSelector(element)}[value="${CSS.escape(element.value)}"]`);
  }

  function addPath(context) {
    const value = definition(context.state);
    const source = firstEndpoint(context.state, value.source),
      target = firstEndpoint(context.state, value.target);
    value.workflow = [
      ...(value.workflow ?? []),
      { source, target, direction: "forward", label: "" },
    ];
    paint(context);
  }
  function firstEndpoint(state, constraint) {
    return (constraint ?? names(state))[0] ?? "";
  }

  function removePath(context, index) {
    const value = definition(context.state);
    value.workflow.splice(index, 1);
    paint(context);
  }

  function removeField(context, name) {
    delete definition(context.state).fields[name];
    paint(context);
  }

  function deleteDefinition(context) {
    const { kind, key } = context.state.selection;
    if (kind === "type" && countFor(context.config, key) > 0) return;
    const collection =
      kind === "type" ? context.state.draft.entityTypes : context.state.draft.relationshipTypes;
    delete collection[key];
    repairSelection(context.state);
    paint(context);
  }

  function submitted(context, event) {
    const form = event.target.closest("[data-editor-form]");
    if (!form) return;
    event.preventDefault();
    if (!form.reportValidity()) return;
    submitForm(context, form);
  }

  function submitForm(context, form) {
    try {
      if (form.dataset.editorForm === "field") addField(context, form);
      else commitAddition(context, form);
      context.state.error = "";
      if (form.dataset.editorForm === "addition") centerAddition(context);
      paint(context);
    } catch (error) {
      context.state.error = error.message;
      paint(context);
    }
  }

  function centerAddition(context) {
    ensurePositions(context.state);
    const selection = context.state.selection;
    if (selection.kind === "type") return centerType(context, selection.key);
    const value = definition(context.state);
    const key = (value.target ?? names(context.state))[0];
    if (key) centerType(context, key);
  }

  function uniqueName(name, collection) {
    if (!name.trim()) throw new Error("Enter a nonempty key.");
    if (Object.hasOwn(collection, name)) throw new Error("That key already exists.");
  }

  function addField(context, form) {
    const value = definition(context.state);
    const name = form.elements.name.value.trim();
    value.fields = value.fields ?? {};
    uniqueName(name, value.fields);
    define(value.fields, name, { type: "string" });
    context.state.pendingFields[definitionKey(context.state)] = "";
  }

  function commitAddition(context, form) {
    const values = Object.fromEntries(new FormData(form));
    const name = values.name.trim();
    const kind = context.state.form.kind;
    const collection = additionCollection(context.state, kind);
    const sourceKey = additionSourceKey(context.state);
    uniqueName(name, collection);
    define(collection, name, additionValue(context.state, form, values, kind));
    finishAddition(context.state, kind, name, sourceKey);
  }

  function additionCollection(state, kind) {
    return kind === "type" ? state.draft.entityTypes : state.draft.relationshipTypes;
  }

  function additionSourceKey(state) {
    return state.selection.kind === "type" ? state.selection.key : names(state)[0];
  }

  function additionValue(state, form, values, kind) {
    return kind === "type" ? { fields: {} } : newRelationship(state, form, values);
  }

  function finishAddition(state, kind, name, sourceKey) {
    if (kind === "type") {
      ensurePositions(state);
      positionAddedType(state, name, sourceKey);
    }
    state.selection = { kind, key: name };
    if (supportsViews(state.draft)) state.view = "all";
    state.form = null;
  }

  function positionAddedType(state, key, sourceKey) {
    ["wide", "portrait"].forEach((layout) => {
      const source = state.layouts[layout][sourceKey] ?? { x: 12, y: 20 };
      const candidate = { x: source.x, y: source.y + 130 };
      const occupied = Object.entries(state.layouts[layout])
        .filter(([name]) => name !== key)
        .map(([, point]) => point);
      while (
        occupied.some(
          (point) =>
            Math.abs(point.x - candidate.x) < nodeWidth + 18 &&
            Math.abs(point.y - candidate.y) < nodeHeight + 18,
        )
      ) {
        candidate.y += 110;
      }
      state.layouts[layout][key] = candidate;
    });
  }

  function newRelationship(state, form, values) {
    if (!names(state).includes(values.source) || !names(state).includes(values.target))
      throw new Error("Select existing source and target types.");
    const value = { source: [values.source], target: [values.target], fields: {} };
    if (form.elements.workflow.checked)
      value.workflow = [
        { source: values.source, target: values.target, direction: "forward", label: values.label },
      ];
    return value;
  }

  function validation(state) {
    const errors = [];
    if (Object.values(state.pendingFields).some((value) => value.trim()))
      errors.push("Add the field to the draft or clear its name before saving.");
    if (state.form) errors.push("Finish adding the definition to the draft before saving.");
    Object.entries(state.draft.entityTypes).forEach(([key, value]) =>
      validateFields(key, value, errors),
    );
    Object.entries(state.draft.relationshipTypes).forEach(([key, value]) =>
      validateRelationship(state, key, value, errors),
    );
    return errors;
  }

  function validateFields(key, value, errors) {
    Object.entries(value.fields ?? {}).forEach(([name, field]) =>
      validateField(key, name, field, errors),
    );
  }

  function validateField(key, name, field, errors) {
    if (!fieldTypes.includes(field.type)) errors.push(`${key}.${name}: unsupported field type.`);
    if (field.required !== undefined && typeof field.required !== "boolean")
      errors.push(`${key}.${name}: Required must be boolean.`);
  }

  function validateRelationship(state, key, value, errors) {
    ["source", "target"].forEach((side) => validateEndpoint(state, key, value[side], errors));
    validateFields(key, value, errors);
    const seen = new Set();
    (value.workflow ?? []).forEach((path) => validatePath(state, key, value, path, seen, errors));
  }

  function validateEndpoint(state, key, types, errors) {
    if (types === undefined) return;
    if (!Array.isArray(types)) {
      errors.push(`${key}: endpoint constraints must be arrays.`);
      return;
    }
    if (types.some((type) => !names(state).includes(type)))
      errors.push(`${key}: endpoint refers to a missing type.`);
  }

  function validatePath(state, key, value, path, seen, errors) {
    validatePathTypes(state, key, value, path, errors);
    validatePathProperties(key, path, errors);
    const identity = JSON.stringify([path.source, path.target, path.direction]);
    if (seen.has(identity)) errors.push(`${key}: duplicate authored path.`);
    seen.add(identity);
  }

  function validatePathTypes(state, key, value, path, errors) {
    ["source", "target"].forEach((side) => {
      if (!names(state).includes(path[side]))
        errors.push(`${key}: workflow ${side} type is missing.`);
      if (!allowed(value[side], path[side]))
        errors.push(`${key}: workflow ${side} is not permitted.`);
    });
  }

  function allowed(constraint, type) {
    return constraint === undefined || constraint.includes(type);
  }

  function validatePathProperties(key, path, errors) {
    if (!["forward", "reverse"].includes(path.direction))
      errors.push(`${key}: workflow direction is invalid.`);
    if (!String(path.label ?? "").trim()) errors.push(`${key}: enter a workflow label.`);
    validateFeedback(key, path, errors);
  }

  function validateFeedback(key, path, errors) {
    if (path.feedback !== undefined && typeof path.feedback !== "boolean")
      errors.push(`${key}: Feedback must be boolean.`);
  }

  async function save(context) {
    if (context.busy) return;
    const errors = validation(context.state);
    if (errors.length) {
      context.state.error = errors.join(" ");
      paint(context);
      return;
    }
    context.busy = true;
    const saved = clone(context.state.draft);
    try {
      await saveCallback(context, saved);
      savedState(context, saved);
    } catch (error) {
      context.state.error = `Save failed: ${error.message}. Draft retained.`;
    }
    context.busy = false;
    paint(context);
  }

  function saveCallback(context, saved) {
    return context.config.onSave?.(clone(saved));
  }

  function savedState(context, saved) {
    context.state.base = clone(saved);
    context.state.savedLayouts = clone(context.state.layouts);
    context.state.savedCameras = clone(context.state.cameras);
    context.state.error = "";
    context.state.notice = "Model saved for this study session. Native item data is unchanged.";
  }

  function pointerStart(context, event) {
    const frame = event.target.closest(".model-editor-frame");
    if (!frame || event.button > 0) return;
    const node = event.target.closest("[data-model-node]");
    beginPointer(context, event, node);
  }

  function beginPointer(context, event, node) {
    const point = node ? context.state.layouts[mode()][node.dataset.modelNode] : camera(context);
    context.drag = {
      id: event.pointerId,
      node: node?.dataset.modelNode ?? "",
      x: event.clientX,
      y: event.clientY,
      origin: clone(point),
    };
    context.moved = false;
  }

  function pointerMove(context, event) {
    if (!context.drag) return;
    const dx = event.clientX - context.drag.x,
      dy = event.clientY - context.drag.y;
    if (!context.moved && Math.hypot(dx, dy) < 5) return;
    context.moved = true;
    dragPosition(context, dx, dy);
  }

  function dragPosition(context, dx, dy) {
    const drag = context.drag;
    if (drag.node) return dragNode(context, drag, dx, dy);
    const value = camera(context);
    value.x = drag.origin.x + dx;
    value.y = drag.origin.y + dy;
    draw(context);
  }

  function dragNode(context, drag, dx, dy) {
    const point = context.state.layouts[mode()][drag.node];
    point.x = Math.max(0, drag.origin.x + dx / camera(context).scale);
    point.y = Math.max(0, drag.origin.y + dy / camera(context).scale);
    const element = context.root.querySelector(`[data-model-node="${CSS.escape(drag.node)}"]`);
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
    element.classList.add("is-dragging");
    redrawEdges(context);
  }

  function redrawEdges(context) {
    const svg = context.root.querySelector(".model-editor-wires");
    svg.querySelectorAll(".model-editor-edge").forEach((element) => element.remove());
    const lines = edges(context.state);
    const families = Object.groupBy(lines, (edge) => edge.key);
    svg.insertAdjacentHTML(
      "beforeend",
      lines
        .map((edge) => {
          const family = families[edge.key];
          return edgeMarkup(
            context.state,
            edge,
            family,
            edge === labelOwner(context.state, family),
          );
        })
        .join(""),
    );
  }

  function pointerEnd(context) {
    if (!context.drag) return;
    context.drag = null;
    context.root
      .querySelectorAll(".is-dragging")
      .forEach((element) => element.classList.remove("is-dragging"));
    notify(context);
    updateDraftLabel(context);
  }

  function updateDraftLabel(context) {
    context.root.querySelector(".model-editor-draft-note").textContent = context.state.dirty
      ? "Unsaved session draft"
      : "Session model";
    context.root
      .querySelectorAll("[data-editor-action=save],[data-editor-action=cancel]")
      .forEach((button) => {
        button.disabled = !draftActive(context.state);
      });
  }

  function keyboard(context, event) {
    const frame = event.target.closest(".model-editor-frame");
    if (!frame) return;
    if (event.key === "Escape") return pointerEnd(context);
    keyboardGraph(context, event);
  }

  function keyboardGraph(context, event) {
    const move = {
      ArrowLeft: [-24, 0],
      ArrowRight: [24, 0],
      ArrowUp: [0, -24],
      ArrowDown: [0, 24],
    }[event.key];
    if (!move) return;
    event.preventDefault();
    const node = event.target.closest("[data-model-node]");
    if (node) moveNode(context, node.dataset.modelNode, move);
    else moveCamera(context, move);
  }

  function moveNode(context, key, [x, y]) {
    const point = context.state.layouts[mode()][key];
    point.x = Math.max(0, point.x + x);
    point.y = Math.max(0, point.y + y);
    paint(context, `[data-model-node="${CSS.escape(key)}"]`);
  }

  function moveCamera(context, [x, y]) {
    const value = camera(context);
    value.x -= x;
    value.y -= y;
    draw(context);
    notify(context);
  }

  function wheel(context, event) {
    if (!event.ctrlKey) return;
    if (!event.target.closest(".model-editor-frame")) return;
    event.preventDefault();
    zoom(context, event.deltaY < 0 ? 1.15 : 0.87);
  }

  function viewportChanged(context) {
    if (!context.root.querySelector(".model-editor")) return;
    paint(context);
  }

  window.tracerModelEditor = { render, mount, capture, unmount };
})();
