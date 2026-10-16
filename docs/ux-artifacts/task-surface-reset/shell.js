const requirements = [
  {
    key: "REQ-R01",
    title: "Blower operating envelope",
    statement:
      "Operate the selected blower within the recorded duty envelope while providing the flow used by the example pickup profile.",
    evaluation: "EVAL-R01",
    outcome: "SIMULATED target not met",
    evaluationTitle: "Simulated baseline pickup evaluation",
    evaluationStatement:
      "SIMULATED: the invented baseline task collected 84% of the defined debris mass against the 90% draft target. This is a configuration-specific shortfall.",
    designInput: "v1 → v2",
    review: "Unreviewed",
    changed: true,
  },
  {
    key: "REQ-R03",
    title: "Whole-product energy allocation",
    statement:
      "Allocate a draft average 60 W across the defined cleaning profile using the fictional 60 Wh usable-energy assumption; preserve reserve and profile assumptions.",
    acceptance: "Engineering allocation to investigate, not an engine-computed runtime guarantee.",
    evaluation: "EVAL-R02",
    outcome: "SIMULATED within old allocation",
    evaluationTitle: "Simulated baseline energy evaluation",
    evaluationStatement:
      "SIMULATED: the invented duty-profile observation supports the old baseline allocation only. The later blower-control change has not been evaluated.",
    designInput: "v1 → v2",
    review: "Unreviewed",
    changed: true,
  },
  {
    key: "REQ-R04",
    title: "Driver thermal monitoring",
    statement:
      "Monitor the selected driver temperature indication and use an explicit derating behavior before the recorded component limit is reached.",
    evaluation: "EVAL-R03",
    outcome: "SIMULATED partial coverage",
    evaluationTitle: "Simulated driver thermal evaluation",
    evaluationStatement:
      "SIMULATED: an invented sustained-load scenario reached the selected derating condition; combined high-suction thermal behavior remains unresolved.",
    designInput: "v1 → v2",
    review: "Unreviewed",
    changed: true,
  },
  {
    key: "REQ-R05",
    title: "Actuator command timing",
    statement:
      "Deliver the recorded blower and traction commands without violating the navigation controller's allocated timing budget.",
    evaluation: "",
    outcome: "No evaluation connected",
    evaluationTitle: "",
    evaluationStatement: "",
    designInput: "—",
    review: "—",
    changed: false,
  },
  {
    key: "REQ-R10",
    title: "Acoustic operating profile",
    statement:
      "Evaluate the selected blower, mounting and speed profile together against the acoustic target; no motor-only result represents the whole robot.",
    evaluation: "EVAL-R05",
    outcome: "No result · definition only",
    evaluationTitle: "Acoustic evaluation definition",
    evaluationStatement:
      "Define the whole-robot acoustic setup and operating profile. No run or observed sound level is present.",
    designInput: "—",
    review: "—",
    changed: false,
  },
];

const design = {
  key: "DES-01",
  title: "Blower-control firmware design",
  version: 2,
  capturedVersion: 1,
  statement:
    "Example blower-control design increases the proposed maximum duty from its baseline profile to improve pickup. Review energy, thermal, acoustic and command-timing effects before adoption; earlier baseline results remain captured against v1.",
  capturedStatement:
    "Example control design uses the baseline duty profile and retains command timing while monitoring driver temperature.",
  artifact: "Invented artifact controls/blower-profile.ts",
};

const evaluations = [
  {
    key: "EVAL-R01",
    title: "Simulated baseline pickup evaluation",
    statement:
      "SIMULATED: the invented baseline task collected 84% of the defined debris mass against the 90% draft target. This is a configuration-specific shortfall.",
    outcome: "SIMULATED target not met",
    receiptOutcome: "SIMULATED pickup target not met",
    method: "Invented two-pass task and weighing record",
    purpose: "Evaluate draft pickup target.",
  },
  {
    key: "EVAL-R02",
    title: "Simulated baseline energy evaluation",
    statement:
      "SIMULATED: the invented duty-profile observation supports the old baseline allocation only. The later blower-control change has not been evaluated.",
    outcome: "SIMULATED within old allocation",
    receiptOutcome: "SIMULATED within old allocation; predates firmware edit",
    method: "Invented whole-product power trace",
    purpose: "Evaluate energy allocation.",
  },
  {
    key: "EVAL-R03",
    title: "Simulated driver thermal evaluation",
    statement:
      "SIMULATED: an invented sustained-load scenario reached the selected derating condition; combined high-suction thermal behavior remains unresolved.",
    outcome: "SIMULATED partial coverage",
    receiptOutcome: "SIMULATED partial thermal coverage",
    method: "Invented load and temperature record",
    purpose: "Investigate thermal response.",
  },
  {
    key: "EVAL-R05",
    title: "Acoustic evaluation definition",
    statement:
      "Define the whole-robot acoustic setup and operating profile. No run or observed sound level is present.",
    outcome: "No result",
    receiptOutcome: "",
    method: "Not executed",
    purpose: "Evaluate draft acoustic target.",
  },
];

const capturedResults = [
  {
    output: "EVAL-R01",
    title: "Simulated baseline pickup evaluation",
    outcome: "SIMULATED pickup target not met",
    inputs: 5,
  },
  {
    output: "EVAL-R02",
    title: "Simulated baseline energy evaluation",
    outcome: "SIMULATED within old allocation; predates firmware edit",
    inputs: 5,
  },
  {
    output: "EVAL-R03",
    title: "Simulated driver thermal evaluation",
    outcome: "SIMULATED partial thermal coverage",
    inputs: 4,
  },
  {
    output: "EVAL-R04",
    title: "Simulated power-interface evaluation",
    outcome: "SIMULATED fail — shared rail reset",
    inputs: 4,
  },
];

const allItems = [
  design,
  ...requirements,
  ...evaluations,
  {
    key: "BUILD-R01",
    title: "Prototype A — recorded configuration",
    statement:
      "Fictional starting build combines the baseline blower, physical design, driver and firmware records. Its manifest records selected native revisions before the blower-profile edit.",
  },
];

function orbitInitialSection(hash) {
  return ["overview", "results", "configurations", "model"].includes(hash) ? hash : "items";
}

const isNarrow = matchMedia("(max-width: 720px)").matches;
const initialHash = location.hash.slice(1);
const state = {
  section: initialHash ? orbitInitialSection(initialHash) : "overview",
  itemMode: "scope",
  view: ["table", "document", "graph"].includes(initialHash) ? initialHash : "table",
  selected: "REQ-R03",
  inspector: !isNarrow,
  inspectorTab: "details",
  changedOnly: false,
  dialog: null,
  sessionItems: [],
  sessionEdits: {},
  catalogue: null,
  modelSchema: null,
  sessionSchema: null,
  modelEditor: null,
  catalogueError: false,
  catalogueSearch: "",
  catalogueType: "",
  cataloguePage: 0,
  sessionConnections: new Set(),
  notice: "",
  receipt: initialHash === "receipt",
  receiptReturn: null,
  review: {
    judgment: "",
    rationale: "",
    saved: false,
  },
};

if (initialHash === "saved" || initialHash === "all") {
  state.section = "items";
  state.itemMode = initialHash;
}

if (state.receipt) {
  state.section = "items";
  state.receiptReturn = {
    section: "items",
    itemMode: "scope",
    view: "table",
    selected: "REQ-R03",
  };
}

const main = document.querySelector("#main-content");
const breadcrumbs = document.querySelector("[data-breadcrumbs]");
const rail = document.querySelector("#project-rail");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function currentRequirements() {
  return state.changedOnly ? requirements.filter((item) => item.changed) : requirements;
}

function compatibleRequirements() {
  return nativeCatalogueItems()
    .filter((item) => item.type === "requirement")
    .map((item) => ({
      ...item,
      evaluation: "",
      outcome: "Evaluation context not loaded",
      designInput: "—",
      review: "—",
    }));
}
function nativeCatalogueItems() {
  return state.catalogue || [];
}
function itemPool() {
  return [
    ...requirements,
    ...evaluations,
    design,
    ...allItems,
    ...state.sessionItems,
    ...nativeCatalogueItems(),
  ];
}
function presentItem(item) {
  return { ...item, ...state.sessionEdits[item.key] };
}
function versionLabel(item) {
  if (isSessionItem(item)) return "Session item";
  const native = `Native v${item.version || 1}`;
  return state.sessionEdits[item.key] ? `${native} · session edit` : native;
}

function selectedItem() {
  const item = itemPool().find((item) => item.key === state.selected);
  return item ? presentItem(item) : undefined;
}

function workspaceHash() {
  return state.itemMode === "scope" ? state.view : state.itemMode;
}

function setHash() {
  let value = state.section === "items" ? workspaceHash() : state.section;
  if (state.receipt) value = "receipt";
  history.replaceState(null, "", `#${value}`);
}

function breadcrumbParts() {
  if (state.receipt) return ["Orbit R1", "Captured result", "EVAL-R02"];
  if (state.section === "items") {
    const labels = { saved: "Saved scopes", all: "All items", scope: "Connected requirements" };
    return ["Orbit R1", "Items", labels[state.itemMode]];
  }
  const labels = {
    overview: "Overview",
    results: "Captured results",
    configurations: "Captured configurations",
    model: "Project model",
  };
  return ["Orbit R1", labels[state.section]];
}

function setCurrentPage(button, selected) {
  if (selected) button.setAttribute("aria-current", "page");
  else button.removeAttribute("aria-current");
}
function updateChrome() {
  const parts = breadcrumbParts();
  breadcrumbs.innerHTML = parts
    .map((part, index) =>
      index === parts.length - 1
        ? `<strong>${escapeHtml(part)}</strong>`
        : `<span>${escapeHtml(part)}</span><b>/</b>`,
    )
    .join("");

  document.querySelectorAll("[data-section]").forEach((button) => {
    const selected =
      !state.receipt &&
      button.dataset.section === state.section &&
      !(button.dataset.section === "items" && state.section !== "items");
    setCurrentPage(button, selected);
  });
  document.querySelectorAll("[data-item-mode]").forEach((button) => {
    setCurrentPage(
      button,
      !state.receipt && state.section === "items" && button.dataset.itemMode === state.itemMode,
    );
  });
  document.querySelector("[data-item-scopes]").hidden = state.section !== "items" || state.receipt;
}

function renderCenter() {
  if (state.receipt) return renderReceipt();
  const renderers = {
    overview: renderOverview,
    items: renderItemsSection,
    results: renderResults,
    configurations: renderConfigurations,
    model: renderModel,
  };
  return renderers[state.section]();
}

const orbitModelNodes = [
  ["product", "Product", 20, 30],
  ["goal", "Goal", 175, 30],
  ["target", "Target", 330, 30],
  ["function", "Function", 485, 30],
  ["requirement", "Requirement", 640, 30],
  ["design", "Design", 830, 30],
  ["component", "Component", 640, 200],
  ["interface", "Interface", 830, 200],
  ["evaluation", "Evaluation", 830, 330],
];
function orbitModelConfig() {
  if (matchMedia("(max-width: 720px)").matches) return orbitPortraitModel();
  const nodes = orbitModelNodes.map(([key, label, x, y]) => ({
    key,
    label,
    x,
    y,
    count: nativeCatalogueItems().filter((item) => item.type === key).length,
  }));
  const hierarchy = orbitModelNodes.slice(0, 4).map(([source], index) => ({
    source,
    target: orbitModelNodes[index + 1][0],
    kind: "hierarchy",
  }));
  return {
    nodes,
    totalTypeCount: 16,
    edges: [
      ...hierarchy,
      {
        source: "requirement",
        target: "design",
        kind: "design",
        label: "realized by",
        x: 800,
        y: 45,
      },
      {
        source: "design",
        target: "component",
        kind: "design",
        path: "M 875 90 C 875 155 704 145 704 200",
        label: "defines",
        x: 790,
        y: 158,
      },
      {
        source: "component",
        target: "interface",
        kind: "design",
        label: "provides",
        x: 800,
        y: 214,
      },
      {
        source: "target",
        target: "evaluation",
        kind: "verification",
        path: "M 394 90 L 394 294 L 848 294 L 848 330",
      },
      {
        source: "requirement",
        target: "evaluation",
        kind: "verification",
        path: "M 678 90 L 678 281 L 878 281 L 878 330",
      },
      {
        source: "design",
        target: "evaluation",
        kind: "verification",
        path: "M 958 60 L 980 60 L 980 360 L 958 360",
      },
      {
        source: "interface",
        target: "evaluation",
        kind: "verification",
        path: "M 916 260 L 916 330",
        label: "evaluated by",
        x: 940,
        y: 305,
      },
    ],
    annotations: [
      { text: "Product intent → engineering requirements · breaks down into", x: 20, y: 16 },
      {
        text: "Acceptance criteria / design under test · evaluated by",
        x: 400,
        y: 315,
        kind: "verification",
      },
    ],
    legend: "Arrows show allowed relationship directions. Select a type to work with its items.",
  };
}
function orbitPortraitModel() {
  const positions = [
    ["product", "Product", 10, 10],
    ["goal", "Goal", 10, 106],
    ["target", "Target", 10, 202],
    ["function", "Function", 10, 298],
    ["requirement", "Requirement", 10, 394],
    ["design", "Design", 182, 394],
    ["component", "Component", 182, 490],
    ["interface", "Interface", 182, 586],
    ["evaluation", "Evaluation", 10, 586],
  ];
  const hierarchy = positions.slice(0, 4).map(([source, , , y], index) => ({
    source,
    target: positions[index + 1][0],
    kind: "hierarchy",
    path: `M74 ${y + 60} V${positions[index + 1][3]}`,
    label: "breaks down into",
    x: 74,
    y: y + 82,
  }));
  return {
    width: 320,
    height: 700,
    totalTypeCount: 16,
    nodes: positions.map(([key, label, x, y]) => ({
      key,
      label,
      x,
      y,
      count: nativeCatalogueItems().filter((item) => item.type === key).length,
    })),
    edges: [
      ...hierarchy,
      {
        source: "requirement",
        target: "design",
        kind: "design",
        path: "M138 424 H182",
        label: "realized by",
        x: 160,
        y: 383,
      },
      {
        source: "design",
        target: "component",
        kind: "design",
        path: "M246 454 V490",
        label: "defines",
        x: 278,
        y: 476,
      },
      {
        source: "component",
        target: "interface",
        kind: "design",
        path: "M246 550 V586",
        label: "provides",
        x: 278,
        y: 572,
      },
      { source: "target", target: "evaluation", kind: "verification", path: "M10 232 H2 V616 H10" },
      { source: "requirement", target: "evaluation", kind: "verification", path: "M74 454 V586" },
      {
        source: "design",
        target: "evaluation",
        kind: "verification",
        path: "M182 424 H154 V566 H108 V586",
      },
      { source: "interface", target: "evaluation", kind: "verification", path: "M182 616 H138" },
    ],
    annotations: [
      {
        text: "Evaluated by: target, requirement, design + interface",
        x: 10,
        y: 690,
        kind: "verification",
      },
    ],
    legend: "Arrows show allowed relationship directions. Select a type to work with its items.",
  };
}
function overviewFact(label, value) {
  return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
}
function overviewSessionCount() {
  return state.sessionItems.length
    ? `<p class="session-notice">${state.sessionItems.length} additional items saved only in this study session.</p>`
    : "";
}
function overviewTypeCount() {
  if (state.sessionSchema) return Object.keys(state.sessionSchema.entityTypes).length;
  return new Set(nativeCatalogueItems().map((item) => item.type)).size;
}
function overviewRelationshipCount() {
  if (state.sessionSchema) return Object.keys(state.sessionSchema.relationshipTypes).length;
  return 15;
}
function renderOverview() {
  const status = catalogueLoadingStatus();
  if (status) return status;
  return `<section class="overview-surface">
    <header class="overview-header"><div><h1>Orbit R1</h1><p>Robot vacuum development across hardware, embedded control, navigation and the companion app.</p></div><button class="quiet-button" data-resume-scope>Open current scope</button></header>
    <dl class="overview-facts">${overviewFact("Items", nativeCatalogueItems().length)}${overviewFact("Item types", overviewTypeCount())}${overviewFact("Relationship types", overviewRelationshipCount())}${overviewFact("Captured results", capturedResults.length)}</dl>
    ${overviewSessionCount()}
    <section class="overview-model-preview"><header class="overview-section-header"><h2>Data model</h2><button class="quiet-button" data-overview-model>More model details →</button></header>
    ${window.tracerModelGraph.render(window.tracerModelGraph.reflect(orbitModelConfig(), state.sessionSchema, state.modelSchema))}</section>
  </section>`;
}
function resumeScope() {
  restoreScopeFrame();
  state.section = "items";
  state.itemMode = "scope";
  state.receipt = false;
  render({ focus: "#main-content" });
}
function openOverviewModel() {
  state.section = "model";
  render({ focus: "#main-content" });
}

function renderItemsSection() {
  const renderers = { scope: renderWorkspace, saved: renderSavedScopes, all: renderAllItems };
  return renderers[state.itemMode]();
}

function render({ focus } = {}) {
  updateChrome();
  window.tracerModelEditor.unmount?.(main);
  main.innerHTML = renderCenter();
  alignGraphPaths();
  mountModelEditor();
  window.tracerModelGraph.attach(main, (type) =>
    openTypeCollection({ dataset: { overviewType: type } }),
  );
  setHash();
  updateDialogIsolation();
  if (focus) requestAnimationFrame(() => focusRendered(focus));
}

function focusRendered(focus) {
  const target = focus === "#main-content" ? main : main.querySelector(focus);
  target?.focus();
}

function updateDialogIsolation() {
  rail.inert = Boolean(state.dialog);
  document.querySelector(".global-bar").inert = Boolean(state.dialog);
  main.querySelectorAll(".items-surface > :not(.dialog-backdrop)").forEach((element) => {
    element.inert = Boolean(state.dialog);
  });
}

function retainVisibleSelection(items) {
  if (state.selected === design.key) return;
  if (items.some((item) => item.key === state.selected)) return;
  state.selected = items.length ? items[0].key : "";
}

function sessionNotice() {
  return state.notice
    ? `<p class="session-notice" role="status">${escapeHtml(state.notice)}</p>`
    : "";
}

function scopeCount(items) {
  return items.length === 5
    ? "5 requirements in this retained scope"
    : `${items.length} requirements in this page session`;
}

function renderWorkspace() {
  const anchor = displayItem(presentItem(design));
  const items = currentRequirements();
  retainVisibleSelection(items);
  return `
    <section class="items-surface">
      <header class="scope-header">
        <div class="scope-record">
          <div class="scope-key">${design.key}<small>${versionLabel(design)}</small></div>
          <div class="scope-copy">
            <strong>${anchor.title}</strong>
            <p>${anchor.statement}</p>
          </div>
        </div>
      </header>
      <div class="local-toolbar" aria-label="Item view controls">
        <div class="scope-name">
          <strong>Connected requirements</strong>
        </div>
        <div class="view-switch" aria-label="Representation">
          ${["table", "document", "graph"]
            .map(
              (view) =>
                `<button type="button" data-view="${view}" aria-pressed="${state.view === view}">${view[0].toUpperCase() + view.slice(1)}</button>`,
            )
            .join("")}
        </div>
        <div class="toolbar-actions">
          <button class="quiet-button" type="button" data-filter-changed aria-pressed="${state.changedOnly}">
            Changed inputs
          </button>
          <button class="quiet-button" type="button" data-open-inspector aria-pressed="${state.inspector}">
            ${state.inspector ? "Hide inspector" : "Inspect"}
          </button>
          <button class="quiet-button" type="button" data-connect-item>
            Connect requirement
          </button>
          <button class="solid-button" type="button" data-create-item>
            New requirement
          </button>
        </div>
      </div>
      ${sessionNotice()}
      <div class="workspace-grid ${state.inspector ? "inspector-open" : ""}">
        <section class="work-area" aria-label="${state.view} view">
          <div class="scope-strip">
            <strong>Incoming realized_by</strong>
            <span>Requirement → Design</span>
            <span>${scopeCount(items)}</span>
          </div>
          ${renderCurrentView(items)}
        </section>
        ${state.inspector ? renderInspector() : ""}
      </div>
      ${renderWorkDialog()}
    </section>
  `;
}

function renderCurrentView(items) {
  if (state.view === "document") return renderDocument(items);
  if (state.view === "graph") return renderGraph(items);
  return renderTable(items);
}

function renderTable(items) {
  return `
    <table class="data-table">
      <colgroup><col><col><col><col><col></colgroup>
      <thead>
        <tr>
          <th>Requirement</th>
          <th>Statement excerpt</th>
          <th>Recorded evaluation</th>
          <th>Design input</th>
          <th>Review</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(renderTableRow).join("")}
      </tbody>
    </table>
  `;
}

function displayItem(item) {
  return Object.fromEntries(
    Object.entries(item).map(([key, value]) => [
      key,
      typeof value === "string" ? escapeHtml(value) : value,
    ]),
  );
}

function tableRecordMark(item) {
  return state.selected === item.key ? '<span class="selected-mark">Selected</span>' : "";
}

function tableEvaluation(item) {
  return item.evaluation ? `<a>${item.evaluation}</a>` : "";
}

function renderTableRow(rawItem) {
  const item = displayItem(presentItem(rawItem));
  return `
          <tr data-select="${item.key}" tabindex="0" class="${state.selected === item.key ? "selected" : ""}" aria-selected="${state.selected === item.key}">
            <td>
              <div class="record-cell">
                ${tableRecordMark(item)}
                <a>${item.key}</a><strong>${item.title}</strong>
              </div>
            </td>
            <td><p class="statement-excerpt">${item.statement}</p></td>
            <td>
              <div class="evaluation-cell">
                ${tableEvaluation(item)}
                <span>${item.outcome}</span>
              </div>
            </td>
            <td><span class="cell-state ${item.changed ? "changed" : ""}">${item.designInput}</span></td>
            <td><span class="cell-state">${reviewState(item)}</span></td>
          </tr>
`;
}

function reviewState(item) {
  if (item.key === "REQ-R03" && state.review.saved) return "Session judgment saved";
  return item.review;
}

function renderDocument(items) {
  return `
    <article class="document-view">
      <header><h2>Connected requirements</h2><span>Reading order · requirement key</span></header>
      ${items
        .map((rawItem) => {
          const item = displayItem(presentItem(rawItem));
          return `
        <section class="requirement-block ${state.selected === item.key ? "selected" : ""}" data-select="${item.key}" tabindex="0" aria-selected="${state.selected === item.key}">
          <header><a>${item.key}</a><h3>${item.title}</h3></header>
          <p>${item.statement}</p>
          <div class="document-meta">
            <span>${documentEvaluation(item)}</span>
            <span>Design input ${item.designInput}</span>
            <span>${reviewState(item)}</span>
          </div>
        </section>
      `;
        })
        .join("")}
    </article>
  `;
}

function documentEvaluation(item) {
  return item.evaluation ? `${item.evaluation} · ${item.outcome}` : item.outcome;
}

function renderGraph(items) {
  const anchor = displayItem(presentItem(design));
  const positions = {
    "REQ-R01": "req-1",
    "REQ-R03": "req-2",
    "REQ-R04": "req-3",
    "REQ-R05": "req-4",
    "REQ-R10": "req-5",
  };
  const paths = [
    ["REQ-R01", "M 145 62 C 310 62 330 260 394 268"],
    ["REQ-R03", "M 855 62 C 690 62 670 260 606 268"],
    ["REQ-R04", "M 125 278 C 245 278 315 278 394 278"],
    ["REQ-R05", "M 875 278 C 755 278 685 278 606 278"],
    ["REQ-R10", "M 500 500 C 500 420 500 365 500 310"],
  ];
  const added = items.filter((item) => !positions[item.key]);
  const height = Math.max(560, 360 + Math.ceil(added.length / 2) * 90);
  added.forEach((item, index) => {
    const x = index % 2 ? 855 : 145;
    const y = 390 + Math.floor(index / 2) * 90;
    paths.push([item.key, `M ${x} ${y} C ${x} 340 620 330 560 310`]);
  });
  return `
    <div class="graph-view">
      <p class="graph-mobile-note">Relationship list · each requirement points to DES-01</p>
      <header><strong>DES-01 neighborhood</strong><span>${items.length} requirement nodes · ${items.length} ${items.length === 5 ? "recorded" : "page-session"} connections</span></header>
      <div class="graph-stage" style="--graph-height:${height}px" aria-label="Requirements realized by DES-01">
        <svg class="graph-wires" viewBox="0 0 1000 ${height}" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 z" fill="currentColor"></path>
            </marker>
          </defs>
          ${paths
            .filter(([key]) => items.some((item) => item.key === key))
            .map(
              ([key, path]) =>
                `<path data-edge="${key}" class="${state.selected === key ? "selected" : ""}" d="${path}" marker-end="url(#arrow)"></path>`,
            )
            .join("")}
        </svg>
        <button class="graph-node design ${state.selected === design.key ? "selected" : ""}" type="button" data-select="${design.key}">
          <span class="node-key">${design.key} · v2</span><strong>${anchor.title}</strong><small>Design anchor</small>
        </button>
        ${items
          .map((rawItem) => {
            const item = displayItem(presentItem(rawItem));
            return `
          <button class="graph-node ${positions[item.key] || "req-session"} ${state.selected === item.key ? "selected" : ""}" type="button" data-select="${item.key}" ${addedNodeStyle(item, added)}>
            <span class="node-key">${item.key}</span><strong>${item.title}</strong><small>${item.outcome}</small>
          </button>
        `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function rectCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
function borderPoint(rect, toward) {
  const center = rectCenter(rect),
    dx = toward.x - center.x,
    dy = toward.y - center.y;
  const scale = Math.min(rect.width / (2 * Math.abs(dx)), rect.height / (2 * Math.abs(dy)));
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}
function graphPoint(point, stage) {
  return { x: ((point.x - stage.left) * 1000) / stage.width, y: point.y - stage.top };
}
function alignGraphPaths() {
  const stage = main.querySelector(".graph-stage");
  if (!stage) return;
  if (matchMedia("(max-width: 720px)").matches) return;
  const bounds = stage.getBoundingClientRect(),
    anchor = stage.querySelector(".design").getBoundingClientRect();
  stage.querySelectorAll("[data-edge]").forEach((path) => {
    const node = stage
      .querySelector(`[data-select="${path.dataset.edge}"]`)
      .getBoundingClientRect();
    const start = graphPoint(borderPoint(node, rectCenter(anchor)), bounds);
    const end = graphPoint(borderPoint(anchor, rectCenter(node)), bounds);
    const mid = (start.x + end.x) / 2;
    path.setAttribute(
      "d",
      `M ${start.x} ${start.y} C ${mid} ${start.y} ${mid} ${end.y} ${end.x} ${end.y}`,
    );
  });
}
window.addEventListener("resize", alignGraphPaths);

function addedNodeStyle(item, added) {
  const index = added.findIndex((candidate) => candidate.key === item.key);
  if (index < 0) return "";
  const side = index % 2 ? "right" : "left";
  return `style="${side}:4%;top:${360 + Math.floor(index / 2) * 90}px"`;
}

function itemType(item) {
  const types = { REQ: "Requirement", EVAL: "Evaluation", DES: "Design" };
  return types[item.key.split("-")[0]] || "Item";
}

function inspectorContent(item) {
  return state.inspectorTab === "history" ? renderHistory(item) : renderDetails(displayItem(item));
}

function renderInspector() {
  const item = selectedItem();
  if (!item) return "";
  const type = itemType(item);
  return `
    <aside class="selection-panel" aria-label="Selected item">
      <header class="inspector-header" tabindex="-1">
        <div><small>${escapeHtml(item.key)} · ${type}</small><strong>${escapeHtml(item.title)}</strong></div>
        <div class="inspector-header-actions">
          <button class="quiet-button" type="button" data-edit-item>Edit</button>
          <button class="icon-button" type="button" data-close-inspector aria-label="Close inspector">×</button>
        </div>
      </header>
      <div class="inspector-tabs" role="tablist" aria-label="Selected item information">
        <button type="button" data-inspector-tab="details" aria-selected="${state.inspectorTab === "details"}">Details</button>
        <button type="button" data-inspector-tab="history" aria-selected="${state.inspectorTab === "history"}">History</button>
      </div>
      <div class="inspector-body">
        ${inspectorContent(item)}
      </div>
    </aside>
  `;
}

function renderDetails(item) {
  if (item.nativeCatalogue) return renderCatalogueDetails(item);
  if (item.key === design.key) return renderDesignDetails();
  if (item.key.startsWith("EVAL")) return renderEvaluationDetails(item);
  return renderRequirementDetails(item);
}

function renderCatalogueDetails(item) {
  return `<section><h3>Statement</h3><p>${item.statement}</p></section>
    ${acceptanceDetail(item)}
    <dl class="field-list"><div><dt>Version</dt><dd>${versionLabel(item)}</dd></div>
    <div><dt>Type</dt><dd>${item.type}</dd></div><div><dt>Status</dt><dd>${item.status || "—"}</dd></div>
    <div><dt>Owner</dt><dd>${item.owner || "—"}</dd></div></dl>`;
}

function renderDesignDetails() {
  return `

      <dl class="field-list">
        <div><dt>Version</dt><dd>${versionLabel(design)}</dd></div><div><dt>Status</dt><dd>illustrative draft</dd></div>
        <div><dt>Owner</dt><dd>fictional example team</dd></div><div><dt>Artifact</dt><dd>${design.artifact}</dd></div>
      </dl>
`;
}
function renderEvaluationDetails(item) {
  return `
      <section><h3>Recorded statement</h3><p>${item.statement}</p></section>
      <dl class="field-list">
        <div><dt>Version</dt><dd>${versionLabel(item)}</dd></div><div><dt>Outcome</dt><dd>${item.outcome}</dd></div>
        <div><dt>Method</dt><dd>${item.method}</dd></div><div><dt>Purpose</dt><dd>${item.purpose}</dd></div>
      </dl>
      ${receiptAction(item, "Open exact receipt")}
`;
}
function renderRequirementDetails(item) {
  return `
    ${detailStatement(item)}
    ${acceptanceDetail(item)}
    <dl class="field-list">
      <div><dt>Version</dt><dd>${versionLabel(item)}</dd></div><div><dt>Status</dt><dd>illustrative draft</dd></div>
      <div><dt>Owner</dt><dd>fictional example team</dd></div><div><dt>Relationship</dt><dd>realized_by DES-01</dd></div>
    </dl>
    ${receiptAction(item, "Review exact receipt")}
`;
}

function detailStatement(item) {
  return state.view === "document"
    ? ""
    : `<section><h3>Statement</h3><p>${item.statement}</p></section>`;
}
function acceptanceDetail(item) {
  return item.acceptance ? `<section><h3>Acceptance</h3><p>${item.acceptance}</p></section>` : "";
}
function receiptAction(item, label) {
  if (!["REQ-R03", "EVAL-R02"].includes(item.key)) return "";
  return `<div class="inspector-actions"><button class="solid-button" type="button" data-open-receipt>${label}</button></div>`;
}

function renderWorkDialog() {
  if (!state.dialog) return "";
  const renderers = {
    create: renderCreateDialog,
    connect: renderConnectDialog,
    edit: renderEditDialog,
  };
  return renderers[state.dialog]();
}
function renderCreateDialog() {
  const draftKey = state.sessionItems.length
    ? `REQ-DRAFT-${state.sessionItems.length + 1}`
    : "REQ-DRAFT";
  return `
      <div class="dialog-backdrop" data-close-dialog>
        <section class="work-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title" data-dialog-card>
          <header><div><h2 id="create-title">New requirement</h2></div><button class="icon-button" type="button" data-close-dialog aria-label="Close">×</button></header>
          <form data-create-form>
            <label>Key<input name="key" value="${draftKey}" pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*" required autofocus></label>
            <label>Title<input name="title" placeholder="Requirement title" required></label>
            <label>Statement<textarea name="statement" rows="5" placeholder="Write the requirement statement" required></textarea></label>
            <p>Saved for this page session. Connecting the new item to this design scope is optional.</p>
            <footer><button class="quiet-button" type="button" data-close-dialog>Cancel</button><button class="solid-button" type="submit">Create requirement</button></footer>
          </form>
        </section>
      </div>
    `;
}
function renderConnectDialog() {
  const available = [...compatibleRequirements(), ...state.sessionItems].filter(
    (item) => !requirements.some((current) => current.key === item.key),
  );
  return `
      <div class="dialog-backdrop" data-close-dialog>
        <section class="work-dialog" role="dialog" aria-modal="true" aria-labelledby="connect-title" data-dialog-card>
          <header><div><small>Current DES-01 scope</small><h2 id="connect-title">Connect requirement</h2></div><button class="icon-button" type="button" data-close-dialog aria-label="Close">×</button></header>
          ${
            available.length
              ? `<form data-connect-form>
                  <label>Existing requirement<select name="key" data-connect-candidate required autofocus>${available.map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.key)} · ${escapeHtml(item.title)}</option>`).join("")}</select></label>
                  <section class="connection-source-preview"><strong data-candidate-key>${escapeHtml(available[0].key)} → realized_by → DES-01</strong><p data-candidate-statement>${escapeHtml(available[0].statement)}</p></section>
                  <label>Scope<textarea name="scope" rows="2" required></textarea></label>
                  <label>Source version annotation<input name="source_version" type="number" step="any" value="1" required></label>
                  <label>Review<input name="review" required></label>
                  <p>The connection is held only for this page session.</p>
                  <footer><button class="quiet-button" type="button" data-close-dialog>Cancel</button><button class="solid-button" type="submit">Connect requirement</button></footer>
                </form>`
              : `<div class="dialog-empty"><p>No compatible unconnected requirements remain in this study.</p><button class="solid-button" type="button" data-create-from-connect autofocus>New requirement</button></div>`
          }
        </section>
      </div>
    `;
}
function renderEditDialog() {
  const item = selectedItem();
  if (!item) return "";
  return `
    <div class="dialog-backdrop" data-close-dialog>
      <section class="work-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title" data-dialog-card>
        <header><div><small>${escapeHtml(item.key)}</small><h2 id="edit-title">Edit item</h2></div><button class="icon-button" type="button" data-close-dialog aria-label="Close">×</button></header>
        <form data-edit-form>
          <label>Title<input name="title" value="${escapeHtml(item.title)}" required autofocus></label>
          <label>Statement<textarea name="statement" rows="7" required>${escapeHtml(item.statement)}</textarea></label>
          <p>Edits stay in this page session; no project data is written.</p>
          <footer><button class="quiet-button" type="button" data-close-dialog>Cancel</button><button class="solid-button" type="submit">Save changes</button></footer>
        </form>
      </section>
    </div>
  `;
}

function renderHistory(item) {
  if (isSessionItem(item))
    return "<p>No recorded history. This item is saved only in the current page session.</p>";
  if (item.key === design.key) {
    return `
      <div class="history-list">
        <article><b>v2</b><p>${escapeHtml(design.statement)}</p></article>
        <article><b>v1</b><p>${escapeHtml(design.capturedStatement)}</p></article>
      </div>
    `;
  }
  return `
    <div class="history-list">
      <article><b>Native v${item.version || 1}</b><p>Current recorded revision. No earlier revision is loaded for this item.</p></article>
    </div>
  `;
}

function renderSavedScopes() {
  return `
    <section class="catalogue-surface">
      <header class="catalogue-header">
        <div><h1>Saved scopes</h1><p>Retained item contexts reopen with their recorded bounds.</p></div>
        <span class="catalogue-count">1 scope</span>
      </header>
      <div class="saved-grid">
        <button class="saved-scope" type="button" data-open-scope>
          <strong>DES-01 connected requirements</strong>
          <p>Incoming realized_by · Requirement → Design · 5 requirements</p>
          <small>Last representation · Table</small>
        </button>
      </div>
    </section>
  `;
}

function matchesCatalogueType(item) {
  return !state.catalogueType || (item.type || "requirement") === state.catalogueType;
}
function openTypeCollection(element) {
  rememberScopeFrame();
  state.section = "items";
  state.itemMode = "all";
  state.catalogueType = element.dataset.overviewType;
  state.catalogueSearch = "";
  state.cataloguePage = 0;
  state.inspector = false;
  render({ focus: "[data-catalogue-search]" });
}
function clearTypeFilter() {
  state.catalogueType = "";
  render({ focus: "[data-catalogue-search]" });
}
function catalogueFilterLabel() {
  if (!state.catalogueType) return "";
  return `<p class="session-notice">${escapeHtml(state.catalogueType.replaceAll("_", " "))} items <button class="quiet-button" data-clear-type>Show all types</button></p>`;
}

function catalogueMatches() {
  const term = state.catalogueSearch.trim().toLowerCase();
  return [...state.sessionItems, ...nativeCatalogueItems()]
    .filter(matchesCatalogueType)
    .filter((item) =>
      `${item.key} ${item.type || "requirement"} ${presentItem(item).title} ${presentItem(item).statement}`
        .toLowerCase()
        .includes(term),
    );
}
function renderCatalogueRow(rawItem) {
  const item = displayItem(presentItem(rawItem));
  return `<tr><td>${item.key}</td><td>${item.type || "requirement"}</td><td><strong>${item.title}</strong></td>
    <td class="catalogue-action"><span>${sessionItemStatus(item)}</span><button class="quiet-button" data-select="${item.key}">Inspect</button></td></tr>`;
}
function catalogueLoadingStatus() {
  if (state.catalogueError)
    return '<p role="alert">Could not load the item catalogue. Reload this study to retry.</p>';
  return state.catalogue ? "" : '<p role="status">Loading items…</p>';
}
function catalogueFooter(matches, start, page, pageCount) {
  return `<footer class="catalogue-header"><span>${matches.length ? start + 1 : 0}–${start + page.length} of ${matches.length} matching items</span>
    <div><button class="quiet-button" data-catalogue-prev ${state.cataloguePage === 0 ? "disabled" : ""}>Previous</button>
    <button class="quiet-button" data-catalogue-next ${state.cataloguePage + 1 === pageCount ? "disabled" : ""}>Next</button></div></footer>`;
}
function isSessionItem(item) {
  return state.sessionItems.some((record) => record.key === item.key);
}
function sessionItemStatus(item) {
  if (!isSessionItem(item)) return "";
  return state.sessionConnections.has(item.key)
    ? "Session only · connected to DES-01"
    : "Session only · unconnected";
}
function renderAllItems() {
  const status = catalogueLoadingStatus();
  if (status) return status;
  const matches = catalogueMatches();
  const pageCount = Math.max(1, Math.ceil(matches.length / 25));
  state.cataloguePage = Math.min(state.cataloguePage, pageCount - 1);
  const start = state.cataloguePage * 25;
  const page = matches.slice(start, start + 25);
  return `<section class="items-surface">
    <header class="catalogue-header"><div><h1>All items</h1></div>
    <label>Find an item <input type="search" data-catalogue-search value="${escapeHtml(state.catalogueSearch)}" placeholder="Key, title or statement"></label></header>
    ${sessionNotice()}${catalogueFilterLabel()}
    <div class="workspace-grid ${state.inspector ? "inspector-open" : ""}">
      <section class="work-area"><table class="catalogue-table"><thead><tr><th>Key</th><th>Type</th><th>Title</th><th></th></tr></thead>
      <tbody>${page.map(renderCatalogueRow).join("")}</tbody></table>
      ${catalogueFooter(matches, start, page, pageCount)}</section>
      ${state.inspector ? renderInspector() : ""}
    </div>${renderWorkDialog()}</section>`;
}

function renderResults() {
  return `
    <section class="catalogue-surface">
      <header class="catalogue-header">
        <div><h1>Captured results</h1><p>Immutable output receipts and their declared inputs.</p></div>
        <span class="catalogue-count">${capturedResults.length} receipts</span>
      </header>
      <table class="catalogue-table">
        <thead><tr><th>Output</th><th>Result</th><th>Captured outcome</th><th>Inputs</th><th></th></tr></thead>
        <tbody>
          ${capturedResults
            .map(
              (result) => `
            <tr>
              <td>${result.output}</td><td>${result.title}</td><td>${result.outcome}</td><td>${result.inputs}</td>
              <td class="catalogue-action">${result.output === "EVAL-R02" ? '<button class="quiet-button" type="button" data-open-receipt>Open receipt</button>' : ""}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderConfigurations() {
  return `
    <section class="catalogue-surface">
      <header class="catalogue-header">
        <div><h1>Captured configurations</h1><p>Immutable selected native revisions referenced by results.</p></div>
        <span class="catalogue-count">1 loaded capture</span>
      </header>
      <div class="configuration-grid">
        <article class="configuration-card">
          <strong>BUILD-R01 · selected native inputs</strong>
          <p>Prototype A — recorded configuration · subject v2</p>
          <small>9 pinned revisions · referenced by the EVAL-R02 receipt</small>
        </article>
      </div>
    </section>
  `;
}

function orbitModelOptions() {
  const counts = Object.fromEntries(
    Object.keys(state.modelSchema.entityTypes).map((type) => [
      type,
      nativeCatalogueItems().filter((item) => item.type === type).length,
    ]),
  );
  return { schema: state.sessionSchema || state.modelSchema, counts, state: state.modelEditor };
}
function renderModel() {
  if (!state.modelSchema) return '<p role="status">Loading project model…</p>';
  return window.tracerModelEditor.render(orbitModelOptions());
}
function mountModelEditor() {
  if (state.section !== "model" || !state.modelSchema || state.receipt) return;
  window.tracerModelEditor.mount(main, {
    ...orbitModelOptions(),
    onState: (snapshot) => {
      state.modelEditor = snapshot;
    },
    onSave: (schema) => {
      state.sessionSchema = schema;
    },
  });
}

function renderReceipt() {
  const feedback = state.review.saved
    ? `<p class="review-feedback" role="status">Saved for this page session: ${escapeHtml(state.review.judgment)}. The recorded outcome is unchanged.</p>`
    : '<p class="review-feedback" role="status" hidden></p>';
  return `
    <section class="receipt-surface">
      <button class="receipt-return" type="button" data-return-receipt>← ${receiptReturnLabel()}</button>
      <header class="receipt-heading">
        <div>
          <h1 tabindex="-1" data-receipt-heading>Simulated baseline energy evaluation</h1>
          <p>Output EVAL-R02 v1 · recorded <time datetime="2026-10-14T06:48:50.568Z">2026-10-14 06:48:50 UTC</time></p>
        </div>
        <span class="receipt-status">${state.review.saved ? "Session judgment saved" : "Unreviewed"}</span>
      </header>
      <div class="receipt-grid">
        <div>
          <div class="receipt-summary">
            <div><small>Recorded outcome</small><span>SIMULATED within old allocation; predates firmware edit</span></div>
            <div><small>Method</small><span>Invented whole-product power trace</span></div>
          </div>
          <details class="output-disclosure">
            <summary>Captured output details</summary>
            <dl class="receipt-fields">
              <div><dt>Output record</dt><dd>EVAL-R02 · v1</dd></div>
              <div class="wide"><dt>Receipt ID</dt><dd class="long">35f4fd6a-2f35-490d-aa6c-aa789fad8d86</dd></div>
              <div><dt>Purpose</dt><dd>Evaluate energy allocation.</dd></div>
              <div class="full"><dt>Recorded statement</dt><dd>SIMULATED: the invented duty-profile observation supports the old baseline allocation only. The later blower-control change has not been evaluated.</dd></div>
            </dl>
          </details>
          <section class="receipt-inputs">
            <header><h2>Inputs used by this result</h2><p>Five captured records · one changed · none unknown</p></header>
            ${renderReceiptInput("TGT-02", "Draft cleaning runtime target", "v1 · unchanged", [
              [
                "Recorded statement",
                "Complete 60 minutes of the defined mixed navigation and cleaning profile on the selected battery configuration.",
              ],
              [
                "Acceptance",
                "Invented duty profile; compare whole-product consumption and usable battery energy.",
              ],
            ])}
            ${renderReceiptInput("REQ-R03", "Whole-product energy allocation", "v1 · unchanged", [
              ["Recorded statement", requirements[1].statement],
              ["Acceptance", requirements[1].acceptance],
            ])}
            ${renderChangedDesignInput()}
            ${renderReceiptInput("DES-04", "Battery and power schematic", "v1 · unchanged", [
              [
                "Recorded statement",
                "Example schematic and energy allocation describe pack use, shared rail and transient supply needs.",
              ],
              ["Artifact", "Invented schematic PWR-04"],
            ])}
            ${renderReceiptInput(
              "BUILD-R01",
              "Prototype A — recorded configuration",
              "v2 · unchanged",
              [
                [
                  "Recorded statement",
                  "Fictional starting build combines the baseline blower, physical design, driver and firmware records. Its manifest records selected native revisions before the blower-profile edit.",
                ],
                [
                  "Manifest",
                  "DES-01 v1 · DES-02 v1 · DES-03 v1 · DES-04 v1 · DES-05 v1 · DES-06 v1 · DES-07 v1 · DES-08 v1 · REQ-R03 v1",
                ],
              ],
            )}
          </section>
        </div>
        <aside class="review-card">
          <h2>Review this receipt</h2>
          <p>Judge whether the recorded result remains applicable after the disclosed input change.</p>
          <form data-review-form>
            <label for="shell-judgment">Judgment
              <select id="shell-judgment" name="judgment" required>
                <option value="">Select…</option>
                ${["Evidence still applicable", "Acknowledge change", "Needs reevaluation"]
                  .map(
                    (choice) =>
                      `<option value="${choice}" ${state.review.judgment === choice ? "selected" : ""}>${choice}</option>`,
                  )
                  .join("")}
              </select>
            </label>
            <label for="shell-rationale">Rationale
              <textarea id="shell-rationale" name="rationale" rows="5" required placeholder="Record the reason for this receipt">${escapeHtml(state.review.rationale)}</textarea>
            </label>
            ${feedback}
            <button class="solid-button" type="submit">${state.review.saved ? "Update judgment" : "Save judgment"}</button>
          </form>
          <small>Saved for this page session only. The captured result and project data remain unchanged.</small>
        </aside>
      </div>
    </section>
  `;
}

function receiptReturnLabel() {
  return state.receiptReturn?.section === "results"
    ? "Return to captured results"
    : "Return to DES-01 requirements";
}

function renderReceiptInput(key, title, inputState, fields) {
  return `
    <details>
      <summary>
        <span class="input-name"><b>${key}</b><strong>${title}</strong></span>
        <span class="input-state"><span>${inputState}</span><i>Inspect</i></span>
      </summary>
      <dl class="input-fields">
        ${fields
          .map(
            ([label, value]) =>
              `<div class="${fields.length === 1 ? "full" : ""}"><dt>${label}</dt><dd>${value}</dd></div>`,
          )
          .join("")}
      </dl>
    </details>
  `;
}

function renderChangedDesignInput() {
  return `
    <details class="changed-input" open>
      <summary>
        <span class="input-name"><b>DES-01</b><strong>Blower-control firmware design</strong></span>
        <span class="input-state"><span>captured v1 · current v2</span><i>Inspect</i></span>
      </summary>
      <dl class="input-fields">
        <div><dt>Captured v1</dt><dd>${design.capturedStatement}</dd></div>
        <div><dt>Current v2</dt><dd>${design.statement}</dd></div>
        <div class="full"><dt>Artifact</dt><dd>${design.artifact}</dd></div>
      </dl>
    </details>
  `;
}

function scopeFrame() {
  return {
    view: state.view,
    selected: state.selected,
    inspector: state.inspector,
    inspectorTab: state.inspectorTab,
    changedOnly: state.changedOnly,
  };
}
function rememberScopeFrame() {
  if (state.section === "items" && state.itemMode === "scope" && !state.receipt)
    state.ownedScopeFrame = scopeFrame();
}
function restoreScopeFrame() {
  Object.assign(state, state.ownedScopeFrame);
}
function openScope() {
  state.section = "items";
  state.itemMode = "scope";
  state.view = "table";
  state.selected = "REQ-R03";
  state.inspector = !isNarrow;
  state.inspectorTab = "details";
  render({ focus: '[data-select="REQ-R03"]' });
}

function openReceipt() {
  rememberScopeFrame();
  state.receiptReturn = {
    section: state.section,
    itemMode: state.itemMode,
    view: state.view,
    selected: state.selected,
    inspector: state.inspector,
  };
  state.receipt = true;
  render({ focus: "[data-receipt-heading]" });
}

function returnFromReceipt() {
  const origin = state.receiptReturn || {
    section: "items",
    itemMode: "scope",
    view: "table",
    selected: "REQ-R03",
    inspector: !isNarrow,
  };
  state.section = origin.section;
  state.itemMode = origin.itemMode;
  state.view = origin.view;
  state.selected = origin.selected;
  state.inspector = origin.inspector ?? !isNarrow;
  state.receipt = false;
  state.receiptReturn = null;
  render({
    focus: receiptOriginFocus(),
  });
}

function receiptOriginFocus() {
  if (state.section !== "items") return "[data-open-receipt]";
  return state.itemMode === "scope" ? `[data-select="${state.selected}"]` : "[data-open-receipt]";
}

document.querySelectorAll("[data-section]").forEach((button) => {
  button.addEventListener("click", () => {
    rememberScopeFrame();
    state.section = button.dataset.section;
    state.receipt = false;
    if (state.section === "items") {
      state.itemMode = "scope";
      restoreScopeFrame();
    }
    document.body.classList.remove("rail-open");
    render({ focus: "#main-content" });
  });
});

document.querySelectorAll("[data-item-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    rememberScopeFrame();
    state.section = "items";
    state.itemMode = button.dataset.itemMode;
    if (state.itemMode === "scope") restoreScopeFrame();
    state.catalogueType = "";
    state.receipt = false;
    document.body.classList.remove("rail-open");
    render({ focus: "#main-content" });
  });
});

document.querySelector("[data-open-rail]").addEventListener("click", () => {
  document.body.classList.add("rail-open");
  requestAnimationFrame(() => rail.querySelector("[data-section]")?.focus());
});

document.querySelectorAll("[data-close-rail]").forEach((button) => {
  button.addEventListener("click", () => {
    document.body.classList.remove("rail-open");
    document.querySelector("[data-open-rail]")?.focus();
  });
});

function closeDialog() {
  const focus = {
    create: "[data-create-item]",
    connect: "[data-connect-item]",
    edit: "[data-edit-item]",
  };
  const origin = focus[state.dialog];
  state.dialog = null;
  render({ focus: origin });
}
function openDialog(kind) {
  state.dialog = kind;
  render({ focus: "[autofocus]" });
}
function switchView(element) {
  state.view = element.dataset.view;
  state.inspectorTab = "details";
  render({ focus: `[data-view="${state.view}"]` });
}
function selectItem(element) {
  state.selected = element.dataset.select;
  state.inspector = true;
  state.inspectorTab = "details";
  render({ focus: ".selection-panel .inspector-header" });
}
function toggleChanged() {
  state.changedOnly = !state.changedOnly;
  render({ focus: "[data-filter-changed]" });
}
function toggleInspector() {
  state.inspector = !state.inspector;
  render({
    focus: state.inspector ? ".selection-panel .inspector-header" : "[data-open-inspector]",
  });
}
function closeInspector() {
  state.inspector = false;
  render({ focus: state.itemMode === "all" ? "[data-catalogue-search]" : "[data-open-inspector]" });
}
function switchInspectorTab(element) {
  state.inspectorTab = element.dataset.inspectorTab;
  render({ focus: `[data-inspector-tab="${state.inspectorTab}"]` });
}
function cataloguePage(step) {
  state.cataloguePage += step;
  render({ focus: "[data-catalogue-search]" });
}

const clickActions = [
  ["[data-overview-type]", openTypeCollection],
  ["[data-overview-model]", openOverviewModel],
  ["[data-resume-scope]", resumeScope],
  ["[data-clear-type]", clearTypeFilter],
  ["[data-catalogue-prev]", () => cataloguePage(-1)],
  ["[data-catalogue-next]", () => cataloguePage(1)],
  ["button[data-close-dialog]", closeDialog],
  ["[data-create-item], [data-create-from-connect]", () => openDialog("create")],
  ["[data-connect-item]", () => openDialog("connect")],
  ["[data-edit-item]", () => openDialog("edit")],
  ["[data-view]", switchView],
  ["[data-select]", selectItem],
  ["[data-filter-changed]", toggleChanged],
  ["[data-open-inspector]", toggleInspector],
  ["[data-close-inspector]", closeInspector],
  ["[data-inspector-tab]", switchInspectorTab],
  ["[data-open-scope]", openScope],
  ["[data-open-receipt]", openReceipt],
  ["[data-return-receipt]", returnFromReceipt],
];
main.addEventListener("click", (event) => {
  if (event.target.matches(".dialog-backdrop")) return closeDialog();
  const action = clickActions.find(([selector]) => event.target.closest(selector));
  if (action) action[1](event.target.closest(action[0]));
});

function activateSelectedRow(event) {
  if (!["Enter", " "].includes(event.key)) return;
  const selection = event.target.closest("[data-select]");
  if (!selection) return;
  event.preventDefault();
  selection.click();
}
function cycleDialogFocus(event) {
  const controls = [
    ...main.querySelectorAll(
      "[data-dialog-card] button, [data-dialog-card] input, [data-dialog-card] textarea, [data-dialog-card] select",
    ),
  ];
  const step = event.shiftKey ? -1 : 1;
  const index = controls.indexOf(document.activeElement);
  const target = controls[(index + step + controls.length) % controls.length];
  event.preventDefault();
  target?.focus();
}
main.addEventListener("keydown", (event) => {
  if (!state.dialog) return activateSelectedRow(event);
  if (event.key === "Escape") return closeDialog();
  if (event.key === "Tab") cycleDialogFocus(event);
});

main.addEventListener("change", (event) => {
  if (!event.target.matches("[data-connect-candidate]")) return;
  const item = [...compatibleRequirements(), ...state.sessionItems].find(
    (record) => record.key === event.target.value,
  );
  main.querySelector("[data-candidate-key]").textContent = `${item.key} → realized_by → DES-01`;
  main.querySelector("[data-candidate-statement]").textContent = presentItem(item).statement;
});
function searchCatalogue(event) {
  state.catalogueSearch = event.target.value;
  state.cataloguePage = 0;
  render({ focus: "[data-catalogue-search]" });
}

main.addEventListener("input", (event) => {
  if (event.target.matches("[data-catalogue-search]")) return searchCatalogue(event);
  if (event.target.name === "key") event.target.setCustomValidity("");
  if (["judgment", "rationale"].includes(event.target.name))
    state.review[event.target.name] = event.target.value;
});

function submitCreate(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const key = String(data.get("key")).trim().toUpperCase();
  if (
    itemPool()
      .concat(compatibleRequirements())
      .some((item) => item.key === key)
  ) {
    const keyField = event.target.querySelector('[name="key"]');
    keyField.setCustomValidity("Use a unique key for this page session.");
    keyField.reportValidity();
    return;
  }
  state.sessionItems.push({
    key,
    type: "requirement",
    nativeCatalogue: true,
    status: "Session only",
    title: String(data.get("title")).trim(),
    statement: String(data.get("statement")).trim(),
    evaluation: "",
    outcome: "No evaluation connected",
    evaluationTitle: "",
    evaluationStatement: "",
    designInput: "—",
    review: "—",
    changed: false,
  });
  state.dialog = null;
  state.notice = `${key} created for this page session.`;
  render({ focus: "[data-connect-item]" });
  return;
}
function submitConnect(event) {
  event.preventDefault();
  const key = String(new FormData(event.target).get("key"));
  const item = [...compatibleRequirements(), ...state.sessionItems].find(
    (candidate) => candidate.key === key,
  );
  if (!item) return;
  state.sessionConnections.add(key);
  item.sessionConnection = {
    scope: String(new FormData(event.target).get("scope")),
    source_version: Number(new FormData(event.target).get("source_version")),
    review: String(new FormData(event.target).get("review")),
  };
  requirements.push(item);
  state.selected = key;
  state.inspector = true;
  state.changedOnly = false;
  state.view = "table";
  state.dialog = null;
  state.notice = `${key} connected to DES-01 through realized_by for this page session.`;
  render({ focus: `[data-select="${key}"]` });
  return;
}
function submitEdit(event) {
  event.preventDefault();
  const item = selectedItem();
  const data = new FormData(event.target);
  state.sessionEdits[item.key] = {
    title: String(data.get("title")).trim(),
    statement: String(data.get("statement")).trim(),
  };
  state.dialog = null;
  state.notice = `${item.key} updated for this page session. Native revisions and captured results are unchanged.`;
  render({ focus: ".selection-panel .inspector-header" });
  return;
}
function submitReview(event) {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  state.review.judgment = data.get("judgment");
  state.review.rationale = data.get("rationale");
  state.review.saved = true;
  const feedback = form.querySelector(".review-feedback");
  feedback.hidden = false;
  feedback.textContent = `Saved for this page session: ${state.review.judgment}. The recorded outcome is unchanged.`;
  form.querySelector('button[type="submit"]').textContent = "Update judgment";
  main.querySelector(".receipt-status").textContent = "Session judgment saved";
}
const submitActions = [
  ["[data-create-form]", submitCreate],
  ["[data-connect-form]", submitConnect],
  ["[data-edit-form]", submitEdit],
  ["[data-review-form]", submitReview],
];
main.addEventListener("submit", (event) => {
  const action = submitActions.find(([selector]) => event.target.matches(selector));
  if (action) action[1](event);
});

function restoreOrbitSession() {
  const raw = sessionStorage.getItem("tracer-study:orbit");
  if (!raw) return;
  const saved = JSON.parse(raw);
  Object.assign(state, saved.state);
  state.sessionConnections = new Set(saved.state.sessionConnections);
  requirements.splice(0, requirements.length, ...saved.requirements);
}
try {
  restoreOrbitSession();
} catch {
  /* Unavailable tab storage leaves the original fixture intact. */
}
if (["overview", "results", "configurations", "model"].includes(initialHash)) {
  state.section = initialHash;
  state.receipt = false;
}
state.ownedScopeFrame ||= scopeFrame();
window.tracerStudy = {
  key: "orbit",
  capture: () => ({
    state: { ...state, sessionConnections: [...state.sessionConnections] },
    requirements,
  }),
};

render();

fetch("catalogue.json")
  .then((response) => {
    if (!response.ok) throw new Error("Catalogue unavailable");
    return response.json();
  })
  .then((items) => {
    state.catalogue = items;
    if (["all"].includes(state.itemMode) || ["overview", "model"].includes(state.section)) render();
  })
  .catch(() => {
    state.catalogueError = true;
    if (["all"].includes(state.itemMode) || ["overview", "model"].includes(state.section)) render();
  });

matchMedia("(max-width: 720px)").addEventListener("change", () => {
  if (["overview", "model"].includes(state.section)) render();
});

fetch("orbit-model.json")
  .then((response) => {
    if (!response.ok) throw new Error("Model unavailable");
    return response.json();
  })
  .then((schema) => {
    state.modelSchema = schema;
    if (state.section === "model") render();
  })
  .catch(() => {
    if (state.section === "model")
      main.innerHTML = '<p role="alert">Could not load the project model. Reload to retry.</p>';
  });
