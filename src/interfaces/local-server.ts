import { mutation, readQuery } from "./api-endpoints.ts";
import type { Provenance } from "../core/model.ts";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { Socket } from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { TracerError, ensure, record, validateProvenance } from "../core/model.ts";
import type { Tracer } from "../application/service.ts";
import { demoGuide } from "./demo-guide.ts";
import { serializeProjectExport, type ProjectExport } from "../core/project-export.ts";
import type { DemoGuide } from "./demo-guide.ts";

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  ensure(
    request.headers["content-type"]?.split(";")[0].trim() === "application/json",
    "usage",
    "Content-Type must be application/json",
  );
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    ensure(size <= 1024 * 1024, "usage", "Request body exceeds 1 MiB");
    chunks.push(chunk);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new TracerError("usage", "Invalid JSON body");
  }
  ensure(record(value), "usage", "JSON body must be an object");
  return value;
}
function ownOrigin(request: IncomingMessage, origin: string) {
  // Exact Host validation blocks DNS rebinding; there are no CORS allowances.
  return (
    request.headers.host === new URL(origin).host &&
    (request.headers.origin === undefined || request.headers.origin === origin) &&
    (request.headers["sec-fetch-site"] === undefined ||
      ["same-origin", "none"].includes(String(request.headers["sec-fetch-site"])))
  );
}
async function asset(root: string, url: URL) {
  ensure(!url.pathname.startsWith("/api/"), "not_found", "Unknown query endpoint");
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    throw new TracerError("usage", "Invalid URL encoding");
  }
  const path = await realpath(
    resolve(root, pathname === "/" ? "index.html" : "." + pathname),
  ).catch(() => undefined);
  ensure(path && path.startsWith(root + sep), "not_found", "Asset not found");
  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
  };
  return {
    content: await readFile(path),
    type: types[extname(path)] ?? "application/octet-stream",
  };
}
function failure(error: unknown) {
  if (!(error instanceof TracerError))
    return { status: 500, value: { error: "storage", message: "Local server operation failed" } };
  const statuses: Record<TracerError["code"], number> = {
    validation: 400,
    referential_integrity: 400,
    unsupported_storage: 400,
    usage: 400,
    conflict: 409,
    schema_conflict: 409,
    not_found: 404,
    busy: 503,
    storage: 503,
  };
  return {
    status: statuses[error.code],
    value: {
      error: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}
const securityHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};

async function serveRead(
  tracer: Tracer,
  root: string | undefined,
  url: URL,
  context: { token: string; guide: DemoGuide | null; projects: { id: string; title: string }[] },
  response: ServerResponse,
  send: (status: number, value: unknown) => void,
) {
  const result = await readQuery(tracer, url, context);
  if (result.handled) {
    if (url.pathname === "/api/project-export") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(serializeProjectExport(result.value as ProjectExport));
      return;
    }
    send(200, result.value);
    return;
  }
  ensure(root, "not_found", "Unknown query endpoint");
  const file = await asset(root, url);
  response.writeHead(200, { "Content-Type": file.type });
  response.end(file.content);
}
/** A loopback-only same-origin interface, not the organizational server/API. */
export async function startLocalServer(
  tracer: Tracer,
  uiDirectory: string | undefined,
  port = 4317,
  guide?: DemoGuide,
  projects: { id: string; title: string; tracer: Tracer; guide?: DemoGuide }[] = [],
  provenance: Provenance = { actor: "local-ui" },
) {
  ensure(Number.isInteger(port) && port >= 0 && port <= 65535, "usage", "Invalid port");
  provenance = validateProvenance({ ...provenance });
  const root = uiDirectory === undefined ? undefined : await realpath(uiDirectory),
    token = crypto.randomUUID();
  const registry = new Map<string, { tracer: Tracer; title: string; guide?: DemoGuide }>([
    ["default", { tracer, title: guide?.title.split(" — ")[0] ?? "Local project", guide }],
    ...projects.map((project) => [project.id, project] as const),
  ]);
  ensure(
    registry.size === projects.length + 1 &&
      projects.every((project) => /^[a-z0-9-]+$/.test(project.id)),
    "usage",
    "Project ids must be unique lowercase names",
  );
  const catalogue = [...registry].map(([id, project]) => ({ id, title: project.title }));
  let origin = "";
  const server = createServer(async (request, response) => {
    const send = (status: number, value: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(value));
    };
    for (const [key, value] of Object.entries(securityHeaders)) response.setHeader(key, value);
    try {
      if (!ownOrigin(request, origin)) {
        send(403, { error: "usage", message: "Only the server's own origin is allowed" });
        return;
      }
      const url = new URL(request.url ?? "/", origin);
      ensure(url.origin === origin, "usage", "Invalid request URL");
      const project = registry.get(projectRequestId(request));
      ensure(project, "not_found", "Unknown project. Choose a configured project.");
      const context = {
        token,
        guide: projectGuide(project.guide),
        projects: catalogue,
      };
      if (request.method === "POST") {
        if (!validMutationSession(request, origin, token)) {
          send(403, { error: "usage", message: "Mutation requires same-origin session token" });
          return;
        }
        send(200, await mutation(project.tracer, url.pathname, await body(request), provenance));
        return;
      }
      if (request.method !== "GET") {
        send(405, { error: "usage", message: "Method not allowed" });
        return;
      }
      await serveRead(project.tracer, root, url, context, response, send);
    } catch (error) {
      const result = failure(error);
      if (!response.headersSent) send(result.status, result.value);
      else response.end();
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 40;
  const close = localServerClose(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address !== "string") origin = `http://127.0.0.1:${address.port}`;
      server.off("error", reject);
      resolve();
    });
  });
  return {
    origin,
    close,
  };
}

/** Node 24 can retain browser preconnect sockets during close; drain actual requests normally. */
function localServerClose(server: Server) {
  const preconnections = new Set<Socket>();
  server.on("connection", (socket) => {
    preconnections.add(socket);
    socket.once("data", () => preconnections.delete(socket));
    socket.once("close", () => preconnections.delete(socket));
  });
  return () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      for (const socket of preconnections) if (socket.bytesRead === 0) socket.destroy();
    });
}

function validMutationSession(request: IncomingMessage, origin: string, token: string) {
  return request.headers.origin === origin && request.headers["x-tracer-token"] === token;
}

function projectRequestId(request: IncomingMessage) {
  return String(request.headers["x-tracer-project"] ?? "default");
}
function projectGuide(guide?: DemoGuide) {
  return guide ? demoGuide(guide) : null;
}
