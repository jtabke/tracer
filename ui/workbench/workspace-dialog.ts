type Options = {
  app: HTMLElement;
  dialog: HTMLDialogElement;
  prepare(): void;
  canDismiss(): boolean;
  escape(value: unknown): string;
};

export function captureOpener(app: HTMLElement) {
  const focused = document.activeElement;
  const opener = focused instanceof HTMLElement || focused instanceof SVGElement ? focused : null;
  const attribute = [
    "id",
    "data-action",
    "data-node-action",
    "data-edit-field",
    "data-inspect-link",
    "data-edge",
  ].find((name) => opener?.hasAttribute(name));
  const identity = attribute
    ? `[${attribute}="${CSS.escape(opener!.getAttribute(attribute)!)}"]`
    : null;
  const label = opener?.getAttribute("aria-label");
  const selector =
    identity &&
    `${opener?.closest(".inspector") ? ".inspector " : ""}${identity}${label ? `[aria-label="${CSS.escape(label)}"]` : ""}`;

  return () => {
    const target = opener?.isConnected
      ? opener
      : selector
        ? app.querySelector<HTMLElement | SVGElement>(selector)
        : null;
    (target?.getClientRects().length
      ? target
      : app.querySelector<HTMLElement>('[data-action="search"]')
    )?.focus({ preventScroll: true });
  };
}

// Capture a logical opener as well as its DOM node: workspace renders replace nodes.
export function createWorkspaceDialog({ app, dialog, prepare, canDismiss, escape: e }: Options) {
  return function openDialog(title: string, body: string) {
    prepare();
    const returnFocus = captureOpener(app);
    dialog.classList.remove("search-dialog", "navigation-dialog");
    dialog.onkeydown = null;
    dialog.setAttribute("closedby", "any");
    let edited = false;
    dialog.oninput = (event) => {
      if ((event.target as Element).closest("form:not(.dialog-head)")) edited = true;
    };
    dialog.oncancel = (event) => {
      if (!canDismiss() || (edited && !window.confirm("Discard unsaved dialog changes?")))
        event.preventDefault();
    };
    function restoreFocus() {
      if (dialog.open) return;
      // Native close can leave focus inside the hidden dialog when its opener was replaced.
      const active = document.activeElement;
      if (active !== document.body && !dialog.contains(active) && active?.getClientRects().length)
        return;
      returnFocus();
    }
    dialog.onclose = () => requestAnimationFrame(restoreFocus);
    dialog.innerHTML = `<form method="dialog" class="dialog-head"><h2 id="dialog-title">${e(title)}</h2><button type="button" aria-label="Close dialog">×</button></form><div class="workspace-dialog-body">${body}</div>`;
    dialog.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!.onclick = () =>
      dialog.requestClose();
    dialog.showModal();
  };
}
