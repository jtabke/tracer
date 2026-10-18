import { ensure } from "./model.ts";

export type CsvRow = { line: number; cells: string[] };
export type CsvTable = { headers: string[]; rows: CsvRow[] };
type Parser = {
  rows: CsvRow[];
  cells: string[];
  cell: string;
  mode: "plain" | "quoted" | "closed";
  line: number;
  start: number;
};
function problem(state: Parser, message: string): never {
  ensure(
    false,
    "validation",
    `CSV line ${state.line}, column ${state.cells.length + 1}: ${message}`,
  );
}
function cell(state: Parser) {
  state.cells.push(state.cell);
  ensure(state.cells.length <= 100, "validation", "CSV supports at most 100 columns");
  state.cell = "";
  state.mode = "plain";
}
function row(state: Parser) {
  cell(state);
  if (state.cells.some((value) => value !== ""))
    state.rows.push({ line: state.start, cells: state.cells });
  ensure(state.rows.length <= 1001, "validation", "CSV supports at most 1,000 data rows");
  state.cells = [];
}
function character(state: Parser, text: string, index: number) {
  const value = text[index];
  if (state.mode === "quoted") {
    if (value !== '"') state.cell += value;
    else if (text[index + 1] === '"') {
      state.cell += '"';
      return index + 1;
    } else state.mode = "closed";
    return index;
  }
  if (value === ",") cell(state);
  else if (value === '"' && state.mode === "plain" && state.cell === "") state.mode = "quoted";
  else {
    if (state.mode === "closed" || value === '"') problem(state, "Unexpected text or quote");
    state.cell += value;
  }
  return index;
}
function newline(state: Parser, value: string) {
  if (state.mode === "quoted") state.cell += value;
  else row(state);
  state.line++;
  if (state.mode !== "quoted") state.start = state.line;
}
/** Comma-separated UTF-8 text, with quoted commas/newlines and doubled quotes. No evaluation. */
export function parseCsv(text: string): CsvTable {
  ensure(typeof text === "string", "validation", "CSV must be text");
  ensure(new TextEncoder().encode(text).length <= 512 * 1024, "validation", "CSV exceeds 512 KiB");
  text = text.replace(/^\uFEFF/, "");
  const state: Parser = { rows: [], cells: [], cell: "", mode: "plain", line: 1, start: 1 };
  for (let index = 0; index < text.length; index++) {
    const value = text[index];
    if (value === "\r" || value === "\n") {
      const pair = value === "\r" && text[index + 1] === "\n";
      newline(state, pair ? "\r\n" : value);
      if (pair) index++;
    } else index = character(state, text, index);
  }
  if (state.mode === "quoted") problem(state, "Unclosed quoted cell");
  if (state.cell || state.cells.length || state.mode === "closed") row(state);
  const header = state.rows.shift();
  ensure(header, "validation", "CSV needs a header row");
  const headers = header.cells.map((value) => value.trim());
  ensure(headers.every(Boolean), "validation", "Every CSV column needs a nonempty header");
  ensure(new Set(headers).size === headers.length, "validation", "CSV headers must be unique");
  ensure(state.rows.length > 0, "validation", "CSV needs at least one data row");
  return { headers, rows: state.rows };
}
