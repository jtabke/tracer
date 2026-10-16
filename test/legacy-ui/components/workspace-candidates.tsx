import { useEffect, useState } from "react";
import type { Entity } from "../../../src/core/model.ts";
import type { Editing } from "../../../ui/editing.ts";
import { label } from "../../../ui/fields.tsx";
import { useDebounced } from "../../../ui/use-debounced.ts";
import { usePageCursor } from "../../../ui/use-page-cursor.ts";
import type { Projection } from "../../../ui/use-projection.ts";
import { useProjection } from "../../../ui/use-projection.ts";
import { WorkspacePager } from "./workspace-pager.tsx";

export function WorkspaceCandidates({
  types,
  editing,
  target,
  onChoose,
  onReadReady,
  initialType,
  contextual = false,
}: {
  types: string[];
  initialType?: string;
  contextual?: boolean;
  editing: Editing;
  target?: Entity;
  onChoose(entity?: Entity): void;
  onReadReady(ready: boolean): void;
}) {
  const [type, setType] = useState(() => initialCandidateType(types, initialType)),
    [search, setSearch] = useState("");
  const cursor = usePageCursor();
  const term = useDebounced(search.trim());
  const settled = term === search.trim();
  const candidates = useProjection(
    "/api/entities",
    candidateSearchQuery(term, types, type, cursor.after),
    editing.epoch,
    editing.report,
  );
  const selected = useProjection(
    "/api/family",
    candidateTargetQuery(target),
    editing.epoch,
    editing.report,
  );
  const selectedReady = selectedCandidateReady(selected, types);
  useEffect(() => {
    onReadReady(mappingReadReady(target, selectedReady, settled, candidates.ready));
  }, [target, selectedReady, settled, candidates.ready, onReadReady]);
  if (target)
    return (
      <SelectedCandidate
        loading={selected.loading}
        failed={selected.failed}
        ready={selected.ready}
        allowed={selectedReady}
        onChange={() => onChoose(undefined)}
      />
    );

  return (
    <>
      <details className="picker-options" open={!contextual}>
        <summary>Change target type · {type}</summary>
        <label>
          Target type
          <select
            aria-label="Mapping target type"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              onChoose(undefined);
              setSearch("");
              cursor.reset();
            }}
          >
            {types.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </details>
      <label>
        Find existing {type}
        <input
          aria-label="Find mapping candidate"
          data-initial-focus
          maxLength={200}
          value={search}
          placeholder="Search by key or content"
          onChange={(event) => {
            setSearch(event.target.value);
            onChoose(undefined);
            cursor.reset();
          }}
        />
      </label>
      <CandidateResults
        settled={settled}
        loading={candidates.loading}
        data={candidates.data}
        onChoose={onChoose}
      />
      <WorkspacePager
        noun="candidates"
        previous={cursor.hasPrevious}
        next={settled && candidates.ready && !!candidates.data?.nextAfter}
        paused={!settled || candidates.loading}
        onPrevious={cursor.previous}
        onNext={() => cursor.next(candidates.data?.nextAfter)}
      />
    </>
  );
}

function selectedCandidateReady(selected: Projection<"/api/family">, types: string[]) {
  return selected.ready && !!selected.data && types.includes(selected.data.root.type);
}
function mappingReadReady(
  target: Entity | undefined,
  selectedReady: boolean,
  settled: boolean,
  searchReady: boolean,
) {
  return target ? selectedReady : settled && searchReady;
}

function SelectedCandidate({
  loading,
  failed,
  ready,
  allowed,
  onChange,
}: {
  loading: boolean;
  failed: boolean;
  ready: boolean;
  allowed: boolean;
  onChange(): void;
}) {
  return (
    <>
      {loading && <p role="status">Checking the selected item…</p>}
      {failed && (
        <p role="alert">
          The selected item could not be read. Your proposal is retained; refresh to retry.
        </p>
      )}
      {ready && !allowed && (
        <p role="alert">The selected item is no longer an allowed target. Choose another item.</p>
      )}
      <button onClick={onChange}>Change target</button>
    </>
  );
}

function CandidateResults({
  settled,
  loading,
  data,
  onChoose,
}: {
  settled: boolean;
  loading: boolean;
  data?: Projection<"/api/entities">["data"];
  onChoose(entity: Entity): void;
}) {
  if (loading || !settled) return <p role="status">Reading candidates…</p>;
  if (!data) return <p>Search failed. Your draft is retained; refresh to retry.</p>;
  return (
    <>
      <p>
        {data.items.length} candidates loaded{data.nextAfter ? "; more available" : ""}.
      </p>
      <ul className="workspace-candidates">
        {data.items.map((item) => (
          <li key={item.id}>
            <button onClick={() => onChoose(item)}>Choose {label(item)}</button>
            <span>
              {String(item.fields.title ?? "")} · {item.id.slice(0, 8)}
            </span>
          </li>
        ))}
      </ul>
      {!data.items.length && <p>No matches. Try another name or type.</p>}
    </>
  );
}

function initialCandidateType(types: string[], requested?: string) {
  return requested && types.includes(requested) ? requested : (types[0] ?? "");
}
function candidateSearchQuery(term: string, types: string[], type: string, after?: string) {
  if (!types.includes(type)) return undefined;
  return { type, search: term || undefined, after, limit: 20 };
}
function candidateTargetQuery(target?: Entity) {
  return target ? { rootId: target.id, limit: 1 } : undefined;
}
