import type { Fields } from "../../src/core/model.ts";
import type { WorkspaceRelationship } from "./workspace-snapshot.ts";
import type { EditingContext } from "./editing-context.ts";
import { createConnectionPicker } from "./connection-picker.ts";
import { requiredField } from "./authoring-policy.ts";
import { allowedTypes } from "./relationship-policy.ts";
import { MAX_VISIBLE, typeName, titleCase } from "./presentation.ts";

type Options = EditingContext & { openDialog(title: string, body: string): void };
export function createAuthoringDialogs(context: Options) {
  const { state, dialog, native, notify, render, commit, openDialog, escape: e } = context;
  function openCreate() {
    openDialog(
      native ? "Create artifact" : "Create local artifact",
      `<form id="create-form" class="workspace-form"><label>Type<select name="type">${Object.keys(
        context.schema().entityTypes,
      )
        .map((type) => `<option value="${type}">${e(typeName(type))}</option>`)
        .join(
          "",
        )}</select></label><label>Identifier<input name="key" required placeholder="REQ-NEW"></label><label>Title<input name="title" required></label><label>Statement<textarea name="statement" required></textarea></label><p class="form-error" role="alert"></p><button type="submit">${native ? "Create artifact" : "Create locally"}</button><p class="draft-note">${native ? "Saved in the selected project" : "This tab only · no database save"}</p></form>`,
    );
    const form = dialog.querySelector<HTMLFormElement>("#create-form")!;
    const error = form.querySelector<HTMLElement>(".form-error")!;
    async function submitArtifact(event: SubmitEvent) {
      event.preventDefault();
      if (state.revision !== context.head()) return;
      const fields = new FormData(form),
        key = String(fields.get("key")).trim(),
        title = String(fields.get("title")).trim(),
        statement = String(fields.get("statement")).trim();
      if (
        !key ||
        !title ||
        !statement ||
        context.model().records.has(key) ||
        state.visible.size >= MAX_VISIBLE
      ) {
        error.textContent =
          "Use a unique identifier and nonempty fields; the view is limited to 50 artifacts.";
        return;
      }
      const record = {
        key,
        type: String(fields.get("type")),
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
          error,
        );
        if (!result) return;
      } else state.localEntities.set(key, record);
      state.visible.add(key);
      state.selected = key;
      dialog.close();
      notify(native ? `${key} created · r${context.head()}` : `${key} created locally`);
      render();
    }
    form.onsubmit = submitArtifact;
  }
  function connectionFields(
    existing: WorkspaceRelationship | undefined,
    source: string,
    type: string,
    scope: string,
  ): Fields {
    return {
      ...(existing?.fields ?? {}),
      ...(context.schema().relationshipTypes[type].fields?.scope ? { scope } : {}),
      ...(context.schema().relationshipTypes[type].fields?.source_version
        ? {
            source_version:
              existing?.fields?.source_version ?? context.model().records.get(source)!.version,
          }
        : {}),
      ...(context.schema().relationshipTypes[type].fields?.review
        ? { review: existing?.fields?.review ?? "Not reviewed" }
        : {}),
    };
  }
  function openConnect(
    existing?: WorkspaceRelationship,
    endpoints: { source: string; target: string } | null = null,
  ) {
    if (state.revision !== context.head()) return;
    const records = [...context.model().records.values()],
      source = existing?.source ?? endpoints?.source ?? state.selected;
    openDialog(
      existing ? (native ? "Edit relationship" : "Edit local relationship") : "Connect artifacts",
      `<form id="connection-form" class="workspace-form"><label>Source<input name="source" id="connection-source" list="connection-sources" aria-describedby="connection-source-summary" required autocomplete="off" value="${e(source)}" placeholder="Identifier or title"><datalist id="connection-sources">${records.map((record) => `<option value="${e(record.key)}" label="${e(record.title)} · ${e(typeName(record.type))}"></option>`).join("")}</datalist></label><p id="connection-source-summary" class="connection-endpoint-summary"></p><label>Target<input name="target" id="connection-target" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="connection-target-results" aria-describedby="connection-target-status" required autocomplete="off" value="${e(existing?.target ?? endpoints?.target ?? "")}" placeholder="Find a compatible artifact"></label><div id="connection-target-results" class="connection-candidates" role="listbox" aria-label="Compatible target artifacts"></div><p id="connection-target-status" class="connection-endpoint-summary" role="status"></p><label>Relationship type<select name="type" id="connection-type"></select></label><label><span id="connection-scope-label">Scope</span><textarea name="scope">${e(existing?.scope ?? "")}</textarea></label><p class="form-error" role="alert"></p><div class="connection-form-actions"><button type="submit">${native ? (existing ? "Save relationship" : "Connect") : existing ? "Apply locally" : "Connect locally"}</button><button type="button" data-cancel-connection>Cancel</button></div><p class="draft-note">${native ? "Saved in the selected project" : "This tab only · no database save"}</p></form>`,
    );
    const form = dialog.querySelector<HTMLFormElement>("#connection-form")!;
    const sourceInput = form.querySelector<HTMLInputElement>("#connection-source")!;
    const targetInput = form.querySelector<HTMLInputElement>("#connection-target")!;
    const typeInput = form.querySelector<HTMLSelectElement>("#connection-type")!;
    const scopeInput = form.querySelector<HTMLTextAreaElement>('[name="scope"]')!;
    const error = form.querySelector<HTMLElement>(".form-error")!;
    const capturedSchemaVersion = context.schema().version;
    const update = () => {
      const source = context.model().records.get(sourceInput.value),
        target = context.model().records.get(targetInput.value),
        types = source && target ? allowedTypes(context.schema(), source, target) : [];
      const selectedType = typeInput.value || existing?.type;
      typeInput.innerHTML = types.length
        ? types
            .map(
              (type) =>
                `<option value="${e(type)}" ${type === selectedType ? "selected" : ""}>${e(titleCase(type))}</option>`,
            )
            .join("")
        : '<option value="">Choose compatible artifacts</option>';
      form.querySelector<HTMLElement>("#connection-source-summary")!.textContent = source
        ? `${source.key} · ${source.title} · ${typeName(source.type)}`
        : "Choose an existing source identifier.";
      picker.refresh();
      updateScope();
      sourceInput.setCustomValidity(source ? "" : "Choose an existing source artifact.");
      targetInput.setCustomValidity(
        target && types.length ? "" : "Choose a compatible existing target artifact.",
      );
      form.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled = !types.length;
      error.textContent =
        target && !types.length
          ? "These artifacts have no permitted relationship. Search for a compatible target."
          : "";
    };
    const picker = createConnectionPicker(form, {
      candidates: () => {
        const source = context.model().records.get(sourceInput.value);
        return records.filter(
          (record) => source && allowedTypes(context.schema(), source, record).length,
        );
      },
      changed: update,
      escape: e,
    });
    function updateScope() {
      const required = requiredField(
        context.schema(),
        "relationshipTypes",
        typeInput.value,
        "scope",
      );
      scopeInput.required = required;
      form.querySelector<HTMLElement>("#connection-scope-label")!.textContent = required
        ? "Scope · required"
        : "Scope · optional";
    }
    form.querySelector<HTMLButtonElement>("[data-cancel-connection]")!.onclick = () =>
      dialog.close();
    sourceInput.oninput = update;
    targetInput.oninput = update;
    typeInput.onchange = updateScope;
    update();
    if (!existing) targetInput.focus();
    async function submitConnection(event: SubmitEvent) {
      event.preventDefault();
      if (state.revision !== context.head()) return;
      const fields = new FormData(form),
        source = String(fields.get("source")),
        target = String(fields.get("target")),
        type = String(fields.get("type")),
        scope = String(fields.get("scope")).trim();
      if (
        (requiredField(context.schema(), "relationshipTypes", type, "scope") && !scope) ||
        !context.model().records.has(source) ||
        !context.model().records.has(target) ||
        !allowedTypes(
          context.schema(),
          context.model().records.get(source),
          context.model().records.get(target),
        ).includes(type)
      ) {
        error.textContent = "Choose a permitted relationship and describe its scope.";
        return;
      }
      if (
        context
          .model()
          .links.some(
            (link) =>
              link.id !== existing?.id &&
              link.source === source &&
              link.target === target &&
              link.type === type,
          )
      ) {
        error.textContent = "That typed relationship is already recorded.";
        return;
      }
      const needed = [source, target].filter((key) => !state.visible.has(key));
      if (state.visible.size + needed.length > MAX_VISIBLE) {
        error.textContent = "The view is limited to 50 artifacts.";
        return;
      }
      if (native) {
        const input = {
          source: context.model().records.get(source)!.id!,
          target: context.model().records.get(target)!.id!,
          type,
          fields: connectionFields(existing, source, type, scope),
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
                    sourceVersion: context.model().records.get(source)!.version,
                    targetVersion: context.model().records.get(target)!.version,
                  },
                },
          ],
          error,
          capturedSchemaVersion,
        );
        if (!result) return;
        state.visible.add(source);
        state.visible.add(target);
        state.edge = result.results[0].id;
        state.inspector = true;
        dialog.close();
        notify(`Relationship saved · r${context.head()}`);
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
          source_version: context.model().records.get(source)!.version,
          review: "local prototype",
        },
      });
      state.visible.add(source);
      state.visible.add(target);
      state.edge = null;
      dialog.close();
      notify("Relationship updated locally · no database save");
      render();
    }
    form.onsubmit = submitConnection;
  }
  return { openCreate, openConnect };
}
