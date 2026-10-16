import { useEffect, useState } from "react";
import type { ChainQuery, ChainStep, ChainTable } from "../../../src/application/views.ts";
import type { Entity, SchemaObject } from "../../../src/core/model.ts";
import { read } from "../../../ui/api.ts";
import type { Editing, Focus } from "../../../ui/editing.ts";
import { label } from "../../../ui/fields.tsx";
import { useDebounced } from "../../../ui/use-debounced.ts";
import { useProjection } from "../../../ui/use-projection.ts";
import { WorkItem } from "../../../ui/work-item.tsx";
import "./chain-table.css";
import { relationshipSlots } from "./relationship-slots.ts";
import { SavedViewPanel } from "./saved-views.tsx";
import { TableView } from "./table.tsx";
import "./work.css";

function choices(schema: SchemaObject, source: string): ChainStep[] {
  return relationshipSlots(schema, source).map(({ targetType, ...slot }) => ({
    type: targetType,
    ...slot,
  }));
}
function initial(schema: SchemaObject, type: string): ChainStep[] {
  const steps: ChainStep[] = [],
    seen = new Set([type]);
  for (let i = 0; i < 3; i++) {
    const next = choices(schema, type).find((step) => !seen.has(step.type));
    if (!next) break;
    steps.push(next);
    seen.add(next.type);
    type = next.type;
  }
  return steps;
}
export function TableWorkspace(props: {
  schema: SchemaObject;
  editing: Editing;
  sharedFocus?: Focus;
  onFocus: (value: Focus) => void;
  intent?: { sequence: number; query: ChainQuery };
}) {
  const [mode, setMode] = useState("chain"),
    [rowsOpened, setRowsOpened] = useState(false);
  useEffect(() => {
    if (props.intent) setMode("chain");
  }, [props.intent?.sequence]);
  return (
    <>
      <div className="toolbar" aria-label="Table layout">
        <button aria-pressed={mode === "chain"} onClick={() => setMode("chain")}>
          Relationship columns
        </button>
        <button
          aria-pressed={mode === "rows"}
          onClick={() => {
            setRowsOpened(true);
            setMode("rows");
          }}
        >
          Editable rows
        </button>
        <span className="muted">
          Same items and changesets; different working levels. Drafts stay in each layout.
        </span>
      </div>
      <div hidden={mode !== "chain"}>
        <ChainView
          {...props}
          onRows={() => {
            setRowsOpened(true);
            setMode("rows");
          }}
        />
      </div>
      <div hidden={mode !== "rows"}>{rowsOpened && <TableView {...props} />}</div>
    </>
  );
}
function ChainView({
  schema,
  editing,
  sharedFocus,
  onFocus,
  onRows,
  intent,
}: {
  schema: SchemaObject;
  editing: Editing;
  onFocus: (value: Focus) => void;
  onRows: () => void;
  intent?: { sequence: number; query: ChainQuery };
  sharedFocus?: Focus;
}) {
  const { type, setType, steps, setSteps, search, setSearch, after, setAfter } = useChainScope(
    schema,
    intent,
  );
  const { selected, dirty, siblings, setDirty, setSiblings, choose } = useChainSelection(
    sharedFocus,
    editing,
    onFocus,
  );
  useEffect(() => {
    if (intent) setSiblings(false);
  }, [intent?.sequence]);
  const term = useDebounced(search.trim());
  const projection = useProjection(
    "/api/chain",
    type ? { type, steps, search: term || undefined, after, limit: 20 } : undefined,
    editing.epoch,
    editing.report,
  );
  const data = projection.data;
  const { rows, siblingCount } = chainFamily(data, selected, siblings);
  const columns = [type, ...steps.map((step) => step.type)];
  // Merge only identical path prefixes, never globally merge a shared child.
  const prefix = (row: ChainTable["rows"][number], column: number) =>
    JSON.stringify([
      row.cells.slice(0, column + 1).map((item) => item?.id),
      row.links.slice(0, column).map((link) => link?.id),
    ]);
  function renderFocusedItem() {
    return (
      <>
        {selected && (
          <WorkItem
            key={selected.entity.id}
            entity={selected.entity}
            schema={data?.schema ?? schema}
            editing={{ ...editing, busy: editing.busy || projection.loading || !data }}
            onDirty={setDirty}
            onChoose={(entity) => choose(entity)}
            onTable={onRows}
          />
        )}
      </>
    );
  }
  function renderPendingSelection() {
    return (
      <>
        {dirty && sharedFocus && sharedFocus.id !== selected?.entity.id && (
          <p>Shared selection pending. Save or discard the focused draft to reveal it.</p>
        )}
      </>
    );
  }
  function renderColumnControls() {
    return (
      <>
        <div className="toolbar">
          <label>
            Parent type
            <select
              aria-label="Chain parent type"
              value={type}
              onChange={(event) => {
                const value = event.target.value;
                setType(value);
                setSteps(initial(schema, value));
                setAfter(undefined);
                setSiblings(false);
              }}
            >
              {Object.keys(schema.entityTypes).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            Find parents
            <input
              aria-label="Find chain parents"
              maxLength={200}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setAfter(undefined);
                setSiblings(false);
              }}
            />
          </label>
          <button onClick={onRows}>Create items / bulk edit</button>
        </div>
        <button
          onClick={() => {
            const root = Object.hasOwn(schema.entityTypes, type)
              ? type
              : (Object.keys(schema.entityTypes)[0] ?? "");
            setType(root);
            setSteps(initial(schema, root));
            setAfter(undefined);
            setSiblings(false);
          }}
        >
          Reset columns to current schema
        </button>
        <div className="chain-config" aria-label="Relationship columns">
          {steps.map((step, index) => (
            <label key={index}>
              Column {index + 2}
              <select
                aria-label={`Chain column ${index + 2}`}
                value={JSON.stringify(step)}
                onChange={(event) => {
                  setSteps([...steps.slice(0, index), JSON.parse(event.target.value) as ChainStep]);
                  setAfter(undefined);
                  setSiblings(false);
                }}
              >
                {choices(schema, columns[index]).map((choice) => (
                  <option key={JSON.stringify(choice)} value={JSON.stringify(choice)}>
                    {choice.direction === "incoming" ? "←" : "→"}{" "}
                    {choice.relationshipType.replaceAll("_", " ")} · {choice.type}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            disabled={steps.length >= 7 || !choices(schema, columns.at(-1)!).length}
            onClick={() => {
              const available = choices(schema, columns.at(-1)!);
              const next =
                available.find((choice) => !columns.includes(choice.type)) ?? available[0];
              setSteps([...steps, next]);
              setAfter(undefined);
              setSiblings(false);
            }}
          >
            Add relationship column
          </button>
          <button
            disabled={!steps.length}
            onClick={() => {
              setSteps(steps.slice(0, -1));
              setAfter(undefined);
              setSiblings(false);
            }}
          >
            Remove last column
          </button>
        </div>
      </>
    );
  }
  function renderChainStatus() {
    return (
      <>
        {selected && (
          <div className="toolbar">
            <strong>Selected: {label(selected.entity)}</strong>
            <button
              disabled={!selected.parentId || !data}
              aria-pressed={siblings}
              onClick={() => setSiblings(!siblings)}
            >
              {siblings ? "Show all chains" : `Show siblings (${siblingCount})`}
            </button>
            <span className="muted">
              Siblings share the clicked parent and column relationship; counts cover this root
              page.
            </span>
          </div>
        )}
        {projection.loading && <p role="status">Loading relationship chains…</p>}
        {!data && !projection.loading && (
          <p role="alert">
            Chain could not be read. Narrow the root search or reduce columns and retry. No partial
            chains are shown; focused drafts remain.
          </p>
        )}
      </>
    );
  }
  function renderCellContent(
    entity: Entity | null | undefined,
    column: number,
    row: ChainTable["rows"][number],
  ) {
    return (
      <>
        {entity ? (
          <>
            <button
              aria-label={`Inspect chain ${label(entity)}`}
              onClick={() => choose(entity, column, row.cells[column - 1]?.id)}
            >
              {label(entity)}
            </button>
            <small>{String(entity.fields.statement ?? entity.fields.title ?? "")}</small>
          </>
        ) : (
          <span className="gap">
            {column > 0 && row.cells[column - 1] ? "No connected child" : "—"}
          </span>
        )}
      </>
    );
  }
  function renderChainGrid() {
    return (
      <>
        {data && (
          <div className="scroll">
            <table className="chain-grid">
              <caption>
                {rows.length} paths · {data.roots.items.length} root items on this page · all
                children of these roots, within explicit bounds
              </caption>
              <thead>
                <tr>
                  {columns.map((name, index) => (
                    <th scope="col" key={index}>
                      {name.replaceAll("_", " ")}
                      {index > 0 && (
                        <small>
                          {steps[index - 1].direction === "incoming" ? "←" : "→"}{" "}
                          {steps[index - 1].relationshipType.replaceAll("_", " ")}
                        </small>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.cells.map((entity, column) => {
                      if (
                        rowIndex > 0 &&
                        prefix(rows[rowIndex - 1], column) === prefix(row, column)
                      )
                        return null;
                      let span = 1;
                      while (
                        rowIndex + span < rows.length &&
                        prefix(rows[rowIndex + span], column) === prefix(row, column)
                      )
                        span++;
                      return (
                        <td
                          key={column}
                          rowSpan={span}
                          className={selected?.entity.id === entity?.id ? "entity-focused" : ""}
                        >
                          {renderCellContent(entity, column, row)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p>No matching parents. Broaden the search or create an item.</p>}
          </div>
        )}
      </>
    );
  }
  return (
    <section aria-label="Relationship chain table">
      <h2>Relationship columns</h2>
      {renderPendingSelection()}
      <SavedViewPanel
        definition={{
          kind: "chain",
          type,
          search,
          steps: steps.map((step) => ({ ...step, direction: step.direction ?? "outgoing" })),
        }}
        schemaVersion={schema.version}
        disabled={editing.busy || projection.loading}
        onOpen={(definition) => {
          if (definition.kind !== "chain") return false;
          setType(definition.type);
          setSteps(definition.steps);
          setSearch(definition.search ?? "");
          setAfter(undefined);
          setSiblings(false);
          return true;
        }}
      />
      <div className="chain-settings" role="region" aria-label="Trace scope controls">
        {renderColumnControls()}
      </div>
      {renderChainStatus()}
      <div className={`chain-layout ${selected ? "with-detail" : ""}`}>
        <div>
          {renderChainGrid()}
          <div className="toolbar">
            <button
              disabled={!after || projection.loading}
              onClick={() => {
                setAfter(undefined);
                setSiblings(false);
              }}
            >
              First chain roots
            </button>
            <button
              disabled={!data?.roots.nextAfter || projection.loading}
              onClick={() => {
                setAfter(data?.roots.nextAfter);
                setSiblings(false);
              }}
            >
              More chain roots
            </button>
            <small>
              20 roots · maximum 8 columns / 300 paths / 1,000 links. Overflow is explicit, not
              silent truncation.
            </small>
          </div>
        </div>
        {renderFocusedItem()}
      </div>
    </section>
  );
}

function useChainScope(schema: SchemaObject, intent?: { sequence: number; query: ChainQuery }) {
  const [type, setType] = useState(Object.keys(schema.entityTypes)[0] ?? "");
  const [steps, setSteps] = useState(() => initial(schema, type));
  const [search, setSearch] = useState(""),
    [after, setAfter] = useState<string>();
  useEffect(() => {
    if (!intent) return;
    setType(intent.query.type);
    setSteps(intent.query.steps);
    setSearch(intent.query.search ?? "");
    setAfter(undefined);
  }, [intent?.sequence]);
  return { type, setType, steps, setSteps, search, setSearch, after, setAfter };
}

function useChainSelection(
  sharedFocus: Focus | undefined,
  editing: Editing,
  onFocus: (value: Focus) => void,
) {
  const [selected, setSelected] = useState<{ entity: Entity; column: number; parentId?: string }>();
  const [dirty, setDirty] = useState(false),
    [siblings, setSiblings] = useState(false);
  useEffect(() => {
    if (!sharedFocus || sharedFocus.id === selected?.entity.id || dirty) return;
    let active = true;
    void read("/api/connections", { id: sharedFocus.id, limit: 1 })
      .then((value) => {
        if (active) {
          setSelected({ entity: value.entity, column: 0 });
          setSiblings(false);
        }
      })
      .catch((error) => {
        if (active) editing.report(error);
      });
    return () => {
      active = false;
    };
  }, [sharedFocus?.id, selected?.entity.id, dirty]);
  const choose = (entity: Entity, column = 0, parentId?: string) => {
    if (
      selected?.entity.id !== entity.id &&
      dirty &&
      !window.confirm("Discard the focused item's unsaved draft to inspect another item?")
    )
      return;
    setSelected({ entity, column, parentId });
    if (selected?.entity.id !== entity.id) setDirty(false);
    setSiblings(false);
    onFocus({ id: entity.id, type: entity.type });
  };
  return { selected, dirty, siblings, setDirty, setSiblings, choose };
}

function chainFamily(
  data: ChainTable | undefined,
  selected: { entity: Entity; column: number; parentId?: string } | undefined,
  siblings: boolean,
) {
  const family =
    data?.rows.filter(
      (row) => selected?.parentId && row.cells[selected.column - 1]?.id === selected.parentId,
    ) ?? [];
  const siblingCount = new Set(
    family
      .map((row) => row.cells[selected!.column]?.id)
      .filter((id) => id && id !== selected?.entity.id),
  ).size;
  const rows = siblings ? family : (data?.rows ?? []);
  return { rows, siblingCount };
}
