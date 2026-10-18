/** Direct listeners for one rendered DOM scope; reset/dispose never replay events. */
export function createDomBindings(root: ParentNode) {
  let controller: AbortController | undefined;
  function dispose() {
    controller?.abort();
    controller = undefined;
  }
  function reset() {
    dispose();
    controller = new AbortController();
    return controller.signal;
  }
  function on<K extends keyof HTMLElementEventMap>(
    selector: string,
    type: K,
    handle: (element: HTMLElement, event: HTMLElementEventMap[K]) => void,
  ) {
    if (!controller) return;
    const { signal } = controller;
    for (const element of root.querySelectorAll<HTMLElement>(selector)) {
      function handleBoundEvent(event: HTMLElementEventMap[K]) {
        handle(element, event);
      }
      element.addEventListener(type, handleBoundEvent, { signal });
    }
  }
  const click = (selector: string, handle: (element: HTMLElement) => void) =>
    on(selector, "click", handle);
  return { reset, dispose, on, click };
}
