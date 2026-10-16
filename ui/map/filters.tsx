import {
  connectionEndpoints,
  connectionFilterGroups,
  connectionNames,
  groupedChoices,
  itemDescriptions,
  itemFilterGroups,
  relevantRelationships,
} from "./filters.ts";
import { typeNames } from "./model.ts";
import type { MapIndex } from "./types.ts";

function filterModel({
  index,
  types,
  relations,
  focused,
  tab,
  setTab,
  onTypes,
  onRelations,
  onClose,
  onReset,
  contextTypes = [],
}: {
  index: MapIndex;
  types: string[];
  relations: string[];
  focused: boolean;
  tab: string;
  setTab(tab: string): void;
  onTypes(types: string[]): void;
  onRelations(types: string[]): void;
  onClose(): void;
  onReset(): void;
  contextTypes?: string[];
}) {
  const schema = index.fixture.schema;
  const allRelations = Object.keys(schema.relationshipTypes);
  const relevant = focused
    ? allRelations
    : relevantRelationships(schema, [...new Set([...types, ...contextTypes])]);
  const outside = allRelations.filter((type) => !relevant.includes(type));
  const activeTab = focused ? "connections" : tab;
  const toggle = (current: string[], type: string, checked: boolean) =>
    checked ? [...new Set([...current, type])] : current.filter((value) => value !== type);

  function connectionGroups(choices: string[]) {
    return groupedChoices(connectionFilterGroups, choices).map((group) => (
      <details className="filter-group" key={group.label} open>
        <summary>
          {group.label}
          <span>
            {group.types.filter((type) => relations.includes(type)).length}/{group.types.length}
          </span>
        </summary>
        {group.types.map((type) => (
          <label className="check filter-choice" key={type}>
            <input
              type="checkbox"
              aria-label={connectionNames[type] ?? type.replaceAll("_", " ")}
              checked={relations.includes(type)}
              onChange={(event) => onRelations(toggle(relations, type, event.target.checked))}
            />
            <span>
              <strong>{connectionNames[type] ?? type.replaceAll("_", " ")}</strong>
              <small>{connectionEndpoints(schema.relationshipTypes[type])}</small>
            </span>
          </label>
        ))}
      </details>
    ));
  }

  return {
    index,
    types,
    relations,
    focused,
    tab,
    setTab,
    onTypes,
    onRelations,
    onClose,
    onReset,
    contextTypes,
    schema,
    allRelations,
    relevant,
    outside,
    activeTab,
    toggle,
    connectionGroups,
  };
}
type FilterModel = ReturnType<typeof filterModel>;
export function GraphFilters(props: Parameters<typeof filterModel>[0]) {
  const model = filterModel(props);
  const { focused, onClose, onReset, activeTab } = model;
  return (
    <section className="floating-panel filters" aria-label="Graph filters">
      <div className="panel-heading">
        <strong>Filters</strong>
        <button aria-label="Close filters" onClick={onClose}>
          ×
        </button>
      </div>
      {!focused && <FilterTabs model={model} />}
      {activeTab === "items" ? <ItemFilters model={model} /> : <ConnectionFilters model={model} />}
      <footer className="filter-footer">
        <span>Changes update the graph immediately.</span>
        <button onClick={onReset}>Reset filters</button>
      </footer>
    </section>
  );
}
function FilterTabs({ model }: { model: FilterModel }) {
  const { setTab, activeTab } = model;
  return (
    <div className="filter-tabs" role="tablist" aria-label="Filter choices">
      {[
        ["items", "Items"],
        ["connections", "Connections"],
      ].map(([value, label]) => (
        <button
          key={value}
          id={`filter-tab-${value}`}
          role="tab"
          aria-selected={activeTab === value}
          aria-controls={`filter-${value}`}
          tabIndex={activeTab === value ? 0 : -1}
          onClick={() => setTab(value)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? "items"
                : event.key === "End"
                  ? "connections"
                  : value === "items"
                    ? "connections"
                    : "items";
            setTab(next);
            document.getElementById(`filter-tab-${next}`)?.focus();
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
function ItemFilters({ model }: { model: FilterModel }) {
  const { index, types, onTypes, schema, toggle } = model;
  return (
    <div role="tabpanel" id="filter-items" aria-labelledby="filter-tab-items">
      <p className="filter-help">Choose which kinds of records appear on the map.</p>
      {groupedChoices(itemFilterGroups, Object.keys(schema.entityTypes)).map((group, number) => (
        <details className="filter-group" key={group.label} open={number === 0}>
          <summary>
            {group.label}
            <span>
              {group.types.filter((type) => types.includes(type)).length}/{group.types.length}
            </span>
          </summary>
          {group.types.map((type) => (
            <label className="check filter-choice" key={type}>
              <input
                type="checkbox"
                aria-label={typeNames[type] ?? type}
                checked={types.includes(type)}
                onChange={(event) => onTypes(toggle(types, type, event.target.checked))}
              />
              <span>
                <strong>{typeNames[type] ?? type}</strong>
                {itemDescriptions[type] && <small>{itemDescriptions[type]}</small>}
              </span>
              <span
                className="filter-record-count"
                aria-label={`${(index.byType.get(type)?.length ?? 0).toLocaleString()} records`}
              >
                {(index.byType.get(type)?.length ?? 0).toLocaleString()}
              </span>
            </label>
          ))}
        </details>
      ))}
    </div>
  );
}
function ConnectionFilters({ model }: { model: FilterModel }) {
  const { relations, focused, onRelations, relevant, outside, connectionGroups } = model;
  return (
    <div
      role={focused ? undefined : "tabpanel"}
      id="filter-connections"
      aria-labelledby={focused ? undefined : "filter-tab-connections"}
    >
      <p className="filter-help">
        {focused
          ? "Choose connection kinds to follow in this trace. Item types follow its direction and depth."
          : "Choose which connections appear between the visible item types."}
      </p>
      <div className="filter-shortcuts">
        <button onClick={() => onRelations([...new Set([...relations, ...relevant])])}>
          Show all {focused ? "kinds" : "relevant"}
        </button>
        <button onClick={() => onRelations(relations.filter((type) => !relevant.includes(type)))}>
          Hide all {focused ? "kinds" : "relevant"}
        </button>
      </div>
      {relevant.length ? (
        connectionGroups(relevant)
      ) : (
        <p className="filter-help">No connection kinds apply to these item types.</p>
      )}
      {!!outside.length && (
        <details className="other-connections">
          <summary>
            Other connections <span>{outside.length}</span>
          </summary>
          <p className="filter-help">
            These need item types outside the current scope. Choices are kept when you change scope.
          </p>
          {connectionGroups(outside)}
        </details>
      )}
    </div>
  );
}
