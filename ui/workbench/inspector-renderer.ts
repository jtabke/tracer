import type { SchemaObject } from "../../src/core/model.ts";
import { requiredField } from "./authoring-policy.ts";
import { textDraftChanged, textFields, type TextDraft, type TextField } from "./artifact-draft.ts";
import type { EditingContext, EditingRecord } from "./editing-context.ts";
import { typeName, titleCase } from "./presentation.ts";
import type { WorkspaceRelationship, WorkspaceRevision } from "./workspace-snapshot.ts";

type ReachableTrace = {
  entries: { key: string; keys: string[]; links: string[] }[];
  truncated: boolean;
};
export type InspectorRenderContext = {
  state: Readonly<
    Pick<
      EditingContext["state"],
      "selected" | "revision" | "inlineField" | "editing" | "sheetState" | "edge"
    >
  > & {
    readonly artifactFull: boolean;
    readonly perspective: string;
    readonly width: number;
    readonly drafts: ReadonlyMap<string, TextDraft>;
    readonly localEntities: ReadonlyMap<string, EditingRecord>;
    readonly relationshipDrafts: ReadonlyMap<string, { scope: string; error?: string }>;
    readonly matrixSteps: readonly { type: string; targetType: string }[];
    readonly explainedRoute?: readonly string[] | null;
    readonly investigation: { event: number } | null;
    readonly pathRoot: string | null;
    readonly pathLinkIds: ReadonlySet<string> | null;
  };
  native: boolean;
  model(): { records: ReadonlyMap<string, EditingRecord>; links: readonly WorkspaceRelationship[] };
  head(): number;
  data(): {
    schema: SchemaObject;
    revisions: WorkspaceRevision[];
    relationships: WorkspaceRelationship[];
  };
  panelMode(): string;
  supportsTextField(record: EditingRecord, field: TextField): boolean;
  escape(value: unknown): string;
  mono(value: unknown): string;
  icon(type: string): string;
  relationshipLabel(type: string, outgoing: boolean): string;
  reachableTrace(key: string): ReachableTrace;
  recordedRoute(
    links: readonly WorkspaceRelationship[],
    root: string | null,
    target: string,
    allowedIds: ReadonlySet<string> | null,
  ): WorkspaceRelationship[];
};

// Read the current model/head for each render; markup never captures or saves a proposal.
export function renderInspector(context: InspectorRenderContext): string {
  const {
    state,
    native,
    panelMode,
    supportsTextField,
    mono,
    icon,
    relationshipLabel,
    recordedRoute,
  } = context;
  const data = context.data(),
    model = context.model(),
    head = context.head(),
    e = context.escape;
  function routeExplanation(link: WorkspaceRelationship) {
    let route =
      state.explainedRoute?.at(-1) === link.id
        ? state.explainedRoute.map((id) => model.links.find((item) => item.id === id))
        : [];
    if (!route.length || route.some((item) => !item)) {
      if (!state.investigation || !state.pathLinkIds?.has(link.id)) return "";
      route = [...recordedRoute(model.links, state.pathRoot, link.source, state.pathLinkIds), link];
    }
    const recorded = route.filter((item): item is WorkspaceRelationship => Boolean(item));
    return `<section class="route-explanation"><h3>Recorded path</h3><p>${mono(recorded[0].source)}${recorded.map((item) => ` <span>→ ${e(relationshipLabel(item.type, true).toLowerCase())} →</span> ${mono(item.target)}`).join("")}</p><p>Included through ${route.length} recorded ${route.length === 1 ? "connection" : "connections"} at r${state.revision}. No technical assessment recorded here.</p></section>`;
  }

  function relationshipInspector() {
    const link = model.links.find((link) => link.id === state.edge),
      mode = panelMode();
    if (!link)
      return `<aside class="inspector" aria-label="Relationship inspector"><p>The selected relationship is not present at r${state.revision}.</p><button data-action="close-inspector">Close</button></aside>`;
    const draft = state.relationshipDrafts.get(link.id);
    const editableScope =
      data.schema.relationshipTypes[link.type]?.fields?.scope?.type === "string";
    const editing = draft && state.revision === head;
    return `<aside class="inspector relationship-inspector" aria-label="Relationship inspector" data-inspector-context="relationship:${e(link.id)}" data-sheet="partial" data-style="--inspector-width:${state.width}px" ${mode === "drawer" ? 'role="dialog" aria-modal="true"' : ""}><div class="inspector-state">Relationship at r${state.revision} · ${state.revision === head ? "Latest" : "Historical"} · v${link.version}</div><button class="relationship-return" data-action="back-artifact">← Back to artifact</button><div class="inspector-top"><strong>${e(titleCase(link.type))}</strong><button data-action="close-inspector" aria-label="Close inspector">×</button></div><div class="relationship-endpoints"><button data-related="${e(link.source)}" title="${e(model.records.get(link.source)?.title)}">${mono(link.source)}</button><span>→ ${e(titleCase(link.type))} →</span><button data-related="${e(link.target)}" title="${e(model.records.get(link.target)?.title)}">${mono(link.target)}</button></div><p class="endpoint-titles">${e(model.records.get(link.source)?.title)} → ${e(model.records.get(link.target)?.title)}</p>${routeExplanation(link)}<div class="section-label">Scope</div>${editing ? `<form id="relationship-scope-form"><textarea name="scope" aria-label="Relationship scope" ${requiredField(data.schema, "relationshipTypes", link.type, "scope") ? "required" : ""}>${e(draft.scope)}</textarea><p class="form-error" role="alert">${e(draft.error ?? "")}</p><div class="edge-actions"><button type="submit">Save</button><button type="button" data-cancel-relationship-scope>Cancel</button></div></form>` : native && state.revision === head && editableScope ? `<button class="editable-field criterion" data-edit-relationship-scope aria-label="Edit relationship scope">${e(link.scope) || "Add scope"}<span class="inline-pencil" aria-hidden="true">✎</span></button>` : `<p class="criterion">${e(link.scope)}</p>`}<div class="edge-actions"><button data-action="relationship-history">History</button><button data-action="edit-edge" ${state.revision !== head ? "disabled" : ""}>${native ? "Edit" : "Edit locally"}</button></div></aside>`;
  }
  function inlineFieldEditor(field: TextField, record: EditingRecord, value: unknown) {
    const draft = state.drafts.get(record.key) ?? {};
    return `<div class="inline-edit"><label class="inline-edit-label" for="inline-value">${field === "acceptance" ? "Acceptance criterion" : titleCase(field)}</label><textarea id="inline-value">${e(draft[field] ?? value)}</textarea><p class="inspector-draft-status" data-inspector-draft-status role="status"></p><div><button data-apply-field="${field}">${native ? "Save" : "Apply locally"}</button><button data-action="cancel-inline">Cancel</button></div><p class="inspector-edit-help">⌘ / Ctrl + Enter to save · Esc to cancel</p></div>`;
  }
  function fieldContent(field: TextField, record: EditingRecord) {
    const value =
      field === "title"
        ? record.title
        : field === "statement"
          ? record.statement
          : (record.fields[field] ?? "");
    if (state.inlineField === field) return inlineFieldEditor(field, record, value);
    if (state.revision !== head || !supportsTextField(record, field))
      return `<p class="${field === "statement" ? "statement" : "criterion"}">${e(value)}</p>`;
    return `<button class="editable-field ${field === "statement" ? "statement" : "criterion"}" data-edit-field="${field}" aria-label="Edit ${field === "acceptance" ? "acceptance criterion" : field}">${e(value) || (field === "acceptance" ? "Add acceptance criterion" : `Add ${e(field.replaceAll("_", " "))}`)}<span class="inline-pencil" aria-hidden="true">✎</span></button>`;
  }
  function inspector() {
    if ((state.perspective === "matrix" || native) && state.edge && !state.artifactFull)
      return relationshipInspector();
    const record = model.records.get(state.selected),
      mode = panelMode(),
      historical = state.revision !== head;
    const modal = mode === "drawer" && !state.artifactFull;
    const shell = (content: string) =>
      `<aside class="inspector ${state.artifactFull ? "full-artifact" : ""}" data-inspector-context="artifact:${e(state.selected)}:${state.editing ? "edit" : "read"}:${state.artifactFull ? "full" : "panel"}" data-sheet="${state.sheetState}" aria-label="${state.artifactFull ? "Artifact editor" : "Artifact inspector"}" data-style="--inspector-width:${state.width}px" ${modal ? 'role="dialog" aria-modal="true" aria-labelledby="artifact-heading"' : ""}>${content}</aside>`;
    if (!record)
      return shell(
        `<div class="inspector-top">${mono(state.selected)}<button data-action="close-inspector" aria-label="Close inspector">×</button></div><p>This artifact does not exist at revision ${state.revision}.</p><button data-action="latest">Return to latest</button>`,
      );
    if (mode === "sheet" && !state.artifactFull && state.sheetState === "collapsed")
      return shell(
        `<div class="compact-inspector"><div>${mono(`${record.key} · r${state.revision}`)}<strong>${e(record.title)}</strong></div><button data-action="expand-sheet" aria-label="Expand artifact details">Details ↑</button><button data-action="open-artifact" aria-label="Open artifact editor" title="Open artifact editor">↗</button><button data-action="close-inspector" aria-label="Close inspector">×</button></div>`,
      );
    function renderOwnHistory(record: EditingRecord) {
      return data.revisions
        .filter(
          (entry) =>
            entry.kind === "entity" &&
            entry.snapshot?.key === record.key &&
            entry.projectRevision <= state.revision,
        )
        .slice(-2)
        .reverse();
    }
    function renderHeader(record: EditingRecord) {
      return `${mode === "docked" && !state.artifactFull ? `<div class="inspector-resize" role="separator" tabindex="0" aria-label="Resize artifact inspector" aria-orientation="vertical" aria-valuemin="300" aria-valuemax="460" aria-valuenow="${state.width}"></div>` : ""}<div class="inspector-state">${state.localEntities.has(record.key) && !historical ? `Local edit · based on r${head}` : `${state.perspective === "history" ? "Artifact state" : "Artifact"} · r${state.revision} · ${state.revision === head ? "Latest" : "Historical"}`}</div><div class="inspector-top"><div>${mono(record.key)}<span class="version">v${record.version}</span></div><div class="inspector-actions">${mode === "sheet" && !state.artifactFull ? '<button data-action="collapse-sheet" aria-label="Collapse artifact details">↓</button>' : ""}${!state.artifactFull ? '<button data-action="open-artifact" aria-label="Open artifact editor" title="Open artifact editor">↗</button>' : ""}<button data-action="edit" ${historical ? "disabled" : ""} aria-label="Edit artifact" title="Edit artifact">✎</button><button data-action="close-inspector" aria-label="${state.artifactFull ? "Close artifact editor" : "Close inspector"}">×</button></div></div><p class="type-label">${icon(record.type)}${e(typeName(record.type))}${state.localEntities.has(record.key) && !historical ? '<span class="local-dot">Local edit</span>' : ""}</p>`;
    }
    function renderFields(record: EditingRecord) {
      const names = textFields.filter((field) => supportsTextField(record, field));
      const label = (field: TextField) =>
        field === "acceptance" ? "Acceptance criterion" : titleCase(field);
      return state.editing
        ? `<h2 id="artifact-heading" tabindex="-1">Edit ${e(record.key)}</h2><div class="editor-fields">${names.map((field) => `<label>${label(field)}${field === "title" ? `<input id="draft-title" value="${e(draft.title)}">` : `<textarea id="draft-${field}">${e(draft[field] ?? record.fields[field] ?? "")}</textarea>`}</label>`).join("")}<p class="inspector-draft-status" data-inspector-draft-status role="status"></p><div class="edit-actions"><button data-action="apply-edit">${native ? "Save" : "Apply locally"}</button><button data-action="cancel-edit">Cancel</button></div><p class="inspector-edit-help">⌘ / Ctrl + Enter to save · Esc to cancel</p><p class="draft-note">${native ? "Changes stay in this tab until saved" : "This tab only · no database save"}</p></div>`
        : `<h2 id="artifact-heading" tabindex="-1">${e(record.title)}</h2>${fieldContent("statement", record)}${supportsTextField(record, "acceptance") || record.fields.acceptance !== undefined ? `<div class="section-label">Acceptance criterion</div>${fieldContent("acceptance", record)}` : ""}`;
    }
    function renderRelationships() {
      return `<section class="relationship-groups"><div class="inspector-section-heading"><h3>Direct connections <span>${links.length}</span></h3><button data-action="connect" ${historical ? "disabled" : ""} aria-label="Add relationship">＋</button></div>${[...groups].map(([label, items]) => `<section class="relationship-group"><h4>${e(label)} <span>${items.length}</span></h4>${items.map(({ link, key }) => `<div class="relationship-entry"><button class="connection-row" data-related="${e(key)}"><span>${mono(key)}<strong>${e(model.records.get(key)?.title ?? key)}</strong></span></button><button data-inspect-link="${e(link.id)}" aria-label="Inspect relationship ${e(link.source)} to ${e(link.target)}" title="Inspect relationship">↗</button></div>`).join("")}</section>`).join("")}</section>`;
    }
    function renderReachableSection() {
      return `<section class="reachable-trace"><div class="inspector-section-heading"><h3>Reachable in trace <span>${reachable.entries.length}${reachable.truncated ? "+" : ""}</span></h3></div><p class="trace-scope-note">Current matrix path · up to ${state.matrixSteps.length} steps</p>${reachable.entries.map((item) => `<button class="reachable-entry" data-trace-route="${e(JSON.stringify(item.links))}">${mono(item.key)}<strong>${e(model.records.get(item.key)?.title ?? item.key)}</strong><small>${item.keys.map(e).join(" → ")}</small></button>`).join("")}${!reachable.entries.length ? '<p class="trace-scope-note">No indirect matches in this configured path.</p>' : ""}${reachable.truncated ? '<p class="trace-scope-note">Bounded path view; narrow the configured trace.</p>' : ""}</section>`;
    }

    const draft: TextDraft = state.drafts.get(record.key) ?? record,
      groups = new Map<string, { link: WorkspaceRelationship; key: string; outgoing: boolean }[]>(),
      links = model.links.filter(
        (link) => link.source === record.key || link.target === record.key,
      );
    for (const link of links) {
      const outgoing = link.source === record.key,
        label = relationshipLabel(link.type, outgoing);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push({ link, key: outgoing ? link.target : link.source, outgoing });
    }
    const ownHistory = renderOwnHistory(record);
    const header = renderHeader(record);
    const fields = renderFields(record);
    const relationships = renderRelationships() + referenceAction(native, historical);
    const reachable = context.reachableTrace(record.key);
    const reachableSection = renderReachableSection();
    const recent = `<section class="artifact-history"><div class="inspector-section-heading"><h3>Recent history</h3><button data-action="artifact-history" aria-label="View artifact history">↗</button></div>${ownHistory.map((entry) => `<button data-artifact-event="${entry.projectRevision}">${mono(`r${entry.projectRevision}`)}<span>${entry.version === 1 ? "Created" : `Updated to v${entry.version}`}</span></button>`).join("")}</section>`;
    return shell(
      header +
        fields +
        retainedArtifactDraft(record) +
        (!state.editing
          ? recordedProperties(record, e) + relationships + reachableSection + recent
          : ""),
    );
  }
  function retainedArtifactDraft(record: EditingRecord) {
    if (state.editing || state.inlineField || state.revision !== head) return "";
    const draft = state.drafts.get(record.key);
    if (!draft || !textDraftChanged(record, draft)) return "";
    return '<div class="retained-artifact-draft"><span>Unsaved edits in this tab</span><div><button data-action="edit">Resume editing</button><button data-action="cancel-edit">Discard edits</button></div></div>';
  }
  return inspector();
}

function recordedProperties(record: EditingRecord, escape: (value: unknown) => string) {
  const fields = Object.entries(record.fields).filter(
    ([name]) => !textFields.includes(name as TextField),
  );
  if (!fields.length) return "";
  return `<section class="recorded-properties" aria-label="Recorded properties"><h3>Recorded properties</h3><p class="trace-scope-note">Stored project context. These values do not establish verification.</p><dl>${fields.map(([name, value]) => `<dt>${escape(titleCase(name.replace(/([a-z])([A-Z])/g, "$1 $2")))}</dt><dd>${escape(typeof value === "string" ? value : JSON.stringify(value))}</dd>`).join("")}</dl></section>`;
}

export function renderEdgeDetail(context: InspectorRenderContext): string {
  const { state, mono } = context;
  const model = context.model(),
    data = context.data(),
    head = context.head(),
    e = context.escape;
  function edgeDetail() {
    const link =
      model.links.find((link) => link.id === state.edge) ??
      data.relationships.find((link) => link.id === state.edge);
    if (!link) return "";
    return `<section class="edge-detail" aria-label="Relationship details"><button data-action="close-edge" aria-label="Close relationship details">×</button><strong>${e(titleCase(link.type))}</strong>${mono(`${link.source} → ${link.target}`)}<p>${e(link.scope)}</p><div class="edge-actions"><button data-action="relationship-history">History</button><button data-action="edit-edge" ${state.revision !== head ? "disabled" : ""}>Edit</button><button data-action="remove-edge" ${state.revision !== head ? "disabled" : ""}>Remove</button></div></section>`;
  }
  return edgeDetail();
}

function referenceAction(native: boolean, historical: boolean) {
  return native
    ? `<button data-action="references" ${historical ? "disabled" : ""}>References and supporting material</button>`
    : "";
}
