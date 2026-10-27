import { ensure, json, knownProperties, record } from "./model.ts";
import type { Json } from "./model.ts";

/** Internal native discriminator, never a project-defined engineering classification. */
export const resourceType = "@resource";
export type Resource = { label: string; source?: { system: "file" | "git"; externalId: string } };
export type ReferenceState =
  | { mode: "current" }
  | { mode: "pinned"; observationId: string }
  | { mode: "pinned"; revision: number };
export type Reference = {
  role: string;
  explanation?: string;
  selector?: { kind: string; value: Json };
  state: ReferenceState;
};
const nonempty = (v: unknown) => typeof v === "string" && json(v) && v.trim().length > 0;
export function validateResource(value: unknown): asserts value is Resource {
  ensure(record(value), "validation", "Resource descriptor is required");
  knownProperties(value, ["label", "source"]);
  ensure(nonempty(value.label), "validation", "Resource label is required");
  if (value.source !== undefined) {
    ensure(record(value.source), "validation", "Invalid resource source");
    knownProperties(value.source, ["system", "externalId"]);
    ensure(
      ["file", "git"].includes(String(value.source.system)) && nonempty(value.source.externalId),
      "validation",
      "Resource needs a stable file/Git identity",
    );
  }
}
export function validateReference(value: unknown): asserts value is Reference {
  ensure(record(value) && json(value), "validation", "Reference qualification must be JSON");
  knownProperties(value, ["role", "explanation", "selector", "state"]);
  ensure(
    nonempty(value.role) &&
      (value.explanation === undefined || typeof value.explanation === "string"),
    "validation",
    "Reference role/explanation is invalid",
  );
  if (value.selector !== undefined) {
    ensure(record(value.selector), "validation", "Invalid selector");
    knownProperties(value.selector, ["kind", "value"]);
    ensure(
      nonempty(value.selector.kind) && Object.hasOwn(value.selector, "value"),
      "validation",
      "Selector needs a declared kind and value",
    );
  }
  const state = value.state;
  ensure(record(state), "validation", "Reference state is required");
  knownProperties(state, ["mode", "observationId", "revision"]);
  ensure(
    state.mode === "current"
      ? Object.keys(state).length === 1
      : state.mode === "pinned" &&
          (nonempty(state.observationId)
            ? state.revision === undefined
            : state.observationId === undefined &&
              Number.isSafeInteger(state.revision) &&
              Number(state.revision) > 0),
    "validation",
    "Select current state or one exact observed/native state",
  );
}
