import { ensure, json } from "../core/model.ts";
import type { WorkingContext } from "../core/working-context.ts";

export type CursorKind = "rows" | "trace" | "receipts";
export type WorkingCursor = {
  kind: CursorKind;
  scope: string;
  owner: string;
  clocks: number[];
  position: string;
};
type Context = WorkingContext["context"];
function text(value: unknown, maximum = 32768): value is string {
  return typeof value === "string" && value.length <= maximum && json(value);
}
function nonnegative(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
function positive(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0;
}
function clockArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length === 3;
}
function validClocks(value: unknown): value is number[] {
  if (!clockArray(value)) return false;
  return positive(value[0]) && positive(value[1]) && nonnegative(value[2]);
}
function parse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    ensure(false, "validation", "Invalid working-context cursor");
  }
}
function position(value: unknown, kind: CursorKind): value is string {
  if (!text(value, 200)) return false;
  return kind === "receipts"
    ? /^[1-9]\d*$/.test(value) && positive(Number(value))
    : value.length > 0;
}
export function parseWorkingCursor(value: unknown, kind: CursorKind): WorkingCursor | undefined {
  if (value === undefined) return undefined;
  ensure(text(value, 65536), "validation", "Invalid working-context cursor");
  const parsed = parse(value);
  ensure(
    Array.isArray(parsed) && parsed.length === 6,
    "validation",
    "Invalid working-context cursor",
  );
  ensure(
    parsed[0] === "working-context-v1" && parsed[1] === kind,
    "validation",
    "Wrong working-context cursor kind",
  );
  ensure(text(parsed[2]) && text(parsed[3]), "validation", "Invalid working-context cursor scope");
  ensure(validClocks(parsed[4]), "validation", "Invalid working-context cursor revisions");
  ensure(position(parsed[5], kind), "validation", "Invalid working-context cursor position");
  return { kind, scope: parsed[2], owner: parsed[3], clocks: parsed[4], position: parsed[5] };
}
export function cursorScope(cursor: WorkingCursor | undefined, scope: string) {
  if (!cursor) return;
  ensure(cursor.scope === scope, "validation", "Cursor belongs to another working recipe or focus");
}
export function cursorOwner(cursor: WorkingCursor | undefined, owner: string) {
  if (!cursor) return;
  ensure(
    cursor.owner === owner,
    "validation",
    "Cursor belongs to another working-context page owner",
  );
}
function clocks(context: Context) {
  return [context.projectRevision, context.schemaVersion, context.evidenceRevision];
}
export function cursorRevisions(cursor: WorkingCursor | undefined, context: Context) {
  if (!cursor) return;
  ensure(
    JSON.stringify(cursor.clocks) === JSON.stringify(clocks(context)),
    "conflict",
    "Native or evidence snapshot changed; restart the working context",
  );
}
export function workingCursor(
  kind: CursorKind,
  scope: string,
  owner: string,
  context: Context,
  position: string,
) {
  return JSON.stringify(["working-context-v1", kind, scope, owner, clocks(context), position]);
}
