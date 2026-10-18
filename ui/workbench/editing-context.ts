import type { ChangesetResult, Operation } from "../../src/application/commands.ts";
import type { SchemaObject } from "../../src/core/model.ts";
import type { WorkspaceEntity, WorkspaceRelationship } from "./workspace-snapshot.ts";
import type { TextDraft, TextField } from "./artifact-draft.ts";

export type EditingRecord = Omit<WorkspaceEntity, "id"> & { id?: string; localGeneration?: number };
type EditingModel = { records: Map<string, EditingRecord>; links: WorkspaceRelationship[] };
type EditingState = {
  selected: string;
  revision: number;
  inlineField: TextField | null;
  editing: boolean;
  inspector: boolean;
  sheetState: string;
  drafts: Map<string, TextDraft>;
  localEntities: Map<string, EditingRecord>;
  localLinks: Map<string, WorkspaceRelationship>;
  removed: Set<string>;
  visible: Set<string>;
  edge: string | null;
};
export type EditingContext = {
  app: HTMLElement;
  dialog: HTMLDialogElement;
  state: EditingState;
  native: boolean;
  model(): EditingModel;
  schema(): SchemaObject;
  head(): number;
  refreshModel(): void;
  render(): void;
  notify(message: string): void;
  escape(value: unknown): string;
  commit(
    operations: Operation[],
    errorElement?: HTMLElement | null,
    schemaVersion?: number,
  ): Promise<ChangesetResult | null>;
};
