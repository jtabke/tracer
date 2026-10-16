import { changedText } from "./authoring-policy.mjs";
import { reachableTrace, recordedRoute } from "./trace-context.mjs";
import { wheelIntent } from "./canvas-input.mjs";
import { traceRows, groupedTraceRows } from "./trace-table.mjs";
import {
  renderGrid,
  renderGridEditor,
  disposeGridEditor,
  bindGrid,
  beginRoot,
  cancelGridEdit,
  rowPath,
} from "./matrix-editor.mjs";
import {
  relationshipLabel,
  historyFeed,
  connectedWork,
  focusedNeighborhood,
  potentialPaths,
  pathLayout,
} from "./workspace-journeys.mjs";
import {
  MAX_VISIBLE,
  typeName,
  titleCase,
  snapshotAt,
  significantEvents,
  diffAt,
  allowedTypes,
} from "./workspace-model.mjs";
const params = new URLSearchParams(location.search);
const native = params.has("native") ? await import("./native-client.ts") : null;
document.querySelector("#app").textContent = "Loading workspace…";
let data;
try {
  data = native
    ? await native.initialize()
    : await fetch("./data.json").then((response) => response.json());
} catch (error) {
  document.querySelector("#app").textContent = `The database could not be loaded. ${error.message}`;
  throw error;
}
if (native)
  document.querySelector(".reviewbar span:last-child").textContent =
    "Fictional Aster · saved in the isolated project";
let head = data.snapshotReference.revision;
document.body.classList.toggle("presentation", params.has("presentation"));
const app = document.querySelector("#app"),
  dialog = document.querySelector("#workspace-dialog");
const currentProject = params.get("project") ?? "default";
const evidenceWorkspace = native
  ? (await import("./evidence-workspace.tsx")).createEvidenceWorkspace(native.mutations)
  : null;
let databases = native ? native.projects.map((project) => ({ ...project, url: null })) : [];
if (!native) {
  try {
    const response = await fetch("../../../output/product-identity/native-projects.json", {
      cache: "no-store",
    });
    if (response.ok) databases = await response.json();
  } catch {
    /* Static mode still identifies its exported preview when the native server is absent. */
  }
}
const state = {
  selected: data.trace.root,
  visible: new Set(data.trace.keys),
  baseScope: new Set(data.trace.keys),
  perspective: ["graph", "matrix", "history"].includes(params.get("view"))
    ? params.get("view")
    : "graph",
  density: "compact",
  revision: head,
  inspector: params.get("view") === "matrix" ? false : innerWidth > 1050,
  inspectorPrefs: { graph: innerWidth > 1050, matrix: false, history: innerWidth > 1050 },
  sheetState: "collapsed",
  pathLinkIds: null,
  pathRoot: null,
  pathRevision: null,
  timelineScope: "project",
  investigation: null,
  editing: false,
  width: 340,
  filter: "all",
  timelineFilter: "selected",
  historySubject: null,
  matrixScope: "selected",
  matrixSubject: null,
  matrixPresentation: "grouped",
  matrixDensity: "comfortable",
  matrixCell: null,
  matrixAnchor: null,
  matrixScroll: { top: 0, left: 0 },
  relationshipDrafts: new Map(),
  matrixDraft: null,
  matrixPath: null,
  pathPreview: null,
  matrixMode: native ? "traceability" : "relationships",
  matrixRootType: "product_requirement",
  matrixSteps: [
    { type: "decomposes_into", targetType: "subsystem_requirement" },
    { type: "realized_by", targetType: "design_output" },
    { type: "verified_by", targetType: "verification_protocol" },
  ],
  matrixSearch: "",
  matrixConfigOpen: false,
  saving: false,
  readBlocked: false,
  artifactFull: false,
  inlineField: null,
  assessment: null,
  evidenceOpen: false,
  evidenceDirty: false,
  evidenceSubject: null,
  evidenceReturnView: "graph",
  evidenceEpoch: 0,
  evidenceDiscard: 0,
  historyLimit: 30,
  focusConfig: { direction: "downstream", depth: 1, verification: true },
  focusReturn: null,
  expansions: new Map(),
  pinned: new Set(),
  event: head,
  layout: new Map(),
  scene: null,
  expandedLayout: false,
  projectedHeight: null,
  camera: { zoom: 1, x: 0, y: 0 },
  fittedTitles: false,
  pendingInvestigationLayout: null,
  localEntities: new Map(),
  localLinks: new Map(),
  removed: new Set(),
  drafts: new Map(),
  edge: null,
  more: false,
  notice: "",
  fade: true,
};
if (!data.schema.entityTypes.product_requirement) {
  const first = data.entities.find((record) => record.key === data.trace.root);
  state.matrixRootType = first?.type ?? Object.keys(data.schema.entityTypes)[0];
  state.matrixSteps = [];
  let key = data.trace.root;
  const followed = new Set();
  for (let index = 0; index < 3; index++) {
    const link = data.relationships.find((link) => link.source === key && !followed.has(link.id));
    if (!link) break;
    const target = data.entities.find((record) => record.key === link.target);
    if (!target) break;
    state.matrixSteps.push({ type: link.type, targetType: target.type });
    followed.add(link.id);
    key = link.target;
  }
}
let traceLayout = new Map();
const cache = new Map();
let model;
let selectionTimer, pendingSelection;
let spaceHeld = false;
let suppressCanvasClickUntil = 0;
const escape = (text) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
const e = escape;
const mono = (text) => `<span class="mono">${e(text)}</span>`;
function icon(type) {
  const paths = {
    graph:
      '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="10" cy="19" r="2"/><path d="m7 5 10 2M6 7l3 10m3 0 6-8"/>',
    matrix:
      '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 10h18M10 3v18M3 16h18M16 3v18"/>',
    history: '<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6m3-4v6l4 3"/>',
    entity: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h4"/>',
    subsystem_requirement: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5"/>',
    verification_protocol:
      '<path d="m12 3 8 4v6c0 5-8 9-8 9s-8-4-8-9V7l8-4Z"/><path d="m8 12 3 3 5-6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[type] ?? paths.entity}</svg>`;
}
const brand =
  '<svg viewBox="0 0 24 30" fill="none" aria-hidden="true"><path d="M3 4h17M11 4v23M11 13l9-5M11 22l-8-5" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="8" r="2.4" fill="currentColor"/><circle cx="3" cy="17" r="2.4" fill="currentColor"/></svg>';
function notify(message) {
  state.notice = message;
  document.querySelector("#announcement").textContent = message;
}
function currentModel() {
  if (!cache.has(state.revision)) cache.set(state.revision, snapshotAt(data, state.revision));
  const native = cache.get(state.revision),
    records = new Map(native.records);
  if (state.revision === head)
    for (const [key, record] of state.localEntities) records.set(key, record);
  let links = native.links;
  if (state.revision === head)
    links = [...links.filter((link) => !state.removed.has(link.id)), ...state.localLinks.values()];
  return { records, links };
}
function visibleKeys() {
  if (state.perspective === "graph" && state.pathPreview)
    return state.pathPreview.keys.filter((key) => model.records.has(key));
  return [...state.visible].filter((key) => model.records.has(key));
}
function visibleLinks() {
  const keys = new Set(visibleKeys());
  return model.links.filter(
    (link) =>
      keys.has(link.source) &&
      keys.has(link.target) &&
      (state.filter === "all" || link.type === state.filter) &&
      (!state.pathLinkIds || state.pathLinkIds.has(link.id)) &&
      (state.perspective !== "graph" ||
        !state.pathPreview ||
        state.pathPreview.links.includes(link.id)),
  );
}
function panelMode() {
  const workspace = innerWidth - (innerWidth <= 760 ? 50 : 68);
  return workspace < 640 ? "sheet" : workspace - state.width - 22 < 640 ? "drawer" : "docked";
}
function rememberDraft() {
  const draft = state.drafts.get(state.selected) ?? {};
  if (state.inlineField && document.querySelector("#inline-value")) {
    state.drafts.set(state.selected, {
      ...draft,
      [state.inlineField]: document.querySelector("#inline-value").value,
    });
  } else if (state.editing && document.querySelector("#draft-title")) {
    state.drafts.set(state.selected, {
      ...draft,
      title: document.querySelector("#draft-title").value,
      statement: document.querySelector("#draft-statement").value,
      acceptance: document.querySelector("#draft-acceptance")?.value ?? draft.acceptance,
    });
  }
}
function beginDraft() {
  const record = model.records.get(state.selected);
  if (!record || state.revision !== head) return false;
  if (!state.drafts.has(state.selected))
    state.drafts.set(state.selected, {
      title: record.title,
      statement: record.statement,
      acceptance: record.fields.acceptance ?? "",
      expectedVersion: record.version,
      expectedLocal: record.localGeneration ?? 0,
    });
  return true;
}
function beginInline(field) {
  rememberDraft();
  if (!beginDraft()) return;
  state.inlineField = field;
  state.sheetState = "partial";
  state.editing = false;
  state.inspector = true;
  render();
  document.querySelector("#inline-value")?.focus();
}
async function applyDraft(field = null) {
  rememberDraft();
  const record = model.records.get(state.selected),
    draft = state.drafts.get(state.selected);
  if (state.revision !== head || !record || !draft) return;
  if (
    draft.expectedVersion !== record.version ||
    draft.expectedLocal !== (record.localGeneration ?? 0)
  ) {
    notify(
      "This local draft is based on an older version. Cancel the draft, then reopen the field to review it.",
    );
    render();
    return;
  }
  if (!draft.title.trim() || !draft.statement.trim()) {
    notify("Title and statement are required.");
    render();
    return;
  }
  const fields = { ...record.fields };
  for (const key of field ? [field] : ["title", "statement", "acceptance"])
    if (draft[key] !== undefined) fields[key] = draft[key];
  if (native) {
    const result = await commit([
      {
        op: "entity.update",
        id: record.id,
        expectedVersion: draft.expectedVersion,
        input: { fields },
      },
    ]);
    if (!result) return;
  } else {
    state.localEntities.set(record.key, {
      ...record,
      title: fields.title,
      statement: fields.statement,
      fields,
      localGeneration: (record.localGeneration ?? 0) + 1,
    });
  }
  state.drafts.delete(record.key);
  state.inlineField = null;
  state.editing = false;
  notify(
    native ? `${record.key} saved · r${head}` : `${record.key} updated locally · no database save`,
  );
  render();
}
async function commit(operations, errorElement = null, schemaVersion = data.schema.version) {
  if (state.saving || state.readBlocked || state.revision !== head) return null;
  state.saving = true;
  document
    .querySelectorAll('button[type="submit"], [data-apply-field], [data-action="apply-edit"]')
    .forEach((button) => (button.disabled = true));
  let saved;
  try {
    saved = await native.save(schemaVersion, operations);
    const next = await native.load();
    data = next;
    head = next.snapshotReference.revision;
    cache.clear();
    state.revision = head;
    state.event = head;
    state.assessment = head;
    state.evidenceEpoch++;
    model = currentModel();
    return saved;
  } catch (error) {
    if (saved) state.readBlocked = true;
    const message = saved
      ? "Saved, but the refreshed project could not be loaded. Reload before editing again."
      : error.message;
    if (!errorElement) {
      notify(message);
      render();
      errorElement = app.querySelector(".workspace-notice");
    }
    if (errorElement) {
      errorElement.textContent = message;
      if (native.mutations.snapshot().status === "unknown") {
        errorElement.classList.add("save-recovery");
        const inspect = document.createElement("button");
        inspect.type = "button";
        inspect.textContent = "Inspect saved result";
        inspect.dataset.inspectOutcome = "";
        errorElement.append(inspect);
        inspect.onclick = async () => {
          inspect.disabled = true;
          try {
            const result = await native.inspectAttempt();
            const evidence = document.createElement("div");
            for (const record of result?.records ?? []) {
              const line = document.createElement("p");
              line.textContent = `${record.heading}: ${record.value?.snapshot?.fields?.scope ?? record.description}`;
              evidence.append(line);
            }
            if (!result?.records.length)
              evidence.textContent =
                "No saved result found in this bounded read. This does not prove the save failed.";
            errorElement.append(evidence);
            const acknowledge = document.createElement("button");
            acknowledge.type = "button";
            acknowledge.textContent = "I have inspected the result";
            acknowledge.dataset.acknowledgeOutcome = "";
            errorElement.append(acknowledge);
            acknowledge.onclick = async () => {
              try {
                const next = await native.load();
                native.mutations.acknowledge();
                data = next;
                head = next.snapshotReference.revision;
                cache.clear();
                state.revision = head;
                state.event = head;
                model = currentModel();
                errorElement.append(
                  document.createTextNode(
                    " Project refreshed. Your proposal is retained; compare it before saving again.",
                  ),
                );
                acknowledge.disabled = true;
                const submit = errorElement.closest("form")?.querySelector('[type="submit"]');
                if (submit) submit.disabled = false;
                if (state.matrixDraft) {
                  state.matrixDraft.error =
                    "Saved result inspected. Review the retained proposal before continuing.";
                  render();
                }
              } catch (error) {
                errorElement.append(document.createTextNode(error.message));
              }
            };
          } catch (error) {
            errorElement.append(document.createTextNode(error.message));
            inspect.disabled = false;
          }
        };
      }
    }
    return null;
  } finally {
    state.saving = false;
    document
      .querySelectorAll('button[type="submit"], [data-apply-field], [data-action="apply-edit"]')
      .forEach(
        (button) =>
          (button.disabled = state.readBlocked || native.mutations.snapshot().status === "unknown"),
      );
  }
}
function relevantFeed() {
  return historyFeed(data, {
    scope: state.timelineFilter,
    key: state.historySubject?.key ?? state.selected,
    linkId: state.historySubject ? state.historySubject.linkId : state.edge,
  });
}
function pickEvent(revision, { showHistory = false } = {}) {
  state.evidenceOpen = false;
  rememberDraft();
  if (showHistory && !state.historySubject)
    state.historySubject = { key: state.selected, linkId: state.edge };
  state.event = Number(revision);
  state.revision = state.event;
  state.assessment = state.event;
  state.inlineField = null;
  state.editing = false;
  if (showHistory && state.perspective !== "history") {
    changePerspective("history");
    return;
  }
  render();
}
function stepEvent(delta) {
  const feed = relevantFeed().sort((a, b) => a.revision - b.revision),
    index = feed.findIndex((event) => event.revision === state.event);
  const next =
    index < 0
      ? delta < 0
        ? feed.filter((event) => event.revision < state.event).at(-1)
        : feed.find((event) => event.revision > state.event)
      : feed[index + delta];
  if (next) pickEvent(next.revision);
}
function select(key, open = false) {
  state.evidenceOpen = false;
  clearTimeout(selectionTimer);
  pendingSelection = null;
  rememberDraft();
  state.selected = key;
  if (!state.pathPreview && !state.matrixDraft) state.matrixSubject = null;
  state.historySubject = null;
  state.edge = null;
  state.more = false;
  state.editing = false;
  state.inlineField = null;
  if (open) state.inspector = true;
  render();
  if (state.inspector && panelMode() === "drawer" && !state.artifactFull)
    document.querySelector('.inspector [data-action="close-inspector"]')?.focus();
  else document.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
}
function showDetails(edit = false) {
  rememberDraft();
  state.inspector = true;
  state.editing = edit && state.revision === head;
  state.inlineField = null;
  if (state.editing) {
    beginDraft();
    state.sheetState = "partial";
  }
  render();
  if (panelMode() === "drawer")
    document.querySelector('.inspector [data-action="close-inspector"]')?.focus();
  else if (edit) document.querySelector("#draft-title")?.focus();
}
function closeDetails() {
  rememberDraft();
  state.inspector = false;
  state.artifactFull = false;
  state.inlineField = null;
  state.editing = false;
  render();
  document.querySelector('[data-action="details"]')?.focus();
}
function changePerspective(view) {
  state.evidenceOpen = false;
  if (pendingSelection) select(pendingSelection);
  rememberDraft();
  if (view === "history" && !state.historySubject)
    state.historySubject = { key: state.selected, linkId: state.edge };
  if (!state.artifactFull) state.inspectorPrefs[state.perspective] = state.inspector;
  state.perspective = view;
  state.inspector = state.inspectorPrefs[view];
  state.artifactFull = false;
  render();
  if (view === "matrix" && state.edge)
    app
      .querySelector(".matrix .selected-link")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  document.querySelector(`[data-view="${view}"]`)?.focus();
}
function applyGeometry(root) {
  for (const element of root.querySelectorAll("[data-style]")) {
    for (const declaration of element.dataset.style.split(";")) {
      const split = declaration.indexOf(":");
      if (split > 0)
        element.style.setProperty(declaration.slice(0, split), declaration.slice(split + 1));
    }
    element.removeAttribute("data-style");
  }
}
async function showPendingSave() {
  if (!native || native.mutations.snapshot().status !== "unknown") return;
  try {
    const attempt = native.mutations.snapshot().attempt;
    const result = await native.inspectAttempt();
    const matchingReview =
      attempt.path === "/api/reviews" &&
      result.records.some(
        (record) =>
          record.value?.receiptId === attempt.input.receiptId &&
          record.value?.decision === attempt.input.decision &&
          record.value?.rationale === attempt.input.rationale &&
          record.value?.token === attempt.input.expectedComparison,
      );
    openDialog(
      "Inspect saved result",
      `<div class="switch-database"><p>The proposal remains retained. No automatic retry has been sent.</p>${result.records.map((record) => `<p><strong>${e(record.heading)}</strong><br>${e(String(record.value?.snapshot?.fields?.scope ?? record.description))}</p>`).join("") || "<p>No result found in this bounded read. This does not prove the save failed.</p>"}<button id="acknowledge-pending-save">I have inspected the result</button></div>`,
    );
    dialog.querySelector("#acknowledge-pending-save").onclick = async () => {
      try {
        const next = await native.load();
        native.mutations.acknowledge();
        if (matchingReview) state.evidenceDiscard++;
        state.evidenceEpoch++;
        data = next;
        head = next.snapshotReference.revision;
        cache.clear();
        state.revision = head;
        state.event = head;
        dialog.close();
        render();
      } catch (error) {
        notify(error.message);
      }
    };
  } catch (error) {
    notify(error.message);
    render();
  }
}
function databasePicker() {
  return `<label class="database-picker"><span class="sr-only">Database</span><select id="database-picker" aria-label="Database">${!native ? '<option value="preview" selected>Aster · preview</option>' : ""}${databases.map((database) => `<option value="${e(database.id)}" ${native && database.id === currentProject ? "selected" : ""}>${e(database.title)}</option>`).join("")}</select></label>`;
}
function switchDatabase(id) {
  const picker = app.querySelector("#database-picker");
  const reset = () => {
    if (picker) picker.value = native ? currentProject : "preview";
  };
  if (id === "preview" || (native && id === currentProject)) return;
  const database = databases.find((database) => database.id === id);
  if (!database) {
    reset();
    return;
  }
  reset();
  rememberDraft();
  if (
    state.saving ||
    (native && ["saving", "unknown"].includes(native.mutations.snapshot().status))
  ) {
    notify("Resolve the pending save before switching databases.");
    render();
    return;
  }
  const navigate = () => {
    const url = new URL(database.url ?? location.href);
    url.search = new URLSearchParams({
      native: "1",
      presentation: "1",
      project: id,
      view: state.perspective,
    });
    location.assign(url);
  };
  if (
    state.evidenceDirty ||
    state.matrixDraft ||
    state.relationshipDrafts.size ||
    state.drafts.size ||
    state.localEntities.size ||
    state.localLinks.size ||
    state.removed.size
  ) {
    openDialog(
      "Switch database?",
      '<div class="switch-database"><p>Unsaved edits in this tab will be discarded. Saved records stay in their database.</p><button id="cancel-database-switch">Keep editing</button><button id="confirm-database-switch">Switch database</button></div>',
    );
    dialog.querySelector("#cancel-database-switch").onclick = () => dialog.close();
    dialog.querySelector("#confirm-database-switch").onclick = navigate;
  } else navigate();
}
function assessmentSubject() {
  const key = state.investigation?.subject.key ?? state.selected;
  const record = model.records.get(key);
  return record ? { id: record.id, key, change: state.investigation?.event } : null;
}
async function refreshAssessmentWorkspace() {
  if (!native || state.saving || ["saving", "unknown"].includes(native.mutations.snapshot().status))
    return;
  rememberDraft();
  try {
    data = await native.load();
    head = data.snapshotReference.revision;
    cache.clear();
    state.revision = head;
    state.event = head;
    state.readBlocked = false;
    state.evidenceEpoch++;
    render();
  } catch (error) {
    notify(error.message);
    render();
  }
}
function updateEvidenceWorkspace() {
  if (!evidenceWorkspace) return;
  const subject =
    (state.evidenceOpen || state.evidenceDirty) && state.evidenceSubject
      ? state.evidenceSubject
      : assessmentSubject();
  const slot = app.querySelector("#evidence-slot");
  if (slot) slot.append(evidenceWorkspace.host);
  if (!subject) return;
  evidenceWorkspace.update({
    subject,
    open: state.evidenceOpen,
    visible: Boolean(slot),
    current: state.revision === head,
    head,
    epoch: state.evidenceEpoch,
    blocked: state.readBlocked || state.saving,
    discardRevision: state.evidenceDiscard,
    onOpen: () => action("assess-evidence"),
    returnLabel:
      state.investigation && state.evidenceReturnView === "graph"
        ? "Back to investigation"
        : `Back to ${state.evidenceReturnView}`,
    onReturn: () => {
      state.evidenceOpen = false;
      changePerspective(state.evidenceReturnView);
      app.querySelector('[data-action="assess-evidence"]')?.focus();
    },
    onDirty: (dirty) => {
      state.evidenceDirty = dirty;
    },
    onSaved: () => {
      state.evidenceEpoch++;
      render();
    },
    onMutationSettled: () => render(),
    onRefresh: refreshAssessmentWorkspace,
  });
}
function render() {
  const previousScroll = app.querySelector(".matrix-scroll");
  if (previousScroll)
    state.matrixScroll = { top: previousScroll.scrollTop, left: previousScroll.scrollLeft };
  disposeGridEditor();
  evidenceWorkspace?.host.remove();
  model = currentModel();
  document.body.dataset.panel = panelMode();
  const record = model.records.get(state.selected),
    count = visibleKeys().length,
    atHead = state.revision === head;
  const workspaceTabs = `<nav class="view-switch workspace-perspectives" aria-label="Workspace perspective">${["graph", "matrix", "history"].map((view) => `<button data-view="${view}" aria-pressed="${state.perspective === view}">${icon(view)}${view[0].toUpperCase() + view.slice(1)}</button>`).join("")}</nav>`;
  app.innerHTML = `<div class="shell"><aside class="rail" aria-label="Project navigation"><div class="brand">${brand}</div><nav class="railnav"><button class="active" data-action="graph" title="Development map">${icon("graph")}</button></nav></aside>
  <main class="workspace"><header class="topbar"><div class="crumb">${databasePicker()}<span>/</span><button data-action="reset">${data.schema.entityTypes.product_requirement ? "Requirement trace" : "Connections"}</button></div>${workspaceTabs}<button class="search-button" data-action="search">Search <kbd>⌘ K</kbd></button></header>
  <section class="context details-visible"><div><h1>${state.evidenceOpen ? "Change assessment" : state.artifactFull ? "Artifact" : state.perspective === "history" ? `History · r${state.event}` : state.perspective === "matrix" ? (state.matrixMode === "traceability" ? "Traceability" : "Relationships") : data.schema.entityTypes.product_requirement ? "Requirement trace" : "Connections"}</h1><p>${mono(state.selected)}${state.edge ? " · Relationship selected" : ""}${state.perspective === "matrix" ? "" : ` &nbsp; / &nbsp; ${count} artifacts`}${state.revision !== head ? ` &nbsp; / &nbsp; r${state.revision} · read-only` : ""}</p></div><div class="context-actions">${native && !state.evidenceOpen && !(state.revision === head && (state.investigation || state.evidenceDirty)) ? `<button data-action="assess-evidence" ${state.revision !== head || !assessmentSubject() ? "disabled" : ""}>${state.evidenceDirty ? "Resume assessment" : "Assess evidence"}</button>` : ""}${state.artifactFull ? `<button data-action="back-workspace">← Back to ${state.perspective}</button>` : state.perspective === "history" ? `<button data-action="inspect-revision">Explore potential impact ↗</button>` : state.pathLinkIds && state.investigation ? `<button data-action="return-change">← Change r${state.investigation.event}</button><button data-action="details">Inspect</button>` : `<button data-action="details">${mono(state.selected)} · Inspect</button>`}</div></section>
  ${state.revision !== head ? `<div class="temporal-context" role="status"><strong>Viewing revision ${state.revision} · Read only</strong><button data-action="latest">Return to latest</button></div>` : ""}
  ${state.pathLinkIds && state.investigation ? `<div class="shared-investigation-context"><strong>Change r${state.investigation.event} · ${e(state.pathRoot)}</strong><span>Recorded dependencies at r${state.revision} · ${state.pathLinkIds.size} links · Not assessed impacts</span></div>` : ""}
  ${native && !state.evidenceOpen && state.revision === head && (state.investigation || state.evidenceDirty) ? '<div id="evidence-slot"></div>' : ""}
  <div class="workarea ${state.evidenceOpen ? "assessment-focused" : state.artifactFull ? "artifact-focused" : ""}">${!state.evidenceOpen && state.inspector && panelMode() === "drawer" && !state.artifactFull ? '<button class="inspector-backdrop" data-action="close-inspector" aria-label="Dismiss details"></button>' : ""}<div class="view" id="view">${state.evidenceOpen ? '<div id="evidence-slot"></div>' : state.perspective === "graph" ? graph() : state.perspective === "matrix" ? matrix() : history()}</div>${!state.evidenceOpen && state.inspector ? inspector() : ""}</div>
  ${state.notice ? `<div class="workspace-notice" role="status">${e(state.notice)}<button data-action="dismiss-notice" aria-label="Dismiss notification">×</button></div>` : ""}${native && native.mutations.snapshot().status === "unknown" ? '<div class="pending-save"><span>Save outcome needs inspection</span><button data-action="inspect-pending-save">Inspect saved result</button></div>' : ""}${timeline()}</main></div>`;
  applyGeometry(app);
  const matrixScroll = app.querySelector(".matrix-scroll");
  if (matrixScroll) matrixScroll.scrollTo(state.matrixScroll.left, state.matrixScroll.top);
  if (state.artifactFull) app.querySelector(".view").inert = true;
  if (!state.evidenceOpen && state.inspector && panelMode() === "drawer" && !state.artifactFull) {
    app
      .querySelectorAll(".topbar,.context,.view,.historybar,.workspace-notice")
      .forEach((element) => (element.inert = true));
    const backdrop = app.querySelector(".inspector-backdrop");
    if (backdrop) backdrop.tabIndex = -1;
  }
  bind();
  if (state.perspective === "graph" && !state.evidenceOpen) mountGraph();
  updateEvidenceWorkspace();
}
function graph() {
  const filterTypes = [
    ...new Set(
      model.links
        .filter((link) => state.visible.has(link.source) && state.visible.has(link.target))
        .map((link) => link.type),
    ),
  ];
  return `<div class="graph-toolbar"><label class="sr-only" for="link-filter">Relationship filter</label><select id="link-filter"><option value="all">All relationships</option>${filterTypes.map((type) => `<option value="${type}" ${state.filter === type ? "selected" : ""}>${titleCase(type)}</option>`).join("")}</select><form id="focus-form" class="neighborhood-controls" aria-label="Neighborhood focus"><label class="sr-only" for="focus-direction">Connection direction</label><select id="focus-direction" name="direction"><option value="downstream">Downstream</option><option value="upstream" ${state.focusConfig.direction === "upstream" ? "selected" : ""}>Upstream</option><option value="both" ${state.focusConfig.direction === "both" ? "selected" : ""}>Both directions</option></select><label class="sr-only" for="focus-depth">Connection depth</label><select id="focus-depth" name="depth">${[0, 1, 2, 3].map((depth) => `<option value="${depth}" ${state.focusConfig.depth === depth ? "selected" : ""}>${depth === 0 ? "This artifact" : `${depth} ${depth === 1 ? "step" : "steps"}`}</option>`).join("")}</select><button type="button" data-action="toggle-verification" aria-pressed="${state.focusConfig.verification}" title="Include verification work in the focused scope">Verification</button><button type="submit" class="focus-apply" title="Focus the scope on ${e(state.selected)}">Focus</button></form><label class="sr-only" for="node-detail">Node detail</label><select id="node-detail" aria-label="Node detail">${[
    ["compact", "Titles"],
    ["expanded", "Details"],
    ["overview", "Identifiers"],
  ]
    .map(
      ([value, label]) =>
        `<option value="${value}" ${state.density === value ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select>${state.focusReturn ? '<button class="return-scope" data-action="return-focus" title="Return to previous scope">← Previous scope</button>' : `<span class="graph-count">${visibleLinks().length} links</span>`}</div>
${state.pathPreview ? `<div class="matrix-path-context"><span>Selected matrix path · r${state.pathPreview.revision}</span><button data-view="matrix">Back to matrix</button><button data-action="clear-matrix-path">Show neighborhood</button></div>` : state.pathLinkIds ? investigationContext() + pathSummary() : ""}
 <div class="canvas density-${state.density} mode-trace" aria-label="Engineering graph"><div class="scene"><svg class="edges" aria-label="Directed relationships"></svg><div class="node-layer"></div></div><div class="node-action-layer"></div><div class="canvas-tools" title="Scroll or pinch to zoom · Drag canvas to pan · Shift-scroll to pan"><button data-action="zoom-out" aria-label="Zoom out">−</button><button data-action="frame">Fit</button><button data-action="zoom-in" aria-label="Zoom in">+</button></div>${state.edge && !(native && state.inspector) ? edgeDetail() : ""}</div>`;
}
function initialLayout(width, height) {
  if (!data.trace.keys.includes("PRS-01")) {
    const levels = new Map([[data.trace.root, 0]]);
    for (let pass = 0; pass < 4; pass++)
      for (const link of visibleLinks())
        if (levels.has(link.source) && !levels.has(link.target))
          levels.set(link.target, levels.get(link.source) + 1);
    traceLayout = pathLayout({ keys: visibleKeys(), levels }, width, height);
    return;
  }
  const base = new Map([
    ["PRS-01", { x: width * 0.18, y: height * 0.46 }],
    ["SYS-03", { x: width * 0.51, y: height * 0.23 }],
    ["SYS-04", { x: width * 0.51, y: height * 0.41 }],
    ["SYS-09", { x: width * 0.51, y: height * 0.59 }],
    ["SYS-10", { x: width * 0.51, y: height * 0.77 }],
    ["VER-03", { x: width * 0.84, y: height * 0.46 }],
  ]);
  for (const [key, point] of base) traceLayout.set(key, point);
}
function canvasViewport(canvas = document.querySelector(".canvas")) {
  const bounds = canvas.getBoundingClientRect();
  const inspector = app.querySelector(".inspector:not(.full-artifact)");
  let overlap = 0;
  if (panelMode() === "sheet" && inspector) {
    if (state.sheetState === "partial") {
      const area = app.querySelector(".workarea");
      inspector.style.height = `${Math.max(76, Math.min(260, area.clientHeight * 0.34, canvas.clientHeight - 300))}px`;
    }
    const sheet = inspector.getBoundingClientRect();
    if (sheet.top < bounds.bottom && sheet.right > bounds.left && sheet.left < bounds.right)
      overlap = Math.min(bounds.height, Math.max(0, bounds.bottom - sheet.top));
  }
  canvas.style.setProperty("--inspector-overlap", `${overlap}px`);
  const toolsHeight = canvas.querySelector(".canvas-tools")?.offsetHeight ?? 34;
  return {
    width: canvas.clientWidth,
    height: Math.max(80, canvas.clientHeight - overlap - toolsHeight - 30),
  };
}
function mountGraph() {
  const canvas = document.querySelector(".canvas");
  if (!state.scene) {
    state.scene = {
      width: Math.max(640, canvas.clientWidth),
      height: Math.max(510, canvas.clientHeight),
    };
    initialLayout(state.scene.width, state.scene.height);
  }
  if (state.projectedHeight === null)
    state.projectedHeight = Math.max(
      510,
      Math.min(state.scene.height, canvas.clientHeight - 60 - (panelMode() === "sheet" ? 86 : 0)),
    );
  const investigation = state.pendingInvestigationLayout;
  if (investigation) {
    const viewport = canvasViewport(canvas),
      scale = projection();
    const groups = new Map();
    for (const key of investigation.keys) {
      const level = investigation.levels.get(key) ?? 0;
      if (!groups.has(level)) groups.set(level, []);
      groups.get(level).push(key);
    }
    // Pack tall levels into adjacent columns so readable cards also fit with a sheet open.
    const workarea = app.querySelector(".workarea").getBoundingClientRect();
    const potentialHeight =
      panelMode() === "sheet"
        ? Math.min(
            viewport.height,
            Math.max(
              100,
              canvas.clientHeight -
                Math.max(76, Math.min(260, workarea.height * 0.34, canvas.clientHeight - 300)) -
                62,
            ),
          )
        : viewport.height;
    const rows = Math.max(1, Math.floor((potentialHeight - 48) / 74));
    const columns = [...groups]
      .sort(([a], [b]) => a - b)
      .flatMap(([, keys]) => {
        const chunks = [];
        for (let start = 0; start < keys.length; start += rows)
          chunks.push(keys.slice(start, start + rows));
        return chunks;
      });
    const pitch = Math.max(
      220,
      Math.min(280, (viewport.width - 206) / Math.max(1, columns.length - 1)),
    );
    const estimate = Math.min(
      1,
      (viewport.width - 32) / (174 + pitch * Math.max(0, columns.length - 1)),
    );
    const rowPitch = 74 / Math.max(0.15, estimate);
    const positions = new Map();
    for (const [column, keys] of columns.entries())
      for (const [row, key] of keys.entries())
        positions.set(
          key,
          state.pinned.has(key) && traceLayout.has(key)
            ? { ...traceLayout.get(key) }
            : {
                x: (column * pitch) / scale.x,
                y: ((row - (keys.length - 1) / 2) * rowPitch) / scale.y,
              },
        );
    traceLayout = positions;
    state.pendingInvestigationLayout = null;
  }
  state.layout = traceLayout;
  let frameNewConnection = false;
  if (native && state.edge) {
    const link = model.links.find((link) => link.id === state.edge);
    if (link && [link.source, link.target].some((key) => !state.layout.has(key))) {
      if (!state.expandedLayout)
        for (const [key, point] of state.layout) state.layout.set(key, projectPoint(point));
      const row = Math.max(...visibleKeys().map((key) => state.layout.get(key)?.y ?? 0)) + 120;
      for (const [index, key] of [link.source, link.target].entries())
        if (!state.layout.has(key)) state.layout.set(key, { x: 200 + index * 280, y: row });
      state.expandedLayout = true;
      frameNewConnection = true;
    }
  }
  placeMissing();
  const scene = canvas.querySelector(".scene");
  scene.style.width = `${projection().width}px`;
  scene.style.height = `${projection().height}px`;
  const changed = new Set(
    state.assessment
      ? diffAt(data, state.assessment)
          .filter((diff) => diff.kind === "entity")
          .map((diff) => diff.after?.key ?? diff.before?.key)
      : [],
  );
  const related = new Set([
    state.selected,
    ...visibleLinks()
      .filter((link) => link.source === state.selected || link.target === state.selected)
      .flatMap((link) => [link.source, link.target]),
  ]);
  scene.querySelector(".node-layer").innerHTML =
    (visibleKeys().every((key) => data.trace.keys.includes(key))
      ? `<div class="graph-lane" data-style="left:4%;width:28%"><span>${data.schema.entityTypes.product_requirement ? "Product requirement" : "Selected artifact"}</span></div><div class="graph-lane" data-style="left:37%;width:28%"><span>${data.schema.entityTypes.product_requirement ? "Subsystem allocations" : "Connections"}</span></div><div class="graph-lane" data-style="left:70%;width:28%"><span>${data.schema.entityTypes.product_requirement ? "Verification plan" : "Connected artifacts"}</span></div>`
      : "") +
    visibleKeys()
      .map((key) => {
        const record = model.records.get(key),
          point = projectPoint(state.layout.get(key));
        return `<button class="node ${state.pathLinkIds ? "path-context" : ""} ${changed.has(key) ? "changed" : ""} ${key === state.selected ? "selected" : ""} ${state.fade && !related.has(key) ? "dim" : ""}" data-key="${e(key)}" data-style="left:${point.x}px;top:${point.y}px" aria-pressed="${key === state.selected}" title="${e(record.title)}" aria-label="${e(key)}: ${e(record.title)}"><span class="node-meta">${icon(record.type)}${mono(key)}${changed.has(key) ? '<span class="change-mark" title="Changed in selected revision">Δ</span>' : ""}${state.localEntities.has(key) && state.revision === head ? '<span class="local-dot" title="Local edit">●</span>' : ""}</span><strong>${e(record.title)}</strong>${state.density === "expanded" ? `<span class="node-type">${e(typeName(record.type))}</span>` : ""}</button>`;
      })
      .join("");
  applyGeometry(scene);
  transform();
  drawEdges();
  drawNodeActions();
  bindGraph();
  if (frameNewConnection || investigation) action("frame");
}
function placeMissing() {
  const known = state.layout;
  let index = 0;
  for (const key of visibleKeys())
    if (!known.has(key)) {
      const link = model.links.find(
          (link) =>
            (link.source === key && known.has(link.target)) ||
            (link.target === key && known.has(link.source)),
        ),
        anchor = known.get(link?.source === key ? link.target : link?.source) ?? {
          x: state.scene.width / 2,
          y: state.scene.height / 2,
        };
      let point;
      for (let attempt = 0; attempt < 100; attempt++) {
        const angle = (attempt + index) * 2.399,
          radius = 115 + Math.floor(attempt / 8) * 65;
        point = {
          x: Math.max(105, Math.min(state.scene.width - 105, anchor.x + Math.cos(angle) * radius)),
          y: Math.max(85, Math.min(state.scene.height - 60, anchor.y + Math.sin(angle) * radius)),
        };
        if (
          [...known.values()].every(
            (other) => Math.abs(other.x - point.x) > 190 || Math.abs(other.y - point.y) > 85,
          )
        )
          break;
      }
      known.set(key, point);
      index++;
    }
}
// Keep neighbors in directional columns with room for readable cards.
function arrangeExpanded(added = []) {
  // Existing node positions stay fixed. Only newly revealed cards claim free slots.
  if (!state.expandedLayout) {
    for (const [key, point] of traceLayout) traceLayout.set(key, projectPoint(point));
  }
  const anchor = traceLayout.get(state.selected);
  for (const key of added) {
    const incoming = visibleLinks().some(
      (link) => link.source === key && link.target === state.selected,
    );
    const direction = incoming ? -1 : 1;
    let point;
    for (let attempt = 0; attempt < 500; attempt++) {
      const row = attempt === 0 ? 0 : Math.ceil(attempt / 2) * (attempt % 2 ? -1 : 1);
      point = { x: anchor.x + direction * 250, y: anchor.y + row * 104 };
      if (
        [...traceLayout].every(
          ([otherKey, other]) =>
            !state.visible.has(otherKey) ||
            otherKey === key ||
            Math.abs(point.x - other.x) >= 200 ||
            Math.abs(point.y - other.y) >= 90,
        )
      )
        break;
    }
    traceLayout.set(key, point);
  }
  state.expandedLayout = true;
}
function zoomAt(value, x, y) {
  state.fittedTitles = false;
  const zoom = Math.max(0.15, Math.min(2.5, value)),
    ratio = zoom / state.camera.zoom;
  state.camera.x = x - (x - state.camera.x) * ratio;
  state.camera.y = y - (y - state.camera.y) * ratio;
  state.camera.zoom = zoom;
  transform();
  drawNodeActions();
}
function projection() {
  const canvas = document.querySelector(".canvas");
  if (state.expandedLayout && !state.pathLinkIds) {
    const points = visibleKeys()
      .map((key) => traceLayout.get(key))
      .filter(Boolean);
    return {
      width: Math.max(state.scene.width, ...points.map((p) => p.x + 140)),
      height: Math.max(state.scene.height, ...points.map((p) => p.y + 120)),
      x: 1,
      y: 1,
    };
  }
  const width = Math.max(
    640,
    Math.min(state.scene.width, canvas?.clientWidth ?? state.scene.width),
  );
  const height = state.projectedHeight ?? state.scene.height;
  return { width, height, x: width / state.scene.width, y: height / state.scene.height };
}
function projectPoint(point) {
  const scale = projection();
  return { x: point.x * scale.x, y: point.y * scale.y };
}
function transform() {
  const scene = document.querySelector(".scene");
  const canvas = document.querySelector(".canvas");
  if (canvas) {
    canvas.classList.toggle("zoom-overview", state.camera.zoom < 0.7 && !state.fittedTitles);
    canvas.classList.toggle("fitted-titles", state.fittedTitles);
    canvas.style.setProperty("--camera-zoom", state.camera.zoom);
    canvasViewport(canvas);
  }
  if (scene)
    scene.style.transform = `translate(${state.camera.x}px,${state.camera.y}px) scale(${state.camera.zoom})`;
}
function drawEdges() {
  const svg = document.querySelector("svg.edges");
  if (!svg) return;
  svg.innerHTML =
    `<defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 8 4 0 8" fill="none" stroke="var(--edge)"/></marker></defs>` +
    visibleLinks()
      .map((link) => {
        const a = projectPoint(state.layout.get(link.source)),
          b = projectPoint(state.layout.get(link.target)),
          width = state.density === "overview" ? 72 : 174,
          height = state.density === "expanded" ? 100 : state.density === "overview" ? 32 : 66;
        const reverse = b.x < a.x;
        let sx = a.x + (reverse ? -width / 2 : width / 2),
          tx = b.x + (reverse ? width / 2 : -width / 2),
          sy = a.y,
          ty = b.y;
        let d;
        if (link.source === link.target) {
          d = `M${a.x + width / 2} ${a.y} C${a.x + width} ${a.y - height - 60} ${a.x - width} ${a.y - height - 60} ${a.x - width / 2} ${a.y}`;
        } else if (link.source === "PRS-01" && link.target === "VER-03") {
          sx = a.x;
          sy = a.y + height / 2;
          tx = b.x;
          ty = b.y + height / 2;
          const top =
            Math.max(...visibleKeys().map((key) => projectPoint(state.layout.get(key)).y)) +
            height / 2 +
            24;
          d = `M${sx} ${sy} V${top - 12} Q${sx} ${top} ${sx + 12} ${top} H${tx - 12} Q${tx} ${top} ${tx} ${top - 12} V${ty}`;
        } else if (Math.abs(a.x - b.x) < 2) {
          const side = a.x + width / 2 + 40;
          d = `M${a.x + width / 2} ${a.y} C${side} ${a.y} ${side} ${b.y} ${b.x + width / 2} ${b.y}`;
        } else {
          const mid = (sx + tx) / 2;
          d = `M${sx} ${sy} C${mid} ${sy} ${mid} ${ty} ${tx} ${ty}`;
        }
        const focused =
          link.id === state.edge ||
          link.source === state.selected ||
          link.target === state.selected;
        return `<g><title>${e(link.source)} → ${e(titleCase(link.type))} → ${e(link.target)}</title><path class="edge ${state.pathLinkIds?.has(link.id) ? "recorded-path" : ""} ${state.assessment && diffAt(data, state.assessment).some((diff) => diff.kind === "relationship" && diff.id === link.id) ? "changed-edge" : ""} ${focused ? "focused" : state.fade ? "dim" : ""} ${link.type === "verified_by" ? "verification-edge" : ["executed_as", "examines_output"].includes(link.type) ? "evidence-edge" : link.type === "realized_by" ? "implementation-edge" : !["decomposes_into", "depends_on"].includes(link.type) ? "reference-edge" : ""}" d="${d}" marker-end="url(#arrow)"/><path class="edgehit" d="${d}" data-edge="${e(link.id)}" tabindex="0" role="button" aria-label="${e(link.source)} ${e(titleCase(link.type))} ${e(link.target)}"/></g>`;
      })
      .join("");
  for (const path of svg.querySelectorAll("[data-edge]")) {
    const open = () => {
      rememberDraft();
      state.edge = path.dataset.edge;
      state.historySubject = null;
      render();
      document.querySelector(".edge-detail button")?.focus();
    };
    path.onclick = open;
    path.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    };
  }
}
function drawNodeActions() {
  const layer = document.querySelector(".node-action-layer"),
    point = state.layout.has(state.selected)
      ? projectPoint(state.layout.get(state.selected))
      : null;
  if (!layer || !point || !visibleKeys().includes(state.selected)) return;
  const canvas = document.querySelector(".canvas"),
    x = point.x * state.camera.zoom + state.camera.x,
    y = point.y * state.camera.zoom + state.camera.y;
  const viewport = canvasViewport(canvas);
  const selectedNode = canvas.querySelector(".node.selected");
  const nodeHeight = (selectedNode?.offsetHeight ?? 66) * state.camera.zoom;
  let toolbarTop = Math.max(9, Math.min(viewport.height - 44, y - nodeHeight / 2 - 48));
  const toolbarLeft = Math.max(12, Math.min(canvas.clientWidth - 294, x - 140));
  const canvasBounds = canvas.getBoundingClientRect();
  if (
    state.fittedTitles &&
    [...canvas.querySelectorAll(".node")].some((node) => {
      const r = node.getBoundingClientRect();
      return (
        r.right > canvasBounds.left + toolbarLeft &&
        r.left < canvasBounds.left + toolbarLeft + 280 &&
        r.bottom > canvasBounds.top + toolbarTop &&
        r.top < canvasBounds.top + toolbarTop + 36
      );
    })
  )
    toolbarTop = 9;
  layer.innerHTML = `<div class="node-actions" role="toolbar" aria-label="Actions for ${e(state.selected)}" data-style="left:${toolbarLeft}px;top:${toolbarTop}px"><button data-node-action="expand" title="Expand recorded neighbors">Expand <span>＋</span></button>${state.expansions.has(state.selected) ? '<button data-node-action="collapse">Collapse</button>' : ""}<button data-node-action="connect" ${state.revision !== head ? "disabled" : ""}>Connect</button><button data-node-action="edit" ${state.revision !== head ? "disabled" : ""}>Edit</button><button data-node-action="more" aria-label="More node actions">···</button>${state.more ? `<div class="node-more"><button data-action="details">Inspect</button><button data-action="open-artifact">Open artifact</button><button data-action="pin">${state.pinned.has(state.selected) ? "Unpin position" : "Pin position"}</button><button data-action="focus">Focus neighborhood</button></div>` : ""}</div>`;
  applyGeometry(layer);
  layer
    .querySelectorAll("[data-node-action]")
    .forEach((button) => (button.onclick = () => nodeAction(button.dataset.nodeAction)));
  layer
    .querySelectorAll("[data-action]")
    .forEach((button) => (button.onclick = () => action(button.dataset.action)));
}
function nodeAction(name) {
  if (name === "expand") expand();
  if (name === "collapse") {
    const removed = state.expansions.get(state.selected) ?? [];
    state.expansions.delete(state.selected);
    const protectedKeys = new Set([...state.baseScope, ...[...state.expansions.values()].flat()]);
    for (const key of removed)
      if (!protectedKeys.has(key) && key !== state.selected) state.visible.delete(key);
    render();
  }
  if (name === "connect") openConnect();
  if (name === "edit") showDetails(true);
  if (name === "more") {
    state.more = !state.more;
    drawNodeActions();
  }
}
function expand() {
  rememberDraft();
  const neighbors = model.links
    .filter((link) => link.source === state.selected || link.target === state.selected)
    .flatMap((link) => [link.source, link.target])
    .filter((key) => model.records.has(key) && !state.visible.has(key));
  const unique = [...new Set(neighbors)],
    available = MAX_VISIBLE - state.visible.size;
  const added = unique.slice(0, available);
  if (added.length)
    state.expansions.set(state.selected, [
      ...(state.expansions.get(state.selected) ?? []),
      ...added,
    ]);
  for (const key of added) state.visible.add(key);
  if (added.length) arrangeExpanded(added);
  notify(
    unique.length
      ? `${Math.min(available, unique.length)} neighbors revealed${unique.length > available ? `; ${unique.length - available} beyond the 50-artifact study limit` : ""}`
      : "All recorded neighbors are already visible.",
  );
  render();
  if (added.length) {
    const canvas = document.querySelector(".canvas");
    const clipped = added.some((key) => {
      const p = projectPoint(state.layout.get(key)),
        c = state.camera;
      const x = p.x * c.zoom + c.x,
        y = p.y * c.zoom + c.y;
      return (
        x - 100 * c.zoom < 0 ||
        x + 100 * c.zoom > canvas.clientWidth ||
        y - 50 * c.zoom < 0 ||
        y + 50 * c.zoom > canvas.clientHeight
      );
    });
    if (clipped) action("frame");
  }
}
function diffMarkup(field) {
  const before = typeof field.before === "string" ? field.before : JSON.stringify(field.before);
  const after = typeof field.after === "string" ? field.after : JSON.stringify(field.after);
  const parts = changedText(before, after);
  const line = (kind, value, part, symbol) =>
    value === undefined
      ? ""
      : `<p class="${kind}"><span>${symbol}</span>${e(part.prefix)}${part.change ? `<mark>${e(part.change)}</mark>` : ""}${e(part.suffix)}</p>`;
  return (
    line("before", field.before, parts.before, "−") + line("after", field.after, parts.after, "+")
  );
}
function investigationContext() {
  const diff = diffAt(data, state.pathRevision).find(
    (item) => item.kind === "entity" && (item.after?.key ?? item.before?.key) === state.pathRoot,
  );
  const fields = diff?.fields ?? [];
  const field = fields.find((item) => item.key === "statement") ?? fields[0];
  if (!field) return "";
  const parts = changedText(field.before, field.after);
  return `<section class="investigation-field-change field-diff" aria-label="Investigated change"><h4>${e(titleCase(field.key))} changed · r${state.pathRevision}</h4><div class="change-values"><span class="before">− <mark>${e(parts.before.change || "(empty)")}</mark></span><span aria-hidden="true"> → </span><span class="after">+ <mark>${e(parts.after.change || "(empty)")}</mark></span></div><p class="changed-statement" title="${e(String(field.after ?? ""))}">${e(parts.after.prefix)}<mark>${e(parts.after.change)}</mark>${e(parts.after.suffix)}</p></section>`;
}
function routeExplanation(link) {
  let route =
    state.explainedRoute?.at(-1) === link.id
      ? state.explainedRoute.map((id) => model.links.find((item) => item.id === id))
      : [];
  if (!route.length || route.some((item) => !item)) {
    if (!state.investigation || !state.pathLinkIds?.has(link.id)) return "";
    route = [...recordedRoute(model.links, state.pathRoot, link.source, state.pathLinkIds), link];
  }
  return `<section class="route-explanation"><h3>Recorded path</h3><p>${mono(route[0].source)}${route.map((item) => ` <span>→ ${e(relationshipLabel(item.type, true).toLowerCase())} →</span> ${mono(item.target)}`).join("")}</p><p>Included through ${route.length} recorded ${route.length === 1 ? "connection" : "connections"} at r${state.revision}. No technical assessment recorded here.</p></section>`;
}

function pathSummary() {
  const links = visibleLinks();
  return `<details class="path-summary"><summary>Recorded dependency paths · ${links.length} links</summary><div><p>Potential impact exploration · no technical assessment implied.</p>${links.map((link) => `<button data-path-link="${e(link.id)}">${mono(link.source)}<span>${e(titleCase(link.type))}</span>${mono(link.target)}</button>`).join("")}</div></details>`;
}
function relationshipInspector() {
  const link = model.links.find((link) => link.id === state.edge),
    mode = panelMode();
  if (!link)
    return `<aside class="inspector" aria-label="Relationship inspector"><p>The selected relationship is not present at r${state.revision}.</p><button data-action="close-inspector">Close</button></aside>`;
  const draft = state.relationshipDrafts.get(link.id);
  const editing = draft && state.revision === head;
  return `<aside class="inspector relationship-inspector" aria-label="Relationship inspector" data-sheet="${state.sheetState}" data-style="--inspector-width:${state.width}px" ${mode === "drawer" ? 'role="dialog" aria-modal="true"' : ""}><div class="inspector-state">Relationship at r${state.revision} · ${state.revision === head ? "Latest" : "Historical"} · v${link.version}</div><div class="inspector-top"><strong>${e(titleCase(link.type))}</strong><button data-action="close-inspector" aria-label="Close inspector">×</button></div><div class="relationship-endpoints"><button data-related="${e(link.source)}" title="${e(model.records.get(link.source)?.title)}">${mono(link.source)}</button><span>→ ${e(titleCase(link.type))} →</span><button data-related="${e(link.target)}" title="${e(model.records.get(link.target)?.title)}">${mono(link.target)}</button></div><p class="endpoint-titles">${e(model.records.get(link.source)?.title)} → ${e(model.records.get(link.target)?.title)}</p>${routeExplanation(link)}<div class="section-label">Scope</div>${editing ? `<form id="relationship-scope-form"><textarea name="scope" aria-label="Relationship scope" required>${e(draft.scope)}</textarea><p class="form-error" role="alert">${e(draft.error ?? "")}</p><div class="edge-actions"><button type="submit">Save</button><button type="button" data-cancel-relationship-scope>Cancel</button></div></form>` : native && state.revision === head ? `<button class="editable-field criterion" data-edit-relationship-scope aria-label="Edit relationship scope">${e(link.scope)}<span class="inline-pencil" aria-hidden="true">✎</span></button>` : `<p class="criterion">${e(link.scope)}</p>`}<div class="edge-actions"><button data-action="relationship-history">History</button><button data-action="edit-edge" ${state.revision !== head ? "disabled" : ""}>${native ? "Edit" : "Edit locally"}</button></div></aside>`;
}
function bindRelationshipScope() {
  app.querySelector("[data-edit-relationship-scope]")?.addEventListener("click", () => {
    const link = model.links.find((link) => link.id === state.edge);
    if (
      !link ||
      state.saving ||
      state.readBlocked ||
      native.mutations.snapshot().status === "unknown"
    )
      return;
    state.relationshipDrafts.set(link.id, {
      ...link,
      fields: { ...link.fields },
      schemaVersion: data.schema.version,
    });
    render();
    app.querySelector("#relationship-scope-form textarea")?.focus();
  });
  const form = app.querySelector("#relationship-scope-form");
  if (!form) return;
  const input = form.querySelector("textarea"),
    draft = state.relationshipDrafts.get(state.edge);
  const locked =
    state.saving || state.readBlocked || native.mutations.snapshot().status === "unknown";
  form.querySelectorAll("textarea,button").forEach((control) => (control.disabled = locked));
  input.oninput = () => {
    draft.scope = input.value;
  };
  const cancel = () => {
    if (state.saving || native.mutations.snapshot().status === "unknown") return;
    state.relationshipDrafts.delete(draft.id);
    render();
    app.querySelector("[data-edit-relationship-scope]")?.focus();
  };
  form.querySelector("[data-cancel-relationship-scope]").onclick = cancel;
  form.onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      form.requestSubmit();
    }
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!draft.scope.trim()) return;
    const source = model.records.get(draft.source),
      target = model.records.get(draft.target);
    const controls = [...form.querySelectorAll("textarea,button")];
    controls.forEach((control) => (control.disabled = true));
    const result = await commit(
      [
        {
          op: "relationship.update",
          id: draft.id,
          expectedVersion: draft.version,
          input: {
            source: source.id,
            target: target.id,
            type: draft.type,
            fields: { ...draft.fields, scope: draft.scope.trim() },
          },
        },
      ],
      form.querySelector(".form-error"),
      draft.schemaVersion,
    );
    if (!result) {
      draft.error = form.querySelector(".form-error")?.textContent;
      controls.forEach(
        (control) =>
          (control.disabled =
            state.readBlocked || native.mutations.snapshot().status === "unknown"),
      );
      return;
    }
    state.relationshipDrafts.delete(draft.id);
    notify(`Relationship saved · r${head}`);
    render();
  };
}

function fieldContent(field, record) {
  const value =
    field === "title"
      ? record.title
      : field === "statement"
        ? record.statement
        : (record.fields[field] ?? "");
  if (state.inlineField === field) {
    const draft = state.drafts.get(record.key) ?? {};
    return `<div class="inline-edit"><label class="sr-only" for="inline-value">${field === "acceptance" ? "Acceptance criterion" : titleCase(field)}</label><textarea id="inline-value">${e(draft[field] ?? value)}</textarea><div><button data-apply-field="${field}">${native ? "Save" : "Apply locally"}</button><button data-action="cancel-inline">Cancel</button></div></div>`;
  }
  if (state.revision !== head)
    return `<p class="${field === "statement" ? "statement" : "criterion"}">${e(value)}</p>`;
  return `<button class="editable-field ${field === "statement" ? "statement" : "criterion"}" data-edit-field="${field}" aria-label="Edit ${field === "acceptance" ? "acceptance criterion" : field}">${e(value) || "Add acceptance criterion"}<span class="inline-pencil" aria-hidden="true">✎</span></button>`;
}
function inspector() {
  if ((state.perspective === "matrix" || native) && state.edge && !state.artifactFull)
    return relationshipInspector();
  const record = model.records.get(state.selected),
    mode = panelMode(),
    historical = state.revision !== head;
  const modal = mode === "drawer" && !state.artifactFull;
  const shell = (content) =>
    `<aside class="inspector ${state.artifactFull ? "full-artifact" : ""}" data-sheet="${state.sheetState}" aria-label="${state.artifactFull ? "Artifact editor" : "Artifact inspector"}" data-style="--inspector-width:${state.width}px" ${modal ? 'role="dialog" aria-modal="true" aria-labelledby="artifact-heading"' : ""}>${content}</aside>`;
  if (!record)
    return shell(
      `<div class="inspector-top">${mono(state.selected)}<button data-action="close-inspector" aria-label="Close inspector">×</button></div><p>This artifact does not exist at revision ${state.revision}.</p><button data-action="latest">Return to latest</button>`,
    );
  if (mode === "sheet" && !state.artifactFull && state.sheetState === "collapsed")
    return shell(
      `<div class="compact-inspector"><div>${mono(`${record.key} · r${state.revision}`)}<strong>${e(record.title)}</strong></div><button data-action="expand-sheet" aria-label="Expand artifact details">Details ↑</button><button data-action="open-artifact" aria-label="Open artifact editor" title="Open artifact editor">↗</button><button data-action="close-inspector" aria-label="Close inspector">×</button></div>`,
    );
  const draft = state.drafts.get(record.key) ?? record,
    groups = new Map(),
    links = model.links.filter((link) => link.source === record.key || link.target === record.key);
  for (const link of links) {
    const outgoing = link.source === record.key,
      label = relationshipLabel(link.type, outgoing);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push({ link, key: outgoing ? link.target : link.source, outgoing });
  }
  const ownHistory = data.revisions
    .filter(
      (entry) => entry.snapshot?.key === record.key && entry.projectRevision <= state.revision,
    )
    .slice(-2)
    .reverse();
  const header = `${mode === "docked" && !state.artifactFull ? `<div class="inspector-resize" role="separator" tabindex="0" aria-label="Resize artifact inspector" aria-orientation="vertical" aria-valuemin="300" aria-valuemax="460" aria-valuenow="${state.width}"></div>` : ""}<div class="inspector-state">${state.localEntities.has(record.key) && !historical ? `Local edit · based on r${head}` : `${state.perspective === "history" ? "Artifact state" : "Artifact"} · r${state.revision} · ${state.revision === head ? "Latest" : "Historical"}`}</div><div class="inspector-top"><div>${mono(record.key)}<span class="version">v${record.version}</span></div><div class="inspector-actions">${mode === "sheet" && !state.artifactFull ? '<button data-action="collapse-sheet" aria-label="Collapse artifact details">↓</button>' : ""}${!state.artifactFull ? '<button data-action="open-artifact" aria-label="Open artifact editor" title="Open artifact editor">↗</button>' : ""}<button data-action="edit" ${historical ? "disabled" : ""} aria-label="Edit artifact" title="Edit artifact">✎</button><button data-action="close-inspector" aria-label="${state.artifactFull ? "Close artifact editor" : "Close inspector"}">×</button></div></div><p class="type-label">${icon(record.type)}${e(typeName(record.type))}${state.localEntities.has(record.key) && !historical ? '<span class="local-dot">Local edit</span>' : ""}</p>`;
  const fields = state.editing
    ? `<h2 id="artifact-heading" tabindex="-1">Edit ${e(record.key)}</h2><div class="editor-fields"><label>Title<input id="draft-title" value="${e(draft.title)}"></label><label>Statement<textarea id="draft-statement">${e(draft.statement)}</textarea></label><label>Acceptance criterion<textarea id="draft-acceptance">${e(draft.acceptance ?? record.fields.acceptance ?? "")}</textarea></label><div class="edit-actions"><button data-action="apply-edit">${native ? "Save" : "Apply locally"}</button><button data-action="cancel-edit">Cancel</button></div><p class="draft-note">${native ? "Saved in the isolated Aster project" : "This tab only · no database save"}</p></div>`
    : `<h2 id="artifact-heading" tabindex="-1">${e(record.title)}</h2>${fieldContent("statement", record)}<div class="section-label">Acceptance criterion</div>${fieldContent("acceptance", record)}`;
  const relationships = `<section class="relationship-groups"><div class="inspector-section-heading"><h3>Direct connections <span>${links.length}</span></h3><button data-action="connect" ${historical ? "disabled" : ""} aria-label="Add relationship">＋</button></div>${[...groups].map(([label, items]) => `<section class="relationship-group"><h4>${e(label)} <span>${items.length}</span></h4>${items.map(({ link, key }) => `<div class="relationship-entry"><button class="connection-row" data-related="${e(key)}"><span>${mono(key)}<strong>${e(model.records.get(key)?.title ?? key)}</strong></span></button><button data-inspect-link="${e(link.id)}" aria-label="Inspect relationship ${e(link.source)} to ${e(link.target)}" title="Inspect relationship">↗</button></div>`).join("")}</section>`).join("")}</section>`;
  const reachable = reachableTrace(model, record.key, state.matrixSteps);
  const reachableSection = `<section class="reachable-trace"><div class="inspector-section-heading"><h3>Reachable in trace <span>${reachable.entries.length}${reachable.truncated ? "+" : ""}</span></h3></div><p class="trace-scope-note">Current matrix path · up to ${state.matrixSteps.length} steps</p>${reachable.entries.map((item) => `<button class="reachable-entry" data-trace-route="${e(JSON.stringify(item.links))}">${mono(item.key)}<strong>${e(model.records.get(item.key)?.title ?? item.key)}</strong><small>${item.keys.map(e).join(" → ")}</small></button>`).join("")}${!reachable.entries.length ? '<p class="trace-scope-note">No indirect matches in this configured path.</p>' : ""}${reachable.truncated ? '<p class="trace-scope-note">Bounded path view; narrow the configured trace.</p>' : ""}</section>`;
  const recent = `<section class="artifact-history"><div class="inspector-section-heading"><h3>Recent history</h3><button data-action="artifact-history" aria-label="View artifact history">↗</button></div>${ownHistory.map((entry) => `<button data-artifact-event="${entry.projectRevision}">${mono(`r${entry.projectRevision}`)}<span>${entry.version === 1 ? "Created" : `Updated to v${entry.version}`}</span></button>`).join("")}</section>`;
  return shell(header + fields + (!state.editing ? relationships + reachableSection + recent : ""));
}
function edgeDetail() {
  const link =
    model.links.find((link) => link.id === state.edge) ??
    data.relationships.find((link) => link.id === state.edge);
  if (!link) return "";
  return `<section class="edge-detail" aria-label="Relationship details"><button data-action="close-edge" aria-label="Close relationship details">×</button><strong>${e(titleCase(link.type))}</strong>${mono(`${link.source} → ${link.target}`)}<p>${e(link.scope)}</p><div class="edge-actions"><button data-action="relationship-history">History</button><button data-action="edit-edge" ${state.revision !== head ? "disabled" : ""}>Edit</button><button data-action="remove-edge" ${state.revision !== head ? "disabled" : ""}>Remove</button></div></section>`;
}
function matrixHeader() {
  return `<div class="matrix-actions"><div class="matrix-lenses" role="group" aria-label="Matrix representation"><button data-matrix-mode="traceability" aria-pressed="${state.matrixMode === "traceability"}">Traceability</button><button data-matrix-mode="relationships" aria-pressed="${state.matrixMode === "relationships"}">Relationships</button></div><button data-action="create-artifact" ${state.revision !== head ? "disabled" : ""}>＋ New artifact</button></div>`;
}
let matrixProjection;
function matrixContext() {
  return {
    state,
    model,
    data,
    head,
    native,
    app,
    projection: matrixProjection,
    commit,
    render,
    notify,
    recover: showPendingSave,
    showPath: (path) => {
      if (!path?.keys.length) return;
      state.pathPreview = { ...path, revision: state.revision };
      changePerspective("graph");
      action("frame");
    },
  };
}
function traceabilityMatrix() {
  state.matrixSubject ??= state.selected;
  const options = (selected, choices) =>
    choices
      .map(
        (value) =>
          `<option value="${e(value)}" ${value === selected ? "selected" : ""}>${e(typeName(value))}</option>`,
      )
      .join("");
  const types = Object.keys(data.schema.entityTypes);
  const relations = Object.keys(data.schema.relationshipTypes);
  const roots = (
    state.matrixScope === "selected"
      ? [state.matrixSubject]
      : state.matrixScope === "project"
        ? [...model.records.keys()]
        : visibleKeys()
  )
    .filter((key) => {
      const record = model.records.get(key);
      return (
        record?.type === state.matrixRootType &&
        `${key} ${record.title}`.toLowerCase().includes(state.matrixSearch.toLowerCase())
      );
    })
    .sort();
  const links = state.pathLinkIds
    ? visibleLinks()
    : model.links.filter((link) => state.filter === "all" || link.type === state.filter);
  const result = (state.matrixPresentation === "grouped" ? groupedTraceRows : traceRows)(
    model.records,
    links,
    roots,
    state.matrixSteps,
  );
  matrixProjection = result;
  const currentRow = result.rows[state.matrixCell?.row];
  const currentHasLink =
    currentRow?.links.includes(state.edge) ||
    currentRow?.terminals?.some((item) => item.linkId === state.edge);
  if (state.edge && !currentHasLink) {
    const rowIndex = result.rows.findIndex(
      (row) =>
        row.links.includes(state.edge) || row.terminals?.some((item) => item.linkId === state.edge),
    );
    if (rowIndex >= 0) {
      const row = result.rows[rowIndex];
      state.matrixCell = {
        row: rowIndex,
        column: row.terminals?.some((item) => item.linkId === state.edge)
          ? state.matrixSteps.length
          : row.links.indexOf(state.edge) + 1,
      };
      state.matrixAnchor = { ...state.matrixCell };
    }
  }
  if (
    state.matrixCell &&
    (state.matrixCell.row >= result.rows.length ||
      state.matrixCell.column > state.matrixSteps.length)
  ) {
    state.matrixCell = null;
    state.matrixAnchor = null;
  }
  if (
    state.matrixAnchor &&
    (state.matrixAnchor.row >= result.rows.length ||
      state.matrixAnchor.column > state.matrixSteps.length)
  )
    state.matrixAnchor = state.matrixCell ? { ...state.matrixCell } : null;
  if (state.matrixCell) state.matrixPath = rowPath(result.rows[state.matrixCell.row]);
  const table = renderGrid(matrixContext());
  const connection =
    state.recentConnection && model.links.find((link) => link.id === state.recentConnection.id);
  const nextConnection = connection
    ? `<div class="connected-next" role="status"><span>Connected to ${mono(connection.target)}</span><button data-connected-graph>View on graph</button><button data-connected-another ${state.revision !== head ? "disabled" : ""}>Add another</button></div>`
    : "";
  return `<div class="matrix traceability-matrix matrix-${state.matrixDensity}">${matrixHeader()}${nextConnection}<div class="matrix-view-controls"><label>Presentation<select id="trace-presentation"><option value="grouped" ${state.matrixPresentation === "grouped" ? "selected" : ""}>Grouped paths</option><option value="flat" ${state.matrixPresentation === "flat" ? "selected" : ""}>Flat paths</option></select></label><label>Density<select id="trace-density"><option value="comfortable">Comfortable</option><option value="compact" ${state.matrixDensity === "compact" ? "selected" : ""}>Compact</option></select></label>${state.matrixCell ? `<div class="matrix-cell-actions">${state.matrixAnchor && (state.matrixAnchor.row !== state.matrixCell.row || state.matrixAnchor.column !== state.matrixCell.column) ? '<span class="range-selection-label">Range selected · copy as text</span>' : ""}<button data-grid-edit ${!native || state.revision !== head ? "disabled" : ""}>Edit cell</button>${state.edge ? "<button data-grid-inspect>Inspect relationship</button>" : ""}<button data-grid-show-path>Show ${state.matrixPath?.links.length > state.matrixSteps.length ? "paths" : "path"} on graph</button></div>` : ""}</div><details class="trace-config-toggle" ${state.matrixConfigOpen ? "open" : ""}><summary>Configure columns</summary><label class="trace-column-count">Path length<select id="trace-column-count"><option value="0" ${state.matrixSteps.length === 0 ? "selected" : ""}>Artifacts only</option>${[1, 2, 3, 4].map((count) => `<option value="${count}" ${state.matrixSteps.length === count ? "selected" : ""}>${count} relationship${count === 1 ? "" : "s"}</option>`).join("")}</select></label><div class="trace-config"><label>Rows<select id="trace-root-type">${options(state.matrixRootType, types)}</select></label>${state.matrixSteps.map((step, index) => `<label>Column ${index + 2}<select data-trace-relation="${index}" aria-label="Column ${index + 2} relationship">${options(step.type, relations)}</select><select data-trace-target="${index}" aria-label="Column ${index + 2} artifact type">${options(step.targetType, types)}</select></label>`).join("")}</div></details><div class="matrix-controls"><label>Scope<select id="matrix-scope"><option value="selected">${e(state.matrixSubject)} only</option><option value="neighborhood" ${state.matrixScope === "neighborhood" ? "selected" : ""}>Visible neighborhood</option><option value="project" ${state.matrixScope === "project" ? "selected" : ""}>Project</option></select></label><label>Find row<input id="matrix-search" value="${e(state.matrixSearch)}" placeholder="Identifier or title"></label><span>${result.rows.length} rows${result.truncated ? " · bounded view; narrow the scope" : ""}</span></div><div class="matrix-scroll"><table role="grid" aria-label="Editable traceability matrix"><colgroup>${[state.matrixRootType, ...state.matrixSteps.map((step) => step.targetType)].map(() => "<col>").join("")}</colgroup><thead><tr><th>${e(typeName(state.matrixRootType))}</th>${state.matrixSteps.map((step) => `<th>${e(typeName(step.targetType))}<small title="Each transition is a direct recorded relationship from the previous column">Direct · ${e(titleCase(step.type))}</small></th>`).join("")}</tr></thead><tbody>${table}${native && state.revision === head ? `<tr class="matrix-create-row"><td colspan="${state.matrixSteps.length + 1}"><button data-grid-create-root>＋ New ${e(typeName(state.matrixRootType).toLowerCase())}</button></td></tr>` : ""}</tbody></table>${!result.rows.length ? '<p class="matrix-empty">No matching source artifacts. Choose another row type or broaden the scope.</p>' : ""}</div>${renderGridEditor(matrixContext())}<p class="legend">Direct recorded links at r${state.revision}. Grouping is a presentation; missing links are not assessed coverage.</p></div>`;
}
function matrix() {
  if (state.matrixMode === "traceability") return traceabilityMatrix();
  const keys = visibleKeys(),
    links = visibleLinks();
  const rows =
    state.matrixScope === "selected" ? keys.filter((key) => key === state.selected) : keys;
  return `<div class="matrix">${matrixHeader()}<div class="matrix-controls"><label>Scope <select id="matrix-scope"><option value="selected">${e(state.selected)} only</option><option value="neighborhood" ${state.matrixScope === "neighborhood" ? "selected" : ""}>Visible neighborhood</option></select></label><label>Relationships <select id="matrix-filter"><option value="all">All</option>${[...new Set(model.links.map((link) => link.type))].map((type) => `<option value="${type}" ${state.filter === type ? "selected" : ""}>${titleCase(type)}</option>`).join("")}</select></label></div><table><thead><tr><th>Source → Target</th>${keys.map((key) => `<th>${mono(key)}</th>`).join("")}</tr></thead><tbody>${rows
    .map(
      (key) =>
        `<tr class="${key === state.selected ? "selected" : ""}"><td><button data-related="${e(key)}">${mono(key)}${e(model.records.get(key).title)}</button></td>${keys
          .map((target) => {
            const cell = links.filter((link) => link.source === key && link.target === target);
            return `<td class="mark ${cell.some((link) => link.id === state.edge) ? "selected-link" : ""}">${cell.length ? cell.map((link) => `<button data-matrix-edge="${e(link.id)}" title="${e(titleCase(link.type))}" aria-label="${key} ${e(titleCase(link.type))} ${target}">${link.type === "verified_by" ? "◇" : "●"}</button>`).join("") : state.revision === head && allowedTypes(data.schema, model.records.get(key), model.records.get(target)).length ? `<button data-cell-source="${e(key)}" data-cell-target="${e(target)}" aria-label="Connect ${e(key)} to ${e(target)}" title="Create a typed relationship">＋</button>` : "·"}</td>`;
          })
          .join("")}</tr>`,
    )
    .join(
      "",
    )}</tbody></table>${!rows.length ? "<p>The selected artifact is not present at this revision.</p>" : ""}<p class="legend">● Recorded link &nbsp; ◇ Verification link &nbsp; · No recorded link</p>${state.pathLinkIds ? pathSummary() : ""}</div>`;
}
function history() {
  const feed = relevantFeed(),
    relevantChange = feed.some((item) => item.revision === state.event),
    diffs = relevantChange ? diffAt(data, state.event) : [],
    change = data.changesets.find((item) => item.projectRevision === state.event),
    work = relevantChange ? connectedWork(data, state.event) : [];
  const changedArtifacts = diffs.filter((diff) => diff.kind === "entity"),
    changedLinks = diffs.filter((diff) => diff.kind === "relationship");
  const reason = relevantChange ? (change?.reason ?? "") : "";
  const selectedLink =
    model.links.find((link) => link.id === state.edge) ??
    data.relationships.find((link) => link.id === state.edge);
  const subjectLink =
    data.relationships.find((link) => link.id === state.historySubject?.linkId) ?? selectedLink;
  const scope = state.historySubject?.linkId
    ? `${subjectLink?.source ?? ""} → ${subjectLink?.target ?? ""}`
    : (state.historySubject?.key ?? state.selected);
  if (!feed.length)
    return `<section class="history-workspace"><p>No recorded revisions for this local selection.</p><p class="draft-note">Local edits are not saved history.</p><button data-action="graph">Back to graph</button></section>`;
  return `<section class="history-workspace"><div class="history-scope"><span class="history-scope-label">${feed.length} changesets</span><label class="sr-only" for="event-filter">History scope</label><select id="event-filter"><option value="selected" ${state.timelineFilter === "selected" ? "selected" : ""}>${e(scope)} only</option><option value="project" ${state.timelineFilter === "project" ? "selected" : ""}>Project</option></select></div><div class="history-columns"><nav class="changeset-feed" aria-label="Changesets">${
    feed
      .slice(0, state.historyLimit)
      .map(
        (event) =>
          `<button data-event="${event.revision}" class="${state.event === event.revision ? "selected" : ""}" aria-pressed="${state.event === event.revision}">${mono(`r${event.revision}`)}<strong>${e(event.title)}</strong><span>${e(event.operation)} · ${event.kind === "relationship" ? "Relationship" : event.kind === "schema" ? "Model" : "Artifact"}</span></button>`,
      )
      .join("") || "<p>No native history for this local selection.</p>"
  }${feed.length > state.historyLimit ? '<button data-action="more-history">Show more</button>' : ""}</nav><div class="change-detail"><div class="change-heading"><h3>${changedArtifacts.length ? `${changedArtifacts.length} artifact${changedArtifacts.length === 1 ? "" : "s"} changed` : changedLinks.length ? `${changedLinks.length} relationship${changedLinks.length === 1 ? "" : "s"} changed` : relevantChange ? "Project model changed" : `No change to this selection at r${state.event}`}</h3></div><p class="change-reason">${e(reason)}</p>${diffs.map((diff) => `<article><h3>${e(diff.after?.key ?? diff.before?.key ?? titleCase(diff.kind))}<span>${diff.before ? (diff.after ? "Modified" : "Removed") : "Added"}</span></h3>${diff.after?.source ? `<p>${mono(diff.after.source)} → ${e(titleCase(diff.after.type))} → ${mono(diff.after.target)}</p>` : ""}${diff.fields.map((field) => `<section class="field-diff"><h4>${e(titleCase(field.key))}</h4>${diffMarkup(field)}</section>`).join("")}</article>`).join("")}${
    work.length
      ? `<section class="connected-work"><h3>Connected engineering work <span>${work.length}</span></h3><p>Connected artifacts, not assessed impacts.</p>${work
          .map(
            ({ record, relationships }) =>
              `<button data-review-artifact="${e(record.key)}">${mono(record.key)}<span><strong>${e(record.title)}</strong><small>${e(
                relationships
                  .map((link) =>
                    relationshipLabel(
                      link.type,
                      changedArtifacts.some((diff) => diff.after?.key === link.source),
                    ),
                  )
                  .join(" · "),
              )}</small></span><span>↗</span></button>`,
          )
          .join("")}</section>`
      : ""
  }</div></div></section>`;
}
function timeline() {
  const events =
    state.timelineScope === "project"
      ? significantEvents(data)
      : historyFeed(data, { key: state.selected, linkId: state.edge }).map((event) => ({
          ...event,
          title: event.title,
        }));
  return `<footer class="historybar continuous-history"><label class="sr-only" for="timeline-scope">Timeline scope</label><select id="timeline-scope"><option value="project">Project</option><option value="selected" ${state.timelineScope === "selected" ? "selected" : ""}>Selection</option></select><span class="timeline-scale">Revisions 1–${head}</span><div class="revision-axis"><div class="axis-ticks">${events.map((event) => `<button data-axis-event="${event.revision}" data-style="left:${((event.revision - 1) / (head - 1)) * 100}%" title="r${event.revision} · ${e(event.title)}" aria-label="Revision ${event.revision}: ${e(event.title)}"></button>`).join("")}</div><label class="sr-only" for="revision-range">Project revision</label><input id="revision-range" type="range" min="1" max="${head}" step="1" value="${state.revision}" aria-valuetext="Revision ${state.revision} of ${head}"></div><div class="revision-controls"><button data-action="previous-event" aria-label="Previous changeset">‹</button><span class="mono">r${state.revision}</span><button data-action="next-event" aria-label="Next changeset">›</button></div></footer>`;
}
function visitRevision(revision) {
  state.evidenceOpen = false;
  rememberDraft();
  state.revision = Math.max(1, Math.min(head, Number(revision)));
  state.event = state.revision;
  state.editing = false;
  state.inlineField = null;
  state.assessment = state.revision;
  notify(
    state.revision === head
      ? "Latest revision · local edits restored"
      : `Revision ${state.revision} · read-only`,
  );
  render();
}
async function action(name) {
  rememberDraft();
  switch (name) {
    case "assess-evidence": {
      if (!native || state.revision !== head) return;
      const subject = assessmentSubject();
      if (!subject) return;
      if (!state.evidenceDirty || !state.evidenceSubject) {
        state.evidenceSubject = subject;
        if (!state.evidenceOpen) state.evidenceReturnView = state.perspective;
      }
      state.evidenceOpen = true;
      state.artifactFull = false;
      state.evidenceEpoch++;
      render();
      return;
    }
    case "details":
      showDetails();
      return;
    case "close-inspector":
      closeDetails();
      return;
    case "edit":
      showDetails(true);
      return;
    case "cancel-edit":
      state.drafts.delete(state.selected);
      state.editing = false;
      break;
    case "apply-edit":
      applyDraft();
      return;
    case "cancel-inline":
      state.drafts.delete(state.selected);
      state.inlineField = null;
      break;
    case "open-artifact":
      state.inspectorPrefs[state.perspective] = state.inspector;
      state.artifactFull = true;
      state.inspector = true;
      render();
      document.querySelector(".inspector h2")?.focus();
      return;
    case "back-workspace":
      state.inspector = state.inspectorPrefs[state.perspective];
      state.artifactFull = false;
      state.editing = false;
      state.inlineField = null;
      break;
    case "artifact-history":
      state.edge = null;
      state.historySubject = { key: state.selected, linkId: null };
      state.timelineFilter = "selected";
      changePerspective("history");
      return;
    case "relationship-history":
      state.historySubject = { key: state.selected, linkId: state.edge };
      state.timelineFilter = "selected";
      changePerspective("history");
      return;
    case "more-history":
      state.historyLimit += 30;
      break;
    case "pin":
      if (state.pinned.has(state.selected)) state.pinned.delete(state.selected);
      else state.pinned.add(state.selected);
      state.more = false;
      notify(
        state.pinned.has(state.selected) ? "Position pinned in this tab" : "Position unpinned",
      );
      break;
    case "return-focus":
      if (state.focusReturn) {
        state.visible = new Set(state.focusReturn.visible);
        state.baseScope = new Set(state.focusReturn.baseScope ?? state.focusReturn.visible);
        state.filter = state.focusReturn.filter;
        state.pathLinkIds = state.focusReturn.pathIds ? new Set(state.focusReturn.pathIds) : null;
        state.matrixScope = state.focusReturn.matrixScope ?? state.matrixScope;
        if (state.focusReturn.layout) traceLayout = new Map(state.focusReturn.layout);
        state.focusReturn = null;
        state.expansions.clear();
      }
      break;
    case "previous-event":
      stepEvent(-1);
      return;
    case "next-event":
      stepEvent(1);
      return;
    case "connect":
      openConnect();
      return;
    case "history":
      changePerspective("history");
      return;
    case "graph":
      changePerspective("graph");
      return;
    case "search":
      openSearch();
      return;
    case "reset":
      state.expandedLayout = false;
      state.visible = new Set(data.trace.keys);
      state.baseScope = new Set(data.trace.keys);
      state.expansions.clear();
      state.pathLinkIds = null;
      state.investigation = null;
      state.focusReturn = null;
      state.historySubject = null;
      state.selected = data.trace.root;
      state.pathPreview = null;
      state.matrixSubject = null;
      state.filter = "all";
      state.edge = null;
      state.camera = { zoom: 1, x: 0, y: 0 };
      break;
    case "frame": {
      const canvas = document.querySelector(".canvas");
      if (!canvas || !visibleKeys().length) return;
      state.fittedTitles = true;
      for (let pass = 0; pass < 4; pass++) {
        transform();
        const viewport = canvasViewport(canvas);
        const nodes = [...canvas.querySelectorAll(".node")].map((node) => ({
          point: projectPoint(state.layout.get(node.dataset.key)),
          width: node.offsetWidth,
          height: node.offsetHeight,
        }));
        const left = Math.min(...nodes.map((n) => n.point.x - n.width / 2));
        const right = Math.max(...nodes.map((n) => n.point.x + n.width / 2));
        const top = Math.min(...nodes.map((n) => n.point.y - n.height / 2));
        const bottom = Math.max(...nodes.map((n) => n.point.y + n.height / 2));
        const zoom = Math.max(
          0.15,
          Math.min(
            nodes.length <= 8 ? 1.3 : 1,
            (viewport.width - 32) / (right - left),
            (viewport.height - 80) / (bottom - top),
          ),
        );
        state.camera = {
          zoom,
          x: (viewport.width - (right - left) * zoom) / 2 - left * zoom,
          y: 48 + (viewport.height - 48 - (bottom - top) * zoom) / 2 - top * zoom,
        };
      }
      transform();
      drawNodeActions();
      return;
    }
    case "zoom-in":
    case "zoom-out": {
      const canvas = document.querySelector(".canvas");
      zoomAt(
        state.camera.zoom * (name === "zoom-in" ? 1.15 : 1 / 1.15),
        canvas.clientWidth / 2,
        canvas.clientHeight / 2,
      );
      return;
    }
    case "inspect-pending-save":
      await showPendingSave();
      return;
    case "clear-matrix-path":
      state.pathPreview = null;
      render();
      return;
    case "toggle-verification":
      state.focusConfig.verification = !state.focusConfig.verification;
      render();
      return;
    case "focus": {
      if (!state.focusReturn)
        state.focusReturn = {
          visible: [...state.visible],
          filter: state.filter,
          pathIds: state.pathLinkIds ? [...state.pathLinkIds] : null,
          matrixScope: state.matrixScope,
        };
      const result = focusedNeighborhood(model, state.selected, state.focusConfig);
      state.visible = new Set(result.keys);
      state.baseScope = new Set(result.keys);
      state.expansions.clear();
      notify(
        `Focused ${state.selected}${result.omitted ? `; ${result.omitted} beyond the 50-artifact limit` : ""}`,
      );
      break;
    }
    case "close-edge":
      state.edge = null;
      break;
    case "edit-edge":
      openConnect(model.links.find((link) => link.id === state.edge));
      return;
    case "create-artifact":
      if (native && state.perspective === "matrix" && state.matrixMode === "traceability") {
        beginRoot(matrixContext);
        return;
      }
      openCreate();
      return;
    case "remove-edge": {
      const id = state.edge;
      if (native) {
        const link = model.links.find((link) => link.id === id);
        if (!(await commit([{ op: "relationship.remove", id, expectedVersion: link.version }])))
          return;
      } else state.removed.add(id);
      state.localLinks.delete(id);
      state.edge = null;
      notify("Relationship removed locally · no database save");
      break;
    }
    case "dismiss-notice":
      state.notice = "";
      break;
    case "latest":
      visitRevision(head);
      return;
    case "previous-revision":
      visitRevision(state.revision - 1);
      return;
    case "next-revision":
      visitRevision(state.revision + 1);
      return;
    case "return-change":
      if (state.investigation) {
        state.historySubject = { ...state.investigation.subject };
        state.event = state.investigation.event;
        state.revision = state.investigation.revision;
        changePerspective("history");
      }
      return;
    case "expand-sheet":
      state.sheetState = "partial";
      state.inspector = true;
      break;
    case "collapse-sheet":
      rememberDraft();
      state.sheetState = "collapsed";
      state.editing = false;
      state.inlineField = null;
      break;
    case "inspect-revision": {
      rememberDraft();
      const paths = potentialPaths(data, state.event);
      state.investigation = {
        subject: state.historySubject
          ? { ...state.historySubject }
          : { key: state.selected, linkId: state.edge },
        event: state.event,
        revision: state.event,
      };
      if (!state.focusReturn)
        state.focusReturn = {
          visible: [...state.visible],
          filter: state.filter,
          pathIds: state.pathLinkIds ? [...state.pathLinkIds] : null,
          matrixScope: state.matrixScope,
        };
      if (!state.focusReturn.layout)
        state.focusReturn.layout = [...traceLayout].map(([key, point]) => [key, { ...point }]);
      state.pendingInvestigationLayout = paths;
      state.pathPreview = null;
      state.visible = new Set(paths.keys);
      state.baseScope = new Set(paths.keys);
      state.pathLinkIds = new Set(paths.links.map((link) => link.id));
      state.pathRoot = paths.roots[0];
      state.pathRevision = state.event;
      state.matrixScope = "neighborhood";
      if (paths.roots.length && !paths.keys.includes(state.selected))
        state.selected = paths.roots[0];
      state.edge = null;
      state.filter = "all";
      visitRevision(state.event);
      state.notice = "";
      changePerspective("graph");
      return;
    }
  }
  render();
}
function bind() {
  bindRelationshipScope();
  app
    .querySelector("#database-picker")
    ?.addEventListener("change", (event) => switchDatabase(event.target.value));
  for (const field of ["direction", "depth"])
    app.querySelector(`#focus-form [name="${field}"]`)?.addEventListener("change", (event) => {
      state.focusConfig[field] =
        field === "depth" ? Number(event.target.value) : event.target.value;
    });
  app.querySelector("#node-detail")?.addEventListener("change", (event) => {
    state.density = event.target.value;
    render();
  });
  app.querySelector("#trace-column-count")?.addEventListener("change", (event) => {
    const count = Number(event.target.value);
    state.matrixCell = null;
    state.matrixAnchor = null;
    state.matrixSteps = Array.from(
      { length: count },
      (_, index) =>
        state.matrixSteps[index] ?? { type: "verified_by", targetType: "verification_protocol" },
    );
    render();
  });
  const configSummary = app.querySelector(".trace-config-toggle > summary");
  if (configSummary)
    configSummary.onclick = () => {
      state.matrixConfigOpen = !configSummary.parentElement.open;
    };
  app.querySelectorAll("[data-matrix-mode]").forEach(
    (button) =>
      (button.onclick = () => {
        state.matrixMode = button.dataset.matrixMode;
        render();
      }),
  );
  app.querySelectorAll("[data-cell-source]").forEach(
    (button) =>
      (button.onclick = () =>
        openConnect(null, {
          source: button.dataset.cellSource,
          target: button.dataset.cellTarget,
        })),
  );
  app.querySelectorAll("[data-add-stage]").forEach(
    (button) =>
      (button.onclick = () => {
        const step = state.matrixSteps[Number(button.dataset.addStage)];
        const targets = [...model.records.values()].filter(
          (record) => record.type === step.targetType,
        );
        openDialog(
          "Connect recorded work",
          `<div class="stage-targets">${targets.map((record) => `<button data-stage-target="${e(record.key)}">${mono(record.key)} ${e(record.title)}</button>`).join("") || "<p>Create an artifact of this type first.</p>"}</div>`,
        );
        dialog.querySelectorAll("[data-stage-target]").forEach(
          (target) =>
            (target.onclick = () => {
              dialog.close();
              openConnect(null, {
                source: button.dataset.source,
                target: target.dataset.stageTarget,
              });
              const select = dialog.querySelector("#connection-type");
              if ([...select.options].some((option) => option.value === step.type))
                select.value = step.type;
            }),
        );
      }),
  );
  app.querySelector("#trace-root-type")?.addEventListener("change", (event) => {
    state.matrixRootType = event.target.value;
    state.matrixCell = null;
    state.matrixAnchor = null;
    render();
  });
  app.querySelectorAll("[data-trace-relation]").forEach(
    (select) =>
      (select.onchange = () => {
        state.matrixSteps[Number(select.dataset.traceRelation)].type = select.value;
        state.matrixCell = null;
        state.matrixAnchor = null;
        render();
      }),
  );
  app.querySelectorAll("[data-trace-target]").forEach(
    (select) =>
      (select.onchange = () => {
        state.matrixSteps[Number(select.dataset.traceTarget)].targetType = select.value;
        state.matrixCell = null;
        state.matrixAnchor = null;
        render();
      }),
  );
  app.querySelector("#matrix-search")?.addEventListener("input", (event) => {
    const start = event.target.selectionStart;
    state.matrixSearch = event.target.value;
    state.matrixCell = null;
    state.matrixAnchor = null;
    render();
    const input = app.querySelector("#matrix-search");
    input.focus();
    input.setSelectionRange(start, start);
  });
  app.querySelectorAll(".matrix table:not([role=grid]) button").forEach((button) =>
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      const cell = button.closest("td"),
        row = cell.parentElement;
      const next =
        event.key === "ArrowLeft"
          ? cell.previousElementSibling
          : event.key === "ArrowRight"
            ? cell.nextElementSibling
            : (event.key === "ArrowUp" ? row.previousElementSibling : row.nextElementSibling)
                ?.children[cell.cellIndex];
      const target = next?.querySelector("button");
      if (target) {
        event.preventDefault();
        target.focus();
      }
    }),
  );
  app
    .querySelectorAll("[data-action]")
    .forEach((button) => (button.onclick = () => action(button.dataset.action)));
  app
    .querySelectorAll("[data-view]")
    .forEach((button) => (button.onclick = () => changePerspective(button.dataset.view)));
  app.querySelectorAll("[data-density]").forEach(
    (button) =>
      (button.onclick = () => {
        state.density = button.dataset.density;
        render();
      }),
  );
  app.querySelectorAll("[data-related]").forEach(
    (button) =>
      (button.onclick = () => {
        if (!state.visible.has(button.dataset.related) && state.visible.size >= MAX_VISIBLE) {
          notify("50-artifact study limit reached. Reset the trace to reveal another record.");
          render();
          return;
        }
        state.visible.add(button.dataset.related);
        select(button.dataset.related, true);
      }),
  );
  app.querySelectorAll("[data-open-artifact]").forEach(
    (button) =>
      (button.onclick = () => {
        if (state.visible.size >= MAX_VISIBLE && !state.visible.has(button.dataset.openArtifact)) {
          notify("50-artifact study limit reached.");
          render();
          return;
        }
        visitRevision(head);
        state.visible.add(button.dataset.openArtifact);
        state.selected = button.dataset.openArtifact;
        state.inspector = true;
        changePerspective("graph");
      }),
  );
  app.querySelectorAll("[data-event]").forEach(
    (button) =>
      (button.onclick = () => {
        pickEvent(button.dataset.event, { showHistory: true });
      }),
  );
  app
    .querySelectorAll("[data-revision]")
    .forEach((button) => (button.onclick = () => visitRevision(button.dataset.revision)));
  app.querySelectorAll("[data-matrix-edge]").forEach(
    (button) =>
      (button.onclick = () => {
        state.edge = button.dataset.matrixEdge;
        state.inspector = true;
        state.historySubject = null;
        render();
        app
          .querySelector(".matrix .selected-link")
          ?.scrollIntoView({ block: "nearest", inline: "nearest" });
      }),
  );
  for (const id of ["link-filter", "matrix-filter"])
    document.querySelector("#" + id)?.addEventListener("change", (event) => {
      state.filter = event.target.value;
      render();
    });
  document.querySelector("#event-filter")?.addEventListener("change", (event) => {
    state.timelineFilter = event.target.value;
    state.historyLimit = 30;
    render();
  });
  app
    .querySelectorAll("[data-edit-field]")
    .forEach((button) => (button.onclick = () => beginInline(button.dataset.editField)));
  app
    .querySelectorAll("[data-apply-field]")
    .forEach((button) => (button.onclick = () => applyDraft(button.dataset.applyField)));
  app.querySelectorAll("[data-trace-route]").forEach(
    (button) =>
      (button.onclick = () => {
        rememberDraft();
        state.artifactFull = false;
        state.explainedRoute = JSON.parse(button.dataset.traceRoute);
        state.edge = state.explainedRoute.at(-1);
        render();
      }),
  );
  app.querySelectorAll("[data-inspect-link]").forEach(
    (button) =>
      (button.onclick = () => {
        rememberDraft();
        state.edge = button.dataset.inspectLink;
        state.historySubject = null;
        render();
      }),
  );
  app.querySelectorAll("[data-review-artifact]").forEach(
    (button) =>
      (button.onclick = () => {
        if (
          !state.visible.has(button.dataset.reviewArtifact) &&
          state.visible.size >= MAX_VISIBLE
        ) {
          notify("50-artifact study limit reached.");
          render();
          return;
        }
        state.visible.add(button.dataset.reviewArtifact);
        state.selected = button.dataset.reviewArtifact;
        state.inspector = true;
        state.artifactFull = false;
        state.inlineField = null;
        state.editing = false;
        state.edge = null;
        render();
      }),
  );
  document.querySelector("#matrix-scope")?.addEventListener("change", (event) => {
    state.matrixScope = event.target.value;
    state.matrixCell = null;
    state.matrixAnchor = null;
    render();
  });
  document
    .querySelector("#revision-range")
    ?.addEventListener("change", (event) => visitRevision(event.target.value));
  document.querySelector("#focus-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = new FormData(event.target);
    state.focusConfig = {
      direction: fields.get("direction"),
      depth: Number(fields.get("depth")),
      verification: state.focusConfig.verification,
    };
    action("focus");
  });
  document.querySelector("#timeline-scope")?.addEventListener("change", (event) => {
    state.timelineScope = event.target.value;
    render();
  });
  app.querySelectorAll("[data-axis-event]").forEach(
    (button) =>
      (button.onclick = () => {
        state.timelineFilter = state.timelineScope === "project" ? "project" : "selected";
        pickEvent(button.dataset.axisEvent, { showHistory: true });
      }),
  );
  app.querySelectorAll("[data-path-link]").forEach(
    (button) =>
      (button.onclick = () => {
        state.edge = button.dataset.pathLink;
        state.inspector = true;
        render();
      }),
  );
  app.querySelectorAll("[data-artifact-event]").forEach(
    (button) =>
      (button.onclick = () => {
        state.historySubject = { key: state.selected, linkId: null };
        state.timelineFilter = "selected";
        pickEvent(button.dataset.artifactEvent, { showHistory: true });
      }),
  );
  bindResize();
  if (state.perspective === "matrix" && state.matrixMode === "traceability") {
    if (state.matrixDraft)
      app
        .querySelectorAll(
          '.trace-config-toggle select, #trace-presentation, #trace-density, #matrix-scope, #matrix-search, [data-matrix-mode], [data-action="create-artifact"]',
        )
        .forEach((element) => (element.disabled = true));
    bindGrid(matrixContext);
  }
}
function bindGraph() {
  const canvas = document.querySelector(".canvas");
  canvas.addEventListener(
    "click",
    (event) => {
      if (performance.now() < suppressCanvasClickUntil || spaceHeld) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  canvas.querySelectorAll(".node").forEach((button) => {
    let start,
      moved = false;
    button.onpointerdown = (event) => {
      if (event.button !== 0 || spaceHeld || state.pinned.has(button.dataset.key)) return;
      start = {
        x: event.clientX,
        y: event.clientY,
        point: { ...state.layout.get(button.dataset.key) },
      };
      moved = false;
      button.setPointerCapture(event.pointerId);
    };
    button.onpointermove = (event) => {
      if (!start) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4 && !moved) return;
      moved = true;
      const point = state.layout.get(button.dataset.key);
      point.x = Math.max(
        90,
        Math.min(
          state.scene.width - 90,
          start.point.x + (event.clientX - start.x) / state.camera.zoom / projection().x,
        ),
      );
      point.y = Math.max(
        65,
        Math.min(
          state.scene.height - 45,
          start.point.y + (event.clientY - start.y) / state.camera.zoom / projection().y,
        ),
      );
      const projected = projectPoint(point);
      button.style.left = projected.x + "px";
      button.style.top = projected.y + "px";
      drawEdges();
      drawNodeActions();
    };
    button.onpointerup = () => {
      start = null;
    };
    button.onpointercancel = () => {
      start = null;
    };
    button.onclick = (event) => {
      if (performance.now() < suppressCanvasClickUntil || spaceHeld) return;
      if (moved) {
        moved = false;
        return;
      }
      if (event.detail > 1) return;
      if (state.selected === button.dataset.key && !state.edge) return;
      clearTimeout(selectionTimer);
      if (event.detail === 0) select(button.dataset.key);
      else {
        pendingSelection = button.dataset.key;
        selectionTimer = setTimeout(() => select(button.dataset.key), 220);
      }
    };
    button.ondblclick = () => {
      clearTimeout(selectionTimer);
      pendingSelection = null;
      state.selected = button.dataset.key;
      showDetails(true);
    };
    button.onkeydown = (event) => {
      if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        state.selected = button.dataset.key;
        expand();
      }
      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        state.selected = button.dataset.key;
        showDetails();
      }
    };
  });
  canvas.ondblclick = (event) => {
    if (event.target.closest("button,.edgehit,.node-actions")) return;
    openAdd();
  };
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (event.target.closest(".edge-detail,.node-actions,.canvas-tools")) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const intent = wheelIntent(event, canvas.clientHeight);
      if (intent.kind === "zoom")
        zoomAt(
          state.camera.zoom * Math.exp(-Math.max(-150, Math.min(150, intent.delta)) * 0.002),
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
      else {
        state.camera.x -= intent.x;
        state.camera.y -= intent.y;
        transform();
        drawNodeActions();
      }
    },
    { passive: false },
  );
  let pan;
  canvas.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".node-actions,.edge-detail,.canvas-tools")) return;
    const forcedPan = event.button === 1 || (event.button === 0 && spaceHeld);
    if (!forcedPan && (event.button !== 0 || event.target.closest("button,.edgehit"))) return;
    event.preventDefault();
    pan = { x: event.clientX, y: event.clientY, camera: { ...state.camera } };
    canvas.classList.add("panning");
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!pan) return;
    state.camera.x = pan.camera.x + event.clientX - pan.x;
    state.camera.y = pan.camera.y + event.clientY - pan.y;
    transform();
    drawNodeActions();
  });
  const endPan = () => {
    if (pan) suppressCanvasClickUntil = performance.now() + 150;
    pan = null;
    canvas.classList.remove("panning");
  };
  canvas.addEventListener("pointerup", endPan);
  canvas.addEventListener("pointercancel", endPan);
  canvas.addEventListener("lostpointercapture", endPan);
  canvas.addEventListener("auxclick", (event) => {
    if (event.button === 1) event.preventDefault();
  });
}
function bindResize() {
  const handle = document.querySelector(".inspector-resize");
  if (!handle) return;
  let start;
  handle.onpointerdown = (event) => {
    start = { x: event.clientX, width: state.width };
    handle.setPointerCapture(event.pointerId);
  };
  handle.onpointermove = (event) => {
    if (!start) return;
    const available = innerWidth - 68 - 22 - 640;
    state.width = Math.round(
      Math.max(300, Math.min(460, available, start.width + start.x - event.clientX)),
    );
    document.querySelector(".inspector").style.setProperty("--inspector-width", state.width + "px");
    handle.setAttribute("aria-valuenow", state.width);
  };
  handle.onpointerup = () => {
    start = null;
    render();
  };
  handle.onpointercancel = () => (start = null);
  handle.onkeydown = (event) => {
    if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      state.width = Math.max(
        300,
        Math.min(460, innerWidth - 730, state.width + (event.key === "ArrowLeft" ? 20 : -20)),
      );
      render();
      document.querySelector(".inspector-resize")?.focus();
    }
  };
}
function openDialog(title, body) {
  rememberDraft();
  dialog.innerHTML = `<form method="dialog" class="dialog-head"><h2 id="dialog-title">${e(title)}</h2><button aria-label="Close dialog">×</button></form>${body}`;
  dialog.showModal();
}
function openSearch() {
  openDialog(
    "Search or run a command",
    '<input id="search" aria-label="Search artifacts and commands" placeholder="Artifact, description, or command…"><div id="search-results"></div>',
  );
  const input = dialog.querySelector("#search");
  const results = () => {
    const query = input.value.toLowerCase();
    const commands = [
      [
        `Explore connections · ${state.selected}`,
        () => {
          changePerspective("graph");
          action("focus");
        },
      ],
      [
        `Show traceability · ${state.selected}`,
        () => {
          const record = model.records.get(state.selected);
          if (!record) {
            notify("This artifact is not present at the selected revision.");
            render();
            return;
          }
          if (state.matrixRootType !== record.type) {
            const types = [
              state.matrixRootType,
              ...state.matrixSteps.map((step) => step.targetType),
            ];
            const index = types.indexOf(record.type);
            if (index >= 0) state.matrixSteps = state.matrixSteps.slice(index);
            else {
              state.matrixSteps = [];
              let key = record.key;
              const followed = new Set();
              for (let depth = 0; depth < 3; depth++) {
                const link = model.links.find(
                  (link) => link.source === key && !followed.has(link.id),
                );
                if (!link) break;
                const target = model.records.get(link.target);
                if (!target) break;
                state.matrixSteps.push({ type: link.type, targetType: target.type });
                followed.add(link.id);
                key = target.key;
              }
            }
            state.matrixRootType = record.type;
          }
          state.matrixSubject = state.selected;
          state.matrixScope = "selected";
          state.matrixCell = null;
          state.matrixAnchor = null;
          state.matrixMode = "traceability";
          changePerspective("matrix");
        },
      ],
      [
        `Inspect changes · ${state.selected}`,
        () => {
          state.historySubject = { key: state.selected, linkId: state.edge };
          state.timelineFilter = "selected";
          changePerspective("history");
        },
      ],
      ["Expand neighbors", () => expand()],
      ["Fit graph", () => action("frame")],
      ["Show artifact details", () => showDetails()],
      ["Project history", () => changePerspective("history")],
      ["Return to latest revision", () => visitRevision(head)],
      ["Add existing artifact", () => openAdd()],
    ];
    const records = [...model.records.values()]
      .filter((record) =>
        `${record.key} ${record.title} ${record.statement}`.toLowerCase().includes(query),
      )
      .slice(0, 12);
    dialog.querySelector("#search-results").innerHTML =
      commands
        .map(([name], index) =>
          name.toLowerCase().includes(query)
            ? `<button data-command="${index}"><span class="command-icon">⌘</span>${e(name)}</button>`
            : "",
        )
        .join("") +
      records
        .map(
          (record) =>
            `<button data-result="${e(record.key)}">${mono(record.key)}<span>${e(record.title)}<small class="search-type">${e(typeName(record.type))}</small></span></button>`,
        )
        .join("");
    dialog.querySelectorAll("[data-command]").forEach(
      (button) =>
        (button.onclick = () => {
          dialog.close();
          commands[Number(button.dataset.command)][1]();
        }),
    );
    dialog.querySelectorAll("[data-result]").forEach(
      (button) =>
        (button.onclick = () => {
          if (!state.visible.has(button.dataset.result) && state.visible.size >= MAX_VISIBLE) {
            notify("50-artifact study limit reached.");
            dialog.close();
            render();
            return;
          }
          dialog.close();
          state.visible.add(button.dataset.result);
          select(button.dataset.result, true);
        }),
    );
  };
  input.oninput = results;
  results();
  input.focus();
}
function openAdd() {
  openDialog(
    "Add to this view",
    `<div class="add-choices"><button id="add-existing">Add existing artifact <span>Search ${model.records.size} records</span></button><button id="create-new" ${state.revision !== head ? "disabled" : ""}>Create artifact <span>${native ? "Aster project" : "Local prototype record"}</span></button></div>`,
  );
  dialog.querySelector("#add-existing").onclick = () => {
    dialog.close();
    openSearch();
  };
  dialog.querySelector("#create-new").onclick = () => {
    dialog.close();
    openCreate();
  };
}
function openCreate() {
  openDialog(
    native ? "Create artifact" : "Create local artifact",
    `<form id="create-form" class="workspace-form"><label>Type<select name="type">${Object.keys(
      data.schema.entityTypes,
    )
      .map((type) => `<option value="${type}">${e(typeName(type))}</option>`)
      .join(
        "",
      )}</select></label><label>Identifier<input name="key" required placeholder="REQ-NEW"></label><label>Title<input name="title" required></label><label>Statement<textarea name="statement" required></textarea></label><p class="form-error" role="alert"></p><button type="submit">${native ? "Create artifact" : "Create locally"}</button><p class="draft-note">${native ? "Saved in the isolated Aster project" : "This tab only · no database save"}</p></form>`,
  );
  dialog.querySelector("#create-form").onsubmit = async (event) => {
    event.preventDefault();
    if (state.revision !== head) return;
    const fields = new FormData(event.target),
      key = String(fields.get("key")).trim(),
      title = String(fields.get("title")).trim(),
      statement = String(fields.get("statement")).trim();
    if (
      !key ||
      !title ||
      !statement ||
      model.records.has(key) ||
      state.visible.size >= MAX_VISIBLE
    ) {
      dialog.querySelector(".form-error").textContent =
        "Use a unique identifier and nonempty fields; the view is limited to 50 artifacts.";
      return;
    }
    const record = {
      key,
      type: fields.get("type"),
      title,
      statement,
      version: 1,
      fields: { title, statement, status: "local prototype" },
    };
    if (native) {
      const fields = { title, statement };
      const result = await commit(
        [
          {
            op: "entity.create",
            id: crypto.randomUUID(),
            input: { type: record.type, key, fields },
          },
        ],
        dialog.querySelector(".form-error"),
      );
      if (!result) return;
    } else state.localEntities.set(key, record);
    state.visible.add(key);
    state.selected = key;
    dialog.close();
    notify(native ? `${key} created · r${head}` : `${key} created locally`);
    render();
  };
}
function openConnect(existing, endpoints = null) {
  if (state.revision !== head) return;
  const records = [...model.records.values()],
    source = existing?.source ?? endpoints?.source ?? state.selected;
  openDialog(
    existing ? (native ? "Edit relationship" : "Edit local relationship") : "Connect artifacts",
    `<form id="connection-form" class="workspace-form"><label>Source<input name="source" id="connection-source" list="connection-sources" required autocomplete="off" value="${e(source)}" placeholder="Identifier or title"><datalist id="connection-sources">${records.map((record) => `<option value="${e(record.key)}" label="${e(record.title)} · ${e(typeName(record.type))}"></option>`).join("")}</datalist></label><label>Target<input name="target" id="connection-target" list="connection-targets" required autocomplete="off" value="${e(existing?.target ?? endpoints?.target ?? "")}" placeholder="Find a compatible artifact"><datalist id="connection-targets"></datalist></label><label>Relationship type<select name="type" id="connection-type"></select></label><label>Scope<textarea name="scope" required>${e(existing?.scope ?? "")}</textarea></label><p class="form-error" role="alert"></p><button type="submit">${native ? (existing ? "Save relationship" : "Connect") : existing ? "Apply locally" : "Connect locally"}</button><p class="draft-note">${native ? "Saved in the selected project" : "This tab only · no database save"}</p></form>`,
  );
  const form = dialog.querySelector("#connection-form");
  const capturedSchemaVersion = data.schema.version;
  const update = () => {
    const source = model.records.get(form.elements.source.value),
      target = model.records.get(form.elements.target.value),
      types = source && target ? allowedTypes(data.schema, source, target) : [];
    const selectedType = form.elements.type.value || existing?.type;
    form.elements.type.innerHTML = types.length
      ? types
          .map(
            (type) =>
              `<option value="${e(type)}" ${type === selectedType ? "selected" : ""}>${e(titleCase(type))}</option>`,
          )
          .join("")
      : '<option value="">Choose compatible artifacts</option>';
    form.querySelector("#connection-targets").innerHTML = records
      .filter((record) => source && allowedTypes(data.schema, source, record).length)
      .map(
        (record) =>
          `<option value="${e(record.key)}" label="${e(record.title)} · ${e(typeName(record.type))}"></option>`,
      )
      .join("");
    form.elements.source.setCustomValidity(source ? "" : "Choose an existing source artifact.");
    form.elements.target.setCustomValidity(
      target && types.length ? "" : "Choose a compatible existing target artifact.",
    );
    form.querySelector('[type="submit"]').disabled = !types.length;
    form.querySelector(".form-error").textContent =
      form.elements.target.value && !types.length
        ? "These artifacts have no permitted relationship. Search for a compatible target."
        : "";
  };
  form.elements.source.oninput = update;
  form.elements.target.oninput = update;
  update();
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (state.revision !== head) return;
    const fields = new FormData(form),
      source = fields.get("source"),
      target = fields.get("target"),
      type = fields.get("type"),
      scope = String(fields.get("scope")).trim();
    if (
      !scope ||
      !model.records.has(source) ||
      !model.records.has(target) ||
      !allowedTypes(data.schema, model.records.get(source), model.records.get(target)).includes(
        type,
      )
    ) {
      form.querySelector(".form-error").textContent =
        "Choose a permitted relationship and describe its scope.";
      return;
    }
    if (
      model.links.some(
        (link) =>
          link.id !== existing?.id &&
          link.source === source &&
          link.target === target &&
          link.type === type,
      )
    ) {
      form.querySelector(".form-error").textContent =
        "That typed relationship is already recorded.";
      return;
    }
    const needed = [source, target].filter((key) => !state.visible.has(key));
    if (state.visible.size + needed.length > MAX_VISIBLE) {
      form.querySelector(".form-error").textContent = "The view is limited to 50 artifacts.";
      return;
    }
    if (native) {
      const input = {
        source: model.records.get(source).id,
        target: model.records.get(target).id,
        type,
        fields: {
          ...(existing?.fields ?? {}),
          scope,
          source_version: existing?.fields?.source_version ?? model.records.get(source).version,
          review: existing?.fields?.review ?? "Not reviewed",
        },
      };
      const result = await commit(
        [
          existing
            ? {
                op: "relationship.update",
                id: existing.id,
                expectedVersion: existing.version,
                input,
              }
            : {
                op: "relationship.create",
                id: crypto.randomUUID(),
                input,
                rejectExisting: true,
                expectedEndpoints: {
                  sourceVersion: model.records.get(source).version,
                  targetVersion: model.records.get(target).version,
                },
              },
        ],
        form.querySelector(".form-error"),
        capturedSchemaVersion,
      );
      if (!result) return;
      state.visible.add(source);
      state.visible.add(target);
      state.edge = result.results[0].id;
      state.inspector = true;
      dialog.close();
      notify(`Relationship saved · r${head}`);
      render();
      return;
    }
    if (existing) {
      state.removed.add(existing.id);
      state.localLinks.delete(existing.id);
    }
    const id = `local:${crypto.randomUUID()}`;
    state.localLinks.set(id, {
      id,
      source,
      target,
      type,
      scope,
      version: 1,
      fields: {
        scope,
        source_version: model.records.get(source).version,
        review: "local prototype",
      },
    });
    state.visible.add(source);
    state.visible.add(target);
    state.edge = null;
    dialog.close();
    notify("Relationship updated locally · no database save");
    render();
  };
}
document.addEventListener("keydown", (event) => {
  const typing =
    /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable;
  if (
    ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") ||
    (event.key === "/" && !typing)
  ) {
    event.preventDefault();
    if (!dialog.open) openSearch();
    return;
  }
  if (dialog.open) return;
  if (state.evidenceOpen) {
    if (event.key === "Escape") {
      event.preventDefault();
      state.evidenceOpen = false;
      render();
    }
    return;
  }
  if (
    event.code === "Space" &&
    !typing &&
    (!event.target.closest("button,summary,a") || event.target.closest(".node"))
  ) {
    event.preventDefault();
    spaceHeld = true;
    document.querySelector(".canvas")?.classList.add("space-pan");
    return;
  }
  if (
    !typing &&
    ["ArrowLeft", "ArrowRight"].includes(event.key) &&
    (state.perspective === "history" || event.altKey)
  ) {
    event.preventDefault();
    stepEvent(event.key === "ArrowLeft" ? -1 : 1);
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    if (state.matrixDraft && state.perspective === "matrix") {
      cancelGridEdit(matrixContext);
      return;
    }
    if (state.edge) {
      state.edge = null;
      render();
    } else if (state.inlineField) {
      state.inlineField = null;
      render();
    } else if (state.artifactFull) {
      state.artifactFull = false;
      state.editing = false;
      render();
    } else if (state.inspector) closeDetails();
  }
  if (
    event.key === "Tab" &&
    !state.evidenceOpen &&
    state.inspector &&
    panelMode() === "drawer" &&
    !state.artifactFull
  ) {
    const elements = [
      ...document
        .querySelector(".inspector")
        .querySelectorAll('button:not(:disabled),input,textarea,select,[tabindex="0"]'),
    ];
    const first = elements[0],
      last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});
document.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    spaceHeld = false;
    document.querySelector(".canvas")?.classList.remove("space-pan");
  }
});
window.addEventListener("blur", () => {
  spaceHeld = false;
  document.querySelector(".canvas")?.classList.remove("space-pan", "panning");
  document.querySelector(".canvas")?.dispatchEvent(new Event("pointercancel"));
});
let resizeFrame;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    state.projectedHeight = null;
    rememberDraft();
    render();

    if (state.inspector && panelMode() === "drawer" && !state.artifactFull)
      document.querySelector('.inspector [data-action="close-inspector"]')?.focus();
  });
});
render();
