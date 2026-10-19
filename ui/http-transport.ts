import { createClient } from "../src/client.ts";
// A document retains one immutable project identity; switching reloads it.
const project =
  typeof window === "undefined"
    ? "default"
    : (new URLSearchParams(window.location.search).get("project") ?? "default");
const client = createClient({ project });
export const readRequest = client.read;
export const writeRequest = client.write;
export const connectSession = client.connect;
