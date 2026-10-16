import { snapshotInput } from "../core/input-snapshot.ts";
import { ensure, record } from "../core/model.ts";

/** Capture named commands before any asynchronous work, including provenance. */
export function captureCommand<T>(input: T): T {
  const captured = snapshotInput(input);
  ensure(record(captured), "validation", "Command must be an object");
  return captured;
}
