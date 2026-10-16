import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const directory = resolve("docs/ux-artifacts/motor-change-tool-test");
test("editable storyboard is an Excalidraw scene with unique native element identities", () => {
  const scene = JSON.parse(readFileSync(resolve(directory, "motor-change.excalidraw"), "utf8"));
  assert.equal(scene.type, "excalidraw");
  assert.equal(scene.version, 2);
  assert.ok(Array.isArray(scene.elements) && scene.elements.length > 0);
  const ids = new Set<string>();
  for (const element of scene.elements) {
    assert.equal(typeof element.id, "string");
    assert.ok(!ids.has(element.id));
    ids.add(element.id);
    assert.equal(typeof element.type, "string");
    for (const value of [element.x, element.y, element.width, element.height])
      assert.ok(Number.isFinite(value));
    assert.ok(element.width >= 0 && element.height >= 0);
    if (element.type === "text") assert.equal(typeof element.text, "string");
  }
  assert.ok(scene.appState);
  assert.ok(scene.files);
});
