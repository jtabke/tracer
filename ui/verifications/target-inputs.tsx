import { useState } from "react";
import type { Configuration } from "../../src/core/configuration.ts";
import type { VerificationTargetPolicy } from "../../src/core/verification-case.ts";
import { targetSupportProposal, type TargetInputDraft } from "./target-input-draft.ts";
import type { VerificationSupportDraft } from "./common.ts";
import type { Editing } from "../editing.ts";
import { RecordChoice } from "../application-choices.tsx";
import { useProjection } from "../use-projection.ts";
import { label } from "../entity-label.ts";

export function TargetVerificationInputs({
  target,
  policy,
  editing,
  value,
  onChange,
}: {
  target: Configuration;
  policy: VerificationTargetPolicy;
  editing: Editing;
  value: VerificationSupportDraft;
  onChange(value: VerificationSupportDraft): void;
}) {
  const [draft, setDraft] = useState<TargetInputDraft>({
    kind: "native",
    entityId: "",
    referenceId: "",
    fields: [] as string[],
    role: "",
    relationshipId: "",
  });
  const update = (patch: Partial<typeof draft>) =>
    setDraft((previous) => ({ ...previous, ...patch }));
  const { entity, reference, version, historic, selectedEntity, observationId, ready } =
    useSelectedTargetInput(target, draft, editing);
  const count = value.inputs.length + value.relationshipInputs.length;
  const references = (target.relationships ?? [])
    .map((x) => x.relationship)
    .filter((x) => x.target === draft.entityId && x.reference);
  const proposal = targetSupportProposal(
    draft,
    { entity, version, observationId, reference, ready },
    target,
    value,
  );
  function add() {
    if (!proposal) return;
    onChange(proposal);
    update({ entityId: "", referenceId: "", fields: [], role: "", relationshipId: "" });
  }
  return (
    <details>
      <summary>Supporting inputs · {count}</summary>
      <p>
        Inputs are selected from {target.name}. Native annotations, observed content and each
        contextual use remain separate. Governing inputs and owned activity membership are captured
        automatically.
      </p>
      <SelectedTargetInputs value={value} target={target} onChange={onChange} />
      <label>
        Supporting input kind
        <select
          aria-label="Supporting input kind"
          value={draft.kind}
          onChange={(e) =>
            update({
              kind: e.target.value as TargetInputDraft["kind"],
              entityId: "",
              referenceId: "",
              fields: [],
            })
          }
        >
          <option value="native">Native record annotations</option>
          <option value="content">Selected observed content</option>
          <option value="relationship">Selected direct connection</option>
        </select>
      </label>
      {draft.kind === "relationship" ? (
        <label>
          Selected connection
          <select
            aria-label="Selected target connection"
            value={draft.relationshipId}
            onChange={(e) => update({ relationshipId: e.target.value })}
          >
            <option value="">Choose exact selected relationship</option>
            {target.relationships?.map((x) => (
              <option key={x.relationship.id} value={x.relationship.id}>
                {x.relationship.type} · v{x.relationship.version} · {x.relationship.id}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <RecordChoice
            name="Supporting record"
            entities={target.members.map((x) => x.entity)}
            value={draft.entityId}
            onChange={(entityId) => update({ entityId, referenceId: "", fields: [] })}
          />
          {policy === "target-reference-uses-v2" && references.length > 0 && (
            <label>
              Contextual use
              <select
                aria-label="Supporting contextual reference"
                value={draft.referenceId}
                onChange={(e) => update({ referenceId: e.target.value, fields: [] })}
              >
                <option value="">Resource default selected in configuration</option>
                {references.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.reference!.role} · {JSON.stringify(x.reference!.state)} · {x.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          {reference?.reference && (
            <p>
              {reference.reference.explanation} · selector{" "}
              {JSON.stringify(reference.reference.selector ?? "whole resource")}. Passage relevance
              is not established by this selection.
            </p>
          )}
          {historic.failed && (
            <p role="alert">
              The exact referenced native state could not be read. Adding this input is paused.
            </p>
          )}
          {draft.kind === "content" ? (
            <p>
              {observationId
                ? `Exact selected observation ${observationId}`
                : "No observed content state is selected for this use."}{" "}
              This is a content dependency, not a passing result.
            </p>
          ) : (
            selectedEntity && (
              <TargetNativeFields
                entity={selectedEntity}
                version={version}
                fields={draft.fields}
                onChange={(fields) => update({ fields })}
              />
            )
          )}
        </>
      )}
      <label>
        Supporting input purpose
        <input
          aria-label="Supporting input purpose"
          value={draft.role}
          onChange={(e) => update({ role: e.target.value })}
        />
      </label>
      <button type="button" disabled={!proposal} onClick={add}>
        Add supporting input
      </button>
    </details>
  );
}
function SelectedTargetInputs({
  value,
  target,
  onChange,
}: {
  value: VerificationSupportDraft;
  target: Configuration;
  onChange(value: VerificationSupportDraft): void;
}) {
  const name = (id: string) => {
    const entity = target.members.find((x) => x.entity.id === id)?.entity;
    return entity ? label(entity) : id;
  };
  return (
    <ol>
      {value.inputs.map((x, i) => (
        <li key={i}>
          {name(x.entityId)} · {x.facet} · {x.revision ? `v${x.revision}` : x.observationId} ·
          reference {x.referenceId ?? "resource default"} · {x.role}
          <button
            type="button"
            onClick={() => onChange({ ...value, inputs: value.inputs.filter((_, n) => n !== i) })}
          >
            Remove supporting input {i + 1}
          </button>
        </li>
      ))}
      {value.relationshipInputs.map((x, i) => (
        <li key={`link-${i}`}>
          Connection {x.id} · v{x.revision} · {x.role}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                relationshipInputs: value.relationshipInputs.filter((_, n) => n !== i),
              })
            }
          >
            Remove supporting connection {i + 1}
          </button>
        </li>
      ))}
    </ol>
  );
}

function useSelectedTargetInput(target: Configuration, draft: TargetInputDraft, editing: Editing) {
  const { entity, reference, version, observationId } = selectedTargetMaterial(target, draft);
  const historic = useProjection(
    "/api/native-pin",
    entity && version && version !== entity.version
      ? { id: entity.id, version, facet: "annotations" }
      : undefined,
    editing.epoch,
    editing.report,
  );
  const selectedEntity = version === entity?.version ? entity : historic.retained?.entity;
  const ready = version === entity?.version || historic.ready;
  return { entity, reference, version, historic, selectedEntity, observationId, ready };
}

function TargetNativeFields({
  entity,
  version,
  fields,
  onChange,
}: {
  entity: Configuration["members"][number]["entity"];
  version: number | undefined;
  fields: string[];
  onChange(fields: string[]): void;
}) {
  return (
    <fieldset>
      <legend>Native field scope · v{version}</legend>
      {Object.keys(entity.fields).map((name) => (
        <label key={name}>
          <input
            type="checkbox"
            aria-label={`Supporting field ${name}`}
            checked={fields.includes(name)}
            onChange={(e) =>
              onChange(e.target.checked ? [...fields, name] : fields.filter((x) => x !== name))
            }
          />
          {name}
        </label>
      ))}
    </fieldset>
  );
}

function selectedTargetMaterial(target: Configuration, draft: TargetInputDraft) {
  const entity = target.members.find((x) => x.entity.id === draft.entityId)?.entity;
  const reference = target.relationships?.find(
    (x) => x.relationship.id === draft.referenceId,
  )?.relationship;
  const state = reference?.reference?.state;
  const version =
    state?.mode === "pinned" && "revision" in state ? state.revision : entity?.version;
  const observation = target.capture?.content.find((x) => x.entityId === entity?.id)?.observation;
  const observationId =
    state?.mode === "pinned" && "observationId" in state ? state.observationId : observation?.id;
  return { entity, reference, version, observationId };
}
