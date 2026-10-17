import type { MatrixCell, MatrixRow } from "./matrix-types.ts";
type Selection = { matrixCell: MatrixCell | null; matrixAnchor: MatrixCell | null };
export function gridRange(state: Selection) {
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
export function inRange(state: Selection, row: number, column: number, span = 1) {
  const range = gridRange(state);
  return Boolean(
    range &&
    column >= range.left &&
    column <= range.right &&
    row <= range.bottom &&
    row + span - 1 >= range.top,
  );
}
export function rowPath(row: MatrixRow) {
  return {
    keys: [
      ...new Set([
        ...row.keys.filter((key): key is string => Boolean(key)),
        ...(row.terminals ?? []).map((item) => item.key),
      ]),
    ],
    links: [
      ...new Set([
        ...row.links.filter((id): id is string => Boolean(id)),
        ...(row.terminals ?? []).map((item) => item.linkId),
      ]),
    ],
  };
}
export function locate(context: { app: HTMLElement }, row: number, column: number) {
  return [...context.app.querySelectorAll<HTMLTableCellElement>("[data-grid-col]")].find(
    (cell) =>
      Number(cell.dataset.gridCol) === column &&
      Number(cell.dataset.gridRow) <= row &&
      Number(cell.dataset.gridRow) + cell.rowSpan > row,
  );
}
export function focusCell(context: { app: HTMLElement }, row: number, column: number) {
  const cell = locate(context, row, column);
  if (!cell) return;
  cell.focus({ preventScroll: true });
  cell.scrollIntoView({ block: "nearest", inline: "nearest" });
}
export function startsCellEdit(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "isComposing">,
) {
  return (
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.isComposing &&
    event.key !== " " &&
    event.key !== "/"
  );
}
function tabDestination(
  current: MatrixCell,
  columns: number,
  backwards: boolean,
): [number, number] {
  if (!backwards)
    return [
      current.column === columns - 1 ? current.row + 1 : current.row,
      (current.column + 1) % columns,
    ];
  if (current.column === 0) return [current.row - 1, columns - 1];
  return [current.row, current.column - 1];
}
export function gridDestination(
  key: string,
  options: {
    current: MatrixCell;
    origin: MatrixCell;
    span: number;
    rows: number;
    columns: number;
    extend: boolean;
  },
) {
  const { current, origin, span, rows, columns, extend } = options;
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [current.row, current.column - 1],
    ArrowRight: [current.row, current.column + 1],
    ArrowUp: [extend ? current.row - 1 : origin.row - 1, current.column],
    ArrowDown: [extend ? current.row + 1 : origin.row + span, current.column],
    Tab: tabDestination(current, columns, extend),
  };
  const next = moves[key];
  return next && next[0] >= 0 && next[0] < rows && next[1] >= 0 && next[1] < columns
    ? { row: next[0], column: next[1] }
    : null;
}
