import { closeSync, existsSync, openSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";

const args = process.argv.slice(2);
if (args.length !== 2 || args.includes("--help")) {
  console.log("Usage: npm run backup -- SOURCE.sqlite NEW_BACKUP.sqlite");
  process.exitCode = args.length === 1 && args[0] === "--help" ? 0 : 1;
} else {
  const [sourcePath, destinationPath] = args.map((path) => resolve(path));
  if (!existsSync(sourcePath))
    throw new Error("Source database does not exist; no backup created.");
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  let created = false;
  try {
    // Never overwrite a backup or follow an existing destination symlink.
    closeSync(openSync(destinationPath, "wx"));
    created = true;
    await backup(source, destinationPath);
    console.log(`SQLite backup saved: ${destinationPath}`);
  } catch (error) {
    if (created) rmSync(destinationPath, { force: true });
    throw error;
  } finally {
    source.close();
  }
}
