import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useState } from "react";
import type { Graph } from "../../../src/application/views.ts";
import type { Entity, SchemaObject } from "../../../src/core/model.ts";
import type { Editing } from "../../../ui/editing.ts";
import { label } from "../../../ui/fields.tsx";
import { useProjection } from "../../../ui/use-projection.ts";
import { title } from "./graph-model.ts";

export function GraphBrowser({
  types,
  type,
  setType,
  search,
  setSearch,
  root,
  graph,
  filtered,
  focus,
  after,
  setAfter,
  previousPages,
  setPreviousPages,
  loading,
  nextAfter,
  children,
}: {
  types: string[];
  type: string;
  setType: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  root: string;
  graph?: Graph;
  filtered: Entity[];
  focus: (id: string) => void;
  after?: string;
  setAfter: (value: string | undefined) => void;
  previousPages: (string | undefined)[];
  setPreviousPages: Dispatch<SetStateAction<(string | undefined)[]>>;
  loading: boolean;
  nextAfter?: string;
  children?: ReactNode;
}) {
  return (
    <div className="graph-browser">
      <label>
        Browse type
        <select
          aria-label="Graph entity type"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setAfter(undefined);
            setPreviousPages([]);
            setSearch("");
          }}
        >
          {types.map((name) => (
            <option key={name} value={name}>
              {name.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label>
        Find on this page
        <input
          aria-label="Find graph entity on page"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name or title…"
        />
      </label>
      <label className="graph-focus">
        Focus entity
        <select
          aria-label="Focus entity"
          value={root}
          onChange={(event) => focus(event.target.value)}
        >
          <option value="">Choose an entity</option>
          <FocusOptions root={root} graph={graph} filtered={filtered} />
        </select>
      </label>
      {children}
      <div className="toolbar">
        <button
          aria-label="Previous entities"
          title="Previous entities"
          disabled={!previousPages.length || loading}
          onClick={() => {
            setAfter(previousPages.at(-1));
            setPreviousPages((values) => values.slice(0, -1));
          }}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          aria-label="More entities"
          title="More entities"
          disabled={!nextAfter || loading}
          onClick={() => {
            setPreviousPages((values) => [...values, after]);
            setAfter(nextAfter);
          }}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}

function FocusOptions({
  root,
  graph,
  filtered,
}: {
  root: string;
  graph?: Graph;
  filtered: Entity[];
}) {
  return (
    <>
      {root && !filtered.some((value) => value.id === root) && (
        <option value={root}>
          {label(
            graph?.nodes.find((value) => value.id === root) ?? {
              id: root,
              type: "",
              fields: {},
              version: 0,
            },
          )}{" "}
          (current focus)
        </option>
      )}
      {[...filtered]
        .sort((a, b) => label(a).localeCompare(label(b)))
        .map((value) => (
          <option key={value.id} value={value.id}>
            {label(value)} — {title(value)}
          </option>
        ))}
    </>
  );
}

/** The browser owns only its bounded page/filter, not graph or inspector selection. */
export function useGraphPicker(schema: SchemaObject, editing: Editing) {
  const [type, setType] = useState(Object.keys(schema.entityTypes)[0] ?? "");
  const [after, setAfter] = useState<string>();
  const [previousPages, setPreviousPages] = useState<(string | undefined)[]>([]);
  const [search, setSearch] = useState("");
  const picker = useProjection(
    "/api/entities",
    { type, after, limit: 50 },
    editing.epoch,
    editing.report,
  );
  const filtered = (picker.data?.items ?? []).filter((value) =>
    (label(value) + " " + title(value)).toLowerCase().includes(search.toLowerCase()),
  );
  return {
    picker,
    filtered,
    controls: {
      type,
      setType,
      search,
      setSearch,
      after,
      setAfter,
      previousPages,
      setPreviousPages,
    },
  };
}
