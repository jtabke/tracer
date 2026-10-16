import { PAGE_SIZE, typeNames } from "./model.ts";
import type { MapController } from "./use-map-controller.ts";
import { FieldDetails } from "./workbench.tsx";
export function SelectionInspector({ controller }: { controller: MapController }) {
  const {
    changeView,
    hiddenSelection,
    mobileDetailsOpen,
    mobileDetailsTrigger,
    selectedEntity,
    selectedGroup,
    setMobileDetailsOpen,
  } = controller;
  return (
    <aside
      className={`inspector ${mobileDetailsOpen ? "mobile-details-open" : ""}`}
      aria-label="Selection details"
    >
      <div className="panel-heading">
        <strong>
          {selectedEntity ? selectedEntity.key : selectedGroup ? "Model group" : "Connection"}
        </strong>
        <button
          aria-label="Close details"
          onClick={() => {
            if (window.innerWidth <= 760) {
              setMobileDetailsOpen(false);
              requestAnimationFrame(() => mobileDetailsTrigger.current?.focus());
            } else changeView({ selected: null });
          }}
        >
          ×
        </button>
      </div>
      {hiddenSelection && (
        <p className="boundary">This selection is outside the current visible page or filters.</p>
      )}
      {selectedEntity && <ItemSelection controller={controller} />}
      {selectedGroup && <GroupSelection controller={controller} />}
    </aside>
  );
}
export function MobileSelectionBar({ controller }: { controller: MapController }) {
  const { mobileDetailsTrigger, selectedEntity, selectedGroup, setMobileDetailsOpen } = controller;
  const { inspector: visibility_inspector, mobileDetailsOpen: visibility_mobileDetailsOpen } =
    controller;
  if (!(visibility_inspector && !visibility_mobileDetailsOpen)) return null;
  return (
    <div className="mobile-selection-bar">
      <span>Selected: {selectedEntity?.key ?? (selectedGroup ? "Group" : "Connection")}</span>
      <button ref={mobileDetailsTrigger} onClick={() => setMobileDetailsOpen(true)}>
        Item details
      </button>
    </div>
  );
}
function ItemSelection({ controller }: { controller: MapController }) {
  const {
    beginWalk,
    changeView,
    focus,
    index,
    inspectorActions,
    locateTraceItem,
    openTrace,
    organization,
    projection,
    revealNext,
    selectedEntity,
    selectedItemLinks,
    setOrganizeIds,
    showEndpoints,
    visibleIds,
  } = controller;
  if (!selectedEntity) return null;
  return (
    <>
      <p className="type-label">{typeNames[selectedEntity.type]}</p>
      <p className="item-folder-path">
        {organization[selectedEntity.id]?.path.join(" / ") ?? "Unfiled"} ·{" "}
        {organization[selectedEntity.id]?.areas.join(", ") || "Uncategorized"}
      </p>
      <h2>{selectedEntity.fields.title}</h2>
      <p className="statement">{selectedEntity.fields.statement}</p>
      {inspectorActions?.(selectedEntity)}
      <button className="primary" onClick={() => beginWalk(selectedEntity.id)}>
        Follow connections
      </button>
      {(focus || projection.folderDetail) && (
        <button onClick={() => revealNext(selectedEntity.id)}>Reveal next connections</button>
      )}
      <button onClick={() => openTrace(selectedEntity.id)}>Focus this trace</button>
      <div className="item-actions">
        <button
          onClick={() => {
            if (visibleIds.has(selectedEntity.id)) {
              changeView({ representation: "graph" });
              locateTraceItem(selectedEntity.id);
            } else showEndpoints([selectedEntity.id]);
          }}
        >
          {visibleIds.has(selectedEntity.id) ? "Locate on graph" : "Show on map"}
        </button>
        <button onClick={() => setOrganizeIds([selectedEntity.id])}>Organize item</button>
      </div>
      <FieldDetails
        title="Record fields"
        fields={selectedEntity.fields}
        omit={["title", "statement"]}
      />
      <h3>Recorded connections · {selectedItemLinks.length}</h3>
      <div className="inspector-connections">
        {selectedItemLinks.slice(0, 5).map((link) => {
          const otherId =
            link.nativeSource === selectedEntity.id ? link.nativeTarget : link.nativeSource;
          const other = index.entities.get(otherId);
          return (
            <button
              key={link.id}
              onClick={() => beginWalk(selectedEntity.id, link.id)}
              aria-label={`Follow ${other!.key} via ${link.type.replaceAll("_", " ")}`}
            >
              <span>
                {link.nativeSource === selectedEntity.id ? "→" : "←"}{" "}
                {link.type.replaceAll("_", " ")}
              </span>
              <strong>
                {other!.key} · {other!.fields.title}
              </strong>
            </button>
          );
        })}
      </div>
      <button
        onClick={() =>
          changeView({
            tray: {
              id: `item:${selectedEntity.id}`,
              title: `${selectedEntity.key} · connections`,
              linkIds: selectedItemLinks.map((link) => link.id),
            },
          })
        }
      >
        Inspect all {selectedItemLinks.length} connections
      </button>
    </>
  );
}
function GroupSelection({ controller }: { controller: MapController }) {
  const {
    data,
    enterGroup,
    expanded,
    index,
    selectedDirectoryGroup,
    selectedGroup,
    selectedGroupNode,
    selection,
    toggle,
  } = controller;
  if (!selectedGroup) return null;
  const hasFolder = !!selectedGroupNode?.path?.length;
  const groupKey = selection.groupKey ?? selectedGroup;
  const isExpanded = expanded.includes(groupKey);
  return (
    <>
      <p className="type-label">
        {hasFolder
          ? `${typeNames[selectedGroup]} / ${selectedGroupNode!.path!.join(" / ")}`
          : typeNames[selectedGroup]}
      </p>
      <h2>{selectedGroupNode?.title ?? typeNames[selectedGroup]}</h2>
      <p>
        {(
          selectedGroupNode?.total ??
          index.byType.get(selectedGroup)?.length ??
          0
        ).toLocaleString()}{" "}
        records in this group.
      </p>
      {selectedGroupNode?.external ? (
        <p className="boundary">
          Connected items outside the working scope. Revealing them does not change category
          membership.
        </p>
      ) : (
        <>
          <button className="primary" onClick={() => toggle(groupKey)}>
            {hasFolder ? "Open folder & traces" : isExpanded ? "Collapse group" : "Expand in place"}
          </button>
          {selectedDirectoryGroup && !hasFolder && (
            <>
              <button className="enter-group" onClick={() => enterGroup(selectedDirectoryGroup)}>
                Focus group →
              </button>
              <p className="focus-help">
                Work with just this group. Back restores this map exactly.
              </p>
            </>
          )}
        </>
      )}
      {isExpanded && (
        <p className="boundary">
          Up to {PAGE_SIZE} records appear at a time. Lines attach to visible records; other records
          and their links stay summarized.
        </p>
      )}
      <FieldDetails
        title="Fields for this item type"
        fields={data.schema.entityTypes[selectedGroup]?.fields ?? {}}
        definition
      />
    </>
  );
}
