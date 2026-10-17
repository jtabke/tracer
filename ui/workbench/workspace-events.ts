import { listenForResize } from "../map/resize-listener.ts";

type Options = {
  keydown(event: KeyboardEvent): void;
  resize(): void;
  suspend(): void;
  resume(): void;
};
/** Own keyboard/resize work for this document, including back-forward cache suspension. */
export function listenWorkbenchEvents(options: Options, doc = document, target = window) {
  let disposed = false;
  let listening = false;
  let stopResize: (() => void) | undefined;
  function suspend() {
    if (!listening) return;
    listening = false;
    doc.removeEventListener("keydown", options.keydown);
    stopResize?.();
    stopResize = undefined;
    options.suspend();
  }
  function resume() {
    if (disposed || listening) return;
    listening = true;
    doc.addEventListener("keydown", options.keydown);
    stopResize = listenForResize(options.resize, 1, target);
  }
  function hide(event: PageTransitionEvent) {
    if (event.persisted) suspend();
    else dispose();
  }
  function show(event: PageTransitionEvent) {
    if (!event.persisted || disposed) return;
    resume();
    options.resume();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    suspend();
    target.removeEventListener("pagehide", hide);
    target.removeEventListener("pageshow", show);
  }
  resume();
  target.addEventListener("pagehide", hide);
  target.addEventListener("pageshow", show);
  return dispose;
}
