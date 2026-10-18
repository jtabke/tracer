import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeHtml, mono } from "../ui/workbench/html.ts";

test("workbench markup keeps recorded text literal in text and quoted attributes", () => {
  const recorded = `<img src=x onerror="alert('x')"> & pressure ≤ 80`;
  const escaped = "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; pressure ≤ 80";
  assert.equal(escapeHtml(recorded), escaped);
  assert.equal(mono(recorded), `<span class="mono">${escaped}</span>`);
  for (const [value, expected] of [
    [null, ""],
    [undefined, ""],
    [0, "0"],
    [false, "false"],
  ])
    assert.equal(escapeHtml(value), expected);
  assert.equal(escapeHtml("&lt;"), "&amp;lt;");
});
