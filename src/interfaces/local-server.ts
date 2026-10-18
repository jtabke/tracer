import { createServer } from "node:http";
import type { Server } from "node:http";
import type { Socket } from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { TracerError, ensure, record, knownProperties } from "../core/model.ts";
import type { Schema, ObjectQuery, HistoryQuery } from "../core/model.ts";
import type { Tracer } from "../application/service.ts";
import { demoGuide } from "./demo-guide.ts";
import { serializeProjectExport, type ProjectExport } from "../core/project-export.ts";
import type { DemoGuide } from "./demo-guide.ts";
import type { ChangesetInput } from "../application/commands.ts";
import type { MatrixQuery, TableQuery } from "../application/views.ts";
import type {
  EvidenceKind,
  EvidenceQuery,
  Locator,
  ReceiptInput,
  ReviewInput,
} from "../core/evidence.ts";

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
function query(url: URL) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams) {
    ensure(!Object.hasOwn(result, key), "usage", "Duplicate query parameter");
    Object.defineProperty(result, key, {
      value: [
        "limit",
        "depth",
        "atRevision",
        "compareRevision",
        "before",
        "expectedProjectRevision",
      ].includes(key)
        ? Number(value)
        : value,
      enumerable: true,
    });
  }
  return result;
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
async function mutation(tracer: Tracer, path: string, input: Record<string, unknown>) {
  switch (path) {
    case "/api/baselines":
      return tracer.baselines.capture(input as import("../core/baseline.ts").BaselineInput, {
        actor: "local-ui",
      });
    case "/api/configurations":
      return tracer.configurations.capture(
        input as import("../core/configuration.ts").ConfigurationInput,
        { actor: "local-ui" },
      );
    case "/api/saved-views":
      return tracer.savedViews.save(input as import("../application/saved-views.ts").ViewSave);
    case "/api/saved-views/remove":
      ensure(
        Object.keys(input).every((key) => ["id", "expectedVersion"].includes(key)),
        "usage",
        "Invalid saved view deletion",
      );
      await tracer.savedViews.remove(input.id as string, input.expectedVersion as number);
      return { removed: true };
    case "/api/external":
      return tracer.evidence.bindExternal(
        input as {
          entityId: string;
          system: "git" | "file";
          externalId: string;
          ownership: "external";
        },
        { actor: "local-ui" },
      );
    case "/api/observations":
      return tracer.evidence.observe(input as { entityId: string; locator: Locator }, {
        actor: "local-ui",
      });
    case "/api/receipts":
      return tracer.evidence.recordReceipt(input as ReceiptInput, { actor: "local-ui" });
    case "/api/reviews":
      return tracer.evidence.review(input as ReviewInput, { actor: "local-ui" });
    default:
      return nativeMutation(tracer, path, input);
  }
}
async function nativeMutation(tracer: Tracer, path: string, input: Record<string, unknown>) {
  switch (path) {
    case "/api/coverage-expectations":
      return tracer.coverage.set(input as import("../core/coverage.ts").CoverageSet, {
        actor: "local-ui",
      });
    case "/api/schema":
      knownProperties(input, ["schema", "expectedVersion", "initialViews"]);
      return tracer.setSchema({
        schema: input.schema as Schema,
        expectedVersion: input.expectedVersion as number,
        ...(input.initialViews === undefined
          ? {}
          : {
              initialViews: input.initialViews as import("../core/presentation.ts").InitialView[],
            }),
        provenance: { actor: "local-ui", reason: "Define project schema" },
      });
    case "/api/changesets":
      return tracer.applyChangeset(input as ChangesetInput, {
        actor: "local-ui",
        reason: "Interactive edit",
      });
    default:
      throw new TracerError("not_found", "Unknown mutation endpoint");
  }
}
function expandedGraphFilter(expanded: unknown) {
  if (typeof expanded !== "string") return {};
  return { expanded: expanded ? expanded.split(",") : [] };
}
async function readQuery(
  tracer: Tracer,
  url: URL,
  context: { token: string; guide: DemoGuide | null; projects: { id: string; title: string }[] },
): Promise<{ handled: true; value: unknown } | { handled: false }> {
  const projections: Record<string, (filters: ReturnType<typeof query>) => Promise<unknown>> = {
    "/api/next-work": (filters) =>
      tracer.getNextWork(filters as import("../core/next-work.ts").NextWorkQuery),
    "/api/table": (filters) => tracer.getTable(filters as TableQuery),
    "/api/matrix": (filters) => tracer.getMatrix(filters as MatrixQuery),
    "/api/entities": (filters) => tracer.queryEntities(filters as ObjectQuery),
    "/api/relationships": (filters) => tracer.queryRelationships(filters as ObjectQuery),
    "/api/history": (filters) => tracer.history(filters as HistoryQuery),
    "/api/graph": (filters) =>
      tracer.getGraph({
        ...filters,
        ...expandedGraphFilter(filters.expanded),
      } as import("../application/views.ts").GraphQuery),
    "/api/work": (filters) => tracer.getWorkingSet(filters as ObjectQuery),
    "/api/family": (filters) =>
      tracer.getFamily(filters as import("../application/views.ts").FamilyQuery),
    "/api/model-connections": (filters) =>
      tracer.getRecordedConnections(
        filters as import("../application/views.ts").RecordedConnectionsQuery,
      ),
    "/api/connections": (filters) =>
      tracer.getConnections(filters as import("../application/views.ts").ConnectionsQuery),
  };
  const projection = projections[url.pathname];
  if (projection) return { handled: true, value: await projection(query(url)) };
  const resources: Record<string, () => unknown> = {
    "/api/project-export": () => {
      noFilters(url, "Project export accepts no filters");
      return tracer.exportProject();
    },
    "/api/coverage-expectations": () =>
      tracer.coverage.list(query(url) as import("../core/coverage.ts").CoverageListQuery),
    "/api/coverage": () =>
      tracer.coverage.evaluate(query(url) as import("../core/coverage.ts").CoverageEvaluationQuery),
    "/api/impact": () => tracer.getChangeImpact(impactFilters(url)),
    "/api/working-context": () => tracer.getWorkingContext(workingContextFilters(url)),
    "/api/session": () => ({ token: context.token }),
    "/api/projects": () => {
      noFilters(url, "Project catalogue accepts no filters");
      return context.projects;
    },
    "/api/project-snapshot": () => {
      noFilters(url, "Project snapshot accepts no filters");
      return tracer.getProjectSnapshot();
    },
    "/api/schema": async () => (await tracer.getSchema()) ?? null,
    "/api/saved-views": () => {
      noFilters(url, "Saved views accept no filters");
      return tracer.savedViews.list();
    },
    "/api/demo-guide": () => {
      noFilters(url, "Demo guide accepts no filters");
      return context.guide;
    },
    "/api/configurations": () => tracer.configurations.list(query(url) as EvidenceQuery),
    "/api/configuration": () =>
      tracer.configurations.get(
        exactParameter(url, "id", "validation", "Configuration requires id"),
      ),
    "/api/baselines": () =>
      tracer.baselines.list(query(url) as import("../core/baseline.ts").BaselineQuery),
    "/api/baseline": () =>
      tracer.baselines.get(exactParameter(url, "id", "validation", "Baseline requires id")),
    "/api/baseline-contents": () =>
      tracer.baselines.contents(query(url) as import("../core/baseline.ts").BaselineContentsQuery),
    "/api/native-pin": () => readNativePin(tracer, url),
    "/api/receipt": () =>
      tracer.evidence.getReceipt(
        exactParameter(url, "receiptId", "usage", "Receipt requires receiptId"),
      ),
    "/api/comparison": () =>
      tracer.evidence.compareReceipt(
        exactParameter(url, "receiptId", "usage", "Comparison requires receiptId"),
      ),
    "/api/evidence": () => {
      const { kind, ...filters } = query(url);
      return tracer.evidence.list(kind as EvidenceKind, filters as EvidenceQuery);
    },
    "/api/timeline": () => readTimeline(tracer, url),
    "/api/chain": () => tracer.getChain(chainFilters(url)),
  };
  const resource = resources[url.pathname];
  return resource ? { handled: true, value: await resource() } : { handled: false };
}
function exactParameter(url: URL, key: string, code: "usage" | "validation", message: string) {
  ensure(url.searchParams.size === 1 && url.searchParams.has(key), code, message);
  return url.searchParams.get(key)!;
}
function noFilters(url: URL, message: string) {
  ensure(url.searchParams.size === 0, "usage", message);
}
function readNativePin(tracer: Tracer, url: URL) {
  ensure(
    url.searchParams.size === 2 &&
      url.searchParams.getAll("id").length === 1 &&
      url.searchParams.getAll("version").length === 1 &&
      /^[1-9]\d*$/.test(url.searchParams.get("version") ?? ""),
    "validation",
    "Native revision requires an id and positive exact version",
  );
  return tracer.getNativePin(url.searchParams.get("id")!, Number(url.searchParams.get("version")));
}
function readTimeline(tracer: Tracer, url: URL) {
  const filters = query(url);
  ensure(
    Object.keys(filters).every((key) => key === "before"),
    "usage",
    "Invalid timeline query",
  );
  return tracer.timeline(filters.before as number | undefined);
}
function chainFilters(url: URL): import("../application/views.ts").ChainQuery {
  const filters = query(url);
  ensure(typeof filters.steps === "string", "usage", "Chain needs column steps");
  let steps: unknown;
  try {
    steps = JSON.parse(filters.steps);
  } catch {
    throw new TracerError("usage", "Invalid chain steps JSON");
  }
  return { ...filters, steps } as import("../application/views.ts").ChainQuery;
}

function workingContextFilters(url: URL): import("../core/working-context.ts").WorkingContextQuery {
  const encoded = exactParameter(url, "query", "usage", "Working context requires one query JSON");
  try {
    return JSON.parse(encoded);
  } catch {
    throw new TracerError("usage", "Invalid working context JSON");
  }
}
function impactFilters(url: URL): import("../core/impact.ts").ChangeImpactQuery {
  const filters = query(url);
  ensure(
    typeof filters.relationshipTypes === "string",
    "usage",
    "Impact needs explicit relationship types as a JSON array",
  );
  let relationshipTypes: unknown;
  try {
    relationshipTypes = JSON.parse(filters.relationshipTypes);
  } catch {
    throw new TracerError("usage", "Invalid impact relationship types JSON");
  }
  return { ...filters, relationshipTypes } as import("../core/impact.ts").ChangeImpactQuery;
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
  const statuses: Partial<Record<TracerError["code"], number>> = {
    conflict: 409,
    schema_conflict: 409,
    not_found: 404,
    busy: 503,
    storage: 503,
  };
  return {
    status: statuses[error.code] ?? 400,
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
  root: string,
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
  const file = await asset(root, url);
  response.writeHead(200, { "Content-Type": file.type });
  response.end(file.content);
}
/** A loopback-only same-origin interface, not the organizational server/API. */
export async function startLocalServer(
  tracer: Tracer,
  uiDirectory: string,
  port = 4317,
  guide?: DemoGuide,
  projects: { id: string; title: string; tracer: Tracer; guide?: DemoGuide }[] = [],
) {
  ensure(Number.isInteger(port) && port >= 0 && port <= 65535, "usage", "Invalid port");
  const root = await realpath(uiDirectory),
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
        send(200, await mutation(project.tracer, url.pathname, await body(request)));
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
