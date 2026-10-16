type ResizeTarget = Pick<
  Window,
  "requestAnimationFrame" | "cancelAnimationFrame" | "addEventListener" | "removeEventListener"
>;

// One resize owns one frame chain. Replacement and cleanup cancel the entire chain.
export function listenForResize(
  action: () => void,
  frameCount: 1 | 2 = 1,
  target: ResizeTarget = window,
) {
  let active = true,
    pending: number | undefined;
  const cancel = () => {
    if (pending !== undefined) target.cancelAnimationFrame(pending);
    pending = undefined;
  };
  function schedule(remaining: number): void {
    pending = target.requestAnimationFrame(() => {
      pending = undefined;
      if (!active) return;
      if (remaining > 1) schedule(remaining - 1);
      else action();
    });
  }
  const resize = () => {
    cancel();
    schedule(frameCount);
  };
  target.addEventListener("resize", resize);
  return () => {
    active = false;
    target.removeEventListener("resize", resize);
    cancel();
  };
}
