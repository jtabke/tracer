import type { MatrixRow } from "./matrix-types.ts";

export function ancestorSpans(rows: MatrixRow[], columns: number) {
  const spans = rows.map(() => Array<number>(columns).fill(1));
  for (let column = 0; column < columns - 1; column++) {
    let start = 0;
    while (start < rows.length) {
      const signature = (row: MatrixRow) =>
        JSON.stringify([row.keys.slice(0, column + 1), row.links.slice(0, column)]);
      let end = start + 1;
      while (
        rows[start].keys[column] &&
        end < rows.length &&
        signature(rows[start]) === signature(rows[end])
      )
        end++;
      spans[start][column] = end - start;
      for (let index = start + 1; index < end; index++) spans[index][column] = 0;
      start = end;
    }
  }
  return spans;
}
