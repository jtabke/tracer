import { snapshotInput } from "../core/input-snapshot.ts";
import { ensure, json, record, validateProvenance } from "../core/model.ts";
import type { Entity } from "../core/model.ts";
import type { Configuration, ConfigurationInput } from "../core/configuration.ts";
import type { EvidenceQuery } from "../core/evidence.ts";
import type { Repository } from "./ports/repository.ts";
import type { Provenance } from "../core/model.ts";
import { pinEntity } from "./native-pins.ts";
import { captureRelationships } from "./configuration-relationships.ts";

function validateCapture(input: ConfigurationInput) {
  ensure(
    record(input) &&
      json(input) &&
      Object.keys(input).every((key) =>
        ["name", "subjectId", "expectedSubjectVersion", "members", "relationships"].includes(key),
      ),
    "validation",
    "Invalid configuration capture",
  );
  ensure(
    typeof input.name === "string" &&
      input.name.trim().length > 0 &&
      input.name.trim().length <= 80,
    "validation",
    "Configuration name must contain 1–80 characters",
  );
  ensure(
    typeof input.subjectId === "string" &&
      Number.isSafeInteger(input.expectedSubjectVersion) &&
      input.expectedSubjectVersion > 0,
    "validation",
    "Configuration needs a captured subject version",
  );
  ensure(
    Array.isArray(input.members) && input.members.length > 0 && input.members.length <= 100,
    "validation",
    "Configuration needs 1–100 native members",
  );
}
function validateConfigurationQuery(query: EvidenceQuery) {
  ensure(
    record(query) && Object.keys(query).every((key) => ["subject", "after", "limit"].includes(key)),
    "validation",
    "Invalid configuration query",
  );
  ensure(
    query.subject === undefined || typeof query.subject === "string",
    "validation",
    "Invalid configuration subject",
  );
  validateCursor(query.after);
  const limit = query.limit ?? 25;
  ensure(
    Number.isSafeInteger(limit) && limit > 0 && limit <= 100,
    "validation",
    "Configuration page limit must be 1–100",
  );
}
function validateCursor(after: string | undefined) {
  ensure(
    after === undefined ||
      (typeof after === "string" && /^\d+$/.test(after) && Number.isSafeInteger(Number(after))),
    "validation",
    "Invalid configuration cursor",
  );
}

export class Configurations {
  private repository: Repository;
  private newId: () => string;
  constructor(repository: Repository, newId: () => string) {
    this.repository = repository;
    this.newId = newId;
  }
  async capture(input: ConfigurationInput, origin: Provenance): Promise<Configuration> {
    const actor = validateProvenance(origin);
    input = snapshotInput(input);
    validateCapture(input);
    return this.repository.transaction(async (tx) => {
      const subject = (await tx.get("entity", input.subjectId)) as Entity | undefined;
      ensure(subject, "not_found", "Configuration subject is no longer active");
      ensure(
        subject.version === input.expectedSubjectVersion,
        "conflict",
        "Configuration subject changed before capture",
      );
      const members = [];
      const seen = new Set<string>();
      for (const member of input.members) {
        ensure(
          record(member) &&
            Object.keys(member).every((key) => ["entityId", "version"].includes(key)),
          "validation",
          "Invalid configuration member",
        );
        ensure(!seen.has(member.entityId), "validation", "Declare each configuration member once");
        seen.add(member.entityId);
        members.push(await pinEntity(tx, member.entityId, member.version));
      }
      const value: Configuration = {
        ...actor,
        id: this.newId(),
        at: new Date().toISOString(),
        name: input.name.trim(),
        subject,
        members,
        ...(input.relationships === undefined
          ? {}
          : {
              relationships: await captureRelationships(tx, input.relationships, members),
            }),
      };
      await tx.appendConfiguration(value);
      return value;
    });
  }
  async get(id: string): Promise<Configuration> {
    ensure(typeof id === "string" && id.length > 0, "validation", "Configuration ID is required");
    return this.repository.transaction(async (tx) => {
      const value = await tx.getConfiguration(id);
      ensure(value, "not_found", "Configuration not found");
      return value;
    });
  }
  async list(query: EvidenceQuery = {}) {
    query = snapshotInput(query);
    validateConfigurationQuery(query);
    return this.repository.transaction((tx) => tx.configurations(query));
  }
}
