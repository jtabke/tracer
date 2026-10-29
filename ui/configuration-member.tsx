import { useState } from "react";
import type { Entity } from "../src/core/model.ts";

import { RecordChoice, useApplicationDirty } from "./application-choices.tsx";
import { NativeRevisionSelect } from "./native-revision-select.tsx";
import { useProjection } from "./use-projection.ts";
import { usePageCursor } from "./use-page-cursor.ts";

export type CaptureMemberDraft = {
  key: string;
  entityId: string;
  version: number | undefined;
  content: "none" | "unknown" | "observation";
  observationId: string;
  reason: string;
};
export function ConfigurationMember({
  value,
  index,
  entities,
  epoch,
  report,
  onChange,
  onReady,
  remove,
  canRemove,
}: {
  value: CaptureMemberDraft;
  index: number;
  entities: Entity[];
  epoch: number;
  report(error: unknown): void;
  onChange(value: Partial<CaptureMemberDraft>): void;
  onReady(value: boolean): void;
  remove(): void;
  canRemove: boolean;
}) {
  const { entity, pin, external, required, setObservationReady } = useMemberState(
    value,
    entities,
    epoch,
    report,
    onReady,
  );
  return (
    <fieldset aria-label={`Configuration member ${index + 1}`}>
      <legend>Configuration member {index + 1}</legend>
      <RecordChoice
        name="Member entity"
        entities={entities}
        value={value.entityId}
        onChange={(id) => {
          const selected = entities.find((x) => x.id === id);
          onChange({
            entityId: id,
            version: selected?.version,
            content: selected?.resource?.source ? "unknown" : "none",
            observationId: "",
            reason: "",
          });
        }}
      />
      <NativeRevisionSelect
        entity={entity ?? pin.retained?.entity}
        value={value.version}
        allowCurrent={false}
        epoch={epoch}
        onChange={(version) => onChange({ version })}
      />
      {(pin.failed || external.failed) && (
        <p role="alert">
          This member's selected state could not be read. Capture is paused until a successful
          refresh.
        </p>
      )}
      {pin.retained && (
        <p>
          Exact native v{pin.retained.entity.version} ·{" "}
          {String(
            pin.retained.entity.fields.title ??
              pin.retained.entity.resource?.label ??
              pin.retained.entity.type,
          )}
        </p>
      )}
      <label>
        Content selection
        <select
          aria-label="Content selection"
          value={value.content}
          onChange={(e) =>
            onChange({
              content: e.target.value as CaptureMemberDraft["content"],
              observationId: "",
            })
          }
        >
          <option value="none">
            {required
              ? "External member — select observed or unknown content"
              : "Native state only; no content declaration"}
          </option>
          <option value="unknown">Explicitly unknown or unselected content</option>
          <option value="observation">Select a recorded observation</option>
        </select>
      </label>
      {value.content === "unknown" && (
        <label>
          Unknown content reason
          <textarea
            aria-label="Unknown content reason"
            maxLength={4000}
            value={value.reason}
            onChange={(e) => onChange({ reason: e.target.value })}
          />
        </label>
      )}
      {value.content === "observation" && (
        <CaptureObservation
          key={value.entityId}
          entityId={value.entityId}
          value={value.observationId}
          epoch={epoch}
          report={report}
          onChange={(id) => onChange({ observationId: id })}
          onReady={setObservationReady}
        />
      )}
      <button disabled={!canRemove} onClick={remove}>
        Remove member {index + 1}
      </button>
    </fieldset>
  );
}

function CaptureObservation({
  entityId,
  value,
  epoch,
  report,
  onChange,
  onReady,
}: {
  entityId: string;
  value: string;
  epoch: number;
  report(error: unknown): void;
  onChange(id: string): void;
  onReady(value: boolean): void;
}) {
  const cursor = usePageCursor();
  const [selected, setSelected] = useState<{ id: string; description: string }>();
  const observations = useProjection(
    "/api/evidence",
    entityId
      ? { kind: "observation", subject: entityId, limit: 25, after: cursor.after }
      : undefined,
    epoch,
    report,
  );
  useApplicationDirty(observations.ready && Boolean(value), onReady);
  return (
    <section aria-label="Recorded content observations">
      <label>
        Recorded observation
        <select
          aria-label="Recorded observation"
          value={value}
          onChange={(e) => {
            const observation = observations.data?.items.find((x) => x.id === e.target.value);
            if (observation)
              setSelected({
                id: observation.id,
                description: `${observation.availability} · ${observation.hash ?? "no hash"}`,
              });
            onChange(e.target.value);
          }}
        >
          <option value="">Choose exact recorded content</option>
          {value && !observations.retained?.items.some((x) => x.id === value) && (
            <option value={value}>{selected?.description ?? value} · retained selection</option>
          )}
          {observations.retained?.items.map((x) => (
            <option key={x.id} value={x.id}>
              {x.at} · {x.availability} · {x.hash ?? "no hash"}
            </option>
          ))}
        </select>
      </label>
      {observations.failed && (
        <p role="alert">Recorded observations could not be read. Capture is paused.</p>
      )}
      <p>These are existing observations. Selecting one does not fetch or retain external bytes.</p>
      <button disabled={!observations.ready || !cursor.hasPrevious} onClick={cursor.previous}>
        Previous observations
      </button>
      <button
        disabled={!observations.ready || !observations.data?.nextAfter}
        onClick={() => cursor.next(observations.data?.nextAfter)}
      >
        Next observations
      </button>
    </section>
  );
}

function useMemberState(
  value: CaptureMemberDraft,
  entities: Entity[],
  epoch: number,
  report: (error: unknown) => void,
  onReady: (value: boolean) => void,
) {
  const [observationReady, setObservationReady] = useState(false);
  const entity = entities.find((x) => x.id === value.entityId);
  const pin = useProjection(
    "/api/native-pin",
    value.entityId && value.version
      ? { id: value.entityId, version: value.version, facet: "annotations" }
      : undefined,
    epoch,
    report,
  );
  const external = useProjection(
    "/api/evidence",
    value.entityId ? { kind: "external", subject: value.entityId, limit: 1 } : undefined,
    epoch,
    report,
  );
  const required = Boolean(
    pin.retained?.entity.resource?.source || external.retained?.items.length,
  );
  const contentReady =
    value.content === "none"
      ? !required
      : value.content === "unknown"
        ? Boolean(value.reason.trim())
        : Boolean(value.observationId);
  useApplicationDirty(
    pin.ready &&
      external.ready &&
      contentReady &&
      (value.content !== "observation" || observationReady),
    onReady,
  );
  return { entity, pin, external, required, setObservationReady };
}
