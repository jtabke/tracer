import { AsyncLocalStorage } from "node:async_hooks";
import { ensure, TracerError } from "../core/model.ts";

/** Serialize independent callers without allowing a callback to wait on its own queue. */
export class TransactionQueue {
  private closed = false;
  private pending: Promise<unknown> = Promise.resolve();
  private readonly context = new AsyncLocalStorage<{ active: boolean }>();

  async run<T>(work: () => Promise<T>): Promise<T> {
    this.checkOpen();
    if (this.context.getStore()?.active)
      throw new TracerError(
        "storage",
        "Nested transactions on the same repository are not supported; use the active transaction handle",
      );
    const run = this.pending.then(() => {
      this.checkOpen();
      const scope = { active: true };
      return this.context.run(scope, async () => {
        try {
          return await work();
        } finally {
          scope.active = false;
        }
      });
    });
    this.pending = run.catch(() => {});
    return run;
  }
  private checkOpen() {
    ensure(!this.closed, "storage", "Repository is closed");
  }
  close() {
    this.closed = true;
    this.context.disable();
  }
}
