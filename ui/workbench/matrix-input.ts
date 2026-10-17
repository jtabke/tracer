import { createDelayedSelection } from "./selection-delay.ts";
import {
  gridRange,
  inRange,
  rowPath,
  focusCell,
  locate,
  startsCellEdit,
  gridDestination,
} from "./matrix-selection.ts";
import { bindMatrixForm } from "./matrix-form-input.ts";
import { placeMatrixEditor } from "./matrix-placement.ts";
import type { MatrixActions, MatrixCell, MatrixContext } from "./matrix-types.ts";

export function createMatrixInput(get: () => MatrixContext, actions: MatrixActions) {
  let stopScope = () => {};
  const selection = createDelayedSelection(
    ({ row, column }: MatrixCell) => {
      const { state } = get();
      if (state.perspective !== "matrix" || state.matrixDraft) return;
      get().render();
      focusCell(get(), row, column);
    },
    undefined,
    180,
  );
  function dispose() {
    selection.clear();
    stopScope();
    stopScope = () => {};
  }
  function choose(
    row: number,
    column: number,
    key: string | null,
    linkId: string | null | undefined,
    extend = false,
  ) {
    const context = get(),
      { state, projection } = context;
    state.matrixAnchor = extend
      ? (state.matrixAnchor ?? state.matrixCell ?? { row, column })
      : { row, column };
    state.matrixCell = { row, column };
    if (key) state.selected = key;
    state.edge = linkId ?? null;
    state.historySubject = null;
    state.matrixPath = rowPath(projection.rows[row]);
    for (const cell of context.app.querySelectorAll<HTMLTableCellElement>("[data-grid-row]")) {
      const active =
        Number(cell.dataset.gridCol) === column &&
        Number(cell.dataset.gridRow) <= row &&
        Number(cell.dataset.gridRow) + cell.rowSpan > row;
      const selected = inRange(
        state,
        Number(cell.dataset.gridRow),
        Number(cell.dataset.gridCol),
        cell.rowSpan,
      );
      cell.classList.toggle("grid-cell-selected", active);
      cell.classList.toggle("grid-range-selected", selected);
      cell.tabIndex = active ? 0 : -1;
      cell.setAttribute("aria-selected", String(selected));
    }
    focusCell(context, row, column);
    selection.defer({ row, column });
  }
  function bindCell(cell: HTMLTableCellElement, signal: AbortSignal) {
    const row = Number(cell.dataset.gridRow),
      column = Number(cell.dataset.gridCol);
    function click(event: MouseEvent) {
      const target = event.target as Element,
        { state, projection } = get();
      if (target.closest(".cell-editor")) return;
      if (state.matrixDraft) {
        get().notify("Save or cancel the current cell edit first.");
        return;
      }
      const record = target.closest<HTMLElement>("[data-grid-artifact]"),
        line = projection.rows[row];
      choose(
        row,
        column,
        record?.dataset.gridArtifact ?? line.keys[column],
        record?.dataset.matrixEdge ?? line.links[column - 1],
        event.shiftKey,
      );
      if (target.closest("[data-cell-add]")) actions.beginEdit(row, column, "add");
    }
    cell.addEventListener("click", click, { signal });
    // Generic relationship inspection must not run before cell selection.
    for (const button of cell.querySelectorAll<HTMLButtonElement>("[data-matrix-edge]"))
      button.onclick = null;
    cell.addEventListener(
      "dblclick",
      (event) => {
        if (!(event.target as Element).closest(".cell-editor")) actions.beginEdit(row, column);
      },
      { signal },
    );
    function keydown(event: KeyboardEvent) {
      if ((event.target as Element).closest(".cell-editor")) return;
      const { state, projection } = get(),
        current = state.matrixCell ?? { row, column };
      if (startsCellEdit(event)) {
        event.preventDefault();
        actions.beginEdit(current.row, current.column, "replace", event.key);
        return;
      }
      if (event.key === "Enter" || event.key === "F2") {
        event.preventDefault();
        actions.beginEdit(current.row, current.column);
        return;
      }
      const next = gridDestination(event.key, {
        current,
        origin: { row, column },
        span: cell.rowSpan,
        rows: projection.rows.length,
        columns: state.matrixSteps.length + 1,
        extend: event.shiftKey,
      });
      if (!next) return;
      event.preventDefault();
      const line = projection.rows[next.row];
      choose(
        next.row,
        next.column,
        line.keys[next.column],
        line.links[next.column - 1],
        event.shiftKey && event.key !== "Tab",
      );
    }
    cell.addEventListener("keydown", keydown, { signal });
  }
  function copy(event: ClipboardEvent) {
    const { state, model } = get();
    if ((event.target as Element).closest(".cell-editor")) return;
    const range = gridRange(state);
    if (!range) return;
    const multiple = range.top !== range.bottom || range.left !== range.right,
      rows: string[] = [];
    for (let row = range.top; row <= range.bottom; row++) {
      const cells: string[] = [];
      for (let column = range.left; column <= range.right; column++) {
        const cell = locate(get(), row, column);
        cells.push(
          [...cell!.querySelectorAll<HTMLElement>("[data-grid-artifact]")]
            .map(
              (el) =>
                `${el.dataset.gridArtifact}${multiple ? " · " : "\t"}${String(model.records.get(el.dataset.gridArtifact!)?.title ?? "").replace(/[\t\r\n]/g, " ")}`,
            )
            .join(multiple ? "; " : "\n")
            .replaceAll("\r", " ")
            .replaceAll("\n", multiple ? " " : "\n"),
        );
      }
      rows.push(cells.join("\t"));
    }
    event.clipboardData?.setData("text/plain", rows.join("\n"));
    event.preventDefault();
  }
  function bind() {
    dispose();
    const { app } = get(),
      grid = app.querySelector<HTMLElement>('.traceability-matrix [role="grid"]');
    if (!grid) return;
    const controller = new AbortController(),
      { signal } = controller;
    let stopPlacement = () => {};
    app.ownerDocument.defaultView?.addEventListener("blur", selection.clear, { signal });
    stopScope = () => {
      controller.abort();
      stopPlacement();
    };
    app
      .querySelector("[data-grid-create-root]")
      ?.addEventListener("click", actions.beginRoot, { signal });
    app.querySelector("[data-connected-graph]")?.addEventListener(
      "click",
      () => {
        const recent = get().state.recentConnection;
        if (recent) get().showPath({ keys: [recent.source, recent.target], links: [recent.id] });
      },
      { signal },
    );
    app.querySelector("[data-connected-another]")?.addEventListener(
      "click",
      () => {
        const cell = get().state.matrixCell;
        if (cell) actions.beginEdit(cell.row, cell.column, "add");
      },
      { signal },
    );
    app.querySelector<HTMLSelectElement>("#trace-presentation")?.addEventListener(
      "change",
      (event) => {
        const { state } = get();
        state.matrixPresentation = (event.currentTarget as HTMLSelectElement).value;
        state.matrixCell = null;
        state.matrixAnchor = null;
        get().render();
      },
      { signal },
    );
    app.querySelector<HTMLSelectElement>("#trace-density")?.addEventListener(
      "change",
      (event) => {
        get().state.matrixDensity = (event.currentTarget as HTMLSelectElement).value;
        get().render();
      },
      { signal },
    );
    app.querySelector("[data-grid-inspect]")?.addEventListener(
      "click",
      () => {
        get().state.inspector = true;
        get().render();
      },
      { signal },
    );
    app.querySelector("[data-grid-edit]")?.addEventListener(
      "click",
      () => {
        const cell = get().state.matrixCell;
        if (cell) actions.beginEdit(cell.row, cell.column);
      },
      { signal },
    );
    app
      .querySelector("[data-grid-show-path]")
      ?.addEventListener("click", () => get().showPath(get().state.matrixPath), { signal });
    for (const cell of grid.querySelectorAll<HTMLTableCellElement>("[data-grid-row]"))
      bindCell(cell, signal);
    app
      .querySelector("[data-grid-recover]")
      ?.addEventListener("click", () => get().recover(), { signal });
    const form = app.querySelector<HTMLFormElement>("#matrix-cell-popover .cell-editor");
    if (form) {
      stopPlacement = placeMatrixEditor(get);
      bindMatrixForm(get, form, actions, signal);
    }
    grid.addEventListener("copy", copy, { signal });
  }
  return { bind, dispose, cancelSelection: selection.clear };
}
