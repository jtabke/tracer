declare module "@bcoe/v8-coverage" {
  import type { Profiler } from "node:inspector";
  type ProcessCoverage = { result: Profiler.ScriptCoverage[] };
  export function mergeProcessCovs(captures: ProcessCoverage[]): ProcessCoverage;
}
