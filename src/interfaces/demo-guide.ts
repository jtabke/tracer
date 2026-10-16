import { readFile } from "node:fs/promises";
import { viewDefinition } from "../core/presentation.ts";
import type { TraceColumn } from "../core/presentation.ts";
import { ensure, record } from "../core/model.ts";
import type { ChainQuery, ChainStep } from "../application/views.ts";

export type DemoTask = {
  title: string;
  root: string;
  rootId: string;
  relationship: string;
  direction: "incoming" | "outgoing";
  explanation: string;
  presentation?: { layout: "trace"; columns: TraceColumn[] };
};
export type DemoGuide = {
  title: string;
  description: string;
  tasks: DemoTask[];
  chains: { title: string; query: ChainQuery }[];
};

function text(value: unknown, label: string, maximum = 200): string {
  ensure(
    typeof value === "string" && value.trim().length > 0 && value.length <= maximum,
    "usage",
    `Invalid demo ${label}`,
  );
  return value;
}
function direction(value: unknown): "incoming" | "outgoing" {
  ensure(
    value === undefined || value === "incoming" || value === "outgoing",
    "usage",
    "Invalid demo direction",
  );
  return value ?? "outgoing";
}
function task(value: unknown): DemoTask {
  ensure(record(value), "usage", "Invalid demo task");
  return {
    title: text(value.title, "task title"),
    root: text(value.root, "root key"),
    rootId: text(value.rootId, "root identity"),
    relationship: text(value.relationship, "relationship"),
    direction: direction(value.direction),
    explanation: text(value.explanation, "task explanation", 3000),
    ...(value.presentation === undefined
      ? {}
      : { presentation: taskPresentation(value.presentation, value.rootId) }),
  };
}
function step(value: unknown): ChainStep {
  ensure(record(value), "usage", "Invalid demo chain step");
  return {
    type: text(value.type, "column type"),
    relationshipType: text(value.relationshipType, "column relationship"),
    direction: direction(value.direction),
  };
}
function chain(value: unknown): DemoGuide["chains"][number] {
  ensure(record(value) && record(value.query), "usage", "Invalid demo chain");
  const query = value.query;
  ensure(
    Array.isArray(query.steps) && query.steps.length <= 7,
    "usage",
    "Demo chain supports at most eight columns",
  );
  return {
    title: text(value.title, "chain title"),
    query: {
      type: text(query.type, "chain root type"),
      steps: query.steps.map(step),
      ...(query.search === undefined ? {} : { search: text(query.search, "chain search") }),
    },
  };
}
/** Normalize bounded display/query metadata; no source path, raw URL or executable field is sent. */
export function demoGuide(value: unknown): DemoGuide {
  ensure(record(value), "usage", "Invalid demo guide");
  ensure(
    Array.isArray(value.tasks) && value.tasks.length > 0 && value.tasks.length <= 12,
    "usage",
    "Demo guide needs 1–12 tasks",
  );
  ensure(
    Array.isArray(value.chains) && value.chains.length <= 4,
    "usage",
    "Demo guide supports at most four chain recipes",
  );
  return {
    title: text(value.title, "title", 300),
    description: text(value.description, "description", 4000),
    tasks: value.tasks.map(task),
    chains: value.chains.map(chain),
  };
}
export async function readDemoGuide(path: string): Promise<DemoGuide> {
  const contents = await readFile(path);
  ensure(contents.length <= 256 * 1024, "usage", "Demo guide exceeds 256 KiB");
  let value: unknown;
  try {
    value = JSON.parse(contents.toString("utf8"));
  } catch {
    throw new Error("Demo guide must contain valid JSON");
  }
  return demoGuide(value);
}

function taskPresentation(value: unknown, rootId: unknown): NonNullable<DemoTask["presentation"]> {
  ensure(record(value) && value.layout === "trace", "usage", "Invalid demo presentation");
  const definition = viewDefinition({
    kind: "family",
    rootId,
    direction: "outgoing",
    layout: "trace",
    columns: value.columns,
  });
  ensure(definition.kind === "family", "usage", "Invalid demo family presentation");
  return { layout: "trace", columns: definition.columns };
}
