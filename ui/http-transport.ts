import { ApiError } from "../src/interfaces/api-contract.ts";
import { literal, object, text, optional, array, union, number } from "../src/interfaces/decode.ts";
const errorResponse = object({
  error: literal(
    "validation",
    "conflict",
    "schema_conflict",
    "not_found",
    "referential_integrity",
    "busy",
    "storage",
    "unsupported_storage",
    "usage",
  ),
  message: text,
  details: optional(
    object({
      kind: optional(literal("schema", "entity", "relationship")),
      id: optional(text),
      expectedVersion: optional(number),
      actualVersion: optional(number),
      path: optional(array(union(text, number))),
    }),
  ),
});
let token = "";
// Bound once per document. Switching projects reloads the document, so a retained
// draft or delayed response can never silently target a different database.
const project =
  typeof window === "undefined"
    ? "default"
    : (new URLSearchParams(window.location.search).get("project") ?? "default");
export async function transport<T>(
  path: string,
  decode: (value: unknown) => T,
  body?: string,
): Promise<T> {
  try {
    const response = await fetch(
      path,
      body === undefined
        ? { cache: "no-store", headers: { "X-Tracer-Project": project } }
        : {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Tracer-Token": token,
              "X-Tracer-Project": project,
            },
            body,
          },
    );
    const value: unknown = await response.json();
    if (!response.ok) {
      const error = errorResponse(value);
      throw new ApiError(error.error, error.message, error.details);
    }
    return decode(value);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      body === undefined ? "read_failed" : "outcome_unknown",
      body === undefined
        ? "Could not read the project. Refresh to retry."
        : "Could not confirm the save outcome. Refresh and inspect saved data/history before retrying.",
    );
  }
}

export function setToken(value: string) {
  token = value;
}
