import React, { useEffect, useMemo, useRef, useState } from "react";
import { connectionNames } from "./filters.ts";
import { trapFocus } from "./graph-interaction.ts";
import { PAGE_SIZE, typeNames } from "./model.ts";
import type {
  Directory,
  DirectoryGroup,
  MapEntity,
  MapIndex,
  MapLink,
  Organization,
} from "./types.ts";

const TABLE_PAGE = 12;
function Pager({
  page,
  total,
  onPage,
  label,
}: {
  page: number;
  total: number;
  onPage(page: number): void;
  label: string;
}) {
  const pages = Math.max(1, Math.ceil(total / TABLE_PAGE));
  return (
    <div className="table-pager" aria-label={label}>
      <span>
        {total ? `${page * TABLE_PAGE + 1}–${Math.min(total, (page + 1) * TABLE_PAGE)}` : "0"} of{" "}
        {total.toLocaleString()}
      </span>
      <button disabled={!page} onClick={() => onPage(page - 1)} aria-label={`Previous ${label}`}>
        ←
      </button>
      <button
        disabled={page + 1 >= pages}
        onClick={() => onPage(page + 1)}
        aria-label={`Next ${label}`}
      >
        →
      </button>
    </div>
  );
}

export function FolderBrowser({
  directory,
  types,
  onEnter,
  onClose,
  onInspect,
}: {
  directory: Directory;
  types: string[];
  onEnter(group: DirectoryGroup): void;
  onClose(): void;
  onInspect(id: string): void;
}) {
  return (
    <section className="floating-panel folder-browser" aria-label="Folder browser">
      <div className="panel-heading">
        <strong>Browse folders</strong>
        <button aria-label="Close folder browser" onClick={onClose}>
          ×
        </button>
      </div>
      <p className="filter-help">
        Study folders within each item type. Open a folder to work on its contents.
      </p>
      {types
        .filter((type) => directory.roots.get(type)?.members.length)
        .map((type) => {
          const root = directory.roots.get(type)!;
          return (
            <details key={type}>
              <summary>
                {typeNames[type]} <span>{root.members.length}</span>
              </summary>
              <button
                className="folder-row"
                onClick={() =>
                  root.members.length === 1 && onInspect
                    ? onInspect(root.members[0])
                    : onEnter(root)
                }
              >
                All {typeNames[type].toLowerCase()}
              </button>
              {[...directory.groups.values()]
                .filter(
                  (group) =>
                    root.members.length > PAGE_SIZE &&
                    group.type === type &&
                    group.path.length &&
                    !(group.children.length === 1 && !group.directMembers.length),
                )
                .map((group) => (
                  <button
                    key={group.key}
                    className="folder-row"
                    style={{ paddingLeft: 12 + group.path.length * 12 }}
                    onClick={() =>
                      group.members.length === 1 && onInspect
                        ? onInspect(group.members[0])
                        : onEnter(group)
                    }
                  >
                    <span>{group.path.join(" / ")}</span>
                    <small>{group.members.length}</small>
                  </button>
                ))}
            </details>
          );
        })}
    </section>
  );
}

export function RecordTable({
  records,
  organization,
  selectedIds,
  onSelection,
  onInspect,
  onOrganize,
  onReveal,
  scopeKey,
}: {
  records: MapEntity[];
  organization: Organization;
  selectedIds: Set<string>;
  onSelection(ids: Set<string>): void;
  onInspect(id: string): void;
  onOrganize(ids: string[]): void;
  onReveal(ids: string[]): void;
  scopeKey: string;
}) {
  const [pages, setPages] = useState<Record<string, number>>({});
  const page = pages[scopeKey] ?? 0;
  const setPage = (value: number) => setPages((current) => ({ ...current, [scopeKey]: value }));
  const current = Math.min(page, Math.max(0, Math.ceil(records.length / TABLE_PAGE) - 1));
  const shown = records.slice(current * TABLE_PAGE, (current + 1) * TABLE_PAGE);
  const visibleIds = new Set(records.map((record) => record.id));
  const checked = [...selectedIds].filter((id) => visibleIds.has(id));
  function toggle(ids: string[], add: boolean) {
    const next = new Set(selectedIds);
    for (const id of ids) add ? next.add(id) : next.delete(id);
    onSelection(next);
  }
  return (
    <section className="record-table" aria-label="Items in working scope">
      <div className="table-heading">
        <div>
          <strong>Items in this scope</strong>
          <span>
            {records.length.toLocaleString()} records ·{" "}
            {checked.length ? `${checked.length} selected across pages` : "same scope as the graph"}
          </span>
        </div>
        <div className="table-bulk-actions">
          <button disabled={!checked.length} onClick={() => onReveal(checked.slice(0, 24))}>
            {checked.length > 24 ? "Reveal first 24 selected" : "Show selected on map"}
          </button>
          <button disabled={!checked.length} onClick={() => onOrganize(checked)}>
            Organize
            {checked.length
              ? ` ${checked.length} ${checked.length === 1 ? "item" : "items"}`
              : " selected"}
          </button>
        </div>
      </div>
      <div className="data-table-scroll">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Select this page"
                  checked={!!shown.length && shown.every((record) => selectedIds.has(record.id))}
                  onChange={(event) =>
                    toggle(
                      shown.map((record) => record.id),
                      event.target.checked,
                    )
                  }
                />
              </th>
              <th>Item</th>
              <th>Type</th>
              <th>Folder</th>
              <th>Categories</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((record) => (
              <tr key={record.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${record.key}`}
                    checked={selectedIds.has(record.id)}
                    onChange={(event) => toggle([record.id], event.target.checked)}
                  />
                </td>
                <td>
                  <button className="table-item" onClick={() => onInspect(record.id)}>
                    <small>{record.key}</small>
                    <strong>{record.fields.title}</strong>
                  </button>
                </td>
                <td>{typeNames[record.type]}</td>
                <td>{organization[record.id]?.path.join(" / ") ?? "Unfiled"}</td>
                <td>{organization[record.id]?.areas.join(", ") || "Uncategorized"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={current} total={records.length} onPage={setPage} label="item pages" />
      {!records.length && (
        <p className="empty-table">
          No items match this scope. Choose another category or clear the item filters.
        </p>
      )}
    </section>
  );
}

export function ConnectionTray({
  links,
  index,
  title,
  onClose,
  onInspect,
  onReveal,
}: {
  links: MapLink[];
  index: MapIndex;
  title: string;
  onClose(): void;
  onInspect(id: string): void;
  onReveal(ids: string[]): void;
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return links.filter(
      (link) =>
        !text ||
        [
          link.type,
          index.entities.get(link.nativeSource)!.key,
          index.entities.get(link.nativeSource)!.fields.title,
          index.entities.get(link.nativeTarget)!.key,
          index.entities.get(link.nativeTarget)!.fields.title,
        ]
          .join(" ")
          .toLowerCase()
          .includes(text),
    );
  }, [links, index, query]);
  const current = Math.min(page, Math.max(0, Math.ceil(filtered.length / TABLE_PAGE) - 1)),
    shown = filtered.slice(current * TABLE_PAGE, (current + 1) * TABLE_PAGE);
  return (
    <section className="connection-tray" aria-label="Connection records">
      <div className="table-heading">
        <div>
          <strong>{title}</strong>
          <span>{links.length.toLocaleString()} recorded links · exact native endpoints</span>
        </div>
        <button aria-label="Close connection records" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="connection-tools">
        <input
          type="search"
          aria-label="Find in these connections"
          placeholder="Find an item or connection…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
        />
        <button
          disabled={!shown.length}
          onClick={() =>
            onReveal([...new Set(shown.flatMap((link) => [link.nativeSource, link.nativeTarget]))])
          }
        >
          Reveal this page on map
        </button>
        <Pager page={current} total={filtered.length} onPage={setPage} label="connection pages" />
      </div>
      <div className="data-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Connection</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((link) => (
              <tr key={link.id} data-link-id={link.id}>
                <td>
                  <button className="table-item" onClick={() => onInspect(link.nativeSource)}>
                    <small>{index.entities.get(link.nativeSource)!.key}</small>
                    <strong>{index.entities.get(link.nativeSource)!.fields.title}</strong>
                  </button>
                </td>
                <td>{connectionNames[link.type] ?? link.type.replaceAll("_", " ")}</td>
                <td>
                  <button className="table-item" onClick={() => onInspect(link.nativeTarget)}>
                    <small>{index.entities.get(link.nativeTarget)!.key}</small>
                    <strong>{index.entities.get(link.nativeTarget)!.fields.title}</strong>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <p className="empty-table">
          No recorded connections match. An allowed route is a model rule, not a recorded link.
        </p>
      )}
    </section>
  );
}

export function OrganizeDialog({
  count,
  areas,
  onApply,
  onClose,
}: {
  count: number;
  areas: { name: string; count: number }[];
  onApply(action: string, value: string): void;
  onClose(): void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    formRef.current?.querySelector("input")?.focus();
    function trap(event: KeyboardEvent) {
      if (formRef.current) trapFocus(event, formRef.current);
    }
    const form = formRef.current;
    if (!form) return;
    form.addEventListener("keydown", trap);
    return () => {
      form.removeEventListener("keydown", trap);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const [action, setAction] = useState("folder"),
    [value, setValue] = useState("");
  return (
    <div className="organize-overlay">
      <form
        ref={formRef}
        className="organize-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="organize-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onApply(action, value.trim());
        }}
      >
        <div className="panel-heading">
          <strong id="organize-title">
            Organize {count} {count === 1 ? "item" : "items"}
          </strong>
          <button type="button" aria-label="Cancel organization" onClick={onClose}>
            ×
          </button>
        </div>
        <p>
          Study organization is kept in this session. Engineering records and trace links stay
          intact.
        </p>
        <label>
          Action
          <select
            aria-label="Action"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setValue("");
            }}
          >
            <option value="folder">Move to folder</option>
            <option value="add">Add category</option>
            <option value="remove">Remove category</option>
          </select>
        </label>
        <label>
          {action === "folder" ? "Folder within each item's type" : "Category"}
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            list={action === "folder" ? undefined : "study-categories"}
            placeholder={action === "folder" ? "Power / Battery" : "Power"}
          />
        </label>
        <datalist id="study-categories">
          {areas
            .filter((area) => !["All areas", "Uncategorized"].includes(area.name))
            .map((area) => (
              <option key={area.name} value={area.name} />
            ))}
        </datalist>
        <p className="filter-help">
          {action === "folder"
            ? "Use / to nest folders. Moving a folder location does not change category membership or engineering parents."
            : action === "add"
              ? "Adds this category to every selected item, retaining other memberships."
              : "Removes only this category from the selected items."}
        </p>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={!value.trim()}>
            Apply to {count} {count === 1 ? "item" : "items"}
          </button>
        </div>
      </form>
    </div>
  );
}

function fieldText(value: unknown, definition: boolean) {
  if (definition && value && typeof value === "object" && "type" in value)
    return `${value.type}${"required" in value && value.required ? " · required" : ""}`;
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
export function FieldDetails({
  title,
  fields,
  omit = [],
  definition = false,
}: {
  title: string;
  fields: Record<string, unknown>;
  omit?: string[];
  definition?: boolean;
}) {
  return (
    <details className="detail-fields">
      <summary>{title}</summary>
      <dl>
        {Object.entries(fields)
          .filter(([key]) => !omit.includes(key))
          .map(([key, value]) => (
            <React.Fragment key={key}>
              <dt>{key.replaceAll("_", " ")}</dt>
              <dd>{fieldText(value, definition)}</dd>
            </React.Fragment>
          ))}
      </dl>
    </details>
  );
}
