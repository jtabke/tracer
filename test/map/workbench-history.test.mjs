import test from "node:test";
import assert from "node:assert/strict";
import { snapshotAt, diffAt } from "../../ui/workbench/workspace-history.ts";
import { renderHistoryPanel, renderTimeline } from "../../ui/workbench/history-renderer.ts";

const record = (key, fields = {}) => ({ id: key, key, type: "requirement", fields });
const entry = (kind, id, projectRevision, snapshot) => ({ kind, id, projectRevision, snapshot });
test("historical projection preserves deletion, recreation and separate entity/link identities", () => {
  const original = record("A", { statement: "original" });
  const recreated = record("A", { statement: "recreated" });
  const link = { id: "shared", source: "A", target: "B", fields: {} };
  const data = {
    revisions: [
      entry("entity", "shared", 1, original),
      entry("relationship", "shared", 2, link),
      entry("entity", "shared", 3, null),
      entry("entity", "shared", 4, recreated),
    ],
  };
  const unchanged = structuredClone(data);
  assert.equal(snapshotAt(data, 2).records.get("A"), original);
  assert.equal(snapshotAt(data, 3).records.size, 0);
  assert.deepEqual(snapshotAt(data, 3).links, [link]);
  assert.equal(snapshotAt(data, 4).records.get("A"), recreated);
  assert.equal(diffAt(data, 4)[0].before, null);
  assert.deepEqual(data, unchanged);
});
test("one changeset compares every object with the preceding revision and retains endpoint order", () => {
  const original = {
    id: "r",
    type: "verifies",
    source: "A",
    target: "B",
    fields: { scope: "old" },
  };
  const next = {
    ...original,
    type: "references",
    source: "C",
    target: "D",
    fields: { scope: "new" },
  };
  const data = {
    revisions: [
      entry("entity", "r", 1, record("r")),
      entry("relationship", "r", 2, original),
      entry("entity", "r", 3, record("r", { statement: "changed" })),
      entry("relationship", "r", 3, next),
      entry("relationship", "r", 4, null),
    ],
  };
  const changes = diffAt(data, 3);
  assert.equal(changes[1].before, original);
  assert.deepEqual(
    changes[1].fields.map((value) => value.key),
    ["target", "type", "source", "scope"],
  );
  assert.equal(diffAt(data, 4)[0].after, null);
  assert.deepEqual(diffAt(data, 4)[0].fields, [{ key: "scope", before: "new", after: undefined }]);
  assert.deepEqual(diffAt(data, 99), []);
});

test("History renders the supplied selection, literal field diff and directed connection labels", () => {
  const key = 'A<&"';
  const data = {
    revisions: [
      entry("entity", "a", 1, record(key, { statement: "old" })),
      entry("entity", "a", 2, record(key, { statement: "<script>" })),
    ],
  };
  const panel = {
    event: 2,
    filter: "selected",
    subject: key,
    feed: [{ revision: 2, kind: "entity", title: "Edited <A>", operation: "Modified" }],
    limit: 30,
    more: true,
  };
  const html = renderHistoryPanel({
    ...panel,
    detail: {
      reason: "Edit & inspect",
      diffs: diffAt(data, 2),
      work: [
        {
          record: { key: 'B"', title: "Neighbor" },
          relationships: [
            { type: "verified_by", source: key },
            { type: "references", source: 'B"' },
          ],
        },
      ],
    },
  });
  assert.match(html, /A&lt;&amp;&quot; only/);
  assert.match(html, /data-event="2" class="selected" aria-pressed="true"/);
  assert.match(html, /Edited &lt;A&gt;/);
  assert.match(html, /data-action="more-history"/);
  assert.match(html, /Edit &amp; inspect/);
  assert.match(html, /<mark>&lt;script&gt;<\/mark>/);
  assert.match(html, /data-review-artifact="B&quot;"/);
  assert.match(html, /Verified by · Referenced by/);
  assert.match(renderHistoryPanel({ ...panel, event: 1 }), /No change to this selection at r1/);
  assert.match(
    renderHistoryPanel({ ...panel, feed: [] }),
    /No recorded revisions for this local selection/,
  );
});

test("timeline markers use the supplied revisions independently of the current selection", () => {
  const timeline = {
    scope: "selected",
    head: 5,
    revision: 2,
    events: [{ revision: 3, title: 'Moved "A"' }],
  };
  const html = renderTimeline(timeline);
  assert.match(html, /value="selected" selected/);
  assert.match(html, /data-axis-event="3" data-style="left:50%"/);
  assert.match(html, /aria-label="Revision 3: Moved &quot;A&quot;"/);
  assert.match(html, /value="2" aria-valuetext="Revision 2 of 5"/);
  const first = renderTimeline({
    ...timeline,
    head: 1,
    revision: 1,
    events: [{ revision: 1, title: "First" }],
  });
  assert.match(first, /data-axis-event="1" data-style="left:0%"/);
  assert.equal(
    renderTimeline({ ...timeline, head: 0, revision: 0, events: [] }),
    '<footer class="historybar">No saved changes yet</footer>',
  );
});
