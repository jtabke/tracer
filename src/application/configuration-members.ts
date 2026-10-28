import { ensure, record } from "../core/model.ts";
import type { ConfigurationInput } from "../core/configuration.ts";
import type { Transaction } from "./ports/repository.ts";
import { pinEntity } from "./native-pins.ts";

export async function configurationMembers(
  tx: Transaction,
  declarations: ConfigurationInput["members"],
  annotationsOnly = false,
) {
  const members = [],
    seen = new Set<string>();
  for (const member of declarations) {
    ensure(
      record(member) && Object.keys(member).every((key) => ["entityId", "version"].includes(key)),
      "validation",
      "Invalid configuration member",
    );
    ensure(!seen.has(member.entityId), "validation", "Declare each configuration member once");
    seen.add(member.entityId);
    members.push(await pinEntity(tx, member.entityId, member.version, annotationsOnly));
  }
  return members;
}
