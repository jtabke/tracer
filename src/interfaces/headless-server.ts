import { startLocalServer } from "./local-server.ts";
import type { Tracer } from "../application/service.ts";
import type { Provenance } from "../core/model.ts";

export type HeadlessServerOptions = {
  port?: number;
  /** Trusted process configuration, never taken from an HTTP request. */
  provenance?: Provenance;
  projects?: { id: string; title: string; tracer: Tracer }[];
};
/** Loopback API with no static assets, browser or frontend build requirement. */
export function startHeadlessServer(tracer: Tracer, options: HeadlessServerOptions = {}) {
  return startLocalServer(
    tracer,
    undefined,
    options.port,
    undefined,
    options.projects,
    options.provenance ?? { actor: "local-api", reason: "Headless operation" },
  );
}
