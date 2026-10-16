(() => {
  const project = window.tracerProject;
  const main = document.querySelector("#main-content");
  const rail = document.querySelector(".project-rail");
  const breadcrumbs = document.querySelector("[data-breadcrumbs]");
  const storageKey = `tracer-study:${project.key}`;
  const graphViewport = matchMedia("(max-width: 720px)");
  let data;
  let entities = new Map();
  const state = {
    section: "overview",
    itemMode: "scope",
    view: "table",
    anchorId: "",
    relationship: project.relationship,
    direction: project.direction,
    selectedId: "",
    inspector: !matchMedia("(max-width: 720px)").matches,
    inspectorTab: "details",
    search: "",
    catalogueType: "",
    page: 0,
    scopeHistory: [],
    scopeFrame: null,
    savedScopes: [],
    created: [],
    edits: {},
    links: [],
    dialog: null,
    draft: null,
    configurationId: "",
    configurationReceipt: "",
    configurationOrigin: "",
    receiptId: "",
    receiptOrigin: null,
    reviews: {},
    modelEditor: null,
    sessionSchema: null,
    notice: "",
  };

  function html(value = "") {
    return String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  function words(value) {
    return String(value).replaceAll("_", " ");
  }

  function label(value) {
    return value[0].toUpperCase() + value.slice(1);
  }

  function capture() {
    if (!data) return null;
    return structuredClone(state);
  }

  function restore(snapshot) {
    if (!data) return;
    if (!snapshot || typeof snapshot !== "object") return;
    Object.keys(state).forEach((key) => restoreProperty(snapshot, key));
    repairAnchors();
    render();
  }

  function repairAnchors() {
    if (!record(state.anchorId))
      state.anchorId = data.entities.find((item) => item.key === project.anchor).id;
    if (!record(state.selectedId)) state.selectedId = state.anchorId;
  }

  function restoreProperty(snapshot, key) {
    if (Object.hasOwn(snapshot, key)) state[key] = structuredClone(snapshot[key]);
  }

  function readSnapshot() {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey));
    } catch {
      return null;
    }
  }

  function persist() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(capture()));
    } catch {
      state.notice = "Session state could not be retained in this browser.";
    }
  }

  function record(id) {
    const original = entities.get(id) ?? state.created.find((item) => item.id === id);
    if (!original) return undefined;
    return { ...original, fields: state.edits[id] ?? original.fields };
  }

  function allRecords() {
    return [...data.entities, ...state.created].map((item) => record(item.id));
  }

  function allLinks() {
    return [...data.relationships, ...state.links];
  }

  function key(item) {
    if (!item) return "Unavailable record";
    return item.key ?? item.studyIdentity ?? "Unavailable record";
  }

  function title(item) {
    return item?.fields.title ?? "Unavailable record";
  }

  function version(item) {
    if (item.studyIdentity) return "Session item";
    if (state.edits[item.id]) return `Native v${item.version} · session edit`;
    return `v${item.version}`;
  }

  function sortRecords(items) {
    return items.toSorted((left, right) => key(left).localeCompare(key(right)));
  }

  function anchor() {
    return record(state.anchorId);
  }

  function selected() {
    return record(state.selectedId);
  }

  function incident(id) {
    return allLinks().filter((link) => [link.source, link.target].includes(id));
  }

  function hasImplementationPaths(item) {
    return project.implementationTypes.includes(item.type);
  }

  function allocationLinks(id) {
    return allLinks().filter((link) => link.source === id && project.hierarchy.includes(link.type));
  }

  function implementationPaths(id) {
    const pending = [{ nodes: [id], links: [] }];
    const paths = [];
    while (pending.length) {
      const path = pending.shift();
      const current = path.nodes.at(-1);
      directionalLinks(current, project.implementation, "outgoing").forEach((link) => {
        paths.push(extendImplementationPath(path, link));
      });
      allocationLinks(current).forEach((link) => queueAllocation(pending, path, link));
    }
    return paths;
  }

  function extendImplementationPath(path, link) {
    return { nodes: [...path.nodes, link.target], links: [...path.links, link] };
  }

  function queueAllocation(pending, path, link) {
    if (path.nodes.includes(link.target)) return;
    pending.push(extendImplementationPath(path, link));
  }

  function inspectorConnections(item) {
    if (!hasImplementationPaths(item)) return incident(item.id);
    return incident(item.id).filter((link) => !isDirectImplementation(item.id, link));
  }

  function isDirectImplementation(id, link) {
    return link.source === id && link.type === project.implementation;
  }

  function directionalLinks(id, relationship, direction) {
    const endpoint = direction === "incoming" ? "target" : "source";
    return allLinks().filter((link) => link[endpoint] === id && link.type === relationship);
  }

  function otherEndpoint(link, direction) {
    return direction === "incoming" ? link.source : link.target;
  }

  function scopeLinks() {
    return directionalLinks(state.anchorId, state.relationship, state.direction);
  }

  function scopeRecords() {
    const ids = [...new Set(scopeLinks().map((link) => otherEndpoint(link, state.direction)))];
    return sortRecords(ids.map(record).filter(Boolean));
  }

  function permits(types, type) {
    return types === undefined || types.includes(type);
  }

  function compatibleRelations() {
    const endpoint = state.direction === "incoming" ? "target" : "source";
    return Object.entries(data.schema.relationshipTypes)
      .filter(([, definition]) => permits(definition[endpoint], anchor().type))
      .map(([name]) => name);
  }

  function normalizeScope() {
    const allowed = compatibleRelations();
    if (!allowed.includes(state.relationship)) state.relationship = allowed[0] ?? "";
  }

  function neighborTypes() {
    const definition = data.schema.relationshipTypes[state.relationship];
    if (!definition) return [];
    const endpoint = state.direction === "incoming" ? "source" : "target";
    return definition[endpoint] ?? Object.keys(data.schema.entityTypes);
  }

  function snapshotScope() {
    const names = [
      "anchorId",
      "relationship",
      "direction",
      "selectedId",
      "view",
      "inspector",
      "inspectorTab",
    ];
    return Object.fromEntries(names.map((name) => [name, state[name]]));
  }

  function useScope(id) {
    state.scopeHistory.push(snapshotScope());
    state.anchorId = id;
    state.selectedId = id;
    state.itemMode = "scope";
    normalizeScope();
    render();
  }

  function returnScope() {
    const previous = state.scopeHistory.pop();
    if (!previous) return;
    Object.assign(state, previous);
    render();
  }

  function outgoing(id, type) {
    return directionalLinks(id, type, "outgoing")
      .map((link) => record(link.target))
      .filter(Boolean);
  }

  function outputReceipts(id) {
    return data.receipts.filter((entry) => entry.receipt.output.id === id);
  }

  function plans(item) {
    return [
      ...project.criteria.flatMap((type) => outgoing(item.id, type)),
      ...directionalLinks(item.id, project.article, "incoming")
        .map((link) => record(link.source))
        .filter(Boolean),
    ];
  }

  function explicitResults(item) {
    const definitions = [item, ...plans(item)];
    const terminals = definitions.flatMap((definition) =>
      outgoing(definition.id, project.execution),
    );
    const found = [...definitions, ...terminals].flatMap((output) => outputReceipts(output.id));
    return [...new Map(found.map((entry) => [entry.receipt.id, entry])).values()];
  }

  function evidenceText(item) {
    const receipts = explicitResults(item);
    if (receipts.length) return receiptContextCount(item, receipts);
    const definitions = plans(item);
    if (definitions.length) return `${definitions.map(key).join(", ")} · no captured result`;
    return planWithoutRun(item);
  }

  function receiptInput(item, entry) {
    return entry.receipt.inputs.find((input) => input.entity.id === item.id);
  }

  function receiptContextCount(item, receipts) {
    if (outputReceipts(item.id).length) return resultCount(receipts.length, "captured result");
    const captured = receipts.filter((entry) => receiptInput(item, entry)).length;
    const related = receipts.length - captured;
    return [
      captured ? resultCount(captured, "captured-input result") : "",
      related ? resultCount(related, `related ${project.context} result`) : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function resultCount(count, noun) {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
  }

  function planWithoutRun(item) {
    if (project.plans.includes(item.type)) return "Definition · no captured result";
    return "—";
  }

  function action(label, name, value = "", className = "quiet-button", disabled = false) {
    return `<button type="button" class="${className}" data-action="${name}" data-value="${html(value)}" ${disabled ? "disabled" : ""}>${html(label)}</button>`;
  }

  function option(value, label, current) {
    return `<option value="${html(value)}" ${value === current ? "selected" : ""}>${html(label)}</option>`;
  }

  function notice() {
    return state.notice ? `<p class="session-notice" role="status">${html(state.notice)}</p>` : "";
  }

  function chrome() {
    breadcrumbs.innerHTML = `<span>${html(project.name)}</span><b>/</b><strong>${html(locationLabel())}</strong>`;
    document.querySelector("[data-schema-version]").textContent = `Schema v${data.schema.version}`;
    document.querySelectorAll("[data-section]").forEach(markSection);
    document.querySelectorAll("[data-item-mode]").forEach(markItemMode);
    document.querySelector("[data-item-scopes]").hidden = state.section !== "items";
  }

  function markSection(button) {
    button.setAttribute(
      "aria-current",
      button.dataset.section === state.section ? "page" : "false",
    );
  }

  function markItemMode(button) {
    const active = state.itemMode === button.dataset.itemMode && !state.receiptId;
    button.setAttribute("aria-current", active ? "location" : "false");
  }

  function locationLabel() {
    if (state.receiptId) return "Captured result";
    return {
      overview: "Overview",
      items: "Items",
      results: "Captured results",
      configurations: "Captured configurations",
      model: "Project model",
    }[state.section];
  }

  function render(focus) {
    if (!data) return;
    chrome();
    window.tracerModelEditor.unmount?.(main);
    main.innerHTML = renderCenter();
    window.tracerModelGraph.attach(main, openOverviewType);
    mountModelEditor();
    syncScopeFrame();
    persist();
    updateIsolation();
    if (focus) requestAnimationFrame(() => main.querySelector(focus)?.focus());
  }

  function syncScopeFrame() {
    if (state.receiptId) return;
    if (state.section !== "items") return;
    if (state.itemMode !== "scope") return;
    state.scopeFrame = snapshotScope();
  }

  function restoreScopeFrame() {
    if (state.scopeFrame) Object.assign(state, state.scopeFrame);
  }

  function renderCenter() {
    if (state.receiptId) return renderReceipt();
    const renderers = {
      overview: renderOverview,
      items: renderItems,
      results: renderResults,
      configurations: renderConfigurations,
      model: renderModel,
    };
    return renderers[state.section]();
  }

  function renderItems() {
    const renderers = { scope: renderWorkspace, all: renderCatalogue, saved: renderSavedScopes };
    return renderers[state.itemMode]();
  }

  function renderOverview() {
    return `<section class="overview-surface"><header class="overview-header"><div><h1>${html(project.name)}</h1><p>${html(project.description)}</p></div>${action("Open current scope", "item-mode", "scope")}</header>
      <dl class="overview-facts">${overviewFacts().map(overviewFact).join("")}</dl>
      <section class="overview-model-preview"><header class="overview-section-header"><h2>Data model</h2>${action("More model details", "section", "model")}</header>${window.tracerModelGraph.render(window.tracerModelGraph.reflect(overviewGraphConfig(), state.sessionSchema, data.schema))}</section>
      <section class="overview-activity"><header class="overview-section-header"><h2>Recent captures</h2></header><div class="overview-activity-list">${recentCaptures().map(overviewActivity).join("")}</div></section></section>`;
  }

  function overviewFacts() {
    return [
      ["Items", data.entities.length],
      ["Types", Object.keys((state.sessionSchema || data.schema).entityTypes).length],
      [
        "Relationship types",
        Object.keys((state.sessionSchema || data.schema).relationshipTypes).length,
      ],
      [project.resultsLabel, data.receipts.length],
      ["Captured configurations", data.configurations.length],
    ];
  }

  function overviewFact([name, count]) {
    return `<div><dt>${html(name)}</dt><dd>${count}</dd></div>`;
  }

  function overviewViewportChanged() {
    if (!["overview", "model"].includes(state.section)) return;
    if (state.receiptId) return;
    render();
  }

  function overviewGraphConfig() {
    if (project.key === "orbit-clean-v1")
      return window.tracerOrbitOverview(data, graphViewport.matches);
    const narrow = graphViewport.matches;
    const [width, height, labelX, labelY] = [
      [1000, 410, 180, 392],
      [320, 850, 10, 838],
    ][Number(narrow)];
    const config = {
      width,
      height,
      totalTypeCount: Object.keys(data.schema.entityTypes).length,
      nodes: cleanGraphNodes(narrow),
      edges: cleanGraphEdges(narrow),
      annotations: [
        {
          text: "4 validation plans · 0 recorded executions",
          x: labelX,
          y: labelY,
          kind: "validation",
        },
      ],
      legend:
        "Core development model. Arrows name configured relationships; the dashed validation route has no recorded execution.",
    };
    return config;
  }

  function cleanGraphNodes(narrow) {
    const layout = [
      ["device", "Device", 20, 30, 10, 14],
      ["user_need", "User need", 180, 30, 10, 114],
      ["product_requirement", "Product requirement", 340, 30, 10, 214],
      ["subsystem_requirement", "Subsystem requirement", 500, 30, 10, 314],
      ["component_requirement", "Component requirement", 660, 30, 10, 414],
      ["design_output", "Design output", 850, 30, 182, 314],
      ["verification_protocol", "Verification protocol", 850, 180, 182, 464],
      ["validation_protocol", "Validation protocol", 180, 315, 182, 114],
      ["test_run", "Evaluation run", 850, 315, 182, 614],
      ["evaluation_configuration", "Evaluation inputs", 500, 180, 10, 744],
    ];
    return layout.map(([key, label, x, y, phoneX, phoneY]) => ({
      key,
      label,
      x: narrow ? phoneX : x,
      y: narrow ? phoneY : y,
      kind: cleanNodeKind(key),
      count: data.entities.filter((item) => item.type === key).length,
      detail: key === "test_run" ? "8 verification · 0 validation" : undefined,
    }));
  }
  function cleanNodeKind(key) {
    return (
      {
        verification_protocol: "verification",
        validation_protocol: "validation",
        test_run: "shared",
      }[key] || "normal"
    );
  }
  function cleanEdge(source, target, relationship, kind, path, label, x, y, dashed = false) {
    return { source, target, relationship, kind, path, label, x, y, dashed };
  }
  function cleanGraphEdges(narrow) {
    return [
      ...cleanIntentEdges(narrow),
      ...cleanDesignEdges(narrow),
      ...cleanVerificationEdges(narrow),
      ...cleanExecutionEdges(narrow),
    ];
  }
  function cleanIntentEdges(narrow) {
    const routes = [
      ["device", "user_need", "has_user_need", "has user need"],
      ["user_need", "product_requirement", "addressed_by_requirement", "addressed by"],
      ["product_requirement", "subsystem_requirement", "allocated_to_subsystem", "allocated to"],
      ["subsystem_requirement", "component_requirement", "allocated_to_component", "allocated to"],
    ];
    return routes.map(([source, target, relationship, label], index) =>
      cleanEdge(
        source,
        target,
        relationship,
        "hierarchy",
        narrow ? `M74 ${74 + index * 100} V${114 + index * 100}` : undefined,
        label,
        narrow ? 74 : 164 + index * 160,
        narrow ? 98 + index * 100 : 103,
      ),
    );
  }
  function cleanDesignEdges(narrow) {
    const routes = [
      ["product_requirement", narrow ? "M138 244 H154 V290 H246 V314" : "M404 30 V0 H914 V30"],
      ["subsystem_requirement", narrow ? "M138 344 H182" : "M564 30 V0 H914 V30"],
      ["component_requirement", narrow ? "M138 444 H162 V398 H246 V374" : "M724 30 V0 H914 V30"],
    ];
    return routes.map(([source, path], index) =>
      cleanEdge(
        source,
        "design_output",
        "implemented_by",
        "design",
        path,
        index === 0 ? "implemented by" : "",
        narrow ? 240 : 790,
        narrow ? 287 : 16,
      ),
    );
  }
  function cleanEdgeAtViewport(row, narrow) {
    const [source, target, relationship, kind, paths, label, xs, ys, dashed = false] = row;
    const index = Number(narrow);
    return cleanEdge(
      source,
      target,
      relationship,
      kind,
      paths[index],
      label,
      xs[index],
      ys[index],
      dashed,
    );
  }
  function cleanVerificationEdges(narrow) {
    const routes = [
      [
        "product_requirement",
        "verification_protocol",
        "verified_by",
        "verification",
        ["M404 90 V118 H808 V198 H850", "M138 244 H168 V484 H182"],
        "verified by",
        [690, 216],
        [168, 449],
      ],
      [
        "subsystem_requirement",
        "verification_protocol",
        "verified_by",
        "verification",
        ["M564 90 V134 H824 V212 H850", "M138 344 H158 V498 H182"],
        "",
        [0, 0],
        [0, 0],
      ],
      [
        "component_requirement",
        "verification_protocol",
        "verified_by",
        "verification",
        ["M724 90 V150 H836 V226 H850", "M138 444 H148 V512 H182"],
        "",
        [0, 0],
        [0, 0],
      ],
      [
        "verification_protocol",
        "design_output",
        "examines_output",
        "verification",
        ["M914 180 V90", "M262 464 V456 H306 V390 H262 V374"],
        "examines output",
        [946, 268],
        [136, 414],
      ],
    ];
    return routes.map((row) => cleanEdgeAtViewport(row, narrow));
  }
  function cleanExecutionEdges(narrow) {
    const routes = [
      [
        "verification_protocol",
        "test_run",
        "produces_result",
        "verification",
        ["M914 240 V315", "M246 524 V614"],
        "produces result",
        [946, 268],
        [278, 568],
      ],
      [
        "user_need",
        "validation_protocol",
        "validated_by",
        "validation",
        ["M244 90 V315", "M138 144 H182"],
        "validated by",
        [280, 230],
        [210, 103],
      ],
      [
        "validation_protocol",
        "test_run",
        "produces_result",
        "validation",
        ["M308 345 H850", "M310 144 H316 V644 H310"],
        "produces result · allowed",
        [552, 230],
        [331, 600],
        true,
      ],
      [
        "test_run",
        "evaluation_configuration",
        "evaluated_configuration",
        "design",
        ["M850 360 H780 V210 H628", "M246 674 V706 H74 V744"],
        "evaluated inputs",
        [704, 156],
        [195, 725],
      ],
    ];
    return routes.map((row) => cleanEdgeAtViewport(row, narrow));
  }

  function recentCaptures() {
    const receipts = data.receipts.map(({ receipt }) => ({
      kind: "receipt",
      id: receipt.id,
      at: receipt.at,
      title: title(receipt.output),
      description: receipt.outcome,
    }));
    const configurations = data.configurations.map((item) => ({
      kind: "capture",
      id: item.id,
      at: item.at,
      title: item.name,
      description: `${item.members.length} pinned native revisions`,
    }));
    return [...receipts, ...configurations]
      .toSorted((left, right) => Date.parse(right.at) - Date.parse(left.at))
      .slice(0, 3);
  }

  function overviewActivity(activity) {
    return `<button type="button" class="overview-activity-row" data-action="overview-${activity.kind}" data-value="${activity.id}"><div><strong>${html(activity.title)}</strong><p>${html(activity.description)}</p></div><time datetime="${html(activity.at)}">${html(activityDate(activity.at))}</time></button>`;
  }

  function activityDate(at) {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(at),
    );
  }

  function openOverviewType(type) {
    state.catalogueType = type;
    state.section = "items";
    state.itemMode = "all";
    state.search = "";
    state.page = 0;
    state.selectedId = data.entities.find((item) => item.type === type).id;
    state.inspector = false;
    render();
  }

  function renderWorkspace() {
    const origin = anchor();
    const items = scopeRecords();
    return `<section class="items-surface">
      <header class="scope-header"><div class="scope-record"><div class="scope-key">${html(key(origin))}<small>${html(version(origin))}</small></div>
      <div class="scope-copy"><strong>${html(title(origin))}</strong><p>${html(origin.fields.statement)}</p></div></div></header>
      ${renderScopeToolbar()}${notice()}
      <div class="workspace-grid ${state.inspector ? "inspector-open" : ""}"><section class="work-area" aria-label="${state.view} view">
      <div class="scope-strip"><strong>${html(state.direction)} ${html(words(state.relationship))}</strong><span>${scopeCount(items)}</span></div>
      ${renderRepresentation(items)}</section>${renderInspector()}</div>${renderDialog()}</section>`;
  }

  function renderScopeToolbar() {
    return `<div class="medical-scope-controls">
      <label>Starting item<select data-control="anchorId" aria-label="Starting item">${sortRecords(
        allRecords(),
      )
        .map((item) => option(item.id, `${key(item)} · ${title(item)}`, state.anchorId))
        .join("")}</select></label>
      <label>Direction<select data-control="direction" aria-label="Scope direction">${["outgoing", "incoming"].map((direction) => option(direction, direction, state.direction)).join("")}</select></label>
      <label>Relationship<select data-control="relationship" aria-label="Scope relationship">${compatibleRelations()
        .map((name) => option(name, words(name), state.relationship))
        .join("")}</select></label>
      ${scopeReturnButton()}</div><div class="local-toolbar"><div class="view-switch" aria-label="Representation">${["table", "document", "graph"].map(renderViewButton).join("")}</div>
      <div class="toolbar-actions">${action(state.inspector ? "Hide inspector" : "Inspect", "inspector")}${connectScopeAction("Connect existing item")}${action("New item", "create", "", "solid-button", !neighborTypes().length)}${action("Save scope", "save-scope")}</div></div>`;
  }

  function scopeCount(items) {
    const links = scopeLinks();
    const overlay = new Set(state.links.map((link) => link.id));
    const session = links.filter((link) => overlay.has(link.id)).length;
    return `${items.length} items · ${links.length - session} recorded connections · ${session} session connections · complete scope`;
  }

  function connectScopeAction(label, id = "") {
    return action(label, "connect", id, "quiet-button", !neighborTypes().length);
  }

  function scopeReturnButton() {
    const previous = state.scopeHistory.at(-1);
    return previous ? action(`Return to ${key(record(previous.anchorId))}`, "return-scope") : "";
  }

  function renderViewButton(view) {
    return `<button type="button" data-action="view" data-value="${view}" data-view="${view}" aria-pressed="${state.view === view}">${label(view)}</button>`;
  }

  function renderRepresentation(items) {
    const renderers = { table: renderTable, document: renderDocument, graph: renderGraph };
    return renderers[state.view](items);
  }

  function renderTable(items) {
    if (!items.length)
      return `<div class="dialog-empty"><p>No recorded ${html(words(state.relationship))} connections in this scope.</p></div>`;
    return `<table class="data-table medical-table"><thead><tr><th>Item</th><th>Statement excerpt</th>${tableContextHeaders()}</tr></thead><tbody>${items.map(tableRow).join("")}</tbody></table>`;
  }

  function needScope() {
    return (
      state.itemMode === "scope" &&
      anchor().type === "device" &&
      state.relationship === "has_user_need"
    );
  }

  function tableContextHeaders() {
    return needScope()
      ? "<th>Product requirements</th><th>Validation</th>"
      : "<th>Type</th><th>Captured evidence</th>";
  }

  function tableRow(item) {
    return `<tr data-action="select" data-value="${item.id}" data-select="${item.id}" tabindex="0" class="${state.selectedId === item.id ? "selected" : ""}" aria-selected="${state.selectedId === item.id}">
      <td><div class="record-cell"><a>${html(key(item))}</a><strong>${html(title(item))}</strong></div></td><td><p class="statement-excerpt">${html(item.fields.statement)}</p></td>${tableContextCells(item)}</tr>`;
  }

  function tableContextCells(item) {
    if (!needScope())
      return `<td>${html(words(item.type))}</td><td>${html(evidenceText(item))}</td>`;
    const requirements = outgoing(item.id, "addressed_by_requirement").filter(
      (target) => target.type === "product_requirement",
    );
    return `<td>${requirements.length} linked · ${html(requirements.map(key).join(", "))}</td><td>${outgoing(item.id, "validated_by").map(validationPlanText).join("<br>")}</td>`;
  }

  function validationPlanText(plan) {
    const execution = String(plan.fields.status).includes("no approval or run")
      ? ""
      : ` · ${executionText(plan)}`;
    return `${html(key(plan))} · ${html(plan.fields.status)}${execution}`;
  }

  function executionText(plan) {
    const runs = outgoing(plan.id, "produces_result");
    return runs.length ? `${runs.length} recorded runs` : "no run";
  }

  function renderDocument(items) {
    return `<article class="document-view"><header><h2>${html(words(state.relationship))}</h2><span>${items.length} full statements</span></header>${items.map(documentItem).join("")}${emptyDocument(items)}</article>`;
  }

  function emptyDocument(items) {
    return items.length ? "" : "<p>No recorded connections in this scope.</p>";
  }

  function documentItem(item) {
    return `<section class="requirement-block ${state.selectedId === item.id ? "selected" : ""}" data-action="select" data-value="${item.id}" data-select="${item.id}" tabindex="0" aria-selected="${state.selectedId === item.id}">
      <header><a>${html(key(item))}</a><h3>${html(title(item))}</h3></header><p>${html(item.fields.statement)}</p><div class="document-meta"><span>${html(words(item.type))}</span><span>${html(evidenceText(item))}</span></div></section>`;
  }

  function renderGraph(items) {
    const nodes = [anchor(), ...items];
    const height = Math.max(320, items.length * 112 + 60);
    const positions = new Map(
      nodes.map((item, index) => [
        item.id,
        { x: index === 0 ? 175 : 640, y: index === 0 ? height / 2 : index * 112 },
      ]),
    );
    return `<div class="graph-view"><header><strong>Recorded ${html(words(state.relationship))}</strong><span>${nodes.length} identities · ${scopeLinks().length} directed connections</span></header>
      <div class="medical-graph-stage" style="height:${height}px"><svg class="medical-graph-wires" viewBox="0 0 840 ${height}" aria-hidden="true"><defs><marker id="medical-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8z" fill="currentColor"/></marker></defs>${scopeLinks()
        .map((link) => graphWire(link, positions))
        .join("")}</svg>
      ${nodes.map((item) => graphNode(item, positions.get(item.id), height)).join("")}</div><div class="medical-edge-list">${scopeLinks().map(renderLinkLine).join("")}</div></div>`;
  }

  function graphWire(link, positions) {
    const source = positions.get(link.source);
    const target = positions.get(link.target);
    if (!source || !target) return "";
    const sign = source.x < target.x ? 1 : -1;
    return `<path d="M ${source.x + sign * 130} ${source.y} L ${target.x - sign * 130} ${target.y}" marker-end="url(#medical-arrow)"/><text x="${(source.x + target.x) / 2}" y="${(source.y + target.y) / 2 - 8}" text-anchor="middle">${html(words(link.type))}</text>`;
  }

  function graphNode(item, point, height) {
    return `<button type="button" class="medical-graph-node ${state.selectedId === item.id ? "selected" : ""}" style="left:${point.x / 8.4}%;top:${(point.y / height) * 100}%" data-action="select" data-value="${item.id}"><span>${html(key(item))} · ${html(version(item))}</span><strong>${html(title(item))}</strong></button>`;
  }

  function renderInspector() {
    const item = selected();
    if (!state.inspector || !item) return "";
    return `<aside class="selection-panel" aria-label="Selected item"><header class="inspector-header" tabindex="-1"><div><small>${html(key(item))} · ${html(words(item.type))}</small><strong>${html(title(item))}</strong></div><div class="inspector-header-actions">${action("Edit", "edit")}${action("×", "inspector", "", "icon-button")}</div></header>
      <div class="inspector-tabs" role="tablist" aria-label="Selected item information">${["details", "history"].map(inspectorTab).join("")}</div><div class="inspector-body">${inspectorContent(item)}</div></aside>`;
  }

  function inspectorTab(tab) {
    return `<button type="button" data-action="inspector-tab" data-value="${tab}" aria-selected="${state.inspectorTab === tab}">${label(tab)}</button>`;
  }

  function inspectorContent(item) {
    if (state.inspectorTab === "history") return renderHistory(item);
    return `<section><h3>Statement</h3><p>${html(item.fields.statement)}</p></section>${inspectorFields(item.fields)}
      <div class="inspector-actions">${action("Use as starting item", "use-scope", item.id)}${inspectorConnect(item)}</div>
      ${renderItemEvidence(item)}${renderImplementationPaths(item)}<section><h3>${hasImplementationPaths(item) ? "Other recorded connections" : "Recorded connections"}</h3>${inspectorConnections(item).map(renderLinkLine).join("")}</section>
      <details><summary>Identity and revision</summary><p>${html(item.id)} · ${html(version(item))}</p></details>`;
  }

  function inspectorFields(fields) {
    return `${renderFields(fields, ["title", "statement", "notes"])}${additionalFields(fields)}`;
  }

  function additionalFields(fields) {
    return fields.notes
      ? `<details><summary>Additional fields</summary>${renderFields({ notes: fields.notes })}</details>`
      : "";
  }

  function inspectorConnect(item) {
    const included = scopeRecords().some((member) => member.id === item.id);
    return included ? "" : connectScopeAction("Connect in current scope", item.id);
  }

  function renderFields(fields, excluded = []) {
    return `<dl class="field-list">${Object.entries(fields)
      .filter(([name]) => !excluded.includes(name))
      .map(fieldPair)
      .join("")}</dl>`;
  }

  function fieldPair([name, value]) {
    return `<div><dt>${html(words(name))}</dt><dd>${html(fieldValue(value))}</dd></div>`;
  }

  function fieldValue(value) {
    return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
  }

  function renderLinkLine(link) {
    return `<div class="medical-link-line">${action(key(record(link.source)), "select", link.source, "text-button")} <span>→ ${html(words(link.type))} →</span> ${action(key(record(link.target)), "select", link.target, "text-button")}<details><summary>Connection fields</summary>${renderFields(link.fields)}</details></div>`;
  }

  function renderImplementationPaths(item) {
    if (!hasImplementationPaths(item)) return "";
    const paths = implementationPaths(item.id);
    const direct = paths.filter((path) => path.nodes.length === 2);
    const derived = paths.filter((path) => path.nodes.length > 2);
    return `<section class="implementation-paths"><h3>Implementation paths</h3>${renderDirectImplementation(item, direct)}${renderDerivedImplementation(derived, direct)}<small>Calculated paths create no stored links and do not inherit ${html(project.inheritedEvidence)}.</small></section>`;
  }

  function renderDirectImplementation(item, paths) {
    if (!permits(data.schema.relationshipTypes[project.implementation].source, item.type))
      return "";
    return `<h4>Direct · recorded</h4>${paths.map((path) => renderLinkLine(path.links[0])).join("")}${paths.length ? "" : "<p>No direct implementation link.</p>"}`;
  }

  function groupImplementationPaths(paths) {
    const groups = new Map();
    paths.forEach((path) => {
      const id = path.nodes.at(-1);
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(path);
    });
    return [...groups].toSorted(([left], [right]) =>
      key(record(left)).localeCompare(key(record(right))),
    );
  }

  function renderDerivedImplementation(paths, direct) {
    const directIds = new Set(direct.map((path) => path.nodes.at(-1)));
    const rows = groupImplementationPaths(paths).map(([id, routes]) =>
      derivedImplementationRow(id, routes, directIds),
    );
    return `<h4>Through hierarchy · derived</h4>${rows.join("")}${paths.length ? "" : "<p>No design output reachable through the hierarchy.</p>"}`;
  }

  function derivedImplementationRow(id, routes, directIds) {
    const item = record(id);
    const via = routes[0].nodes
      .slice(1, -1)
      .map((node) => key(record(node)))
      .join(" → ");
    return `<div class="implementation-output">${action(`${key(item)} · ${title(item)}`, "select", id, "text-button")}<small>Via ${html(via)}</small><details><summary>${routes.length} allocation ${routes.length === 1 ? "path" : "paths"}${directIds.has(id) ? " · also directly linked" : ""}</summary>${routes.map(renderImplementationPath).join("")}</details></div>`;
  }

  function renderImplementationPath(path) {
    const nodes = path.nodes.map((id) => action(key(record(id)), "select", id, "text-button"));
    const relations = path.links.map((link) => `<span>${html(link.type)}</span>`).join(" → ");
    return `<div class="implementation-route"><div>${nodes.join(" → ")}</div><small>${relations}</small><p>${html(path.links.at(-1).fields.scope ?? "")}</p></div>`;
  }

  function renderItemEvidence(item) {
    const receipts = explicitResults(item);
    if (needScope() && !receipts.length) return "";
    return `<section><h3>${outputReceipts(item.id).length ? "Captured results" : "Related captured results"}</h3>${receipts.map((entry) => receiptButton(entry, item)).join("")}${emptyEvidence(item, receipts)}</section>`;
  }

  function emptyEvidence(item, receipts) {
    if (receipts.length) return "";
    return `<p>${html(evidenceText(item) === "—" ? "No result reached through the recorded evaluation routes." : evidenceText(item))}</p>`;
  }

  function receiptButton(entry, item) {
    return `<div class="medical-result-action"><p>${html(entry.receipt.outcome)}</p><small>${html(receiptItemContext(item, entry))}</small>${action(`Open ${key(entry.receipt.output)} receipt`, "receipt", entry.receipt.id)}</div>`;
  }

  function receiptItemContext(item, entry) {
    if (entry.receipt.output.id === item.id)
      return `Recorded output · captured v${entry.receipt.output.version}`;
    const input = receiptInput(item, entry);
    if (input) return `Declared input · captured v${input.entity.version}`;
    return `Reached through current ${project.context} links; item is not a declared captured input.`;
  }

  function renderHistory(item) {
    const captures = loadedSnapshots();
    const versions = captures.filter((input) => input.id === item.id);
    const unique = [...new Map(versions.map((input) => [input.version, input])).values()];
    return `<div class="history-list"><article><b>${html(version(item))} · current</b><p>${html(item.fields.statement)}</p></article>${unique
      .filter((input) => input.version !== item.version)
      .map(historicalItem)
      .join("")}<p>Only revisions present in this loaded fixture are available.</p></div>`;
  }

  function loadedSnapshots() {
    const receipts = data.receipts.flatMap(({ receipt }) => [
      receipt.output,
      ...receipt.inputs.map((input) => input.entity),
    ]);
    const configurations = data.configurations.flatMap((configuration) => [
      configuration.subject,
      ...configuration.members.map((member) => member.entity),
    ]);
    return [...receipts, ...configurations];
  }

  function historicalItem(item) {
    return `<article><b>Captured v${item.version} · read only</b><p>${html(item.fields.statement)}</p>${renderFields(item.fields, ["statement"])}</article>`;
  }

  function matchingRecords() {
    const query = state.search.trim().toLowerCase();
    return sortRecords(
      catalogueRecords().filter((item) =>
        `${key(item)} ${item.type} ${JSON.stringify(item.fields)}`.toLowerCase().includes(query),
      ),
    );
  }

  function catalogueRecords() {
    return state.catalogueType
      ? allRecords().filter((item) => item.type === state.catalogueType)
      : allRecords();
  }

  function renderCatalogue() {
    const matches = matchingRecords();
    const start = state.page * 25;
    const items = matches.slice(start, start + 25);
    return `<section class="items-surface catalogue-surface"><header class="catalogue-header"><h1>${catalogueTitle()}</h1><span>${data.entities.length} native records · ${state.created.length} session items</span></header>
      <div class="local-toolbar"><label>Search<input type="search" data-search="catalogue" aria-label="Search all items" value="${html(state.search)}"></label>${catalogueReset()}${action("New item", "create")}</div>${notice()}
      <div class="workspace-grid ${state.inspector ? "inspector-open" : ""}"><section class="work-area">${renderTable(items)}<div class="catalogue-footer"><span>${matches.length} matching · ${items.length} loaded</span>${pager(matches.length)}</div></section>${renderInspector()}</div>${renderDialog()}</section>`;
  }

  function catalogueTitle() {
    return state.catalogueType ? html(label(words(state.catalogueType))) : "All items";
  }

  function catalogueReset() {
    return state.catalogueType ? action("All types", "item-mode", "all") : "";
  }

  function pager(total) {
    return `<button type="button" class="quiet-button" data-action="page" data-value="-1" ${state.page === 0 ? "disabled" : ""}>Previous</button><button type="button" class="quiet-button" data-action="page" data-value="1" ${(state.page + 1) * 25 >= total ? "disabled" : ""}>Next</button>`;
  }

  function renderSavedScopes() {
    return `<section class="catalogue-surface"><header class="catalogue-header"><h1>Saved scopes</h1><span>${state.savedScopes.length} session scopes</span></header>${notice()}<div class="configuration-grid">${state.savedScopes.map(savedScopeCard).join("")}${emptySavedScopes()}</div></section>`;
  }

  function emptySavedScopes() {
    return state.savedScopes.length
      ? ""
      : `<p>No saved scopes yet. Save the current item context from its toolbar.</p>${action("Open current scope", "item-mode", "scope")}`;
  }

  function savedScopeCard(scope, index) {
    return `<article class="configuration-card"><strong>${html(scope.name)}</strong><p>${html(key(record(scope.anchorId)))} · ${html(scope.direction)} ${html(words(scope.relationship))}</p>${action("Open scope", "open-saved", index)}</article>`;
  }

  function renderResults() {
    return `<section class="catalogue-surface"><header class="catalogue-header"><h1>Captured results</h1><span>${data.receipts.length} ${html(project.resultsDescription)}</span></header><table class="catalogue-table"><thead><tr><th>Output</th><th>Recorded outcome</th><th>Inputs</th><th>Comparison</th><th></th></tr></thead><tbody>${data.receipts.map(resultRow).join("")}</tbody></table></section>`;
  }

  function resultRow(entry) {
    const summary = comparisonSummary(entry);
    return `<tr><td>${html(key(entry.receipt.output))}<strong>${html(title(entry.receipt.output))}</strong></td><td>${html(entry.receipt.outcome)}</td><td>${entry.receipt.inputs.length}</td><td>${summary.changed} changed · ${summary.unknown} unknown</td><td>${action("Open receipt", "receipt", entry.receipt.id)}</td></tr>`;
  }

  function renderConfigurations() {
    return `<section class="catalogue-surface">${returnToReceiptButton()}<header class="catalogue-header"><h1>Captured configurations</h1><span>${data.configurations.length} immutable captures</span></header><div class="configuration-grid">${data.configurations.map(configurationCard).join("")}</div>${configurationDetails()}</section>`;
  }

  function returnToReceiptButton() {
    if (state.configurationReceipt)
      return action("Return to captured result", "configuration-return");
    return state.configurationOrigin === "overview"
      ? action("Return to Overview", "section", "overview")
      : "";
  }

  function configurationCard(capture) {
    return `<article class="configuration-card"><strong>${html(capture.name)}</strong><p>${html(title(capture.subject))}</p><small>${capture.members.length} item pins · ${capture.relationships.length} relationship pins · ${html(capture.at)}</small>${action("Inspect capture", "configuration", capture.id)}</article>`;
  }

  function configurationDetails() {
    const capture = data.configurations.find((item) => item.id === state.configurationId);
    if (!capture) return "";
    return `<section class="medical-capture-detail"><h2>${html(capture.name)}</h2><p>${html(capture.reason)}</p><table class="catalogue-table"><thead><tr><th>Pinned item</th><th>Captured revision</th><th>Current record</th><th>Details</th></tr></thead><tbody>${capture.members.map(configurationMember).join("")}</tbody></table>${configurationRelationships(capture)}<details><summary>Capture identity</summary><p>${html(capture.id)}</p><p>${html(capture.actor)} · ${html(capture.at)}</p></details></section>`;
  }

  function configurationMember(member) {
    const item = member.entity;
    return `<tr><td>${html(key(item))} · ${html(title(item))}</td><td><span class="compact-column-label">Captured: </span>v${item.version}</td><td><span class="compact-column-label">Current: </span>${html(version(record(item.id)))}</td><td><details><summary>Captured fields and pin</summary>${renderFields(item.fields)}<p>${html(member.revisionId)} · project revision ${member.projectRevision}</p></details></td></tr>`;
  }

  function configurationRelationships(capture) {
    return `<details><summary>${capture.relationships.length} captured relationships</summary><table class="catalogue-table"><thead><tr><th>Relationship</th><th>Source → target</th><th>Captured revision</th><th>Current connection</th><th>Pin</th></tr></thead><tbody>${capture.relationships.map(configurationRelationship).join("")}</tbody></table></details>`;
  }
  function configurationRelationship(pin) {
    const link = pin.relationship;
    return `<tr><td>${html(words(link.type))}</td><td>${html(key(record(link.source)))} → ${html(key(record(link.target)))}</td><td><span class="compact-column-label">Captured: </span>v${link.version}</td><td><span class="compact-column-label">Current: </span>${html(capturedConnectionState(link))}</td><td><details><summary>Fields and identity</summary>${renderFields(link.fields)}<p>${html(link.id)} · ${html(pin.revisionId)} · project revision ${pin.projectRevision}</p></details></td></tr>`;
  }

  function capturedConnectionState(captured) {
    const current = data.relationships.find((link) => link.id === captured.id);
    if (!current) return "Removed after capture";
    return current.version === captured.version ? "Unchanged" : `Updated to v${current.version}`;
  }

  function medicalModelOptions() {
    const counts = Object.fromEntries(
      Object.keys(data.schema.entityTypes).map((type) => [
        type,
        data.entities.filter((item) => item.type === type).length,
      ]),
    );
    return { schema: state.sessionSchema || data.schema, counts, state: state.modelEditor };
  }
  function renderModel() {
    return window.tracerModelEditor.render(medicalModelOptions());
  }
  function mountModelEditor() {
    if (state.section !== "model" || state.receiptId) return;
    window.tracerModelEditor.mount(main, {
      ...medicalModelOptions(),
      onState: (snapshot) => {
        state.modelEditor = snapshot;
        persist();
      },
      onSave: (schema) => {
        state.sessionSchema = schema;
        persist();
      },
    });
  }

  function receiptEntry() {
    return data.receipts.find((entry) => entry.receipt.id === state.receiptId);
  }

  function inputComparison(entry, input) {
    const loaded = entry.comparison.inputs.find(
      (comparison) => comparison.entityId === input.entityId,
    );
    const current = record(input.entityId);
    if (!current) return { state: "unknown", current, hasChanged: false, hasUnknown: true };
    const edited = state.edits[input.entityId];
    if (!edited) return loadedComparison(loaded, current);
    const changed = JSON.stringify(current.fields) !== JSON.stringify(input.entity.fields);
    return {
      current,
      hasChanged: changed,
      hasUnknown: false,
      state: changed ? "changed" : "current",
      session: true,
    };
  }

  function loadedComparison(loaded, current) {
    return { ...loaded, current: loaded?.current?.entity ?? current };
  }

  function comparisonSummary(entry) {
    const inputs = entry.receipt.inputs.map((input) => inputComparison(entry, input));
    return {
      changed: inputs.filter((input) => input.hasChanged).length,
      unknown: inputs.filter((input) => input.hasUnknown).length,
    };
  }

  function reviewState() {
    return state.reviews[state.receiptId] ?? { decision: "", rationale: "", saved: false };
  }

  function renderReceipt() {
    const entry = receiptEntry();
    const receipt = entry.receipt;
    const summary = comparisonSummary(entry);
    return `<section class="receipt-surface">${action(`← ${receiptReturnLabel()}`, "return-receipt", "", "receipt-return")}
      <header class="receipt-heading"><div><h1 tabindex="-1" data-receipt-heading>${html(title(receipt.output))}</h1><p>${html(key(receipt.output))} · captured v${receipt.output.version} · ${html(receipt.at)}</p></div><span>${reviewState().saved ? "Session judgment saved" : "Unreviewed"}</span></header>
      ${notice()}<div class="receipt-grid"><div><div class="receipt-summary"><div><small>Recorded outcome</small><span>${html(receipt.outcome)}</span></div></div>
      <details class="output-disclosure"><summary>Captured output details</summary>${renderFields(receipt.output.fields)}<p>Receipt ${html(receipt.id)} · ${html(receipt.actor)}</p>${receiptConfigurationLink(receipt)}</details>
      <section class="receipt-inputs"><header><h2>Inputs used by this result</h2><p>${receipt.inputs.length} captured records · ${summary.changed} changed · ${summary.unknown} unknown</p></header>${receipt.inputs.map((input) => renderInput(entry, input)).join("")}</section></div>${renderReview(entry)}</div></section>`;
  }

  function receiptConfigurationLink(receipt) {
    return receipt.configuration
      ? action(receipt.configuration.name, "receipt-configuration", receipt.configuration.id)
      : "";
  }

  function receiptReturnLabel() {
    const origin = state.receiptOrigin ?? state;
    const sectionLabel = sectionReturnLabel(origin.section);
    if (sectionLabel) return sectionLabel;
    if (origin.itemMode === "all") return "Return to all items";
    return `Return to ${key(record(origin.anchorId))} scope`;
  }

  function sectionReturnLabel(section) {
    return { overview: "Return to Overview", results: "Return to captured results" }[section];
  }

  function renderInput(entry, input) {
    const comparison = inputComparison(entry, input);
    return `<details ${inputAttributes(comparison)}><summary><span><a>${html(key(input.entity))}</a><strong>${html(title(input.entity))}</strong></span><span>captured v${input.entity.version} · ${html(comparisonLabel(comparison))}</span></summary>
      ${inputDifference(input, comparison)}<details><summary>All captured fields and revision pin</summary>${renderFields(input.entity.fields)}<p>${html(pinRevision(input))} · ${html(input.entityId)}</p></details></details>`;
  }

  function inputAttributes(comparison) {
    return comparison.hasChanged ? 'class="receipt-input changed" open' : 'class="receipt-input"';
  }

  function pinRevision(input) {
    return input.pin?.revisionId ?? "No native pin";
  }

  function comparisonLabel(comparison) {
    if (comparison.session) return `${comparison.state} in session overlay`;
    if (comparison.hasUnknown) return "unknown";
    return `${comparison.state} · current v${comparison.current.version}`;
  }

  function inputDifference(input, comparison) {
    if (!comparison.hasChanged) return `<p>${html(input.entity.fields.statement)}</p>`;
    const currentFields = comparison.current?.fields ?? {};
    const names = Object.keys(input.entity.fields).filter(
      (name) => JSON.stringify(input.entity.fields[name]) !== JSON.stringify(currentFields[name]),
    );
    return `<div class="input-comparison">${names.map((name) => differencePair(name, input.entity.fields[name], currentFields[name])).join("")}</div>`;
  }

  function differencePair(name, before, after) {
    return `<div><small>Captured ${html(words(name))}</small><p>${html(fieldValue(before))}</p></div><div><small>Current ${html(words(name))}</small><p>${html(fieldValue(after))}</p></div>`;
  }

  function renderReview(entry) {
    const review = reviewState();
    const unknown = comparisonSummary(entry).unknown > 0;
    const choices = {
      accepted: "Evidence still applicable",
      acknowledged: "Acknowledge change",
      needs_reevaluation: "Needs reevaluation",
    };
    return `<aside class="review-card"><h2>Review this receipt</h2><form data-form="review"><label>Judgment<select name="decision" required>${option("", "Select…", review.decision)}${Object.entries(
      choices,
    )
      .map(([value, label]) => reviewOption(value, label, review.decision, unknown))
      .join(
        "",
      )}</select></label><label>Rationale<textarea name="rationale" rows="5" required>${html(review.rationale)}</textarea></label><button class="solid-button" type="submit">Save judgment</button></form><small>Saved for this session. The immutable outcome stays unchanged.</small></aside>`;
  }

  function reviewOption(value, label, current, unknown) {
    return `<option value="${value}" ${value === current ? "selected" : ""} ${value === "accepted" && unknown ? "disabled" : ""}>${label}</option>`;
  }

  function renderDialog() {
    if (!state.dialog) return "";
    const renderers = {
      create: createDialog,
      edit: editDialog,
      connect: connectDialog,
      "save-scope": saveScopeDialog,
    };
    return `<div class="dialog-backdrop"><section class="work-dialog" role="dialog" aria-modal="true" aria-label="${html(words(state.dialog))}">${renderers[state.dialog]()}</section></div>`;
  }

  function dialogHeader(label) {
    return `<header><h2>${html(label)}</h2>${action("×", "close-dialog", "", "icon-button")}</header>`;
  }

  function dialogFooter(label) {
    return `<footer>${action("Cancel", "close-dialog")}<button type="submit" class="solid-button">${html(label)}</button></footer>`;
  }

  function createDialog() {
    const draft = state.draft;
    return `${dialogHeader("New item")}<form data-form="create"><label>Type<select name="type" data-control="draftType">${createTypes()
      .map((type) => option(type, words(type), draft.type))
      .join(
        "",
      )}</select></label>${fieldInputs(data.schema.entityTypes[draft.type].fields, draft.fields)}<p>Save without connections; linking is optional.</p>${dialogFooter("Save item")}</form>`;
  }

  function createTypes() {
    if (state.itemMode === "scope") return neighborTypes();
    return state.catalogueType ? [state.catalogueType] : Object.keys(data.schema.entityTypes);
  }

  function editDialog() {
    const item = selected();
    return `${dialogHeader(`Edit ${key(item)}`)}<form data-form="edit">${fieldInputs(data.schema.entityTypes[item.type].fields, state.draft.fields)}${dialogFooter("Save changes")}</form>`;
  }

  function fieldInputs(definitions, values) {
    return Object.entries(definitions)
      .map(([name, definition]) => fieldInput(name, definition, values[name]))
      .join("");
  }

  function fieldInput(name, definition, value = "") {
    const required = definition.required ? "required" : "";
    return `<label>${html(words(name))}<small>${definition.type} · ${definition.required ? "required" : "optional"}</small>${fieldControl(name, definition.type, value, required)}</label>`;
  }

  function fieldControl(name, type, value, required) {
    if (type === "number")
      return `<input name="${html(name)}" type="number" step="any" value="${html(value)}" ${required}>`;
    if (type === "json")
      return `<textarea name="${html(name)}" rows="4" data-json ${required}>${html(jsonFieldValue(value))}</textarea>`;
    return stringControl(name, value, required);
  }

  function jsonFieldValue(value) {
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }

  function stringControl(name, value, required) {
    if (["statement", "notes", "acceptance", "scope"].includes(name))
      return `<textarea name="${html(name)}" rows="4" ${required}>${html(value)}</textarea>`;
    return `<input name="${html(name)}" value="${html(value)}" ${required}>`;
  }

  function availableCandidates() {
    const types = neighborTypes();
    const existing = new Set(scopeRecords().map((item) => item.id));
    return sortRecords(
      allRecords().filter((item) => types.includes(item.type) && !existing.has(item.id)),
    );
  }

  function connectDialog() {
    const candidates = availableCandidates();
    const candidate = record(state.draft.candidateId);
    const definition = data.schema.relationshipTypes[state.relationship];
    return `${dialogHeader("Connect existing item")}<form data-form="connect"><label>Candidate<select name="candidateId" data-control="candidateId" required>${option("", "Select an existing item", state.draft.candidateId)}${candidates.map((item) => option(item.id, `${key(item)} · ${title(item)}`, state.draft.candidateId)).join("")}</select></label>
      ${connectionPreview(candidate)}${fieldInputs(definition.fields ?? {}, state.draft.fields)}<p>${candidates.length} compatible unconnected items. Compatibility does not establish suitability.</p>${dialogFooter("Record connection")}</form>`;
  }

  function connectionPreview(candidate) {
    if (!candidate) return "<p>Select a candidate to inspect the exact endpoints.</p>";
    const endpoints = connectionEndpoints(candidate.id);
    return `<section class="connection-source-preview"><strong>${html(key(record(endpoints.source)))} → ${html(words(state.relationship))} → ${html(key(record(endpoints.target)))}</strong><p>${html(anchor().fields.statement)}</p><p>${html(candidate.fields.statement)}</p><small>Source ${html(version(record(endpoints.source)))} · target ${html(version(record(endpoints.target)))}</small></section>`;
  }

  function connectionEndpoints(candidateId) {
    return state.direction === "incoming"
      ? { source: candidateId, target: state.anchorId }
      : { source: state.anchorId, target: candidateId };
  }

  function saveScopeDialog() {
    return `${dialogHeader("Save scope")}<form data-form="save-scope"><label>Name<input name="name" value="${html(state.draft.name)}" required></label>${dialogFooter("Save scope")}</form>`;
  }

  function openDialog(kind, candidateId = "") {
    if (!canOpenDialog(kind)) return;
    state.dialog = kind;
    state.draft = state.draft ?? newDraft(kind, candidateId);
    render(".work-dialog input, .work-dialog select, .work-dialog textarea");
  }

  function canOpenDialog(kind) {
    if (state.dialog && state.dialog !== kind) return false;
    return kind !== "create" || createTypes().length > 0;
  }

  function newDraft(kind, candidateId) {
    const drafts = {
      create: createDraft,
      edit: editDraft,
      connect: () => connectionDraft(candidateId),
      "save-scope": () => ({ name: `${key(anchor())} · ${words(state.relationship)}` }),
    };
    return drafts[kind]();
  }

  function createDraft() {
    return { type: createTypes()[0], fields: {} };
  }

  function editDraft() {
    return { id: state.selectedId, fields: structuredClone(selected().fields) };
  }

  function connectionDraft(candidateId) {
    const valid = availableCandidates().some((item) => item.id === candidateId);
    const id = valid ? candidateId : "";
    return { candidateId: id, fields: {} };
  }

  function closeDialog() {
    state.dialog = null;
    state.draft = null;
    render();
  }

  function updateIsolation() {
    rail.inert = Boolean(state.dialog);
    document.querySelector(".global-bar").inert = Boolean(state.dialog);
    main.querySelectorAll(".items-surface > :not(.dialog-backdrop)").forEach((element) => {
      element.inert = Boolean(state.dialog);
    });
  }

  function openReceipt(id) {
    state.receiptOrigin = {
      section: state.section,
      itemMode: state.itemMode,
      ...snapshotScope(),
      scroll: scrollY,
    };
    state.receiptId = id;
    render("[data-receipt-heading]");
    scrollTo(0, 0);
  }

  function returnReceipt() {
    const origin = state.receiptOrigin;
    state.receiptId = "";
    if (origin) Object.assign(state, origin);
    render(`[data-select="${state.selectedId}"]`);
    requestAnimationFrame(() => scrollTo(0, origin?.scroll ?? 0));
  }

  function setSection(section) {
    state.section = section;
    state.receiptId = "";
    closeRail();
    render();
  }

  function setItemMode(mode) {
    state.itemMode = mode;
    if (mode === "scope") restoreScopeFrame();
    if (mode === "all") state.catalogueType = "";
    state.section = "items";
    state.receiptId = "";
    closeRail();
    render();
  }

  function select(id) {
    state.selectedId = id;
    state.inspector = true;
    state.inspectorTab = "details";
    render();
  }

  function changeScope(name, value) {
    state[name] = value;
    normalizeScope();
    state.selectedId = state.anchorId;
    render();
  }

  function controlChanged(event) {
    const name = event.target.dataset.control;
    const controls = {
      anchorId: changeScope,
      direction: changeScope,
      relationship: changeScope,
      draftType: changeDraftType,
      candidateId: changeCandidate,
    };
    if (controls[name]) controls[name](name, event.target.value);
  }

  function changeDraftType(_name, value) {
    state.draft.type = value;
    state.draft.fields = {};
    render();
  }

  function changeCandidate(_name, value) {
    state.draft.candidateId = value;
    render();
  }

  function inputChanged(event) {
    const form = event.target.closest("form[data-form]");
    if (form) retainForm(form);
    if (event.target.dataset.search === "catalogue") searchCatalogue(event.target.value);
    persist();
  }

  function retainForm(form) {
    const values = Object.fromEntries(new FormData(form));
    if (form.dataset.form === "review") return retainReview(values);
    if (!state.draft) return;
    retainDraft(values);
  }

  function retainDraft(values) {
    if (state.dialog === "save-scope") {
      state.draft.name = values.name;
      return;
    }
    state.draft.fields = { ...values };
    delete state.draft.fields.type;
    delete state.draft.fields.candidateId;
  }

  function retainReview(values) {
    state.reviews[state.receiptId] = { ...reviewState(), ...values, saved: false };
  }

  function searchCatalogue(value) {
    const position = document.querySelector("[data-search='catalogue']")?.selectionStart;
    state.search = value;
    state.page = 0;
    render("[data-search='catalogue']");
    requestAnimationFrame(() =>
      document.querySelector("[data-search='catalogue']")?.setSelectionRange(position, position),
    );
  }

  function readFields(form, definitions) {
    return Object.fromEntries(
      Object.entries(definitions).flatMap(([name, definition]) =>
        readField(form, name, definition),
      ),
    );
  }

  function readField(form, name, definition) {
    const value = form.elements.namedItem(name).value;
    if (!value && !definition.required) return [];
    return [[name, convertField(value, definition.type)]];
  }

  function convertField(value, type) {
    const converters = { number: Number, json: JSON.parse };
    return converters[type] ? converters[type](value) : value;
  }

  function submit(event) {
    const form = event.target.closest("[data-form]");
    if (!form) return;
    event.preventDefault();
    if (!form.reportValidity()) return;
    submitForm(form);
  }

  function submitForm(form) {
    const handlers = {
      create: saveItem,
      edit: saveEdit,
      connect: saveConnection,
      review: saveReview,
      "save-scope": saveScope,
    };
    try {
      handlers[form.dataset.form](form);
    } catch (error) {
      formFeedback(form, error.message);
    }
  }

  function formFeedback(form, message) {
    let feedback = form.querySelector("[data-form-error]");
    if (!feedback) {
      feedback = document.createElement("p");
      feedback.dataset.formError = "";
      feedback.setAttribute("role", "alert");
      form.append(feedback);
    }
    feedback.textContent = message;
  }

  function saveItem(form) {
    const type = form.elements.type.value;
    const fields = readFields(form, data.schema.entityTypes[type].fields);
    const item = {
      id: `${project.key}-session-${crypto.randomUUID()}`,
      studyIdentity: `Study item ${state.created.length + 1}`,
      type,
      version: 1,
      fields,
    };
    state.created.push(item);
    state.selectedId = item.id;
    state.itemMode = "all";
    state.search = "";
    state.page = (matchingRecords().findIndex((candidate) => candidate.id === item.id) / 25) | 0;
    state.inspector = true;
    state.notice = `${key(item)} saved for this session without connections.`;
    closeDialog();
  }

  function saveEdit(form) {
    const item = selected();
    state.edits[item.id] = readFields(form, data.schema.entityTypes[item.type].fields);
    state.notice = `${key(item)} updated for this session. Native revision and captures are unchanged.`;
    closeDialog();
  }

  function saveConnection(form) {
    const candidateId = form.elements.candidateId.value;
    if (!availableCandidates().some((item) => item.id === candidateId))
      throw new Error("Select a compatible unconnected item.");
    const definition = data.schema.relationshipTypes[state.relationship];
    const fields = readFields(form, definition.fields ?? {});
    state.links.push({
      id: `${project.key}-link-${crypto.randomUUID()}`,
      type: state.relationship,
      version: 1,
      ...connectionEndpoints(candidateId),
      fields,
    });
    state.selectedId = candidateId;
    state.itemMode = "scope";
    state.notice = `Connection recorded for this session. Returned to ${key(anchor())} scope.`;
    closeDialog();
  }

  function saveReview(form) {
    const values = Object.fromEntries(new FormData(form));
    if (!values.rationale.trim()) throw new Error("Enter a rationale for this exact receipt.");
    if (values.decision === "accepted" && comparisonSummary(receiptEntry()).unknown)
      throw new Error("Unknown inputs prevent an accepted judgment.");
    state.reviews[state.receiptId] = { ...values, saved: true };
    state.notice = "Judgment saved for this session. The recorded outcome is unchanged.";
    render();
  }

  function saveScope(form) {
    state.savedScopes.push({ name: form.elements.name.value, ...snapshotScope() });
    state.notice = "Scope saved for this session.";
    closeDialog();
  }

  const actions = {
    select,
    view: (value) => {
      state.view = value;
      render();
    },
    inspector: () => {
      state.inspector = !state.inspector;
      render();
    },
    "inspector-tab": (value) => {
      state.inspectorTab = value;
      render();
    },
    "use-scope": useScope,
    "return-scope": returnScope,
    create: () => openDialog("create"),
    edit: () => openDialog("edit"),
    connect: (value) => openDialog("connect", value),
    "close-dialog": closeDialog,
    "save-scope": () => openDialog("save-scope"),
    "item-mode": setItemMode,
    "open-saved": (value) => {
      state.scopeFrame = state.savedScopes[Number(value)];
      setItemMode("scope");
    },
    page: (value) => {
      state.page += Number(value);
      render();
    },
    receipt: openReceipt,
    "return-receipt": returnReceipt,
    configuration: (value) => {
      state.configurationId = value;
      render();
    },
    "receipt-configuration": (value) => {
      state.configurationReceipt = state.receiptId;
      state.receiptId = "";
      state.configurationId = value;
      setSection("configurations");
    },
    "configuration-return": () => {
      state.receiptId = state.configurationReceipt;
      state.configurationReceipt = "";
      render("[data-receipt-heading]");
    },
    section: setSection,
    "overview-type": openOverviewType,
    "overview-receipt": openReceipt,
    "overview-capture": (value) => {
      state.configurationOrigin = "overview";
      state.configurationReceipt = "";
      state.configurationId = value;
      setSection("configurations");
    },
    retry: boot,
  };

  function click(event) {
    const element = event.target.closest("[data-action]");
    if (!element || !main.contains(element)) return;
    actions[element.dataset.action]?.(element.dataset.value);
  }

  function keyboard(event) {
    if (state.dialog) return dialogKeyboard(event);
    if (!["Enter", " "].includes(event.key)) return;
    const element = event.target.closest("[data-select], .medical-model-node");
    if (element) {
      event.preventDefault();
      actions[element.dataset.action](element.dataset.value);
    }
  }

  function dialogKeyboard(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;
    trapDialogTab(event);
  }

  function trapDialogTab(event) {
    const controls = [
      ...main.querySelectorAll(
        ".work-dialog button, .work-dialog input, .work-dialog select, .work-dialog textarea",
      ),
    ].filter((element) => !element.disabled);
    const index = controls.indexOf(document.activeElement);
    const next = index + (event.shiftKey ? -1 : 1);
    if (next < 0 || next >= controls.length) {
      event.preventDefault();
      controls[(next + controls.length) % controls.length].focus();
    }
  }

  function navigationClick(event) {
    const section = event.target.closest("[data-section]");
    if (section) setSection(section.dataset.section);
    const mode = event.target.closest("[data-item-mode]");
    if (mode) setItemMode(mode.dataset.itemMode);
  }

  function openRail() {
    document.body.classList.add("rail-open");
    document.querySelector("[data-open-rail]").setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => rail.querySelector("[data-section]")?.focus());
  }

  function closeRail() {
    document.body.classList.remove("rail-open");
    document.querySelector("[data-open-rail]").setAttribute("aria-expanded", "false");
  }

  function setDefaultState() {
    state.anchorId = data.entities.find((item) => item.key === project.anchor).id;
    state.selectedId = data.entities.find((item) => item.key === project.selection).id;
    state.scopeFrame = snapshotScope();
    const snapshot = readSnapshot();
    if (snapshot) restore(snapshot);
    initialHash();
  }

  function initialHash() {
    const hash = location.hash.slice(1);
    if (["overview", "items", "results", "configurations", "model"].includes(hash)) {
      state.section = hash;
      state.receiptId = "";
    }
    if (["table", "document", "graph"].includes(hash)) {
      state.section = "items";
      state.view = hash;
    }
  }

  async function boot() {
    main.innerHTML = `<p role="status" class="session-notice">Loading ${html(project.name)} records…</p>`;
    try {
      const response = await fetch(project.file);
      if (!response.ok) throw new Error("Project data could not be loaded.");
      data = await response.json();
      entities = new Map(data.entities.map((item) => [item.id, item]));
      setDefaultState();
      render();
    } catch {
      main.innerHTML = `<p role="alert">${html(project.name)} data could not be loaded.</p>${action("Retry", "retry")}`;
    }
  }

  window.tracerStudy = { key: project.key, capture, restore };
  main.addEventListener("click", click);
  main.addEventListener("change", controlChanged);
  main.addEventListener("input", inputChanged);
  main.addEventListener("submit", submit);
  document.addEventListener("keydown", keyboard);
  graphViewport.addEventListener("change", overviewViewportChanged);
  rail.addEventListener("click", navigationClick);
  document.querySelector("[data-open-rail]").addEventListener("click", openRail);
  document
    .querySelectorAll("[data-close-rail]")
    .forEach((button) => button.addEventListener("click", closeRail));
  boot();
})();
