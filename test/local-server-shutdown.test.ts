import type { SetSchemaCommand } from "../src/application/commands.ts";
import type { Schema, Provenance } from "../src/core/model.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { connect } from "node:net";
import { once } from "node:events";
import { resolve } from "node:path";
import { SQLiteRepository } from "../src/persistence/sqlite.ts";
import { Tracer } from "../src/application/service.ts";
import { startLocalServer } from "../src/interfaces/local-server.ts";

test("local shutdown closes an unused browser preconnection", { timeout: 2000 }, async () => {
  const repository = new SQLiteRepository(":memory:");
  const server = await startLocalServer(new Tracer(repository), resolve("ui"), 0);
  const socket = connect(Number(new URL(server.origin).port), "127.0.0.1");
  let socketError: NodeJS.ErrnoException | undefined;
  let closing: Promise<void> | undefined;
  socket.on("error", (error) => {
    socketError = error;
  });
  try {
    await once(socket, "connect");
    const disconnected = new Promise<void>((resolve) => socket.once("close", () => resolve()));
    closing = server.close();
    await closing;
    await disconnected;
    assert.equal(socket.destroyed, true);
    if (socketError) assert.equal(socketError.code, "ECONNRESET");
  } finally {
    socket.destroy();
    await (closing ?? server.close());
    repository.close();
  }
});

test("shutdown drains an active versioned mutation before the database can close", async () => {
  const repository = new SQLiteRepository(":memory:");
  const tracer = new Tracer(repository);
  let arrive!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const setSchema = tracer.setSchema.bind(tracer);
  tracer.setSchema = async (...args: [SetSchemaCommand] | [Schema, number, Provenance]) => {
    arrive();
    await ready;
    return args.length === 1 ? setSchema(args[0]) : setSchema(...args);
  };
  const server = await startLocalServer(tracer, resolve("ui"), 0);
  let closing: Promise<void> | undefined;
  try {
    const { token } = (await (await fetch(server.origin + "/api/session")).json()) as {
      token: string;
    };
    const mutation = fetch(server.origin + "/api/schema", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: server.origin,
        "X-Tracer-Token": token,
      },
      body: JSON.stringify({
        expectedVersion: 0,
        schema: { entityTypes: { item: { fields: {} } }, relationshipTypes: {} },
      }),
    });
    await entered;
    let closed = false;
    const firstClose = server.close();
    assert.strictEqual(server.close(), firstClose);
    closing = firstClose.then(() => {
      closed = true;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(closed, false);
    release();
    const response = await mutation;
    assert.equal(response.status, 200);
    await response.json();
    await closing;
    assert.strictEqual(server.close(), firstClose);
    await server.close();
    assert.equal((await tracer.getSchema())?.version, 1);
  } finally {
    release();
    await (closing ?? server.close());
    repository.close();
  }
});
