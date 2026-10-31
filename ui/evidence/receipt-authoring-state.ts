import { useState } from "react";
import type { Configuration, PinnedEntity } from "../../src/core/configuration.ts";
import type { ExternalIdentity, InputDeclaration, ReceiptInput } from "../../src/core/evidence.ts";
import type { Entity, Relationship, SchemaObject } from "../../src/core/model.ts";

export type ChosenEntity = { entity: Entity; schema: SchemaObject };
export type PathHop = { relationship: Relationship; target: Entity };
export type InputDraft = {
  id: string;
  chosen?: ChosenEntity;
  external: boolean;
  needsSelection: boolean;
  mode: "current" | "history" | "configuration";
  facet?: "native" | "content";
  revision?: number;
  pin?: PinnedEntity;
  pinEpoch?: number;
  fieldsMode: "whole" | "selected";
  fields: string[];
  observationId: string;
  dependency: "direct" | "recorded";
  hops: PathHop[];
  pathEpoch?: number;
  pathValid: boolean;
  notice: string;
};
function emptyInput(): InputDraft {
  return {
    id: crypto.randomUUID(),
    external: false,
    needsSelection: false,
    mode: "current",
    fieldsMode: "whole",
    fields: [],
    observationId: "",
    dependency: "direct",
    hops: [],
    pathValid: false,
    notice: "",
  };
}
export function inputSnapshot(input: InputDraft): ChosenEntity | undefined {
  if (input.mode === "current") return input.chosen;
  if (input.pin) return { entity: input.pin.entity, schema: input.pin.schema };
  return undefined;
}
export function chooseInput(
  input: InputDraft,
  entity: Entity | undefined,
  schema: SchemaObject | null,
  external: ExternalIdentity[],
  configuration?: Configuration,
): InputDraft {
  if (!entity || !schema)
    return { ...emptyInput(), id: input.id, notice: "Input selection cleared." };
  const pin = configuration?.members.find((value) => value.entity.id === entity.id);
  return {
    ...emptyInput(),
    id: input.id,
    chosen: structuredClone({ entity, schema }),
    external: external.some((value) => value.id === entity.id),
    mode: pin ? "configuration" : "current",
    ...(configuration?.capture ? { facet: "native" as const } : {}),
    pin,
    notice: "Selection changed; field scope and dependency are reset.",
  };
}
export function inputRevision(input: InputDraft, revision?: number): InputDraft {
  return {
    ...input,
    revision,
    mode: revision === undefined ? "current" : "history",
    pin: undefined,
    pinEpoch: undefined,
    fieldsMode: "whole",
    fields: [],
    observationId: "",
    dependency: "direct",
    hops: [],
    pathEpoch: undefined,
    pathValid: false,
    notice: "Revision changed; field scope reset to whole item and live dependency cleared.",
  };
}
export function reconcileBasis(
  input: InputDraft,
  configuration: Configuration | undefined,
  entities: Entity[],
  schema: SchemaObject | null,
  external: ExternalIdentity[],
): InputDraft {
  const id = input.chosen?.entity.id;
  if (!id) return input;
  const pin = configuration?.members.find((value) => value.entity.id === id);
  const entity = configuration ? pin?.entity : entities.find((value) => value.id === id);
  if (!entity)
    return {
      ...input,
      needsSelection: true,
      dependency: "direct",
      hops: [],
      observationId: "",
      notice:
        "This identity is not available in the chosen basis. Its context is retained; choose a replacement before recording.",
    };
  return {
    ...chooseInput(input, entity, pin?.schema ?? schema, external, configuration),
    notice: configuration
      ? "Configuration basis applied; exact member pin selected, scope and live dependency reset."
      : "Configuration basis cleared; matching current identity selected, scope and dependency reset.",
  };
}
export function currentDrift(
  chosen: ChosenEntity | undefined,
  entities: Entity[],
  schema: SchemaObject | null,
) {
  if (!chosen) return "Choose an item.";
  const current = entities.find((value) => value.id === chosen.entity.id);
  if (!current)
    return "The chosen current identity is not in the loaded project. Its captured context is retained.";
  if (current.version !== chosen.entity.version)
    return `Captured v${chosen.entity.version}; latest loaded v${current.version}.`;
  if (schema?.version !== chosen.schema.version)
    return `Chosen schema v${chosen.schema.version}; latest loaded schema v${schema?.version ?? "unknown"}.`;
  return "";
}
export function inputProblem(
  input: InputDraft,
  entities: Entity[],
  schema: SchemaObject | null,
  external: ExternalIdentity[],
  epoch: number,
  pinsAvailable: boolean,
) {
  if (input.needsSelection) return "Needs selection";
  if (!input.chosen) return "Choose input";
  const snapshot = inputSnapshot(input);
  if (input.mode !== "current" && !pinsAvailable)
    return "Configuration / pin capability unavailable";
  if (input.mode === "history" && input.pinEpoch !== epoch)
    return "Exact pin read pending or failed";
  if (!snapshot) return "Exact pin not ready";
  if (input.mode === "configuration" && input.facet === "content")
    return input.observationId ? "" : "Selected configuration has no known observation";
  if (input.fieldsMode === "selected" && !input.fields.length) return "Choose at least one field";
  if (input.mode !== "current") return "";
  return currentInputProblem(input, entities, schema, external, epoch);
}
function currentInputProblem(
  input: InputDraft,
  entities: Entity[],
  schema: SchemaObject | null,
  external: ExternalIdentity[],
  epoch: number,
) {
  const drift = currentDrift(input.chosen, entities, schema);
  if (drift) return drift;
  if (input.external !== external.some((value) => value.id === input.chosen?.entity.id))
    return "Input ownership changed. Explicitly use the current input.";
  if (input.external && !input.observationId) return "Choose an exact observation";
  if (input.dependency === "recorded" && (!input.pathValid || input.pathEpoch !== epoch))
    return "Recorded path pending, changed, incomplete or unavailable";
  return "";
}
export function pathComplete(outputId: string, inputId: string, hops: PathHop[]) {
  if (!hops.length || hops.length > 100) return false;
  if (new Set(hops.map((hop) => hop.relationship.id)).size !== hops.length) return false;
  let endpoint = outputId;
  for (const hop of hops) {
    if (hop.relationship.source !== endpoint) return false;
    endpoint = hop.relationship.target;
  }
  return endpoint === inputId;
}
function declaration(input: InputDraft): InputDeclaration {
  const entityId = input.chosen!.entity.id;
  const fields = input.fieldsMode === "selected" ? { fields: input.fields } : {};
  if (input.mode === "configuration")
    return {
      entityId,
      ...(input.facet ? { facet: input.facet } : {}),
      ...(input.facet === "content" ? { observationId: input.observationId } : fields),
    };
  if (input.mode === "history") return { entityId, revision: input.revision, ...fields };
  return {
    entityId,
    expectedVersion: input.chosen!.entity.version,
    ...fields,
    ...(input.observationId ? { observationId: input.observationId } : {}),
    ...(input.dependency === "recorded"
      ? {
          path: input.hops.map((hop) => hop.relationship.id),
          expectedPathVersions: input.hops.map((hop) => hop.relationship.version),
        }
      : {}),
  };
}
export function receiptProposal(
  output: ChosenEntity,
  outcome: string,
  inputs: InputDraft[],
  configuration?: Configuration,
  supersedes?: string,
): ReceiptInput {
  return {
    outputId: output.entity.id,
    expectedOutputVersion: output.entity.version,
    outcome,
    inputs: inputs.map(declaration),
    ...(configuration ? { configurationId: configuration.id } : {}),
    ...(supersedes ? { supersedes } : {}),
  };
}
export function useReceiptDraft() {
  const [output, setOutput] = useState<ChosenEntity>();
  const [outcome, setOutcome] = useState("");
  const [inputs, setInputs] = useState<InputDraft[]>(() => [emptyInput()]);
  const [active, setActive] = useState(inputs[0].id);
  const [configuration, setConfiguration] = useState<Configuration>();
  const [supersedes, setSupersedes] = useState("");
  const update = (id: string, patch: Partial<InputDraft>) =>
    setInputs((values) =>
      values.map((value) => (value.id === id ? { ...value, ...patch } : value)),
    );
  const chooseOutput = (entity: Entity | undefined, schema: SchemaObject | null) => {
    setOutput(entity && schema ? structuredClone({ entity, schema }) : undefined);
    setSupersedes("");
    setInputs((values) =>
      values.map((value) => ({
        ...value,
        dependency: "direct",
        hops: [],
        pathValid: false,
        pathEpoch: undefined,
        notice: "Output changed; recorded dependency reset. Other input choices are retained.",
      })),
    );
  };
  const adoptOutput = (entity: Entity, schema: SchemaObject) =>
    setOutput(structuredClone({ entity, schema }));
  const add = () => {
    const value = emptyInput();
    setInputs((values) => [...values, value]);
    setActive(value.id);
  };
  const remove = (id: string) =>
    setInputs((values) => {
      const next = values.filter((value) => value.id !== id);
      if (active === id) setActive(next[0].id);
      return next;
    });
  return {
    output,
    outcome,
    inputs,
    active,
    configuration,
    supersedes,
    update,
    chooseOutput,
    adoptOutput,
    add,
    remove,
    setActive,
    setOutcome,
    setConfiguration,
    setInputs,
    setSupersedes,
  };
}
