import { capabilityResponse } from "../api-capabilities.ts";
import { guide } from "../api-models.ts";
import { array, nullable, object, text } from "../decode.ts";
import { read } from "./definition.ts";
import * as q from "./query.ts";
export const sessionReads = {
  "/api/capabilities": read({
    query: q.query({}, { empty: "Capabilities accepts no filters" }),
    response: capabilityResponse,
    handle: ({ capabilities }) => capabilities(),
  }),
  "/api/projects": read({
    query: q.query({}, { empty: "Project catalogue accepts no filters" }),
    response: array(object({ id: text, title: text })),
    handle: ({ projects }) => projects,
  }),
  "/api/session": read({
    query: q.query({}, { empty: "Session accepts no filters" }),
    response: object({ token: text }),
    handle: ({ token }) => ({ token }),
  }),
  "/api/demo-guide": read({
    query: q.query({}, { empty: "Demo guide accepts no filters" }),
    response: nullable(guide),
    handle: ({ guide }) => guide,
  }),
};
