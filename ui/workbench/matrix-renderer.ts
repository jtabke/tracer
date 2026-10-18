import { escapeHtml as esc, mono } from "./html.ts";
import { inRange } from "./matrix-selection.ts";
import { duplicateTarget } from "./matrix-proposal.ts";
import { requiredField } from "./authoring-policy.ts";
import { allowedTypes } from "./relationship-policy.ts";
import { typeName } from "./presentation.ts";
import { ancestorSpans } from "./matrix-spans.ts";
import type { WorkspaceEntity } from "./workspace-snapshot.ts";
import type {
  MatrixDraft,
  MatrixEditorContext,
  RelationshipDraft,
  RootDraft,
} from "./matrix-types.ts";

type MatrixRenderContext = Pick<
  MatrixEditorContext,
  "state" | "projection" | "model" | "data" | "head" | "native"
>;
const keyName = (record: Pick<WorkspaceEntity, "key" | "title">) =>
  `${mono(record.key)}<strong>${esc(record.title)}</strong>`;

const shortTypes: Record<string, string> = {
  verification_protocol: "verification",
  design_output: "output",
  subsystem_requirement: "requirement",
};
const shortType = (type: string) => shortTypes[type] ?? typeName(type).toLowerCase();

function draftEntityType(draft: MatrixDraft) {
  if (draft.kind === "root") return draft.type;
  if (draft.kind === "relationship") return draft.targetType;
  return "";
}
function editorDisabled(context: MatrixRenderContext) {
  return context.state.saving ||
    context.state.readBlocked ||
    context.native?.mutations.snapshot().status === "unknown"
    ? "disabled"
    : "";
}

function editor(context: MatrixRenderContext, draft: MatrixDraft) {
  function renderEditArtifactAction() {
    return draft.kind === "relationship" && !draft.create
      ? '<button type="button" data-cell-edit-artifact>Edit artifact</button>'
      : "";
  }

  function renderRelationshipHeading() {
    return draft.kind === "relationship" && !draft.create
      ? `<p class="cell-editor-heading">${esc(draft.sourceKey)} → ${esc(draft.type.replaceAll("_", " "))}</p>`
      : "";
  }

  function renderEditorLabel() {
    return root
      ? "Create artifact"
      : artifact
        ? "Edit artifact"
        : draft.kind === "relationship" && draft.mode === "replace"
          ? "Replace relationship target"
          : "Link existing artifact";
  }

  function renderRelationshipScope() {
    if (
      draft.kind === "relationship" &&
      (draft.targetKey || draft.create) &&
      (scopeRequired || draft.scope || draft.expanded) &&
      (!draft.create || draft.expanded)
    )
      return `<label>Relationship scope${scopeRequired ? " · Required" : " · Optional"}<input name="scope" ${scopeRequired ? "required" : ""} placeholder="Why are these artifacts linked?" value="${esc(draft.scope)}"></label>`;
    return "";
  }
  function renderEntityFields(draft: MatrixDraft) {
    function renderExpandedCreationFields(draft: RootDraft | RelationshipDraft) {
      return draft.expanded
        ? `<label>Statement${statementRequired ? " · Required" : ""}<textarea name="statement" ${statementRequired ? "required" : ""}>${esc(draft.statement)}</textarea></label>${draft.fullDetails ? `<label>Identifier<input name="key" required value="${esc(draft.key)}"></label>` : ""}${
            draft.kind === "root" && draft.fullDetails
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

    return draft.kind === "root" || (draft.kind === "relationship" && draft.create)
      ? `<p class="cell-editor-heading">${esc(typeName(entityType))} · ${esc(draft.key)}</p><label>Title<input name="title" required value="${esc(draft.title)}" placeholder="What needs to be recorded?"></label>${renderExpandedCreationFields(draft)}${!draft.fullDetails ? '<button type="button" data-cell-details>More fields</button>' : ""}`
      : `<label>Title<input name="title" required value="${esc(draft.title)}"></label>${draft.kind === "artifact" && draft.quickTitle ? "" : `<label>Statement<textarea name="statement" required>${esc(draft.statement)}</textarea></label>`}`;
  }
  function renderTargetPicker(draft: RelationshipDraft) {
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
  const newEntity = root || (draft.kind === "relationship" && draft.create);
  const entityType = draftEntityType(draft);
  const statementRequired = requiredField(data.schema, "entityTypes", entityType, "statement");
  const scopeRequired =
    draft.kind === "relationship" &&
    requiredField(data.schema, "relationshipTypes", draft.type, "scope");
  const disabled = editorDisabled(context);
  let body =
    draft.kind === "relationship" && !newEntity
      ? renderTargetPicker(draft)
      : renderEntityFields(draft);
  body += renderRelationshipScope();
  return `<form id="${root ? "create-form" : "matrix-cell-form"}" class="cell-editor" aria-label="${renderEditorLabel()}">${renderRelationshipHeading()}${body}${draft.error ? `<p class="form-error" role="alert">${esc(draft.error)}</p>` : '<p class="form-error" role="alert"></p>'}<div class="cell-edit-actions"><button type="submit" ${disabled}>Save</button><button type="button" data-cell-cancel ${disabled}>Cancel</button>${renderEditArtifactAction()}</div>${draft.kind === "relationship" && draft.mode === "replace" ? '<p class="cell-edit-note">Updates this recorded relationship everywhere it appears.</p>' : ""}</form>`;
}
export function renderGrid(context: MatrixRenderContext) {
  const { state, projection, model, head, native } = context;
  const columns = state.matrixSteps.length + 1;
  const spans =
    state.matrixPresentation === "grouped"
      ? ancestorSpans(projection.rows, columns)
      : projection.rows.map(() => Array<number>(columns).fill(1));
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
                      const record = model.records.get(item.key)!,
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
export function renderGridEditor(context: MatrixRenderContext) {
  if (!context.state.matrixDraft) return "";
  return `<div id="matrix-cell-popover" popover="manual" role="dialog" aria-modal="false" aria-label="Matrix cell editor">${editor(context, context.state.matrixDraft)}</div>`;
}
