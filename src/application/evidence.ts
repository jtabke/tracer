import { prepareReceipt, captureReceipt } from "./receipt-capture.ts";
import { evidenceText as text, evidenceEntity as entity } from "./evidence-validation.ts";
import { ensure, json, record, validateProvenance as provenance } from "../core/model.ts";
import type { Provenance } from "../core/model.ts";
import type {
  ExternalIdentity,
  Locator,
  Observation,
  ObservedState,
  ReceiptInput,
  Receipt,
  ReviewInput,
  Comparison,
  EvidenceKind,
  EvidenceQuery,
} from "../core/evidence.ts";
import type { Repository, Transaction } from "./ports/repository.ts";
import { compareCapturedInputs, compareReceiptState } from "./receipt-comparison.ts";
import { snapshotInput } from "../core/input-snapshot.ts";
import { prepareReview, captureReview } from "./review-capture.ts";

export type Observer = (locator: Locator) => Promise<ObservedState>;
const unavailable: Observer = async () => ({
  availability: "unknown",
  reason: "No local observer configured",
});
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
      const resource = await entity(tx, input.entityId);
      const previous = await tx.findResource({
        system: input.system,
        externalId: input.externalId,
      });
      ensure(
        !previous || previous.id === resource.id,
        "conflict",
        "External identity already belongs to another resource",
      );
      ensure(
        !resource.resource ||
          (resource.resource.source?.system === input.system &&
            resource.resource.source.externalId === input.externalId),
        "conflict",
        "Binding differs from immutable resource identity",
      );
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
      const resource = await entity(tx, input.entityId);
      const external =
        (await tx.getEvidence("external", input.entityId)) ?? resource.resource?.source;
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
    const prepared = prepareReceipt(input);
    return this.repository.transaction((tx) => captureReceipt(tx, prepared, actor, this.newId));
  }
  compareReceipt(id: string): Promise<Comparison> {
    text(id, "Receipt ID");
    return this.repository.transaction(async (tx) => {
      const receipt = await tx.getEvidence("receipt", id);
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
      for (const value of page.items)
        evaluations.push({ receipt: value, comparison: await this.comparison(tx, value) });
      const identity = await tx.getEvidence("external", id);
      if (identity)
        external.push({
          identity,
          observation: (await tx.latestEvidence("observation", id)) ?? null,
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
    input = prepareReview(input);
    return this.repository.transaction(async (tx) => {
      const receipt = await tx.getEvidence("receipt", input.receiptId);
      ensure(receipt, "not_found", "Receipt not found");
      const comparison = await compareCapturedInputs(tx, receipt);
      return captureReview(tx, input, comparison, actor, this.newId);
    });
  }
  getReceipt(id: string): Promise<Receipt> {
    text(id, "Receipt ID");
    return this.repository.transaction(async (tx) => {
      const value = await tx.getEvidence("receipt", id);
      ensure(value, "not_found", "Receipt not found: " + id);
      return value;
    });
  }
  list<K extends EvidenceKind>(kind: K, query: EvidenceQuery = {}) {
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
