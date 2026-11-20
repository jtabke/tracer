import { changedText } from "./authoring-policy.ts";
import { escapeHtml as e, mono } from "./html.ts";
import { relationshipLabel, titleCase } from "./presentation.ts";
import type { diffAt, nativeFeed } from "./workspace-history.ts";
import type { WorkspaceEntity, WorkspaceRelationship } from "./workspace-snapshot.ts";

type Change = ReturnType<typeof diffAt>[number];
type FeedItem = ReturnType<typeof nativeFeed>[number];
type Scope = "project" | "selected";
type Connected = {
  record: Pick<WorkspaceEntity, "key" | "title">;
  relationships: readonly Pick<WorkspaceRelationship, "type" | "source">[];
};
type Detail = { reason?: string; diffs: readonly Change[]; work: readonly Connected[] };

function recordKey(snapshot: Change["before"]) {
  return snapshot && "key" in snapshot ? snapshot.key : undefined;
}

function renderField(field: Change["fields"][number]) {
  const before = typeof field.before === "string" ? field.before : JSON.stringify(field.before);
  const after = typeof field.after === "string" ? field.after : JSON.stringify(field.after);
  const parts = changedText(before, after);
  function line(kind: "before" | "after", value: string | undefined, symbol: string) {
    if (value === undefined) return "";
    const part = parts[kind];
    return `<p class="${kind}"><span>${symbol}</span>${e(part.prefix)}${part.change ? `<mark>${e(part.change)}</mark>` : ""}${e(part.suffix)}</p>`;
  }
  return `<section class="field-diff"><h4>${e(titleCase(field.key))}</h4>${line("before", before, "−")}${line("after", after, "+")}</section>`;
}

function renderChange({ before, after, kind, fields }: Change) {
  const heading = recordKey(after) ?? recordKey(before) ?? titleCase(kind);
  const operation = before ? (after ? "Modified" : "Removed") : "Added";
  const link = after && "source" in after ? after : undefined;
  const endpoints = link?.source
    ? `<p>${mono(link.source)} → ${e(titleCase(link.type))} → ${mono(link.target)}</p>`
    : "";
  return `<article><h3>${e(heading)}<span>${operation}</span></h3>${endpoints}${fields.map(renderField).join("")}</article>`;
}

function changeCount(event: number, detail: Detail | undefined) {
  if (!detail) return `No change to this selection at r${event}`;
  const artifacts = detail.diffs.filter((diff) => diff.kind === "entity").length;
  if (artifacts) return `${artifacts} artifact${artifacts === 1 ? "" : "s"} changed`;
  const links = detail.diffs.filter((diff) => diff.kind === "relationship").length;
  return links ? `${links} relationship${links === 1 ? "" : "s"} changed` : "Project model changed";
}

function renderConnectedWork({ work, diffs }: Detail) {
  if (!work.length) return "";
  const changed = new Set(
    diffs.filter((diff) => diff.kind === "entity").map((diff) => recordKey(diff.after)),
  );
  const buttons = work.map(({ record, relationships }) => {
    const labels = relationships.map((link) =>
      relationshipLabel(link.type, changed.has(link.source)),
    );
    return `<button data-review-artifact="${e(record.key)}">${mono(record.key)}<span><strong>${e(record.title)}</strong><small>${e(labels.join(" · "))}</small></span><span>↗</span></button>`;
  });
  return `<section class="connected-work"><h3>Connected engineering work <span>${work.length}</span></h3><p>Connected artifacts, not assessed impacts.</p>${buttons.join("")}</section>`;
}

function changesetButton(item: FeedItem, event: number) {
  const selected = item.revision === event;
  const kind =
    item.kind === "relationship" ? "Relationship" : item.kind === "schema" ? "Model" : "Artifact";
  return `<button data-event="${item.revision}" class="${selected ? "selected" : ""}" aria-pressed="${selected}">${mono(`r${item.revision}`)}<strong>${e(item.title)}</strong><span>${e(item.operation)} · ${kind}</span></button>`;
}

export function renderHistoryPanel({
  event,
  filter,
  subject,
  feed,
  limit,
  more,
  detail,
}: {
  event: number;
  filter: Scope;
  subject: string;
  feed: readonly FeedItem[];
  limit: number;
  more?: boolean;
  detail?: Detail;
}) {
  if (!feed.length)
    return '<section class="history-workspace"><p>No recorded revisions for this local selection.</p><p class="draft-note">Local edits are not saved history.</p><button data-action="graph">Back to graph</button></section>';
  const buttons =
    feed
      .slice(0, limit)
      .map((item) => changesetButton(item, event))
      .join("") || "<p>No native history for this local selection.</p>";
  const showMore =
    feed.length > limit || more ? '<button data-action="more-history">Show more</button>' : "";
  return `<section class="history-workspace"><div class="history-scope"><span class="history-scope-label">${feed.length} changesets</span><label class="sr-only" for="event-filter">History scope</label><select id="event-filter"><option value="selected" ${filter === "selected" ? "selected" : ""}>${e(subject)} only</option><option value="project" ${filter === "project" ? "selected" : ""}>Project</option></select></div><div class="history-columns"><nav class="changeset-feed" aria-label="Changesets">${buttons}${showMore}</nav><div class="change-detail"><div class="change-heading"><h3>${changeCount(event, detail)}</h3></div><p class="change-reason">${e(detail?.reason)}</p>${detail ? detail.diffs.map(renderChange).join("") + renderConnectedWork(detail) : ""}</div></div></section>`;
}

export function renderTimeline({
  head,
  revision,
  scope,
  events,
}: {
  head: number;
  revision: number;
  scope: Scope;
  events: readonly Pick<FeedItem, "revision" | "title">[];
}) {
  if (!head) return '<footer class="historybar">No saved changes yet</footer>';
  const span = Math.max(1, head - 1);
  const ticks = events
    .map(
      (event) =>
        `<button data-axis-event="${event.revision}" data-style="left:${((event.revision - 1) / span) * 100}%" title="r${event.revision} · ${e(event.title)}" aria-label="Revision ${event.revision}: ${e(event.title)}"></button>`,
    )
    .join("");
  return `<footer class="historybar continuous-history"><label class="sr-only" for="timeline-scope">Timeline scope</label><select id="timeline-scope"><option value="project">Project</option><option value="selected" ${scope === "selected" ? "selected" : ""}>Selection</option></select><span class="timeline-scale">Revisions 1–${head}</span><div class="revision-axis"><div class="axis-ticks">${ticks}</div><label class="sr-only" for="revision-range">Project revision</label><input id="revision-range" type="range" min="1" max="${head}" step="1" value="${revision}" aria-valuetext="Revision ${revision} of ${head}"></div><div class="revision-controls"><button data-action="previous-event" aria-label="Previous changeset">‹</button><span class="mono">r${revision}</span><button data-action="next-event" aria-label="Next changeset">›</button></div></footer>`;
}
