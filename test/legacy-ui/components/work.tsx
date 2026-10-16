import { useEffect, useState } from "react";
import type { Entity, ObjectQuery, SchemaObject } from "../../../src/core/model.ts";
import { read } from "../../../ui/api.ts";
import type { Editing, Focus } from "../../../ui/editing.ts";
import { label } from "../../../ui/fields.tsx";
import { useDebounced } from "../../../ui/use-debounced.ts";
import { useProjection } from "../../../ui/use-projection.ts";
import { WorkItem } from "../../../ui/work-item.tsx";
import "./work.css";

export function WorkView({
  schema,
  editing,
  sharedFocus,
  onFocus,
  onTable,
}: {
  schema: SchemaObject;
  editing: Editing;
  sharedFocus?: Focus;
  onFocus: (value: Focus) => void;
  onTable: () => void;
}) {
  const {
    query,
    setQuery,
    search,
    setSearch,
    typeSearch,
    setTypeSearch,
    pages,
    setPages,
    term,
    projection,
    filter,
  } = useWorkingQuery(editing);
  const [selected, setSelected] = useState<Entity>(),
    [dirty, setDirty] = useState(false);
  const [handled, setHandled] = useState<string>();
  const working = projection.data;
  const currentSchema = working?.schema ?? schema;
  const [coverageType, setCoverageType] = useState(""),
    [coverageTarget, setCoverageTarget] = useState("");
  const { textFields, meanings, targetTypes } = workingChoices(
    currentSchema,
    query.type,
    coverageType,
  );
  const choose = (entity: Entity) => {
    if (entity.id === selected?.id) return;
    if (
      dirty &&
      !window.confirm("Discard the focused item's unsaved draft to inspect another item?")
    )
      return;
    setSelected(entity);
    setDirty(false);
    setHandled(entity.id);
    onFocus({ id: entity.id, type: entity.type });
  };
  useEffect(() => {
    if (!sharedFocus || sharedFocus.id === handled || dirty) return;
    // Server-side anchor: shared selection never falls back to the first page.
    let active = true;
    void read("/api/connections", { id: sharedFocus.id, limit: 1 })
      .then((value) => {
        if (active) {
          setSelected(value.entity);
          setHandled(value.entity.id);
        }
      })
      .catch((error) => {
        if (active) editing.report(error);
      });
    return () => {
      active = false;
    };
  }, [sharedFocus?.id, dirty, handled]);
  const demo = new URLSearchParams(window.location.search).get("demo");
  function renderWorkHeading() {
    return (
      <>
        <div className="work-heading">
          <div>
            <h2>Find items</h2>
          </div>
          <span className="muted">
            {working?.types.reduce((count, item) => count + item.count, 0) ?? "…"} active items ·{" "}
            {working?.types.length ?? "…"} populated types
          </span>
        </div>
      </>
    );
  }
  function renderDemoGuide() {
    return (
      <>
        {(demo === "working" || demo === "large") && (
          <details className="work-guide" open>
            <summary>
              Try a realistic task ·{" "}
              {demo === "large"
                ? "started with 10,000 items / 100,000 links / 30 types"
                : "started with 1,000 items / 5,000 links / 10 types"}
            </summary>
            <ol>
              <li>
                Find Power requirements without verification.{" "}
                <button
                  onClick={() => {
                    setSearch("");
                    setCoverageType("verified_by");
                    setCoverageTarget("test");
                    filter({
                      type: "requirement",
                      field: "subsystem",
                      value: "Power",
                      without: "verified_by",
                      targetType: "test",
                    });
                  }}
                >
                  Find Power coverage gaps
                </button>
              </li>
              <li>
                Search this working set for <strong>REQ-00392</strong>, inspect it, and connect{" "}
                <strong>TEST-00240</strong>. The gap should disappear; the focused item should stay.
              </li>
              <li>
                Inspect a dense item without a giant graph.{" "}
                <button
                  onClick={() => {
                    setSearch("REQ-00399");
                    filter({ type: "requirement" });
                  }}
                >
                  Find dense requirement
                </button>{" "}
                Filter and page its ordinary connections.
              </li>
              <li>
                Search <strong>REQ-00391</strong> to edit a changed input. In Evidence, inspect the
                Power restart qualification receipt: changed does not mean automatically invalid.
              </li>
            </ol>
            <p className="muted">
              Synthetic workload, not proof of human usability. Duplicate titles, uneven types,
              isolated items, coverage gaps and dense links are intentional.
            </p>
          </details>
        )}
      </>
    );
  }
  function renderTextFieldFilter() {
    return (
      <>
        <label>
          Text field
          <select
            aria-label="Working field"
            value={query.field ?? ""}
            disabled={!query.type}
            onChange={(event) =>
              filter({
                ...query,
                field: event.target.value || undefined,
                value: event.target.value ? "" : undefined,
              })
            }
          >
            <option value="">Any field</option>
            {textFields.map((name) => (
              <option key={name} value={name}>
                {name.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        {query.field && (
          <label>
            Exact value
            <input
              aria-label="Working field value"
              value={query.value ?? ""}
              onChange={(event) => filter({ ...query, value: event.target.value })}
            />
          </label>
        )}
      </>
    );
  }
  function renderWorkFilters() {
    return (
      <>
        <label>
          Search this working set
          <input
            aria-label="Search working set"
            maxLength={200}
            placeholder="Key, title or field content — across all pages"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setQuery((previous) => ({ ...previous, after: undefined }));
              setPages([]);
            }}
          />
        </label>
        <div className="work-filters">
          {renderTextFieldFilter()}
          <label>
            Coverage relationship
            <select
              aria-label="Coverage relationship"
              value={coverageType}
              disabled={!query.type}
              onChange={(event) => {
                const name = event.target.value;
                const target =
                  (currentSchema.relationshipTypes[name]?.target ??
                    Object.keys(currentSchema.entityTypes))[0] ?? "";
                setCoverageType(name);
                setCoverageTarget(target);
                filter({
                  ...query,
                  without: query.without && name ? name : undefined,
                  targetType: query.without && name ? target : undefined,
                });
              }}
            >
              <option value="">Choose meaning</option>
              {meanings.map((name) => (
                <option key={name} value={name}>
                  {name.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          {coverageType && (
            <label>
              Coverage target type
              <select
                aria-label="Coverage target type"
                value={coverageTarget}
                onChange={(event) => {
                  setCoverageTarget(event.target.value);
                  if (query.without) filter({ ...query, targetType: event.target.value });
                }}
              >
                {targetTypes.map((name) => (
                  <option key={name} value={name}>
                    {name.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="work-checkbox">
            <input
              type="checkbox"
              aria-label="Only missing connections"
              checked={Boolean(query.without)}
              disabled={!coverageType || !query.type}
              onChange={(event) =>
                filter({
                  ...query,
                  without: event.target.checked ? coverageType : undefined,
                  targetType: event.target.checked ? coverageTarget : undefined,
                })
              }
            />
            Only missing connections
          </label>
          <button
            onClick={() => {
              setSearch("");
              setCoverageType("");
              setCoverageTarget("");
              filter({});
            }}
          >
            Clear working filters
          </button>
        </div>
        <p className="work-scope">
          {query.type ?? "All types"}
          {query.field ? ` · ${query.field} = ${query.value}` : ""}
          {query.without
            ? ` · no ${query.without.replaceAll("_", " ")} connection to ${query.targetType}`
            : ""}
          {term ? ` · matching “${term}”` : ""}. Coverage means ordinary links, not proof of
          validity or current evidence.
        </p>
      </>
    );
  }
  function renderTypeBrowser() {
    return (
      <>
        <aside className="work-types" aria-label="Working types">
          <label>
            Find a type
            <input
              aria-label="Find working type"
              value={typeSearch}
              onChange={(event) => setTypeSearch(event.target.value)}
              placeholder="Narrow the type list…"
            />
          </label>
          <button
            aria-pressed={!query.type}
            onClick={() => {
              setCoverageType("");
              setCoverageTarget("");
              filter({});
            }}
          >
            All types
          </button>
          {(working?.types ?? [])
            .filter((item) => item.type.toLowerCase().includes(typeSearch.toLowerCase()))
            .map(({ type, count }) => (
              <button
                key={type}
                aria-pressed={query.type === type}
                aria-label={`Work type ${type}`}
                onClick={() => {
                  setCoverageType("");
                  setCoverageTarget("");
                  filter({ type });
                }}
              >
                {type.replaceAll("_", " ")} <small>{count} active</small>
              </button>
            ))}
        </aside>
      </>
    );
  }
  function renderWorkingResults() {
    return (
      <>
        <div className="work-results">
          {projection.loading && <p role="status">Finding your working set…</p>}
          {!working && !projection.loading && (
            <p role="alert">
              The working set could not be read. Refresh to retry; focused drafts are retained.
            </p>
          )}
          {working && (
            <>
              <h3>{working.total} matching items</h3>
              <div className="scroll">
                <table>
                  <caption>
                    {working.entities.items.length} shown ·{" "}
                    {pages.length ? `page ${pages.length + 1}` : "first page"} · search covers all
                    pages
                  </caption>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Title / context</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {working.entities.items.map((entity) => (
                      <tr
                        key={entity.id}
                        className={selected?.id === entity.id ? "entity-focused" : ""}
                      >
                        <td>
                          <button
                            aria-label={`Inspect ${label(entity)}`}
                            aria-pressed={selected?.id === entity.id}
                            onClick={() => choose(entity)}
                          >
                            {label(entity)}
                          </button>
                          <small>{entity.type.replaceAll("_", " ")}</small>
                        </td>
                        <td>
                          {String(entity.fields.title ?? "")}
                          <small>
                            {String(entity.fields.subsystem ?? "")} ·{" "}
                            {String(entity.fields.owner ?? "")}
                          </small>
                        </td>
                        <td>{String(entity.fields.status ?? "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!working.total && (
                <p>No matching items. Broaden the filters or create items in Table.</p>
              )}
              <div className="toolbar">
                <button
                  disabled={!pages.length || projection.loading}
                  onClick={() => {
                    setQuery((previous) => ({ ...previous, after: pages.at(-1) }));
                    setPages((previous) => previous.slice(0, -1));
                  }}
                >
                  Previous working page
                </button>
                <button
                  disabled={!working.entities.nextAfter || projection.loading}
                  onClick={() => {
                    setPages((previous) => [...previous, query.after]);
                    setQuery((previous) => ({ ...previous, after: working.entities.nextAfter }));
                  }}
                >
                  More working items
                </button>
              </div>
            </>
          )}
        </div>
      </>
    );
  }
  return (
    <section className="work-workspace" aria-label="Work workspace">
      {renderWorkHeading()}
      {renderDemoGuide()}
      {renderWorkFilters()}
      {dirty && sharedFocus && sharedFocus.id !== handled && (
        <p>Shared selection pending. Save or discard the focused draft to reveal it.</p>
      )}
      <div className={`work-layout ${selected ? "with-detail" : ""}`}>
        {renderTypeBrowser()}
        {renderWorkingResults()}
        {selected && (
          <WorkItem
            key={selected.id}
            entity={selected}
            schema={currentSchema}
            editing={editing}
            onDirty={setDirty}
            onChoose={choose}
            onTable={onTable}
          />
        )}
      </div>
    </section>
  );
}

export function workingChoices(
  schema: SchemaObject,
  type: string | undefined,
  coverageType: string,
) {
  const textFields = type
    ? Object.keys(schema.entityTypes[type]?.fields ?? {}).filter(
        (name) => schema.entityTypes[type!].fields[name].type === "string",
      )
    : [];
  const meanings = type
    ? Object.keys(schema.relationshipTypes).filter(
        (name) =>
          !schema.relationshipTypes[name].source ||
          schema.relationshipTypes[name].source!.includes(type!),
      )
    : [];
  const targetTypes =
    schema.relationshipTypes[coverageType]?.target ?? Object.keys(schema.entityTypes);
  return { textFields, meanings, targetTypes };
}

function useWorkingQuery(editing: Editing) {
  const [query, setQuery] = useState<ObjectQuery>({ limit: 50 });
  const [search, setSearch] = useState(""),
    [typeSearch, setTypeSearch] = useState("");
  const term = useDebounced(search.trim());
  const [pages, setPages] = useState<(string | undefined)[]>([]);
  const projection = useProjection(
    "/api/work",
    { ...query, search: term || undefined },
    editing.epoch,
    editing.report,
  );
  const filter = (next: ObjectQuery) => {
    setQuery({ ...next, after: undefined, limit: 50 });
    setPages([]);
  };
  return {
    query,
    setQuery,
    search,
    setSearch,
    typeSearch,
    setTypeSearch,
    pages,
    setPages,
    term,
    projection,
    filter,
  };
}
