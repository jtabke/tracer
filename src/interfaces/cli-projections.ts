import { ensure } from "../core/model.ts";
import type { WorkingContextQuery } from "../core/working-context.ts";
import type { HistoryQuery, ObjectQuery } from "../core/model.ts";
import type {
  GraphQuery,
  FamilyQuery,
  ChainQuery,
  ConnectionsQuery,
  TableQuery,
  MatrixQuery,
  RecordedConnectionsQuery,
} from "../application/views.ts";
import { arity, queryInput, requiredInput, type CliCommand } from "./cli-input.ts";

export const projectionCommands: Record<string, CliCommand> = {
  "working-context get": ({ tracer, args }) =>
    tracer.getWorkingContext(requiredInput<WorkingContextQuery>(args)),
  "graph get": ({ tracer, args }) => tracer.getGraph(requiredInput<GraphQuery>(args)),
  "family get": ({ tracer, args }) => tracer.getFamily(requiredInput<FamilyQuery>(args)),
  "chain get": ({ tracer, args }) => tracer.getChain(requiredInput<ChainQuery>(args)),
  "connections get": ({ tracer, args }) =>
    tracer.getConnections(requiredInput<ConnectionsQuery>(args)),
  "model-connections get": ({ tracer, args }) =>
    tracer.getRecordedConnections(requiredInput<RecordedConnectionsQuery>(args)),
  "work get": ({ tracer, args }) => tracer.getWorkingSet(queryInput<ObjectQuery>(args)),
  "table get": ({ tracer, args }) => tracer.getTable(requiredInput<TableQuery>(args)),
  "matrix get": ({ tracer, args }) => tracer.getMatrix(requiredInput<MatrixQuery>(args)),
  "timeline get": ({ tracer, args }) => {
    arity(args, 0, 1);
    return tracer.timeline(args[0] === undefined ? undefined : Number(args[0]));
  },
};
export const legacyProjectionCommands: Record<string, CliCommand> = {
  history: ({ tracer, args }) => {
    ensure(args.length <= 1, "usage", "History accepts one query object");
    return tracer.history(queryInput<HistoryQuery>(args));
  },
  trace: ({ tracer, args }) => {
    ensure(args[0] && args.length <= 4, "usage", "Trace requires ID");
    return tracer.traverse(args[0], {
      direction: args[1] as "forward" | "reverse" | "both" | undefined,
      type: args[2] === "-" ? undefined : args[2],
      maxDepth: args[3] === undefined ? undefined : Number(args[3]),
    });
  },
};
