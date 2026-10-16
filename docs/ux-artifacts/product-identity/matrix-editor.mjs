import { requiredField, suggestedKey } from "./authoring-policy.mjs";
import { allowedTypes, typeName } from "./workspace-model.mjs";
import { ancestorSpans } from "./trace-table.mjs";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
const keyName = (record) =>
  `<span class="mono">${esc(record.key)}</span><strong>${esc(record.title)}</strong>`;
let selectionRenderTimer;
let disposePlacement;
export function disposeGridEditor() {
  disposePlacement?.();
  disposePlacement = null;
}
export function gridRange(state) {
  const focus = state.matrixCell;
  if (!focus) return null;
  const anchor = state.matrixAnchor ?? focus;
  return {
    top: Math.min(anchor.row, focus.row),
    bottom: Math.max(anchor.row, focus.row),
    left: Math.min(anchor.column, focus.column),
    right: Math.max(anchor.column, focus.column),
  };
}
function inRange(state, row, column, span = 1) {
  const range = gridRange(state);
  return (
    range &&
    column >= range.left &&
    column <= range.right &&
    row <= range.bottom &&
    row + span - 1 >= range.top
  );
}
function duplicate(context, draft, targetKey) {
  return context.model.links.some(
    (link) =>
      link.id !== draft.id &&
      link.source === draft.sourceKey &&
      link.target === targetKey &&
      link.type === draft.type,
  );
}
const shortType = (type) =>
  ({
    verification_protocol: "verification",
    design_output: "output",
    subsystem_requirement: "requirement",
  })[type] ?? typeName(type).toLowerCase();
export function rowPath(row) {
  return {
    keys: [
      ...new Set([...row.keys.filter(Boolean), ...(row.terminals ?? []).map((item) => item.key)]),
    ],
    links: [
      ...new Set([
        ...row.links.filter(Boolean),
        ...(row.terminals ?? []).map((item) => item.linkId),
      ]),
    ],
  };
}
export function selectedCell(context) {
  const { state, projection } = context;
  const row = projection?.rows[state.matrixCell?.row];
  if (!row) return null;
  return { row, column: state.matrixCell.column };
}
function editor(context, draft) {
  const { state, model, data } = context;
  if (state.revision !== context.head)
    return '<p class="cell-edit-note">Draft retained. Return to Latest to edit.</p>';
  const root = draft.kind === "root",
    artifact = draft.kind === "artifact";
  if (context.native && context.native.mutations.snapshot().status === "unknown")
    return '<div class="cell-edit-note">Your cell proposal is retained. Inspect the saved result before continuing.<button data-grid-recover>Inspect saved result</button></div>';
  const newEntity = root || draft.create;
  const entityType = root ? draft.type : draft.targetType;
  const statementRequired = requiredField(data.schema, "entityTypes", entityType, "statement");
  const scopeRequired = requiredField(data.schema, "relationshipTypes", draft.type, "scope");
  let body;
  if (newEntity || artifact) {
    body = newEntity
      ? `<p class="cell-editor-heading">${esc(typeName(entityType))} · ${esc(draft.key)}</p><label>Title<input name="title" required value="${esc(draft.title)}" placeholder="What needs to be recorded?"></label>${
          draft.expanded
            ? `<label>Statement${statementRequired ? " · Required" : ""}<textarea name="statement" ${statementRequired ? "required" : ""}>${esc(draft.statement)}</textarea></label>${draft.fullDetails ? `<label>Identifier<input name="key" required value="${esc(draft.key)}"></label>` : ""}${
                root && draft.fullDetails
                  ? `<label>Type<select name="type">${Object.keys(data.schema.entityTypes)
                      .map(
                        (type) =>
                          `<option value="${esc(type)}" ${type === draft.type ? "selected" : ""}>${esc(typeName(type))}</option>`,
                      )
                      .join("")}</select></label>`
                  : ""
              }`
            : ""
        }${!draft.fullDetails ? '<button type="button" data-cell-details>More fields</button>' : ""}`
      : `<label>Title<input name="title" required value="${esc(draft.title)}"></label>${draft.quickTitle ? "" : `<label>Statement<textarea name="statement" required>${esc(draft.statement)}</textarea></label>`}`;
  } else {
    const matches = [...model.records.values()].filter(
      (record) =>
        record.type === draft.targetType &&
        `${record.key} ${record.title}`.toLowerCase().includes(draft.query.toLowerCase()),
    );
    const limit = draft.query.trim() ? 20 : 6;
    const chosen = model.records.get(draft.targetKey);
    body = `<label>Find ${esc(shortType(draft.targetType))}<input name="query" autocomplete="off" role="combobox" aria-expanded="${!chosen}" aria-controls="cell-matches" value="${esc(draft.query)}" placeholder="Identifier or title"></label><div id="cell-matches" class="cell-matches" role="listbox" aria-label="Matching artifacts">${
      (chosen ? [] : matches)
        .slice(0, limit)
        .map((record) => {
          const exists = duplicate(context, draft, record.key);
          return `<button type="button" role="option" data-picker-key="${esc(record.key)}" aria-selected="${record.key === draft.targetKey}" ${exists ? 'disabled aria-disabled="true"' : ""}>${keyName(record)}<small>${exists ? "Already linked" : esc(typeName(record.type))}</small></button>`;
        })
        .join("") || (chosen ? "" : "<span>No matching artifacts</span>")
    }</div>${chosen ? `<div class="chosen-target">${keyName(chosen)}</div>` : ""}${matches.length > limit && !chosen ? '<p class="cell-edit-note">Type to narrow the results.</p>' : ""}<button type="button" data-cell-create>＋ Create ${esc(shortType(draft.targetType))}</button>`;
  }
  if (
    !root &&
    !artifact &&
    (draft.targetKey || draft.create) &&
    (scopeRequired || draft.scope || draft.expanded) &&
    (!draft.create || draft.expanded)
  )
    body += `<label>Relationship scope${scopeRequired ? " · Required" : " · Optional"}<input name="scope" ${scopeRequired ? "required" : ""} placeholder="Why are these artifacts linked?" value="${esc(draft.scope)}"></label>`;
  return `<form id="${root ? "create-form" : "matrix-cell-form"}" class="cell-editor" aria-label="${root ? "Create artifact" : artifact ? "Edit artifact" : draft.mode === "replace" ? "Replace relationship target" : "Link existing artifact"}">${!root && !artifact && !draft.create ? `<p class="cell-editor-heading">${esc(draft.sourceKey)} → ${esc(draft.type.replaceAll("_", " "))}</p>` : ""}${body}${draft.error ? `<p class="form-error" role="alert">${esc(draft.error)}</p>` : '<p class="form-error" role="alert"></p>'}<div class="cell-edit-actions"><button type="submit" ${state.saving || state.readBlocked || context.native?.mutations.snapshot().status === "unknown" ? "disabled" : ""}>Save</button><button type="button" data-cell-cancel ${state.saving || state.readBlocked || context.native?.mutations.snapshot().status === "unknown" ? "disabled" : ""}>Cancel</button>${!root && !artifact && !draft.create ? '<button type="button" data-cell-edit-artifact>Edit artifact</button>' : ""}</div>${draft.mode === "replace" ? '<p class="cell-edit-note">Updates this recorded relationship everywhere it appears.</p>' : ""}</form>`;
}
export function renderGrid(context) {
  const { state, projection, model, head, native } = context;
  const columns = state.matrixSteps.length + 1;
  const spans =
    state.matrixPresentation === "grouped"
      ? ancestorSpans(projection.rows, columns)
      : projection.rows.map(() => Array(columns).fill(1));
  const editable = native && state.revision === head;
  const html = projection.rows
    .map(
      (row, index) =>
        `<tr data-trace-row="${index}" class="${state.matrixCell?.row === index ? "grid-row-selected" : ""}">${row.keys
          .map((key, column) => {
            if (spans[index][column] === 0) return "";
            const items =
              column > 0 && column === columns - 1 && row.terminals
                ? row.terminals
                : key
                  ? [{ key, linkId: row.links[column - 1] }]
                  : [];
            const selected =
              state.matrixCell?.column === column &&
              state.matrixCell.row >= index &&
              state.matrixCell.row < index + spans[index][column];
            const source = row.keys[column - 1],
              step = state.matrixSteps[column - 1];
            const permitted =
              source &&
              step &&
              allowedTypes(context.data.schema, model.records.get(source), {
                type: step.targetType,
              }).includes(step.type);
            const contents = items.length
              ? items
                  .map((item) => {
                    const record = model.records.get(item.key),
                      link = model.links.find((link) => link.id === item.linkId);
                    const parentCount = link
                      ? new Set(
                          model.links
                            .filter(
                              (other) => other.target === item.key && other.type === link.type,
                            )
                            .map((other) => other.source),
                        ).size
                      : 0;
                    const info = link
                      ? `${link.source} — ${link.type.replaceAll("_", " ")} → ${link.target}\nDirect relationship ${link.id} · v${link.version}\nArtifacts v${model.records.get(link.source)?.version} → v${record.version}\n${link.scope}`
                      : `${record.key} · v${record.version}\n${record.statement}`;
                    return `<button tabindex="-1" class="trace-artifact ${link?.id === state.edge ? "active-trace-link" : ""}" data-grid-artifact="${esc(item.key)}" ${link ? `data-matrix-edge="${esc(link.id)}" aria-label="${esc(link.source)} ${esc(link.type.replaceAll("_", " "))} ${esc(link.target)}"` : ""} title="${esc(info)}">${keyName(record)}${parentCount > 1 ? '<span class="shared-reference" title="Shared canonical artifact with multiple recorded sources" aria-label="Shared artifact">↗</span>' : ""}</button>`;
                  })
                  .join("")
              : source
                ? `<span class="cell-empty-label">${permitted ? "No matching link" : "Choose a permitted relationship"}</span>`
                : '<span class="cell-empty-label">—</span>';
            return `<td role="gridcell" aria-selected="${Boolean(inRange(state, index, column, spans[index][column]))}" aria-colindex="${column + 1}" aria-rowindex="${index + 2}" rowspan="${spans[index][column]}" data-grid-row="${index}" data-grid-col="${column}" class="trace-cell ${inRange(state, index, column, spans[index][column]) ? "grid-range-selected" : ""} ${selected ? "grid-cell-selected" : ""} ${items.some((item) => item.linkId === state.edge) ? "selected-link" : ""}" tabindex="${selected || (!state.matrixCell && index === 0 && column === 0) ? "0" : "-1"}">${contents}${editable && permitted ? `<button class="cell-add" data-cell-add aria-label="Link ${esc(shortType(step.targetType))} from ${esc(source)}">＋ Link ${esc(shortType(step.targetType))}</button>` : ""}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  return html;
}
export function renderGridEditor(context) {
  if (!context.state.matrixDraft) return "";
  return `<div id="matrix-cell-popover" popover="manual" role="dialog" aria-modal="false" aria-label="Matrix cell editor">${editor(context, context.state.matrixDraft)}</div>`;
}
function placeEditor(get) {
  const context = get(),
    popover = context.app.querySelector("#matrix-cell-popover");
  if (!popover) return;
  const controller = new AbortController();
  const position = () => {
    if (!popover.isConnected) return disposeGridEditor();
    const draft = get().state.matrixDraft;
    const anchor =
      draft?.kind === "root"
        ? context.app.querySelector(
            draft.origin === "row" ? "[data-grid-create-root]" : '[data-action="create-artifact"]',
          )
        : locate(get(), draft.row, draft.column);
    if (!anchor) return;
    const artifactKey = draft.kind === "artifact" ? draft.key : draft.targetKey;
    const preciseAnchor =
      draft.kind === "root"
        ? anchor
        : (anchor.querySelector(`[data-grid-artifact="${CSS.escape(artifactKey ?? "")}"]`) ??
          anchor.querySelector("[data-grid-artifact], [data-cell-add]") ??
          anchor);
    const bounds = preciseAnchor.getBoundingClientRect();
    const sheet =
      innerWidth <= 760 && !draft.quickTitle && (draft.expanded || draft.kind === "artifact");
    popover.classList.toggle("cell-editor-sheet", sheet);
    const width = Math.min(sheet ? innerWidth - 32 : draft.quickTitle ? 350 : 410, innerWidth - 32);
    popover.style.width = `${width}px`;
    popover.style.maxHeight = `${Math.min(590, innerHeight - 150)}px`;
    const height = popover.getBoundingClientRect().height;
    popover.style.left = `${Math.max(16, Math.min(innerWidth - width - 16, bounds.left))}px`;
    const below = bounds.bottom + 6;
    popover.style.top = `${sheet ? Math.max(90, innerHeight - height - 16) : Math.max(90, Math.min(below, innerHeight - height - 16))}px`;
  };
  popover.showPopover();
  position();
  const observer = new ResizeObserver(position);
  observer.observe(popover);
  addEventListener("resize", position, { signal: controller.signal });
  context.app
    .querySelector(".matrix-scroll")
    ?.addEventListener("scroll", position, { signal: controller.signal });
  disposePlacement = () => {
    controller.abort();
    observer.disconnect();
  };
}
function locate(context, row, column) {
  return [...context.app.querySelectorAll("[data-grid-col]")].find(
    (cell) =>
      Number(cell.dataset.gridCol) === column &&
      Number(cell.dataset.gridRow) <= row &&
      Number(cell.dataset.gridRow) + cell.rowSpan > row,
  );
}
function focusCell(context, row, column) {
  const cell = locate(context, row, column);
  if (!cell) return;
  cell.focus({ preventScroll: true });
  cell.scrollIntoView({ block: "nearest", inline: "nearest" });
}
function choose(get, row, column, key, linkId, extend = false) {
  const context = get(),
    { state, projection } = context;
  state.matrixAnchor = extend
    ? (state.matrixAnchor ?? state.matrixCell ?? { row, column })
    : { row, column };
  state.matrixCell = { row, column };
  if (key) state.selected = key;
  state.edge = linkId ?? null;
  state.historySubject = null;
  state.matrixPath = rowPath(projection.rows[row]);
  for (const cell of context.app.querySelectorAll("[data-grid-row]")) {
    const active =
      Number(cell.dataset.gridCol) === column &&
      Number(cell.dataset.gridRow) <= row &&
      Number(cell.dataset.gridRow) + cell.rowSpan > row;
    const selected = inRange(
      state,
      Number(cell.dataset.gridRow),
      Number(cell.dataset.gridCol),
      cell.rowSpan,
    );
    cell.classList.toggle("grid-cell-selected", active);
    cell.classList.toggle("grid-range-selected", selected);
    cell.tabIndex = active ? 0 : -1;
    cell.setAttribute("aria-selected", String(selected));
  }
  focusCell(context, row, column);
  clearTimeout(selectionRenderTimer);
  selectionRenderTimer = setTimeout(() => {
    if (state.perspective === "matrix" && !state.matrixDraft) {
      get().render();
      focusCell(get(), row, column);
    }
  }, 180);
}
export function beginRoot(get) {
  const { state, data, head, native, model } = get();
  if (!native || state.revision !== head || state.matrixDraft) return;
  state.matrixDraft = {
    kind: "root",
    origin: document.activeElement?.matches("[data-grid-create-root]") ? "row" : "toolbar",
    type: state.matrixRootType,
    key: suggestedKey(model.records, state.matrixRootType),
    title: "",
    statement: "",
    schemaVersion: data.schema.version,
    id: crypto.randomUUID(),
  };
  get().render();
  get().app.querySelector('#matrix-cell-form [name="title"]')?.focus({ preventScroll: true });
}
function beginEdit(get, row, column, mode = "replace", seed = null) {
  clearTimeout(selectionRenderTimer);
  row = Number(locate(get(), row, column)?.dataset.gridRow ?? row);
  const { state, projection, model, data, head, native } = get();
  if (!native || state.revision !== head || state.matrixDraft) return;
  const line = projection.rows[row];
  if (!line) return;
  const link =
    model.links.find(
      (link) =>
        link.id === state.edge &&
        link.source === line.keys[column - 1] &&
        link.type === state.matrixSteps[column - 1]?.type,
    ) ?? model.links.find((link) => link.id === line.links[column - 1]);
  const key =
    column === state.matrixSteps.length &&
    line.terminals?.some((item) => item.key === state.selected)
      ? state.selected
      : line.keys[column];
  const record = model.records.get(key);
  if (column === 0 || mode === "artifact") {
    if (!record) return;
    state.matrixDraft = {
      kind: "artifact",
      row,
      column,
      key: record.key,
      title: record.title,
      statement: record.statement,
      id: record.id,
      version: record.version,
      fields: { ...record.fields },
      schemaVersion: data.schema.version,
      quickTitle: seed !== null,
    };
    if (seed !== null) state.matrixDraft.title = seed;
  } else {
    const source = model.records.get(line.keys[column - 1]),
      step = state.matrixSteps[column - 1];
    if (
      !source ||
      !allowedTypes(data.schema, source, { type: step.targetType }).includes(step.type)
    )
      return;
    const existing = mode === "add" ? null : link;
    state.matrixDraft = {
      kind: "relationship",
      row,
      column,
      mode: existing ? "replace" : "add",
      sourceKey: source.key,
      sourceId: source.id,
      sourceVersion: source.version,
      type: step.type,
      targetType: step.targetType,
      targetKey: existing?.target ?? "",
      targetId: model.records.get(existing?.target)?.id,
      targetVersion: model.records.get(existing?.target)?.version,
      scope: existing?.scope ?? "",
      query: seed ?? "",
      id: existing?.id ?? crypto.randomUUID(),
      version: existing?.version,
      fields: { ...(existing?.fields ?? {}) },
      schemaVersion: data.schema.version,
    };
  }
  get().render();
  const input = get().app.querySelector("#matrix-cell-form input, #matrix-cell-form textarea");
  input?.focus();
  if (seed !== null) input?.setSelectionRange(seed.length, seed.length);
}
async function saveDraft(get, form) {
  const context = get(),
    { state, model } = context,
    draft = state.matrixDraft;
  if (!draft) return;
  if (
    (draft.kind === "root" || draft.create) &&
    draft.title.trim() &&
    !draft.expanded &&
    requiredField(
      context.data.schema,
      "entityTypes",
      draft.kind === "root" ? draft.type : draft.targetType,
      "statement",
    ) &&
    !draft.statement.trim()
  ) {
    draft.expanded = true;
    context.render();
    get().app.querySelector('[name="statement"]')?.focus();
    return;
  }
  let operations = [],
    selected = state.selected;
  if (draft.kind === "root" || draft.kind === "artifact") {
    if (
      !draft.title.trim() ||
      (requiredField(
        context.data.schema,
        "entityTypes",
        draft.type ?? model.records.get(draft.key)?.type,
        "statement",
      ) &&
        !draft.statement.trim()) ||
      (draft.kind === "root" && !draft.key.trim())
    )
      return;
    const fields = {
      ...(draft.fields ?? {}),
      title: draft.title.trim(),
      ...(draft.statement.trim() || draft.kind === "artifact"
        ? { statement: draft.statement.trim() }
        : {}),
    };
    operations = [
      draft.kind === "root"
        ? {
            op: "entity.create",
            id: draft.id,
            input: { type: draft.type, key: draft.key.trim(), fields },
          }
        : { op: "entity.update", id: draft.id, expectedVersion: draft.version, input: { fields } },
    ];
    selected = draft.key.trim();
  } else {
    const target = draft.create ? null : model.records.get(draft.targetKey);
    if (
      (requiredField(context.data.schema, "relationshipTypes", draft.type, "scope") &&
        !draft.scope.trim()) ||
      (!draft.create && !target)
    ) {
      draft.error = "Choose a target and describe the relationship scope.";
      form.querySelector(".form-error").textContent = draft.error;
      return;
    }
    if (target && duplicate(context, draft, target.key)) {
      draft.error = "This artifact is already linked by this relationship type.";
      form.querySelector(".form-error").textContent = draft.error;
      return;
    }
    if (
      draft.create &&
      (!draft.key?.trim() ||
        !draft.title?.trim() ||
        (requiredField(context.data.schema, "entityTypes", draft.targetType, "statement") &&
          !draft.statement?.trim()))
    )
      return;
    if (draft.create)
      operations.push({
        op: "entity.create",
        id: draft.newId,
        input: {
          type: draft.targetType,
          key: draft.key.trim(),
          fields: {
            title: draft.title.trim(),
            ...(draft.statement.trim() ? { statement: draft.statement.trim() } : {}),
          },
        },
      });
    const input = {
      source: draft.sourceId,
      target: draft.targetId ?? draft.newId,
      type: draft.type,
      fields: {
        ...draft.fields,
        ...(draft.scope.trim() ? { scope: draft.scope.trim() } : {}),
        ...(context.data.schema.relationshipTypes[draft.type]?.fields?.source_version
          ? { source_version: draft.fields.source_version ?? draft.sourceVersion }
          : {}),
        ...(context.data.schema.relationshipTypes[draft.type]?.fields?.review
          ? { review: draft.fields.review ?? "Not reviewed" }
          : {}),
      },
    };
    operations.push(
      draft.mode === "replace"
        ? { op: "relationship.update", id: draft.id, expectedVersion: draft.version, input }
        : {
            op: "relationship.create",
            id: draft.id,
            input,
            rejectExisting: true,
            expectedEndpoints: {
              sourceVersion: draft.sourceVersion,
              targetVersion: draft.targetVersion ?? 1,
            },
          },
    );
    selected = draft.create ? draft.key.trim() : target.key;
  }
  const controls = [...form.querySelectorAll("input,textarea,select,button")];
  controls.forEach((control) => (control.disabled = true));
  const result = await context.commit(
    operations,
    form.querySelector(".form-error"),
    draft.schemaVersion,
  );
  if (!result) {
    const locked = state.readBlocked || context.native.mutations.snapshot().status === "unknown";
    controls.forEach((control) => (control.disabled = locked));
    draft.error = form.querySelector(".form-error")?.textContent;
    return;
  }
  state.matrixDraft = null;
  state.selected = selected;
  state.historySubject = null;
  state.edge = draft.kind === "relationship" ? draft.id : null;
  if (draft.kind === "root") {
    state.matrixSubject = selected;
    state.matrixRootType = draft.type;
    state.matrixCell = null;
    state.matrixAnchor = null;
  }
  if (state.visible.size < 50) state.visible.add(selected);
  if (draft.kind === "relationship")
    state.recentConnection = { id: draft.id, source: draft.sourceKey, target: selected };
  context.notify(
    draft.kind === "relationship"
      ? `Connected to ${selected} · r${get().head}`
      : `Saved · r${get().head}`,
  );
  context.render();
  if (draft.kind !== "root") focusCell(get(), draft.row, draft.column);
}
export function cancelGridEdit(get) {
  const context = get(),
    { state, native } = context;
  if (state.saving || native?.mutations.snapshot().status === "unknown") return;
  const draft = state.matrixDraft;
  if (!draft) return;
  state.matrixDraft = null;
  context.render();
  if (draft.kind !== "root") focusCell(get(), draft.row, draft.column);
  else
    get()
      .app.querySelector(
        draft.origin === "row" ? "[data-grid-create-root]" : '[data-action="create-artifact"]',
      )
      ?.focus({ preventScroll: true });
}
export function bindGrid(get) {
  const context = get(),
    { app, state } = context;
  const grid = app.querySelector('.traceability-matrix [role="grid"]');
  if (!grid) return;
  app.querySelector("[data-grid-create-root]")?.addEventListener("click", () => beginRoot(get));
  app.querySelector("[data-connected-graph]")?.addEventListener("click", () =>
    context.showPath({
      keys: [state.recentConnection.source, state.recentConnection.target],
      links: [state.recentConnection.id],
    }),
  );
  app.querySelector("[data-connected-another]")?.addEventListener("click", () => {
    if (state.matrixCell) beginEdit(get, state.matrixCell.row, state.matrixCell.column, "add");
  });
  app.querySelector("#trace-presentation")?.addEventListener("change", (event) => {
    state.matrixPresentation = event.target.value;
    state.matrixCell = null;
    state.matrixAnchor = null;
    context.render();
  });
  app.querySelector("#trace-density")?.addEventListener("change", (event) => {
    state.matrixDensity = event.target.value;
    context.render();
  });
  app.querySelector("[data-grid-inspect]")?.addEventListener("click", () => {
    state.inspector = true;
    context.render();
  });
  app.querySelector("[data-grid-edit]")?.addEventListener("click", () => {
    if (state.matrixCell) beginEdit(get, state.matrixCell.row, state.matrixCell.column);
  });
  app
    .querySelector("[data-grid-show-path]")
    ?.addEventListener("click", () => context.showPath(state.matrixPath));
  for (const cell of grid.querySelectorAll("[data-grid-row]")) {
    const row = Number(cell.dataset.gridRow),
      column = Number(cell.dataset.gridCol);
    cell.onclick = (event) => {
      if (event.target.closest(".cell-editor")) return;
      if (state.matrixDraft) {
        context.notify("Save or cancel the current cell edit first.");
        return;
      }
      const record = event.target.closest("[data-grid-artifact]");
      const line = get().projection.rows[row];
      choose(
        get,
        row,
        column,
        record?.dataset.gridArtifact ?? line.keys[column],
        record?.dataset.matrixEdge ?? line.links[column - 1],
        event.shiftKey,
      );
      if (event.target.closest("[data-cell-add]")) beginEdit(get, row, column, "add");
    };
    // Override the generic inspector click: a cell selects before it edits or inspects.
    cell.querySelectorAll("[data-matrix-edge]").forEach((button) => (button.onclick = null));
    cell.ondblclick = (event) => {
      if (!event.target.closest(".cell-editor")) beginEdit(get, row, column);
    };
    cell.onkeydown = (event) => {
      if (event.target.closest(".cell-editor")) return;
      const rows = get().projection.rows.length,
        columns = state.matrixSteps.length + 1,
        current = state.matrixCell ?? { row, column };
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.isComposing &&
        event.key !== " " &&
        event.key !== "/"
      ) {
        event.preventDefault();
        beginEdit(get, current.row, current.column, "replace", event.key);
        return;
      }
      if (event.key === "Enter" || event.key === "F2") {
        event.preventDefault();
        beginEdit(get, current.row, current.column);
        return;
      }
      const movement = {
        ArrowLeft: [current.row, current.column - 1],
        ArrowRight: [current.row, current.column + 1],
        ArrowUp: [event.shiftKey ? current.row - 1 : row - 1, current.column],
        ArrowDown: [event.shiftKey ? current.row + 1 : row + cell.rowSpan, current.column],
      };
      if (event.key === "Tab")
        movement.Tab = event.shiftKey
          ? [
              current.column === 0 ? current.row - 1 : current.row,
              current.column === 0 ? columns - 1 : current.column - 1,
            ]
          : [
              current.column === columns - 1 ? current.row + 1 : current.row,
              (current.column + 1) % columns,
            ];
      const next = movement[event.key];
      if (next && next[0] >= 0 && next[0] < rows && next[1] >= 0 && next[1] < columns) {
        event.preventDefault();
        const line = get().projection.rows[next[0]];
        choose(
          get,
          next[0],
          next[1],
          line.keys[next[1]],
          line.links[next[1] - 1],
          event.shiftKey && event.key !== "Tab",
        );
      }
    };
  }
  app.querySelector("[data-grid-recover]")?.addEventListener("click", () => context.recover());
  const form = app.querySelector("#matrix-cell-popover .cell-editor");
  if (form) {
    placeEditor(get);
    for (const input of form.querySelectorAll("input,textarea,select"))
      input.addEventListener("input", () => {
        state.matrixDraft[input.name] = input.value;
        if (input.name === "query") {
          state.matrixDraft.targetKey = "";
          state.matrixDraft.targetId = null;
          state.matrixDraft.targetVersion = null;
          const caret = input.selectionStart;
          context.render();
          const field = get().app.querySelector('[name="query"]');
          field?.focus();
          field?.setSelectionRange(caret, caret);
        }
      });
    form.querySelector("[data-cell-details]")?.addEventListener("click", () => {
      state.matrixDraft.expanded = true;
      state.matrixDraft.fullDetails = true;
      context.render();
      get().app.querySelector('[name="statement"]')?.focus();
    });
    form.querySelector('[name="type"]')?.addEventListener("change", (event) => {
      state.matrixDraft.type = event.target.value;
      state.matrixDraft.key = suggestedKey(get().model.records, event.target.value);
      context.render();
    });
    const pick = (button, commit = false) => {
      if (!button || button.disabled) return;
      const draft = state.matrixDraft,
        chosen = get().model.records.get(button.dataset.pickerKey);
      draft.targetKey = chosen.key;
      draft.targetId = chosen.id;
      draft.targetVersion = chosen.version;
      context.render();
      const next = get().app.querySelector("#matrix-cell-form");
      if (
        (commit && draft.scope.trim()) ||
        !requiredField(get().data.schema, "relationshipTypes", draft.type, "scope")
      )
        next?.requestSubmit();
      else next?.querySelector('[name="scope"]')?.focus();
    };
    form
      .querySelectorAll("[data-picker-key]")
      .forEach((button) => (button.onclick = () => pick(button)));
    const query = form.querySelector('[name="query"]');
    if (query)
      query.onkeydown = (event) => {
        const buttons = [...form.querySelectorAll("[data-picker-key]:not(:disabled)")];
        if (event.key === "ArrowDown") {
          event.preventDefault();
          buttons[0]?.focus();
        }
        if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          if (state.matrixDraft.targetKey) {
            if (
              state.matrixDraft.scope.trim() ||
              !requiredField(
                get().data.schema,
                "relationshipTypes",
                state.matrixDraft.type,
                "scope",
              )
            )
              form.requestSubmit();
            else form.querySelector('[name="scope"]')?.focus();
            return;
          }
          pick(
            form.querySelector('[data-picker-key][aria-selected="true"]:not(:disabled)') ??
              buttons[0],
            true,
          );
        }
      };
    const choices = [...form.querySelectorAll("[data-picker-key]:not(:disabled)")];
    choices.forEach((button, index) => {
      button.tabIndex = -1;
      button.onkeydown = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          pick(button, true);
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          choices[
            Math.max(0, Math.min(choices.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))
          ]?.focus();
        }
      };
    });
    form.querySelector("[data-cell-create]")?.addEventListener("click", () => {
      Object.assign(state.matrixDraft, {
        create: true,
        targetId: null,
        targetVersion: null,
        newId: crypto.randomUUID(),
        key: suggestedKey(get().model.records, state.matrixDraft.targetType),
        expanded: false,
        fullDetails: false,
        title: "",
        statement: "",
      });
      context.render();
      get().app.querySelector('#matrix-cell-form [name="title"]')?.focus();
    });
    const cancel = () => cancelGridEdit(get);
    form.querySelector("[data-cell-cancel]").onclick = cancel;
    form.querySelector("[data-cell-edit-artifact]")?.addEventListener("click", () => {
      const { row, column } = state.matrixDraft;
      state.matrixDraft = null;
      beginEdit(get, row, column, "artifact");
    });
    form.onkeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        form.requestSubmit();
      }
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      void saveDraft(get, form);
    };
  }
  grid.oncopy = (event) => {
    if (event.target.closest(".cell-editor") || !state.matrixCell) return;
    const range = gridRange(state),
      multiple = range.top !== range.bottom || range.left !== range.right;
    const rows = [];
    for (let row = range.top; row <= range.bottom; row++) {
      const cells = [];
      for (let column = range.left; column <= range.right; column++) {
        const cell = locate(get(), row, column);
        cells.push(
          [...cell.querySelectorAll("[data-grid-artifact]")]
            .map(
              (el) =>
                `${el.dataset.gridArtifact}${multiple ? " · " : "\t"}${String(get().model.records.get(el.dataset.gridArtifact)?.title ?? "").replace(/[\t\r\n]/g, " ")}`,
            )
            .join(multiple ? "; " : "\n")
            .replaceAll("\r", " ")
            .replaceAll("\n", multiple ? " " : "\n"),
        );
      }
      rows.push(cells.join("\t"));
    }
    event.clipboardData?.setData("text/plain", rows.join("\n"));
    event.preventDefault();
  };
}
