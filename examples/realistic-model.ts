import type { Fields, Schema } from "../src/core/model.ts";
import type { ChainQuery } from "../src/application/views.ts";

export type ExampleItem = [
  type: string,
  key: string,
  title: string,
  statement: string,
  fields?: Fields,
];
export type ExampleLink = [type: string, source: string, target: string, scope?: string];
export function exampleLinks() {
  const links: ExampleLink[] = [];
  const connect = (type: string, source: string, targets: readonly string[], scope?: string) => {
    for (const target of targets) links.push([type, source, target, scope]);
  };
  return { links, connect };
}
export type ExampleTask = {
  title: string;
  root: string;
  relationship: string;
  direction?: "incoming" | "outgoing";
  inspect: string[];
  presentation?: { layout: "trace"; columns: import("../src/core/presentation.ts").TraceColumn[] };
  explanation: string;
};
export type ExampleDefinition = {
  title: string;
  description: string;
  sources: { title: string; url: string; use: string }[];
  schema: Schema;
  items: ExampleItem[];
  links: ExampleLink[];
  receipts: { output: string; inputs: string[]; outcome: string }[];
  changes: { key: string; statement: string; reason: string }[];
  configurations?: { key: string; members: string[]; scope: string }[];
  followUpConfiguration?: { subject: string; name: string; members: string[]; reason: string };
  tasks: ExampleTask[];
  chains: { title: string; query: ChainQuery }[];
};

/** Project-owned schema: these names and annotations have no special engine semantics. */
export function exampleSchema(
  types: Record<string, string[]>,
  connections: Record<string, [source: string[], target: string[]]>,
): Schema {
  return {
    entityTypes: Object.fromEntries(
      Object.entries(types).map(([type, fields]) => [
        type,
        {
          fields: Object.fromEntries(
            ["title", "statement", "status", "owner", "notes", ...fields].map((field) => [
              field,
              {
                type: "string",
                ...(field === "title" || field === "statement" ? { required: true } : {}),
              },
            ]),
          ),
        },
      ]),
    ),
    relationshipTypes: Object.fromEntries(
      Object.entries(connections).map(([type, [source, target]]) => [
        type,
        {
          source,
          target,
          fields: {
            scope: { type: "string", required: true },
            source_version: { type: "number", required: true },
            review: { type: "string", required: true },
          },
        },
      ]),
    ),
  };
}
