import { ensure } from "../core/model.ts";
import type { Entity, Relationship, Page } from "../core/model.ts";
import { serializeProjectExport, type ProjectExport } from "../core/project-export.ts";
import type { Repository, Transaction } from "./ports/repository.ts";

const pageSize = 200;
const itemLimit = 250_000;
const byteLimit = 64 * 1024 * 1024;
const limitMessage =
  "Project export exceeds 250,000 entries or 64 MiB; no partial export was produced. Use a database backup for this project.";

/** Independent of viewport bounds: every collection is exhausted within one transaction. */
export function projectExport(repository: Repository): Promise<ProjectExport> {
  return repository.transaction(async (tx) => {
    const collect = exportCollector();
    const value: ProjectExport = {
      format: "tracer-project-export",
      formatVersion: 1,
      scope: {
        nativeHistory: "all-recorded",
        evidence: "all-recorded",
        externalContent: "references-only",
      },
      projectRevision: await tx.headRevision(),
      evidenceRevision: await tx.impactEvidenceRevision(),
      current: {
        schema: (await tx.get("schema", "project")) ?? null,
        entities: (await collect((after) =>
          tx.query("entity", { after, limit: pageSize }),
        )) as Entity[],
        relationships: (await collect((after) =>
          tx.query("relationship", { after, limit: pageSize }),
        )) as Relationship[],
      },
      provenance: {
        changesets: await collect((after) => changesetPage(tx, after)),
        revisions: await collect((after) => tx.history({ after, limit: pageSize })),
      },
      evidence: {
        external: await collect((after) => tx.evidence("external", { after, limit: pageSize })),
        observations: await collect((after) =>
          tx.evidence("observation", { after, limit: pageSize }),
        ),
        receipts: await collect((after) => tx.evidence("receipt", { after, limit: pageSize })),
        reviews: await collect((after) => tx.evidence("review", { after, limit: pageSize })),
      },
      configurations: await collect((after) => tx.configurations({ after, limit: pageSize })),
      baselines: await collect((after) => tx.baselines({ after, limit: pageSize })),
      savedViews: await collect(async () => ({ items: await tx.listViews() })),
    };
    ensure(
      value.savedViews.length <= 50,
      "validation",
      "Project export cannot include more than 50 saved views; no partial export was produced",
    );
    ensure(
      new TextEncoder().encode(serializeProjectExport(value)).length <= byteLimit,
      "validation",
      limitMessage,
    );
    return value;
  });
}

function exportCollector() {
  let entries = 0,
    bytes = 0;
  return async <T>(read: (after?: string) => Promise<Page<T>>): Promise<T[]> => {
    const items: T[] = [];
    let after: string | undefined;
    do {
      const page = await read(after);
      entries += page.items.length;
      ensure(entries <= itemLimit, "validation", limitMessage);
      bytes += new TextEncoder().encode(JSON.stringify(page.items)).length - 2;
      ensure(bytes <= byteLimit, "validation", limitMessage);
      items.push(...page.items);
      after = page.nextAfter;
    } while (after !== undefined);
    return items;
  };
}

async function changesetPage(tx: Transaction, after?: string) {
  const items = await tx.changesets(Number(after ?? 0), pageSize);
  return {
    items,
    ...(items.length === pageSize ? { nextAfter: String(items.at(-1)!.projectRevision) } : {}),
  };
}
