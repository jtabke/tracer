#!/usr/bin/env node
import { SQLiteRepository } from "../persistence/sqlite.ts";
import { Tracer } from "../application/service.ts";
import { TracerError } from "../core/model.ts";
import { dispatchCli } from "./cli-dispatch.ts";
import { cliHelp } from "./cli-help.ts";
import { cliOptions } from "./cli-input.ts";
import { observeLocal } from "./local-observer.ts";
import { serializeProjectExport, type ProjectExport } from "../core/project-export.ts";

let repository: SQLiteRepository | undefined;
try {
  const options = cliOptions(process.argv.slice(2));
  if (!options.tokens.length || options.tokens[0] === "--help") console.log(cliHelp);
  else {
    repository = new SQLiteRepository(options.db);
    const tracer = new Tracer(repository, undefined, observeLocal);
    const result = await dispatchCli({ tracer, ...options });
    if (options.tokens[0] === "project" && options.tokens[1] === "export")
      process.stdout.write(serializeProjectExport(result as ProjectExport));
    else console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(
    JSON.stringify({
      error: error instanceof TracerError ? error.code : "storage",
      message: error instanceof TracerError ? error.message : "Unexpected failure",
      ...(error instanceof TracerError && error.details ? { details: error.details } : {}),
    }),
  );
  process.exitCode = 1;
} finally {
  repository?.close();
}
