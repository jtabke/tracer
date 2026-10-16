import type { TraceColumn } from "../../../src/core/presentation.ts";
import { traceColumnKey } from "../../../src/core/presentation.ts";
import { readable } from "./graph-model.ts";

function RelationshipColumnHeading({ column }: { column: TraceColumn }) {
  return (
    <th>
      {column.direction === "incoming" ? "←" : "→"} {readable(column.relationshipType)}
      <small>{column.targetType}</small>
    </th>
  );
}

export function RelationshipColumnsHead({
  columns,
  identityTitle,
}: {
  columns: TraceColumn[];
  identityTitle: string;
}) {
  return (
    <thead>
      <tr>
        <th>{identityTitle}</th>
        {columns.map((column) => (
          <RelationshipColumnHeading key={traceColumnKey(column)} column={column} />
        ))}
      </tr>
    </thead>
  );
}
