import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, renameSync, openSync, closeSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync, backup } from "node:sqlite";
import { Tracer, serializeProjectExport } from "../../src/index.ts";
import { SQLiteRepository } from "../../src/persistence/sqlite.ts";

const directory = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let database = join(directory, "tracer.sqlite");
if (args[0] === "--db") {
  args.shift();
  const value = args.shift();
  if (!value) throw new Error("--db requires a path");
  database = resolve(value);
}
const command = args.shift();
const help =
  "node projects/tracer/project.mjs [--db PATH] init|status|show KEY|export|backup NEW_PATH";
if (!command || command === "--help") {
  console.log(help);
} else {
  if (!["init", "status", "show", "export", "backup"].includes(command)) throw new Error(help);
  const needsArgument = command === "show" || command === "backup";
  if (args.length !== (needsArgument ? 1 : 0)) throw new Error(help);
  if (command === "init") {
    // Exclusive creation: even an empty existing project belongs to its owner.
    closeSync(openSync(database, "wx"));
  } else if (!existsSync(database)) {
    throw new Error(
      `Database does not exist: ${database}. Restore a backup; init creates only the original baseline.`,
    );
  }
  if (command === "backup") {
    const destination = resolve(args[0]);
    closeSync(openSync(destination, "wx"));
    const source = new DatabaseSync(database, { readOnly: true });
    try {
      await backup(source, destination);
      console.log(`SQLite backup saved: ${destination}`);
    } finally {
      source.close();
    }
  } else {
    const repository = new SQLiteRepository(database);
    try {
      const tracer = new Tracer(repository);
      if (command === "init") {
        const data = JSON.parse(readFileSync(join(directory, "bootstrap.json"), "utf8"));
        const provenance = {
          actor: "tracer-development-bootstrap",
          reason: `Owner-selected headless product register; documentation baseline ${data.capturedAt}, commit ${data.sourceCommit}, including uncommitted source snapshots. No fresh product verification asserted.`,
        };
        const ids = new Map(data.entities.map((entity) => [entity.key, randomUUID()]));
        if (ids.size !== data.entities.length) throw new Error("Duplicate bootstrap keys");
        const operations = data.entities.map((input) => ({
          op: "entity.create",
          id: ids.get(input.key),
          input,
        }));
        for (const relationship of data.relationships) {
          const source = ids.get(relationship.source);
          const target = ids.get(relationship.target);
          if (!source || !target) throw new Error("Unresolved bootstrap relationship");
          operations.push({
            op: "relationship.create",
            input: { ...relationship, source, target },
            expectedEndpoints: { sourceVersion: 1, targetVersion: 1 },
            rejectExisting: true,
          });
        }
        const schema = await tracer.setSchema({
          schema: data.schema,
          expectedVersion: 0,
          provenance,
        });
        await tracer.applyChangeset({
          expectedSchemaVersion: schema.version,
          operations,
          provenance,
        });
        console.log(
          `Created ${database}: ${ids.size} records, ${data.relationships.length} links. Never rerun init to update an existing project.`,
        );
      } else if (command === "export") {
        const destination = join(directory, "project-export.json");
        if (resolve(database) !== join(directory, "tracer.sqlite")) {
          throw new Error(
            "Export the canonical database here. For another database use the standard project export CLI.",
          );
        }
        const content = serializeProjectExport(await tracer.exportProject());
        const temporary = `${destination}.${randomUUID()}.tmp`;
        writeFileSync(temporary, content, { flag: "wx" });
        renameSync(temporary, destination);
        console.log(
          `Exported ${destination}. This is a review snapshot, not a restorable database backup.`,
        );
      } else {
        const snapshot = await tracer.getProjectSnapshot();
        const entities = snapshot.entities.toSorted((a, b) =>
          (a.key ?? a.id).localeCompare(b.key ?? b.id),
        );
        const byId = new Map(entities.map((entity) => [entity.id, entity]));
        if (command === "show") {
          const entity = entities.find((item) => item.key === args[0]);
          if (!entity) throw new Error(`Unknown key: ${args[0]}`);
          const links = snapshot.relationships.filter(
            (item) => item.source === entity.id || item.target === entity.id,
          );
          console.log(
            JSON.stringify(
              {
                projectRevision: snapshot.projectRevision,
                schemaVersion: snapshot.schema?.version,
                entity,
                relationships: links.map((item) => ({
                  ...item,
                  sourceKey: byId.get(item.source)?.key,
                  targetKey: byId.get(item.target)?.key,
                })),
              },
              null,
              2,
            ),
          );
        } else {
          console.log(
            `Tracer development register: ${database}\nNative revision ${snapshot.projectRevision}; schema ${snapshot.schema?.version}; ${entities.length} records, ${snapshot.relationships.length} links.\nDelivery, verification and user validation are separate; read each scope before calling it done.\n`,
          );
          const requirements = entities.filter((item) => item.type === "requirement");
          const legacy = requirements.filter((item) => item.fields.lifecycle === "superseded");
          if (legacy.length)
            console.log(
              `${legacy.length} historical requirement summaries retained; use show KEY to inspect their replacements.\n`,
            );
          for (const entity of requirements.filter(
            (item) => item.fields.lifecycle !== "superseded",
          )) {
            const fields = entity.fields;
            const needs = snapshot.relationships
              .filter((item) => item.type === "addresses" && item.source === entity.id)
              .map((item) => byId.get(item.target)?.key)
              .sort();
            console.log(
              `${entity.key} ${fields.title}\n  ${fields.deliveryStatus} | ${fields.verificationStatus} | ${fields.validationStatus} | ${fields.selection} | ${needs.join(", ")}\n  Remaining: ${fields.remaining}`,
            );
          }
          const components = entities.filter((item) => item.type === "component");
          if (components.length)
            console.log("\nSystem components (allocation does not establish conformance):");
          for (const entity of components) {
            const parent = snapshot.relationships.find(
              (item) => item.type === "part_of" && item.source === entity.id,
            );
            console.log(
              `${entity.key} ${entity.fields.title}${parent ? ` — part of ${byId.get(parent.target)?.key}` : " — system root"}`,
            );
          }
          console.log(
            "\nWork selection (next/later recommendations are not implementation authorization):",
          );
          for (const horizon of ["now", "next", "later"]) {
            for (const entity of entities.filter(
              (item) => item.type === "work_item" && item.fields.horizon === horizon,
            )) {
              console.log(
                `${horizon}: ${entity.key} ${entity.fields.title} [${entity.fields.deliveryStatus}; ${entity.fields.selection}]\n  ${entity.fields.nextAction}`,
              );
            }
          }
        }
      }
    } finally {
      repository.close();
    }
  }
}
