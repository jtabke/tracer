import type { WriteInput, WritePath, WriteResponse } from "../src/interfaces/api-contract.ts";
import { ApiError } from "./api.ts";

export type MutationExecutor = <K extends WritePath>(
  path: K,
  input: WriteInput<K>,
) => Promise<WriteResponse<K> | undefined>;
export type MutationAttempt = { [K in WritePath]: { path: K; input: WriteInput<K> } }[WritePath];
export type MutationState =
  | { status: "idle" }
  | { status: "saving" | "committed"; attempt: MutationAttempt }
  | { status: "rejected"; attempt: MutationAttempt; error: unknown }
  | { status: "unknown"; attempt: MutationAttempt; inspectedRead: boolean };

/** Own the synchronous write lock and unknown-outcome recovery, independently of any screen. */
export class MutationController {
  private state: MutationState = { status: "idle" };
  private listeners = new Set<() => void>();
  private readSequence = 0;
  private send: <K extends WritePath>(path: K, input: WriteInput<K>) => Promise<WriteResponse<K>>;
  private report: (error: unknown, attempted?: unknown) => void;
  constructor(send: MutationController["send"], report: MutationController["report"]) {
    this.send = send;
    this.report = report;
  }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(state: MutationState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  run: MutationExecutor = async (path, input) => {
    if (this.state.status === "saving" || this.state.status === "unknown") return undefined;
    let attempt = { path, input } as MutationAttempt;
    try {
      const proposal = structuredClone(input);
      attempt = { path, input: proposal } as MutationAttempt;
      this.update({ status: "saving", attempt });
      const value = await this.send(path, proposal);
      this.update({ status: "committed", attempt });
      return value;
    } catch (error) {
      this.update(
        error instanceof ApiError && error.code === "outcome_unknown"
          ? { status: "unknown", attempt, inspectedRead: false }
          : { status: "rejected", attempt, error },
      );
      this.report(error, attempt.input);
      return undefined;
    }
  };
  /** Capture the unknown attempt before starting a reconciliation read; late reads cannot unlock another attempt. */
  beginReconciliation = () => {
    const sequence = ++this.readSequence;
    const attempt = this.state.status === "unknown" ? this.state.attempt : undefined;
    if (this.state.status === "unknown") this.update({ ...this.state, inspectedRead: false });
    return () => {
      if (
        sequence === this.readSequence &&
        attempt &&
        this.state.status === "unknown" &&
        this.state.attempt === attempt
      )
        this.update({ ...this.state, inspectedRead: true });
    };
  };
  acknowledge = () => {
    if (this.state.status === "unknown" && this.state.inspectedRead)
      this.update({ status: "idle" });
  };
}
