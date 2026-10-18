import type { MutationController } from "../mutation-controller.ts";
import type { EditingContext } from "./editing-context.ts";
import type { Fields, SchemaObject } from "../../src/core/model.ts";
import type { WorkspaceEntity, WorkspaceRelationship } from "./workspace-snapshot.ts";
export type MatrixCell = { row: number; column: number };
export type MatrixRow = {
  keys: (string | null)[];
  links: (string | null)[];
  terminals?: { key: string; linkId: string }[];
  terminalTotal?: number;
};
type DraftBase = {
  id: string;
  schemaVersion: number;
  error?: string;
  expanded?: boolean;
  fullDetails?: boolean;
};
type EntityValues = { key: string; title: string; statement: string };
export type RootDraft = DraftBase &
  EntityValues & { kind: "root"; origin: "row" | "toolbar"; type: string };
export type ArtifactDraft = DraftBase &
  EntityValues &
  MatrixCell & { kind: "artifact"; version: number; fields: Fields; quickTitle?: boolean };
type RelationshipValues = DraftBase &
  MatrixCell & {
    kind: "relationship";
    sourceKey: string;
    sourceId: string;
    sourceVersion: number;
    type: string;
    targetType: string;
    targetKey: string;
    targetId?: string | null;
    targetVersion?: number | null;
    scope: string;
    query: string;
    fields: Fields;
    create?: boolean;
    newId?: string;
    key?: string;
    title?: string;
    statement?: string;
  };
export type RelationshipDraft = RelationshipValues &
  ({ mode: "replace"; version: number } | { mode: "add"; version?: undefined });
export type MatrixDraft = RootDraft | ArtifactDraft | RelationshipDraft;
export type MatrixModel = { records: Map<string, WorkspaceEntity>; links: WorkspaceRelationship[] };
export type MatrixState = {
  matrixCell: MatrixCell | null;
  matrixAnchor: MatrixCell | null;
  matrixDraft: MatrixDraft | null;
  matrixSteps: { type: string; targetType: string }[];
  matrixPath: { keys: string[]; links: string[] } | null;
  selected: string;
  edge: string | null;
  historySubject: unknown;
  perspective: string;
  inspector: boolean;
  matrixPresentation: string;
  matrixDensity: string;
  recentConnection?: { source: string; target: string; id: string };
};
export type MatrixContext = {
  app: HTMLElement;
  state: MatrixState;
  model: MatrixModel;
  data: { schema: SchemaObject };
  projection: { rows: MatrixRow[] };
  render(): void;
  notify(message: string): void;
  recover(): void;
  showPath(path: { keys: string[]; links: string[] } | null | undefined): void;
};
export type MatrixActions = {
  beginRoot(): void;
  beginEdit(
    row: number,
    column: number,
    mode?: "replace" | "add" | "artifact",
    seed?: string | null,
  ): void;
  save(form: HTMLFormElement): Promise<void>;
  cancel(): void;
};

// Current providers feed this context on each editor action; commit remains workspace-owned.
export type MatrixEditorContext = MatrixContext & {
  state: MatrixState & {
    revision: number;
    saving: boolean;
    readBlocked: boolean;
    visible: Set<string>;
    matrixRootType: string;
    matrixSubject: string | null;
  };
  head: number;
  native: { mutations: Pick<MutationController, "snapshot"> } | null;
  commit: EditingContext["commit"];
};
