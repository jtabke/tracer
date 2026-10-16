import React from "react";
import { Choice } from "./controls.tsx";
import { typeNames } from "./model.ts";
import { folderKey } from "./organization.ts";
import type { MapController } from "./use-map-controller.ts";
function MapSearchResults({ controller }: { controller: MapController }) {
  const {
    data,
    openTrace,
    organization,
    projection,
    search,
    searchPage,
    searchType,
    setSearchPage,
    setSearchType,
  } = controller;
  return (
    <div className="search-results" aria-label="Search results">
      <div className="search-count">
        <span>Project search · opens a trace</span>
        <Choice
          label="Item type"
          name="Search item type"
          value={searchType}
          onChange={(value) => {
            setSearchType(value);
            setSearchPage(0);
          }}
          options={[
            ["", "All item types"],
            ...Object.keys(data.schema.entityTypes).map((type) => [type, typeNames[type]] as const),
          ]}
        />
        <span>
          {search.total.toLocaleString()} matches · {search.total ? searchPage * 8 + 1 : 0}–
          {Math.min((searchPage + 1) * 8, search.total)} shown
        </span>
      </div>
      {search.items.map((entity) => (
        <button className="search-hit" key={entity.id} onClick={() => openTrace(entity.id)}>
          <span>
            {entity.key} · {typeNames[entity.type]}
          </span>
          <strong>{entity.fields.title}</strong>
          <small>
            {organization[entity.id]?.path.join(" / ") ?? "Unfiled"}
            {!projection.scopeIds?.includes(entity.id) ? " · Outside this view" : ""}
          </small>
        </button>
      ))}
      {!search.total && <p>No matching records. Try another item type or search term.</p>}
      <nav className="search-paging" aria-label="Search pages">
        <button disabled={!searchPage} onClick={() => setSearchPage((page) => page - 1)}>
          Previous results
        </button>
        <button
          disabled={(searchPage + 1) * 8 >= search.total}
          onClick={() => setSearchPage((page) => page + 1)}
        >
          Next results
        </button>
      </nav>
    </div>
  );
}
export function MapSidebar({ controller }: { controller: MapController }) {
  const {
    actions,
    area,
    areas,
    backToModel,
    changeArea,
    choosePreset,
    data,
    dataset,
    focus,
    index,
    onProject,
    projects,
    restoreWork,
    savedViews,
    setNavigation,
    status,
  } = controller;
  return (
    <aside className="rail">
      <label className="project-picker">
        <img
          className="tracer-wordmark"
          src="/tracer-wordmark-light.svg"
          alt="Tracer"
          width="94"
          height="30"
        />
        <select
          aria-label="Project"
          value={dataset}
          onChange={(event) => onProject?.(event.target.value)}
          disabled={!onProject}
        >
          {(projects ?? [{ id: dataset, title: data.title }]).map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </label>
      <nav aria-label="Project navigation">
        <button
          className="rail-active"
          onClick={() => (focus ? backToModel(true) : choosePreset("requirements"))}
        >
          Development map
        </button>
        {actions}
      </nav>
      <section className="area-navigation" aria-label="Working categories">
        <h2>Categories</h2>
        <p className="category-caption">Across all item types</p>
        {areas.map((choice) => (
          <button
            key={choice.name}
            aria-pressed={area === choice.name}
            onClick={() => changeArea(choice.name)}
          >
            <span>{choice.name}</span>
            <small>{choice.count.toLocaleString()}</small>
          </button>
        ))}
        <p>Organization · this session</p>
      </section>
      {!!savedViews.length && (
        <section className="saved-navigation" aria-label="Saved session views">
          <h2>Session views</h2>
          {savedViews.map((view, i) => (
            <button
              key={i}
              onClick={() => {
                restoreWork(view.snapshot);
                setNavigation([]);
              }}
            >
              {view.name}
            </button>
          ))}
        </section>
      )}
      <div className="rail-foot">
        <span>{status ?? "Local project"}</span>
        <span>
          {index.entities.size.toLocaleString()} records
          <br />
          {index.links.length.toLocaleString()} connections
        </span>
      </div>
    </aside>
  );
}
export function MapHeader({ controller }: { controller: MapController }) {
  const {
    activeFolder,
    area,
    backToModel,
    browseRail,
    directory,
    enterGroup,
    focus,
    folderScope,
    index,
    leaveGroup,
    query,
    searchRef,
    setBrowseRail,
    setQuery,
    setSearchPage,
    traceHistory,
  } = controller;
  return (
    <header className="global-header">
      <div className="breadcrumbs">
        <button
          className="text-button category-toggle"
          aria-label={browseRail ? "Hide categories" : "Show categories"}
          onClick={() => setBrowseRail((value) => !value)}
        >
          ☰
        </button>
        {focus ? (
          <button className="text-button" onClick={backToModel}>
            {traceHistory.length ? "← Previous trace" : folderScope ? "← Folder" : "← Data model"}
          </button>
        ) : activeFolder ? (
          <>
            <button className="text-button" onClick={leaveGroup}>
              ← Back
            </button>
            <span>{typeNames[activeFolder.type]}</span>
            {activeFolder.path.map((part, i) => (
              <React.Fragment key={i}>
                <span>/</span>
                <button
                  className="text-button"
                  onClick={() =>
                    enterGroup(
                      directory.groups.get(
                        folderKey(activeFolder.type, activeFolder.path.slice(0, i + 1)),
                      ),
                    )
                  }
                >
                  {part}
                </button>
              </React.Fragment>
            ))}
          </>
        ) : (
          <span>Project / {area === "All areas" ? "Data model" : area}</span>
        )}
        {focus && <span>/ {index.entities.get(focus)?.key}</span>}
      </div>
      <div className="search-area">
        <input
          ref={searchRef}
          type="search"
          aria-label="Find an item"
          placeholder="Find an item by ID or text…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchPage(0);
          }}
        />
        {query.trim() && <MapSearchResults controller={controller} />}
      </div>
    </header>
  );
}
export function WorkspaceHeading({ controller }: { controller: MapController }) {
  const {
    activeFolder,
    area,
    arrange,
    camera,
    changeView,
    focus,
    folderScope,
    frameSelection,
    geometry,
    index,
    rememberCamera,
    selectedVisible,
    selection,
    working,
  } = controller;
  return (
    <section className="workspace-header">
      <div>
        <h1>
          {focus
            ? `Trace · ${index.entities.get(focus)?.key}`
            : (activeFolder?.title ??
              (area === "All areas" ? "Data model" : `${area} development`))}
        </h1>
        <p>
          {focus
            ? index.entities.get(focus)?.fields.title
            : activeFolder
              ? "Choose a source item and follow its recorded traces."
              : "Expand in place, or focus a group to work with fewer items."}
        </p>
      </div>
      <div className="workspace-actions">
        <button onClick={frameSelection} disabled={!selectedVisible && selection.kind !== "edge"}>
          Frame selection
        </button>
        <button onClick={arrange} disabled={working}>
          Arrange
        </button>
        {!focus && !folderScope && (
          <button
            onClick={() => {
              rememberCamera();
              camera.current.local = true;
              camera.current.previous = geometry;
              changeView({ expanded: [] });
            }}
          >
            Collapse groups
          </button>
        )}
      </div>
    </section>
  );
}
