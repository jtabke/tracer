import { ensure } from "../core/model.ts";
import { canonical } from "../core/evidence.ts";

/** Portable bounded semantic fingerprint, independent of incidental JSON key order. */
export async function factDigest(value: unknown) {
  const bytes = new TextEncoder().encode(canonical(value));
  ensure(
    bytes.length <= 1048576,
    "validation",
    "Application fact exceeds 1 MiB; narrow the selected basis",
  );
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return (
    "sha256:" +
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  );
}
