type Scheduler = { set(callback: () => void, delay: number): number; clear(id: number): void };
/** One pending selection update. Clearing invalidates even an already-queued callback. */
export function createDelayedSelection<T = string>(
  select: (value: T) => void,
  scheduler: Scheduler = {
    set: (callback, delay) => window.setTimeout(callback, delay),
    clear: (id) => window.clearTimeout(id),
  },
  delay = 220,
) {
  let pending: { value: T } | null = null;
  let timer: number | undefined;
  let generation = 0;
  function clear() {
    generation++;
    if (timer !== undefined) scheduler.clear(timer);
    timer = undefined;
    pending = null;
  }
  function flush() {
    const key = pending;
    clear();
    if (key !== null) select(key.value);
  }
  function defer(key: T) {
    clear();
    pending = { value: key };
    const current = generation;
    timer = scheduler.set(() => {
      if (current === generation) flush();
    }, delay);
  }
  return { clear, flush, defer };
}
