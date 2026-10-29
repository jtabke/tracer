import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/index.ts";
import type { Repository } from "../src/application/ports/repository.ts";
import type { EvaluationCommand } from "../src/application/evaluations.ts";
import type { ChangesetCommand } from "../src/application/commands.ts";

type Request = { id: number; action: string; input?: ChangesetCommand | EvaluationCommand };
const repository = new SQLiteRepository(process.argv[2]);
const tracer = new Tracer(repository);
let release: (() => void) | undefined;
function barrier(id: number, before?: number) {
  return new Promise<void>((resolve) => {
    release = resolve;
    process.send!({ id, held: true, before });
  });
}
async function hold(message: Request) {
  return repository.transaction(
    async (tx) => {
      const before = await tx.headRevision();
      await barrier(message.id, before);
      return { before, after: await tx.headRevision() };
    },
    message.action === "hold-read" ? { readOnly: true } : undefined,
  );
}
async function evaluate(message: Request) {
  const controlled: Repository = {
    transaction: (work, options) =>
      repository.transaction(async (tx) => {
        const value = await work(tx);
        if (message.action === "evaluation-before-commit") await barrier(message.id);
        return value;
      }, options),
    close: () => repository.close(),
  };
  const result = await new Tracer(controlled).evaluations.commit(
    message.input as EvaluationCommand,
    { actor: "independent-process-contract" },
  );
  if (message.action === "evaluation-after-commit") await barrier(message.id);
  return result;
}
async function dispatch(message: Request) {
  switch (message.action) {
    case "hold-read":
    case "hold-write":
      return hold(message);
    case "apply":
      return tracer.applyChangeset(message.input as ChangesetCommand);
    case "evaluation-before-commit":
    case "evaluation-after-commit":
      return evaluate(message);
    case "snapshot":
      return tracer.getProjectSnapshot();
    default:
      throw new Error("Unknown worker action");
  }
}
process.on("message", async (message: Request) => {
  if (message.action === "release") {
    release?.();
    return;
  }
  try {
    process.send!({ id: message.id, result: await dispatch(message) });
  } catch (error) {
    const failure = error as { code?: string; message: string };
    process.send!({ id: message.id, error: { code: failure.code, message: failure.message } });
  }
});
process.on("disconnect", () => {
  repository.close();
});
process.send!({ ready: true });
