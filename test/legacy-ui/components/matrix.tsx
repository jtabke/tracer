import { useEffect, useState } from "react";
import type { Operation } from "../../../src/application/commands.ts";
import type { MatrixQuery } from "../../../src/application/views.ts";
import type { Entity, SchemaObject } from "../../../src/core/model.ts";
import type { Editing, Focus } from "../../../ui/editing.ts";
import { label } from "../../../ui/fields.tsx";
import { useProjection } from "../../../ui/use-projection.ts";

function AxisHeading({ entity, onFocus }: { entity: Entity; onFocus?: (entity: Focus) => void }) {
  return (
    <>
      {onFocus ? (
        <button
          className="axis-focus"
          aria-label={`Focus ${label(entity)}`}
          onClick={() => onFocus({ id: entity.id, type: entity.type })}
        >
          {label(entity)}
        </button>
      ) : (
        label(entity)
      )}
      {entity.key && typeof entity.fields.title === "string" && (
        <small>{entity.fields.title}</small>
      )}
    </>
  );
}
export function MatrixView({
  schema,
  editing,
  sharedFocus,
  onFocus,
}: {
  schema: SchemaObject;
  editing: Editing;
  sharedFocus?: Focus;
  onFocus?: (entity: Focus) => void;
}) {
  const { types, relationships, initialQuery, query, setQuery, definition, compatible } =
    useMatrixQuery(schema, sharedFocus);
  const {
    relationshipType,
    sourceType,
    targetType,
    sourceAfter,
    targetAfter,
    sourceFocus,
    targetFocus,
  } = query;
  const [attributes, setAttributes] = useState("{}");
  const { data: matrix, loading } = useProjection(
    "/api/matrix",
    sourceType && targetType && relationshipType ? query : undefined,
    editing.epoch,
    editing.report,
  );
  const busy = editing.busy || loading;
  const toggle = async (source: string, target: string) => {
    const links = matrix!.links.filter((link) => link.source === source && link.target === target);
    try {
      const operations: Operation[] = links.length
        ? links.map((link) => ({
            op: "relationship.remove",
            id: link.id,
            expectedVersion: link.version,
          }))
        : [
            {
              op: "relationship.create",
              input: { type: relationshipType, source, target, fields: JSON.parse(attributes) },
            },
          ];
      await editing.commit(operations, matrix!.schema.version);
    } catch (error) {
      editing.report(error, { attributes });
    }
  };
  function renderQueryControls() {
    return (
      <>
        <div className="toolbar">
          <label>
            Relationship type{" "}
            <select
              aria-label="Relationship type"
              value={relationshipType}
              disabled={busy}
              onChange={(event) => {
                setQuery(initialQuery(event.target.value));
              }}
            >
              {relationships.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          {(["source", "target"] as const).map((axis) => {
            const name = axis === "source" ? "Source" : "Target";
            return (
              <label key={axis}>
                {name} type
                <select
                  aria-label={`${name} type`}
                  value={query[`${axis}Type`]}
                  disabled={busy}
                  onChange={(event) =>
                    setQuery({
                      ...query,
                      [`${axis}Type`]: event.target.value,
                      [`${axis}Focus`]: undefined,
                      [`${axis}After`]: undefined,
                    })
                  }
                >
                  {(definition?.[axis] ?? types).map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
            );
          })}
          <label>
            New link attributes (JSON){" "}
            <input
              aria-label="New link attributes"
              value={attributes}
              onChange={(event) => setAttributes(event.target.value)}
              disabled={busy}
            />
          </label>
        </div>
      </>
    );
  }
  function renderMatrixGrid() {
    if (!matrix) return null;
    return (
      <>
        <div className="scroll">
          <table className="matrix">
            <caption>
              {sourceType} → {targetType} via {relationshipType}
            </caption>
            <thead>
              <tr>
                <th scope="col">Source / coverage</th>
                {matrix.targets.items.map((target) => (
                  <th
                    scope="col"
                    key={target.id}
                    className={sharedFocus?.id === target.id ? "entity-focused" : ""}
                  >
                    <AxisHeading entity={target} onFocus={onFocus} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.sources.items.map((source) => (
                <tr key={source.id}>
                  <th scope="row" className={sharedFocus?.id === source.id ? "entity-focused" : ""}>
                    <AxisHeading entity={source} onFocus={onFocus} />
                    {matrix.missingSourceIds.includes(source.id) && (
                      <small className="gap">Missing link</small>
                    )}
                  </th>
                  {matrix.targets.items.map((target) => {
                    const links = matrix.links.filter(
                      (link) => link.source === source.id && link.target === target.id,
                    );
                    return (
                      <td key={target.id}>
                        <button
                          className={links.length ? "linked" : "unlinked"}
                          aria-label={`${label(source)} → ${label(target)}`}
                          aria-pressed={links.length > 0}
                          disabled={busy}
                          onClick={() => void toggle(source.id, target.id)}
                        >
                          {links.length ? (links.length > 1 ? `✓ ${links.length}` : "✓") : "+"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  function renderPagination() {
    if (!matrix) return null;
    return (
      <>
        <div className="toolbar">
          <button
            disabled={busy || (!sourceAfter && !targetAfter && !sourceFocus && !targetFocus)}
            onClick={() => {
              setQuery({
                ...query,
                sourceFocus: undefined,
                targetFocus: undefined,
                sourceAfter: undefined,
                targetAfter: undefined,
              });
            }}
          >
            First matrix page
          </button>
          <button
            disabled={busy || !matrix.sources.nextAfter}
            onClick={() => {
              setQuery({
                ...query,
                sourceFocus: undefined,
                sourceAfter: matrix.sources.nextAfter,
              });
            }}
          >
            Next sources
          </button>
          <button
            disabled={busy || !matrix.targets.nextAfter}
            onClick={() => {
              setQuery({
                ...query,
                targetFocus: undefined,
                targetAfter: matrix.targets.nextAfter,
              });
            }}
          >
            Next targets
          </button>
          <span className="muted">20 entities per axis</span>
        </div>
      </>
    );
  }
  if (!relationships.length)
    return <p>Define a relationship type in the project schema to use the matrix.</p>;
  return (
    <section aria-label="Traceability matrix">
      {sharedFocus && !compatible && (
        <p>The shared entity has no compatible matrix relationship type.</p>
      )}
      {renderQueryControls()}
      <p className="muted">
        Click a cell or use Tab + Space to create/remove its links. A linked cell with duplicates
        removes all shown links atomically.
      </p>
      {loading && <p role="status">Loading matrix…</p>}
      {!sourceType || !targetType ? (
        <p>This relationship has no permitted endpoint types.</p>
      ) : !matrix ? (
        <p>Choose types to load the matrix.</p>
      ) : (
        <>
          {renderMatrixGrid()}
          {(!matrix.sources.items.length || !matrix.targets.items.length) && (
            <p>Create source and target entities in the table first.</p>
          )}
          <p className="muted">
            “Missing link” means no {relationshipType} link to any active {targetType}, including
            entities outside this column page.
          </p>
          {renderPagination()}
        </>
      )}
    </section>
  );
}

function useMatrixQuery(schema: SchemaObject, sharedFocus: Focus | undefined) {
  const types = Object.keys(schema.entityTypes),
    relationships = Object.keys(schema.relationshipTypes);
  const initialQuery = (relationshipType: string): MatrixQuery => ({
    relationshipType,
    sourceType: (schema.relationshipTypes[relationshipType]?.source ?? types)[0] ?? "",
    targetType: (schema.relationshipTypes[relationshipType]?.target ?? types)[0] ?? "",
    limit: 20,
  });
  const [query, setQuery] = useState(() => initialQuery(relationships[0] ?? ""));
  const { relationshipType } = query;
  const definition = schema.relationshipTypes[relationshipType];
  const canSource = (name: string) =>
    !schema.relationshipTypes[name].source ||
    schema.relationshipTypes[name].source!.includes(sharedFocus?.type ?? "");
  const canTarget = (name: string) =>
    !schema.relationshipTypes[name].target ||
    schema.relationshipTypes[name].target!.includes(sharedFocus?.type ?? "");
  const compatible = sharedFocus
    ? relationships.find((name) => canSource(name) || canTarget(name))
    : undefined;
  useEffect(() => {
    if (!sharedFocus || !compatible) return;
    const name =
      canSource(relationshipType) || canTarget(relationshipType) ? relationshipType : compatible;
    const next = initialQuery(name);
    setQuery(
      canSource(name)
        ? { ...next, sourceType: sharedFocus.type, sourceFocus: sharedFocus.id }
        : { ...next, targetType: sharedFocus.type, targetFocus: sharedFocus.id },
    );
  }, [sharedFocus?.id]);
  return { types, relationships, initialQuery, query, setQuery, definition, compatible };
}
