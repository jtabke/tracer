type Options = {
  app: HTMLElement;
  dialog: HTMLDialogElement;
  prepare(): void;
  escape(value: unknown): string;
};

// Capture a logical opener as well as its DOM node: workspace renders replace nodes.
export function createWorkspaceDialog({ app, dialog, prepare, escape: e }: Options) {
  return function openDialog(title: string, body: string) {
    prepare();
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
    dialog.classList.remove("search-dialog", "navigation-dialog");
    dialog.onkeydown = null;
    dialog.setAttribute("closedby", "closerequest");
    function restoreFocus() {
      if (dialog.open) return;
      // Native close can leave focus inside the hidden dialog when its opener was replaced.
      const active = document.activeElement;
      if (active !== document.body && !dialog.contains(active) && active?.getClientRects().length)
        return;
      const replacement = selector ? app.querySelector<HTMLElement | SVGElement>(selector) : null;
      const target = opener?.isConnected ? opener : replacement;
      (target?.getClientRects().length
        ? target
        : app.querySelector<HTMLElement>('[data-action="search"]')
      )?.focus({ preventScroll: true });
    }
    dialog.onclose = () => requestAnimationFrame(restoreFocus);
    dialog.innerHTML = `<form method="dialog" class="dialog-head"><h2 id="dialog-title">${e(title)}</h2><button aria-label="Close dialog">×</button></form>${body}`;
    dialog.showModal();
  };
}
