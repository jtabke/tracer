import { createMatrixInput } from "./matrix-input.ts";
import { inRange, locate, focusCell } from "./matrix-selection.ts";
import { matrixProposal, duplicateTarget } from "./matrix-proposal.ts";
import { requiredField, suggestedKey } from "./authoring-policy.ts";
import { allowedTypes } from "./relationship-policy.ts";
import { typeName } from "./presentation.ts";
import { ancestorSpans } from "./trace-table.mjs";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
const keyName = (record) =>
  `<span class="mono">${esc(record.key)}</span><strong>${esc(record.title)}</strong>`;

const shortType = (type) =>
  ({
    verification_protocol: "verification",
    design_output: "output",
    subsystem_requirement: "requirement",
  })[type] ?? typeName(type).toLowerCase();

function selectedCell(context) {
  const { state, projection } = context;
  const row = projection?.rows[state.matrixCell?.row];
  if (!row) return null;
  return { row, column: state.matrixCell.column };
}
function editor(context, draft) {
  function renderEditArtifactAction() {
    return !root && !artifact && !draft.create
      ? '<button type="button" data-cell-edit-artifact>Edit artifact</button>'
      : "";
  }

  function renderDisabledEditorCancel() {
    return state.saving ||
      state.readBlocked ||
      context.native?.mutations.snapshot().status === "unknown"
      ? "disabled"
      : "";
  }

  function renderDisabledEditor() {
    return state.saving ||
      state.readBlocked ||
      context.native?.mutations.snapshot().status === "unknown"
      ? "disabled"
      : "";
  }

  function renderRelationshipHeading() {
    return !root && !artifact && !draft.create
      ? `<p class="cell-editor-heading">${esc(draft.sourceKey)} → ${esc(draft.type.replaceAll("_", " "))}</p>`
      : "";
  }

  function renderEditorLabel() {
    return root
      ? "Create artifact"
      : artifact
        ? "Edit artifact"
        : draft.mode === "replace"
          ? "Replace relationship target"
          : "Link existing artifact";
  }

  function renderRelationshipScope() {
    if (
      !root &&
      !artifact &&
      (draft.targetKey || draft.create) &&
      (scopeRequired || draft.scope || draft.expanded) &&
      (!draft.create || draft.expanded)
    )
      return `<label>Relationship scope${scopeRequired ? " · Required" : " · Optional"}<input name="scope" ${scopeRequired ? "required" : ""} placeholder="Why are these artifacts linked?" value="${esc(draft.scope)}"></label>`;
    return "";
  }
  function renderEntityFields() {
    function renderExpandedCreationFields() {
      return draft.expanded
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
        : "";
    }

    return newEntity
      ? `<p class="cell-editor-heading">${esc(typeName(entityType))} · ${esc(draft.key)}</p><label>Title<input name="title" required value="${esc(draft.title)}" placeholder="What needs to be recorded?"></label>${renderExpandedCreationFields()}${!draft.fullDetails ? '<button type="button" data-cell-details>More fields</button>' : ""}`
      : `<label>Title<input name="title" required value="${esc(draft.title)}"></label>${draft.quickTitle ? "" : `<label>Statement<textarea name="statement" required>${esc(draft.statement)}</textarea></label>`}`;
  }
  function renderTargetPicker() {
    function renderMatchingArtifacts() {
      return (
        (chosen ? [] : matches)
          .slice(0, limit)
          .map((record) => {
            const exists = duplicateTarget(context.model, draft, record.key);
            return `<button type="button" role="option" data-picker-key="${esc(record.key)}" aria-selected="${record.key === draft.targetKey}" ${exists ? 'disabled aria-disabled="true"' : ""}>${keyName(record)}<small>${exists ? "Already linked" : esc(typeName(record.type))}</small></button>`;
          })
          .join("") || (chosen ? "" : "<span>No matching artifacts</span>")
      );
    }

    const matches = [...model.records.values()].filter(
      (record) =>
        record.type === draft.targetType &&
        `${record.key} ${record.title}`.toLowerCase().includes(draft.query.toLowerCase()),
    );
    const limit = draft.query.trim() ? 20 : 6;
    const chosen = model.records.get(draft.targetKey);
    return `<label>Find ${esc(shortType(draft.targetType))}<input name="query" autocomplete="off" role="combobox" aria-expanded="${!chosen}" aria-controls="cell-matches" value="${esc(draft.query)}" placeholder="Identifier or title"></label><div id="cell-matches" class="cell-matches" role="listbox" aria-label="Matching artifacts">${renderMatchingArtifacts()}</div>${chosen ? `<div class="chosen-target">${keyName(chosen)}</div>` : ""}${matches.length > limit && !chosen ? '<p class="cell-edit-note">Type to narrow the results.</p>' : ""}<button type="button" data-cell-create>＋ Create ${esc(shortType(draft.targetType))}</button>`;
  }
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
  body = newEntity || artifact ? renderEntityFields() : renderTargetPicker();
  body += renderRelationshipScope();
  return `<form id="${root ? "create-form" : "matrix-cell-form"}" class="cell-editor" aria-label="${renderEditorLabel()}">${renderRelationshipHeading()}${body}${draft.error ? `<p class="form-error" role="alert">${esc(draft.error)}</p>` : '<p class="form-error" role="alert"></p>'}<div class="cell-edit-actions"><button type="submit" ${renderDisabledEditor()}>Save</button><button type="button" data-cell-cancel ${renderDisabledEditorCancel()}>Cancel</button>${renderEditArtifactAction()}</div>${draft.mode === "replace" ? '<p class="cell-edit-note">Updates this recorded relationship everywhere it appears.</p>' : ""}</form>`;
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
            const contents = renderCellContents();
            function renderCellContents() {
              return items.length
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
            }
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

function beginRoot(get) {
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
  get().app.querySelector('#matrix-cell-popover [name="title"]')?.focus({ preventScroll: true });
}
function beginEdit(get, row, column, mode = "replace", seed = null) {
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
  function captureArtifactDraft() {
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

    return true;
  }
  function captureRelationshipDraft() {
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

    return true;
  }
  if (column === 0 || mode === "artifact") {
    if (!captureArtifactDraft()) return;
  } else if (!captureRelationshipDraft()) return;
  get().render();
  const input = get().app.querySelector("#matrix-cell-form input, #matrix-cell-form textarea");
  input?.focus();
  if (seed !== null) input?.setSelectionRange(seed.length, seed.length);
}

function expandRequiredDetails(context, draft, get) {
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
    return true;
  }
  return false;
}
async function saveDraft(get, form) {
  const context = get(),
    { state, model } = context,
    draft = state.matrixDraft;
  if (!draft) return;
  if (expandRequiredDetails(context, draft, get)) return;
  const proposal = matrixProposal(context, draft);
  if (proposal.status !== "ready") {
    if (proposal.error) {
      draft.error = proposal.error;
      form.querySelector(".form-error").textContent = proposal.error;
    }
    return;
  }
  const { operations, selected } = proposal;
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
function cancelGridEdit(get) {
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

// One binding lifetime per workspace; drafts remain owned by workspace state.
export function createGridEditor(get) {
  let binding;
  const actions = {
    beginRoot: () => {
      binding.cancelSelection();
      beginRoot(get);
    },
    beginEdit: (...args) => {
      binding.cancelSelection();
      beginEdit(get, ...args);
    },
    save: (form) => saveDraft(get, form),
    cancel: () => cancelGridEdit(get),
  };
  binding = createMatrixInput(get, actions);
  return {
    bind: binding.bind,
    dispose: binding.dispose,
    beginRoot: actions.beginRoot,
    cancel: actions.cancel,
  };
}
