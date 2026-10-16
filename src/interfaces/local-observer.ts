import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { open, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { Locator, ObservedState } from "../core/evidence.ts";

const maximum = 16 * 1024 * 1024;
function git(repository: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["--no-lazy-fetch", "--no-replace-objects", "-C", repository, ...args],
      {
        encoding: "buffer",
        timeout: 5000,
        maxBuffer: maximum,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_NO_LAZY_FETCH: "1" },
      },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
  });
}
function hash(content: Buffer) {
  return "sha256:" + createHash("sha256").update(content).digest("hex");
}

/** Explicit offline snapshots only. Git observes committed blobs, not the working tree. */
export async function observeLocal(locator: Locator): Promise<ObservedState> {
  try {
    if (locator.system === "git") {
      const repository = resolve(locator.repository);
      const commit = (
        await git(repository, [
          "rev-parse",
          "--verify",
          "--end-of-options",
          locator.ref + "^{commit}",
        ])
      )
        .toString()
        .trim();
      if (!/^[0-9a-f]{40,64}$/.test(commit))
        return { availability: "unknown", reason: "Cannot resolve an immutable local commit" };
      const object = commit + ":" + locator.path;
      const type = (await git(repository, ["cat-file", "-t", object])).toString().trim();
      if (type !== "blob")
        return {
          availability: "unknown",
          commit,
          reason: "Declared Git path is not a committed file",
        };
      const content = await git(repository, ["cat-file", "blob", object]);
      return { availability: "available", commit, hash: hash(content) };
    }
    const path = resolve(locator.path);
    const handle = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
    try {
      const before = await handle.stat({ bigint: true });
      if (!before.isFile() || before.size > BigInt(maximum))
        return {
          availability: "unknown",
          reason: "Local input must be a regular file no larger than 16 MiB",
        };
      // Bounded read; reject growth, replacement or mutation during observation.
      const buffer = Buffer.alloc(Number(before.size) + 1);
      let total = 0;
      while (total < buffer.length) {
        const { bytesRead } = await handle.read(buffer, total, buffer.length - total, total);
        if (!bytesRead) break;
        total += bytesRead;
      }
      const after = await handle.stat({ bigint: true }),
        located = await stat(path, { bigint: true });
      if (
        total !== Number(before.size) ||
        before.mtimeNs !== after.mtimeNs ||
        before.ctimeNs !== after.ctimeNs ||
        before.ino !== located.ino ||
        before.dev !== located.dev
      )
        return {
          availability: "unknown",
          reason: "Local file changed during observation; retry explicitly",
        };
      return { availability: "available", hash: hash(buffer.subarray(0, total)) };
    } finally {
      await handle.close();
    }
  } catch {
    return {
      availability: "unknown",
      reason:
        locator.system === "git"
          ? "Local commit or scoped Git file unavailable, too large, or unresolved (no fetch attempted)"
          : "Local file missing or unreadable",
    };
  }
}
