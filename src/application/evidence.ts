import { ensure, json, record, validateProvenance as provenance } from "../core/model.ts";
import type { Entity, Relationship, SchemaObject, Provenance } from "../core/model.ts";
import type {
  ExternalIdentity,
  Locator,
  Observation,
  ObservedState,
  ReceiptInput,
  Receipt,
  CapturedInput,
  ReviewInput,
  Review,
  Comparison,
  EvidenceKind,
  EvidenceQuery,
} from "../core/evidence.ts";
import type { Repository, Transaction } from "../persistence/contracts.ts";
import { resolveReceiptInput } from "./receipt-inputs.ts";
import {
  compareCapturedInputs,
  comparisonToken,
  compareReceiptState,
} from "./receipt-comparison.ts";
import { snapshotInput } from "../core/input-snapshot.ts";

export type Observer = (locator: Locator) => Promise<ObservedState>;
const unavailable: Observer = async () => ({
  availability: "unknown",
  reason: "No local observer configured",
});
function text(value: unknown, label: string): asserts value is string {
  ensure(
    typeof value === "string" && value.trim() && json(value),
    "validation",
    label + " must be nonempty text",
  );
}
function locator(value: Locator) {
  ensure(record(value) && json(value), "validation", "Invalid locator");
  text(value.path, "Path");
  ensure(["git", "file"].includes(value.system), "validation", "Source must be git or file");
  if (value.system === "git") {
    text(value.repository, "Repository");
    text(value.ref, "Ref");
    ensure(
      !value.ref.startsWith("-") &&
        !value.path.startsWith("/") &&
        !value.path.split(/[\\/]/).includes(".."),
      "validation",
      "Git needs a safe repository-relative file path and ref",
    );
    return { system: value.system, repository: value.repository, path: value.path, ref: value.ref };
  }
  return { system: value.system, path: value.path };
}
async function entity(tx: Transaction, id: string) {
  text(id, "Entity ID");
  const value = (await tx.get("entity", id)) as Entity | undefined;
  ensure(value, "not_found", "Active entity not found: " + id);
  return value;
}
async function captureDeclaredInput(
  tx: Transaction,
  declaration: ReceiptInput["inputs"][number],
  output: Entity,
  schema: SchemaObject,
  configuration?: import("../core/configuration.ts").Configuration,
): Promise<CapturedInput> {
  const resolved = await resolveReceiptInput(tx, declaration, schema, configuration);
  const value = resolved.value;
  const observation = resolved.pin ? undefined : await captureObservation(tx, declaration, value);
  validateFieldScope(declaration, value, resolved.schema);
  const { path, links } = await captureDependencyPath(tx, declaration, output, value);
  return {
    entityId: value.id,
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
  return configuration;
}

async function captureObservation(
  tx: Transaction,
  declaration: ReceiptInput["inputs"][number],
  value: Entity,
) {
  const external = await tx.getEvidence("external", value.id);
  let observation: Observation | undefined;
  if (external) {
    text(declaration.observationId, "Explicit observation ID");
    observation = (await tx.getEvidence("observation", declaration.observationId)) as
      Observation | undefined;
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
  } else
    ensure(
      declaration.observationId === undefined,
      "validation",
      "Native inputs have no external observation",
    );
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
            typeof name === "string" && Object.hasOwn(schema.entityTypes[value.type].fields, name),
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
    const link = (await tx.get("relationship", id)) as Relationship | undefined;
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
    const previous = (await tx.getEvidence("receipt", supersedes)) as Receipt | undefined;
    ensure(
      previous && previous.output.id === outputId,
      "validation",
      "Superseded receipt must have the same output identity",
    );
  }
}

function validateEvidenceCursor(query: EvidenceQuery) {
  ensure(
    query.subject === undefined || typeof query.subject === "string",
    "validation",
    "Invalid evidence cursor or limit",
  );
  if (query.after !== undefined) validateSequenceCursor(query.after);
  const limit = query.limit ?? 100;
  ensure(
    Number.isSafeInteger(limit) && limit > 0 && limit <= 1000,
    "validation",
    "Invalid evidence cursor or limit",
  );
}
function validateSequenceCursor(after: string) {
  ensure(
    typeof after === "string" && /^\d+$/.test(after) && Number.isSafeInteger(Number(after)),
    "validation",
    "Invalid evidence cursor or limit",
  );
}

/** Provenance commands share the same repository transaction boundary as native editing. */
export class EvidenceService {
  private repository: Repository;
  private newId: () => string;
  private observeSource: Observer;
  constructor(repository: Repository, newId: () => string, observer: Observer = unavailable) {
    this.repository = repository;
    this.newId = newId;
    this.observeSource = observer;
  }
  bindExternal(
    input: { entityId: string; system: "git" | "file"; externalId: string; ownership: "external" },
    origin: Provenance,
  ) {
    const actor = provenance(origin).actor;
    input = snapshotInput(input);
    ensure(
      record(input) &&
        json(input) &&
        ["git", "file"].includes(input.system) &&
        input.ownership === "external",
      "validation",
      "External identity needs system and external ownership",
    );
    text(input.externalId, "Stable external ID");
    return this.repository.transaction(async (tx) => {
      await entity(tx, input.entityId);
      // Binding is immutable; native annotations remain independently editable.
      const value: ExternalIdentity = {
        id: input.entityId,
        system: input.system,
        externalId: input.externalId,
        ownership: "external",
        actor,
        at: new Date().toISOString(),
      };
      await tx.appendEvidence("external", input.entityId, value);
      return value;
    });
  }
  async observe(input: { entityId: string; locator: Locator }, origin: Provenance) {
    const actor = provenance(origin);
    input = snapshotInput(input);
    ensure(record(input), "validation", "Observation input is required");
    const location = locator(input.locator);
    // Resolve locally outside the database lock. Observation is a point-in-time fact, not a source mutation.
    await this.repository.transaction(async (tx) => {
      await entity(tx, input.entityId);
      const external = (await tx.getEvidence("external", input.entityId)) as
        ExternalIdentity | undefined;
      ensure(
        external && external.system === location.system,
        "validation",
        "Bind the matching external identity first",
      );
    });
    const state = snapshotInput(await this.observeSource(snapshotInput(location)));
    ensure(
      json(state) &&
        ["available", "unknown"].includes(state.availability) &&
        (state.availability !== "available" ||
          (typeof state.hash === "string" &&
            /^sha256:[0-9a-f]{64}$/.test(state.hash) &&
            (location.system !== "git" ||
              (typeof state.commit === "string" && /^[0-9a-f]{40,64}$/.test(state.commit))))),
      "validation",
      "Observer returned an unverifiable state",
    );
    const value: Observation = {
      ...state,
      ...actor,
      id: this.newId(),
      entityId: input.entityId,
      locator: location,
      at: new Date().toISOString(),
    };
    return this.repository.transaction(async (tx) => {
      await entity(tx, input.entityId);
      await tx.appendEvidence("observation", input.entityId, value);
      return value;
    });
  }
  recordReceipt(input: ReceiptInput, origin: Provenance) {
    const actor = provenance(origin);
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
            "supersedes",
            "configurationId",
          ].includes(key),
        ),
      "validation",
      "Invalid receipt input",
    );
    text(input.outcome, "Outcome");
    ensure(
      Array.isArray(input.inputs) && input.inputs.length > 0 && input.inputs.length <= 100,
      "validation",
      "Declare 1–100 inputs",
    );
    return this.repository.transaction(async (tx) => {
      const output = await entity(tx, input.outputId);
      ensure(
        input.expectedOutputVersion === undefined || input.expectedOutputVersion === output.version,
        "conflict",
        "Output changed before receipt capture",
      );
      const schema = (await tx.get("schema", "project")) as SchemaObject;
      const configuration = await receiptConfiguration(tx, input.configurationId);
      const captured: CapturedInput[] = [];
      const seen = new Set<string>();
      for (const declaration of input.inputs) {
        const recorded = await captureDeclaredInput(tx, declaration, output, schema, configuration);
        ensure(!seen.has(recorded.entityId), "validation", "Declare each input once");
        seen.add(recorded.entityId);
        captured.push(recorded);
      }
      await validateSupersedes(tx, input.supersedes, output.id);
      const value: Receipt = {
        ...actor,
        id: this.newId(),
        at: new Date().toISOString(),
        output,
        schema,
        outcome: input.outcome,
        inputs: captured,
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
    });
  }
  compareReceipt(id: string): Promise<Comparison> {
    text(id, "Receipt ID");
    return this.repository.transaction(async (tx) => {
      const receipt = (await tx.getEvidence("receipt", id)) as Receipt | undefined;
      ensure(receipt, "not_found", "Receipt not found");
      return this.comparison(tx, receipt);
    });
  }
  private async comparison(tx: Transaction, receipt: Receipt): Promise<Comparison> {
    const id = receipt.id;
    const comparison = await compareReceiptState(tx, receipt);
    const supersededBy = await tx.supersedingReceiptIds(id);
    return {
      ...comparison,
      supersededBy,
    };
  }
  async graphEvidence(tx: Transaction, ids: string[]) {
    const evaluations: import("./views.ts").Graph["evaluations"] = [];
    const external: import("./views.ts").Graph["external"] = [];
    for (const id of ids) {
      const page = await tx.evidence("receipt", { subject: id, limit: 50 });
      ensure(
        !page.nextAfter && evaluations.length + page.items.length <= 50,
        "validation",
        "Graph exceeds 50 evaluations; choose a smaller neighborhood",
      );
      for (const value of page.items as Receipt[])
        evaluations.push({ receipt: value, comparison: await this.comparison(tx, value) });
      const identity = (await tx.getEvidence("external", id)) as ExternalIdentity | undefined;
      if (identity)
        external.push({
          identity,
          observation:
            ((await tx.latestEvidence("observation", id)) as Observation | undefined) ?? null,
        });
    }
    ensure(
      evaluations.reduce((count, value) => count + value.receipt.inputs.length, 0) <= 200,
      "validation",
      "Graph exceeds 200 declared inputs; choose a smaller neighborhood",
    );
    return { evaluations, external };
  }
  review(input: ReviewInput, origin: Provenance) {
    const actor = provenance(origin);
    input = snapshotInput(input);
    ensure(
      record(input) &&
        json(input) &&
        ["accepted", "acknowledged", "needs_reevaluation"].includes(input.decision),
      "validation",
      "Invalid review decision",
    );
    text(input.receiptId, "Receipt ID");
    text(input.rationale, "Review rationale");
    text(input.expectedComparison, "Expected comparison");
    return this.repository.transaction(async (tx) => {
      const receipt = (await tx.getEvidence("receipt", input.receiptId)) as Receipt | undefined;
      ensure(receipt, "not_found", "Receipt not found");
      const comparison = await compareCapturedInputs(tx, receipt),
        token = comparisonToken(comparison);
      ensure(
        token === input.expectedComparison,
        "conflict",
        "Inputs changed since comparison; compare again before reviewing",
      );
      ensure(
        input.decision !== "accepted" || !comparison.hasUnknown,
        "validation",
        "Cannot accept unresolved unknown inputs; acknowledge or request reevaluation",
      );
      const value: Review = {
        ...actor,
        id: this.newId(),
        at: new Date().toISOString(),
        receiptId: receipt.id,
        decision: input.decision,
        rationale: input.rationale,
        comparison,
        token,
      };
      await tx.appendEvidence("review", receipt.id, value);
      return value;
    });
  }
  getReceipt(id: string): Promise<Receipt> {
    text(id, "Receipt ID");
    return this.repository.transaction(async (tx) => {
      const value = (await tx.getEvidence("receipt", id)) as Receipt | undefined;
      ensure(value, "not_found", "Receipt not found: " + id);
      return value;
    });
  }
  list(kind: EvidenceKind, query: EvidenceQuery = {}) {
    query = snapshotInput(query);
    ensure(
      ["external", "observation", "receipt", "review"].includes(kind) &&
        record(query) &&
        Object.keys(query).every((key) => ["subject", "after", "limit"].includes(key)),
      "validation",
      "Invalid evidence query",
    );
    validateEvidenceCursor(query);
    return this.repository.transaction((tx) => tx.evidence(kind, query));
  }
}
