import { useState } from "react";
import type { Entity } from "../../src/core/model.ts";
import type { SupportReference } from "../../src/core/change-assessment.ts";
import type { Editing } from "../editing.ts";
import { useProjection } from "../use-projection.ts";
import { label } from "../entity-label.ts";

export function SupportMaterialChoice({
  title,
  kind,
  entities,
  editing,
  selected,
  onChoose,
}: {
  title: string;
  kind: "receipt" | "observation" | "relationship";
  entities: Entity[];
  editing: Editing;
  selected: SupportReference | undefined;
  onChoose(value: SupportReference | undefined): void;
}) {
  const [after, setAfter] = useState<string>();
  const evidence = useProjection(
    "/api/evidence",
    kind === "receipt" || kind === "observation" ? { kind, limit: 25, after } : undefined,
    editing.epoch,
    editing.report,
  );
  const links = useProjection(
    "/api/relationships",
    kind === "relationship" ? { limit: 25, after } : undefined,
    editing.epoch,
    editing.report,
  );
  const items = kind === "relationship" ? links.retained : evidence.retained;
  const ready = kind === "relationship" ? links.ready : evidence.ready;
  function choose(id: string) {
    if (!id) {
      onChoose(undefined);
      return;
    }
    if (kind === "relationship") {
      const link = links.data?.items.find((item) => item.id === id);
      if (link) onChoose({ kind, id, version: link.version, mode: "historical" });
    } else onChoose({ kind, id, mode: "historical" });
  }
  return (
    <>
      <label>
        Selection
        <select
          disabled={!ready}
          aria-label={`${title} selection`}
          value={selected?.id ?? ""}
          onChange={(e) => choose(e.target.value)}
        >
          <option value="">Choose recorded material</option>
          {items?.items.map((item) => (
            <option key={item.id} value={item.id}>
              {materialName(item, entities)}
            </option>
          ))}
        </select>
      </label>
      {(evidence.loading || links.loading) && <p role="status">Reading recorded material…</p>}
      {(evidence.failed || links.failed) && (
        <p role="alert">Supporting material could not be read. No selection is inferred.</p>
      )}
      <MaterialPaging
        next={items?.nextAfter}
        after={after}
        onPage={(cursor) => {
          setAfter(cursor);
          onChoose(undefined);
        }}
      />
      <small>
        Up to 25 choices per page. Additional material is available through explicit paging.
      </small>
    </>
  );
}
function materialName(item: { id: string }, entities: Entity[]) {
  if ("output" in item) {
    const receipt = item as import("../../src/core/evidence.ts").Receipt;
    return `${label(receipt.output)} · ${receipt.outcome.slice(0, 90)} · ${receipt.at}`;
  }
  if ("entityId" in item) {
    const observation = item as import("../../src/core/evidence.ts").Observation;
    return `${entities.find((entity) => entity.id === observation.entityId)?.resource?.label ?? observation.entityId.slice(0, 8)} · ${observation.availability} · ${observation.at}`;
  }
  const link = item as import("../../src/core/model.ts").Relationship;
  return `${entities.find((entity) => entity.id === link.source)?.key ?? link.source.slice(0, 8)} → ${link.type} → ${entities.find((entity) => entity.id === link.target)?.key ?? link.target.slice(0, 8)} · v${link.version}`;
}

function MaterialPaging({
  next,
  after,
  onPage,
}: {
  next: string | undefined;
  after: string | undefined;
  onPage(cursor: string | undefined): void;
}) {
  return (
    <>
      {next && (
        <button type="button" onClick={() => onPage(next)}>
          More supporting material
        </button>
      )}
      {after && (
        <button type="button" onClick={() => onPage(undefined)}>
          First supporting material
        </button>
      )}
    </>
  );
}
