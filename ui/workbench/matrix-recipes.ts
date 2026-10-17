import type { ChainView, SavedView } from "../../src/core/presentation.ts";
import type * as Native from "./native-client.ts";

type Step = { type: string; targetType: string };
type MatrixRecipeState = {
  matrixRootType: string;
  matrixSteps: Step[];
  matrixSearch: string;
};
type WorkspaceScope = MatrixRecipeState & {
  revision: number;
  matrixScope: string;
  matrixCell: unknown;
  matrixAnchor: unknown;
  matrixPath: unknown;
  pathLinkIds: unknown;
  pathPreview: unknown;
  investigation: unknown;
  filter: string;
};
type Options = {
  native: typeof Native;
  current(): { state: WorkspaceScope; head: number; schemaVersion: number };
  canWrite(): boolean;
  dialog: HTMLDialogElement;
  openDialog(title: string, body: string): void;
  escape(value: unknown): string;
  render(): void;
  refresh(): Promise<void>;
  notify(message: string): void;
};
export function matrixRecipeDefinition(state: MatrixRecipeState): ChainView {
  return {
    kind: "chain",
    type: state.matrixRootType,
    search: state.matrixSearch,
    steps: state.matrixSteps.map((step) => ({
      type: step.targetType,
      relationshipType: step.type,
      direction: "outgoing",
    })),
  };
}
export function matrixRecipeScope(definition: ChainView) {
  if (definition.steps.some((step) => step.direction === "incoming")) return null;
  return {
    matrixRootType: definition.type,
    matrixSteps: definition.steps.map((step) => ({
      type: step.relationshipType,
      targetType: step.type,
    })),
    matrixSearch: definition.search ?? "",
    matrixScope: "project",
    matrixCell: null,
    matrixAnchor: null,
    matrixPath: null,
    pathLinkIds: null,
    pathPreview: null,
    investigation: null,
    filter: "all",
  };
}
/** Owns saved Matrix recipes; the workspace supplies current state at each action. */
export function createMatrixRecipes(options: Options) {
  const { native, dialog, escape } = options;
  function markup() {
    const { state, head } = options.current();
    const views = native.savedViews.filter((view) => view.definition.kind === "chain");
    return `<div class="matrix-recipes"><button data-action="save-matrix-recipe" ${state.revision !== head ? "disabled" : ""}>Save Matrix configuration</button><label>Saved configurations<select id="matrix-recipe" aria-label="Saved configurations"><option value="">Choose configuration</option>${views.map((view) => `<option value="${escape(view.id)}">${escape(view.name)}</option>`).join("")}</select></label></div>`;
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!options.canWrite()) return;
    const form = event.currentTarget as HTMLFormElement;
    const { state, schemaVersion } = options.current();
    const name = String(new FormData(form).get("name") ?? "");
    const prior = native.savedViews.find((view) => view.name === name);
    const result = await native.mutations.run("/api/saved-views", {
      ...(prior ? { id: prior.id } : {}),
      name,
      expectedVersion: prior?.version ?? 0,
      expectedSchemaVersion: schemaVersion,
      definition: matrixRecipeDefinition(state),
    });
    if (!result) {
      form.querySelector<HTMLElement>('[role="alert"]')!.textContent =
        "Configuration not confirmed. Inspect saved results before retrying.";
      return;
    }
    dialog.close();
    await options.refresh();
  }
  function save() {
    options.openDialog(
      "Save Matrix configuration",
      '<form id="save-matrix-recipe"><label>Name<input name="name" required maxlength="80"></label><p>Saved in this project database. Restores row type, direct path columns and search across the project.</p><button>Save configuration</button><p role="alert"></p></form>',
    );
    dialog.querySelector<HTMLFormElement>("#save-matrix-recipe")!.onsubmit = submit;
  }
  function load(id: SavedView["id"]) {
    const view = native.savedViews.find((view) => view.id === id);
    if (!view || view.definition.kind !== "chain") return;
    const scope = matrixRecipeScope(view.definition);
    if (scope) Object.assign(options.current().state, scope);
    else
      options.notify(
        "This configuration contains incoming columns. This Matrix currently supports outgoing paths.",
      );
    options.render();
  }
  return { markup, save, load };
}
