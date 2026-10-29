import { validateConfigurationCapture } from "../core/configuration-capture-validation.ts";
import { captureRelationships } from "./relationship-inputs.ts";
import { ensure, json, record } from "../core/model.ts";
import type { Entity, Relationship, SchemaObject, Provenance } from "../core/model.ts";
import type {
  Observation,
  ReceiptInput,
  Receipt,
  CapturedInput,
  CapturedRelationship,
} from "../core/evidence.ts";
import type { Transaction } from "./ports/repository.ts";
import { resolveReceiptInput, configurationRelationshipDeclarations } from "./receipt-inputs.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import { evidenceText as text, evidenceEntity as entity } from "./evidence-validation.ts";

async function captureDeclaredInput(
  tx: Transaction,
  declaration: ReceiptInput["inputs"][number],
  output: Entity,
  schema: SchemaObject,
  configuration?: import("../core/configuration.ts").Configuration,
  relationships: CapturedRelationship[] = [],
): Promise<CapturedInput> {
  const resolved = await resolveReceiptInput(tx, declaration, schema, configuration, relationships);
  const value = resolved.value;
  const observation =
    resolved.observation ??
    (resolved.pin ? undefined : await captureObservation(tx, declaration, value));
  validateFieldScope(declaration, value, resolved.schema);
  const { path, links } = await captureDependencyPath(tx, declaration, output, value);
  return {
    entityId: value.id,
    ...(declaration.referenceId === undefined ? {} : { referenceId: declaration.referenceId }),
    contentRetention: observation ? "external-content-not-retained" : "native-history",
    ...(declaration.facet === undefined ? {} : { facet: declaration.facet }),
    ...(declaration.role === undefined ? {} : { role: declaration.role }),
    entity: value,
    links,
    ...(resolved.pin ? { pin: resolved.pin, revision: value.version } : {}),
    ...(declaration.fields ? { fields: declaration.fields } : {}),
    ...(path.length ? { path } : {}),
    ...(observation ? { observationId: observation.id, observation } : {}),
  };
}
async function receiptConfiguration(tx: Transaction, id: string | undefined) {
  if (id === undefined) return undefined;
  text(id, "Configuration ID");
  const configuration = await tx.getConfiguration(id);
  ensure(configuration, "not_found", "Configuration not found");
  validateConfigurationCapture(configuration);
  return configuration;
}

async function captureObservation(
  tx: Transaction,
  declaration: ReceiptInput["inputs"][number],
  value: Entity,
) {
  const external = (await tx.getEvidence("external", value.id)) ?? value.resource?.source;
  let observation: Observation | undefined;
  if (external && declaration.facet !== "native") {
    text(declaration.observationId, "Explicit observation ID");
    observation = await tx.getEvidence("observation", declaration.observationId);
    ensure(
      observation && observation.entityId === value.id,
      "validation",
      "Observation belongs to a different input or is missing",
    );
    ensure(
      declaration.fields === undefined,
      "validation",
      "External dependencies use scoped observed content, not annotation fields",
    );
  } else {
    ensure(
      declaration.facet !== "content",
      "validation",
      "Content inputs require an external observed state",
    );
    ensure(
      declaration.observationId === undefined,
      "validation",
      "Native inputs have no external observation",
    );
  }
  return observation;
}

function validateFieldScope(
  declaration: ReceiptInput["inputs"][number],
  value: Entity,
  schema: SchemaObject,
) {
  if (declaration.fields !== undefined) {
    ensure(
      Array.isArray(declaration.fields) &&
        declaration.fields.length > 0 &&
        new Set(declaration.fields).size === declaration.fields.length &&
        declaration.fields.every(
          (name) =>
            typeof name === "string" &&
            Object.hasOwn(
              value.type === "@resource" ? value.fields : schema.entityTypes[value.type].fields,
              name,
            ),
        ),
      "validation",
      "Invalid native field scope",
    );
  }
}

async function captureDependencyPath(
  tx: Transaction,
  declaration: ReceiptInput["inputs"][number],
  output: Entity,
  value: Entity,
) {
  const path = declaration.path ?? [];
  ensure(
    Array.isArray(path) && path.length <= 100 && new Set(path).size === path.length,
    "validation",
    "Invalid dependency path",
  );
  const expectedVersions = dependencyPathGuards(path, declaration.expectedPathVersions);
  const links: Relationship[] = [];
  let endpoint = output.id;
  for (const id of path) {
    text(id, "Relationship ID");
    const link = await tx.get("relationship", id);
    ensure(
      link && link.source === endpoint,
      "validation",
      "Dependency path must run forward from output to input",
    );
    ensure(
      expectedVersions === undefined || expectedVersions[links.length] === link.version,
      "conflict",
      "Dependency link changed before receipt capture: " + id,
    );
    links.push(link);
    endpoint = link.target;
  }
  ensure(
    !path.length || endpoint === value.id,
    "validation",
    "Dependency path does not reach the declared input",
  );
  return { path, links };
}

function dependencyPathGuards(path: string[], expectedVersions?: number[]) {
  ensure(
    expectedVersions === undefined ||
      (Array.isArray(expectedVersions) &&
        path.length > 0 &&
        expectedVersions.length === path.length &&
        expectedVersions.every((version) => Number.isSafeInteger(version) && version > 0)),
    "validation",
    "Dependency path guards must match each chosen link version",
  );
  return expectedVersions;
}

async function validateSupersedes(
  tx: Transaction,
  supersedes: string | undefined,
  outputId: string,
) {
  if (supersedes !== undefined) {
    text(supersedes, "Superseded receipt");
    const previous = await tx.getEvidence("receipt", supersedes);
    ensure(
      previous && previous.output.id === outputId,
      "validation",
      "Superseded receipt must have the same output identity",
    );
  }
}

/** Capture invocation-time intent before enqueueing; semantic guards remain transaction-local. */
export function prepareReceipt(input: ReceiptInput): ReceiptInput {
  input = snapshotInput(input);
  ensure(
    record(input) &&
      json(input) &&
      Object.keys(input).every((key) =>
        [
          "outputId",
          "expectedOutputVersion",
          "outcome",
          "inputs",
          "relationshipInputs",
          "supersedes",
          "configurationId",
        ].includes(key),
      ),
    "validation",
    "Invalid receipt input",
  );
  text(input.outcome, "Outcome");
  ensure(
    Array.isArray(input.inputs) &&
      input.inputs.length <= 100 &&
      (input.inputs.length > 0 ||
        (Array.isArray(input.relationshipInputs) && input.relationshipInputs.length > 0)),
    "validation",
    "Declare 1–100 inputs",
  );
  return input;
}

function inputIdentity(input: CapturedInput): string {
  return input.facet === undefined && input.role === undefined
    ? input.entityId
    : input.entityId +
        ":" +
        (input.facet ?? "default") +
        ":" +
        (input.role ?? "") +
        ":" +
        (input.observationId ?? input.revision ?? "current") +
        ":" +
        JSON.stringify(input.fields ?? []) +
        (input.referenceId === undefined ? "" : ":reference:" + input.referenceId);
}

/** Internal application composition boundary. No nested transaction or external IO. */
export async function captureReceipt(
  tx: Transaction,
  input: ReceiptInput,
  actor: Provenance,
  newId: () => string,
): Promise<Receipt> {
  const output = await entity(tx, input.outputId);
  ensure(
    input.expectedOutputVersion === undefined || input.expectedOutputVersion === output.version,
    "conflict",
    "Output changed before receipt capture",
  );
  const schema = (await tx.get("schema", "project")) as SchemaObject;
  const configuration = await receiptConfiguration(tx, input.configurationId);
  const relationshipInputs = await captureRelationships(
    tx,
    configurationRelationshipDeclarations(configuration, input.relationshipInputs),
  );
  const captured: CapturedInput[] = [];
  const seen = new Set<string>();
  for (const declaration of input.inputs) {
    const recorded = await captureDeclaredInput(
      tx,
      declaration,
      output,
      schema,
      configuration,
      relationshipInputs,
    );
    const identity = inputIdentity(recorded);
    ensure(!seen.has(identity), "validation", "Declare each input once");
    seen.add(identity);
    captured.push(recorded);
  }
  ensure(
    captured.length + relationshipInputs.length > 0 &&
      captured.length + relationshipInputs.length <= 100,
    "validation",
    "Declare at most 100 total inputs",
  );
  await validateSupersedes(tx, input.supersedes, output.id);
  const value: Receipt = {
    ...actor,
    id: newId(),
    at: new Date().toISOString(),
    output,
    schema,
    outcome: input.outcome,
    inputs: captured,
    ...(input.relationshipInputs === undefined ? {} : { relationshipInputs }),
    ...(configuration
      ? {
          configuration: {
            id: configuration.id,
            name: configuration.name,
            subject: configuration.subject,
          },
        }
      : {}),
    ...(input.supersedes ? { supersedes: input.supersedes } : {}),
  };
  await tx.appendEvidence("receipt", output.id, value);
  return value;
}
