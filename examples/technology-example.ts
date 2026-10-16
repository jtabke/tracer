import { exampleLinks, exampleSchema } from "./realistic-model.ts";
import type { ExampleDefinition, ExampleItem } from "./realistic-model.ts";

const items: ExampleItem[] = [
  [
    "application",
    "APP-01",
    "Gatherline — offline event coordination",
    "Fictional app used by event organizers, volunteers and attendees. Volunteers check people in on phones, organizers publish schedule changes and attendees consult a cached agenda; offline write behavior depends on the task.",
  ],
  [
    "outcome",
    "OUTCOME-01",
    "Keep the entry line moving",
    "Volunteers need to admit eligible attendees during short network outages without losing scans or unknowingly counting repeat admissions.",
  ],
  [
    "outcome",
    "OUTCOME-02",
    "Keep participants informed",
    "Attendees need a useful agenda while offline and a clear indication when schedule information may be out of date.",
  ],
  [
    "outcome",
    "OUTCOME-03",
    "Coordinate changes responsibly",
    "Organizers need to publish authorized schedule changes and understand which version volunteers and attendees have received.",
  ],
  [
    "capability",
    "CAP-01",
    "Prepare an offline event pack",
    "Download the permitted event roster and schedule before a shift; make readiness, expiry and last synchronization visible.",
  ],
  [
    "capability",
    "CAP-02",
    "Capture and recover check-ins",
    "Record a scan locally, show whether it is provisional or server-confirmed and resume delivery after connection loss or app restart.",
  ],
  [
    "capability",
    "CAP-03",
    "Resolve repeat admissions",
    "Deduplicate replayed scan operations and surface independently recorded admissions rather than silently overwriting them.",
  ],
  [
    "capability",
    "CAP-04",
    "Read a cached agenda",
    "Let attendees read the downloaded agenda and saved session choices without requiring a live connection.",
  ],
  [
    "capability",
    "CAP-05",
    "Publish schedule updates",
    "Let authorized organizers edit session details, review conflicts and publish a new agenda version.",
  ],
  [
    "capability",
    "CAP-06",
    "Show update freshness",
    "Expose agenda version and last synchronization; refresh when connected without erasing the current reading position.",
  ],
  [
    "capability",
    "CAP-07",
    "Enforce event-scoped permissions",
    "Allow only authorized volunteers to access a roster and only organizers to publish schedule changes; separate offline expiry from server revocation.",
  ],
  [
    "capability",
    "CAP-08",
    "Inspect delivery health",
    "Let operators see queued writes, rejected operations and delivery lag without copying attendee personal details into diagnostic events.",
  ],

  [
    "story",
    "STORY-01",
    "Download before a volunteer shift",
    "As a volunteer, I download a roster and see its event, version and expiry before leaving reliable connectivity.",
    {
      acceptance:
        "Incomplete pack stays unavailable; a complete pack opens offline and labels its expiry.",
    },
  ],
  [
    "story",
    "STORY-02",
    "Scan while offline",
    "As a volunteer, I scan an eligible attendee offline and see a provisional check-in immediately.",
    {
      acceptance:
        "Local record and outgoing operation commit together before the success indication; offline duplicate detection is local-only.",
    },
  ],
  [
    "story",
    "STORY-03",
    "Resume after a phone restart",
    "As a volunteer, I restart the app after recording scans and retain queued operations and their original operation IDs.",
    {
      acceptance:
        "Restart and timeout retries reuse operation IDs; the user sees pending versus confirmed state.",
    },
  ],
  [
    "story",
    "STORY-04",
    "Handle a repeated admission",
    "As an organizer, I distinguish retry of the same operation from a separate scan of the same attendee at another gate.",
    {
      acceptance:
        "Operation replay is idempotent; two distinct operation IDs for one attendee become an explicit admission-conflict case.",
    },
  ],
  [
    "story",
    "STORY-05",
    "Browse a saved agenda",
    "As an attendee, I read the saved agenda offline and keep my selected sessions.",
    {
      acceptance:
        "Agenda content and bookmarks remain readable without a network; display saved-version metadata.",
    },
  ],
  [
    "story",
    "STORY-06",
    "Save session choices offline",
    "As an attendee, I change my session bookmarks while offline and retain them after restart.",
    {
      acceptance:
        "Bookmark writes persist locally; sync policy is separate from organizer schedule conflict resolution.",
    },
  ],
  [
    "story",
    "STORY-07",
    "Publish an organizer edit",
    "As an organizer, I publish a session time or room change against the version I reviewed.",
    {
      acceptance:
        "A stale base version produces a conflict response; rejected edits remain available for comparison.",
    },
  ],
  [
    "story",
    "STORY-08",
    "Recover a stale organizer edit",
    "As an organizer, I compare my proposed edit with the server version before explicitly resolving a concurrent edit.",
    {
      acceptance:
        "No silent last-write-wins for session publication; display both values and preserve the proposal.",
    },
  ],
  [
    "story",
    "STORY-09",
    "Refresh without losing agenda context",
    "As an attendee, I receive a newer agenda while reading and preserve my current session context.",
    {
      acceptance:
        "Reconcile the downloaded version and explain removed sessions; do not imply a notification itself proves refresh.",
    },
  ],
  [
    "story",
    "STORY-10",
    "Bound offline roster access",
    "As an organizer, I limit how long a downloaded volunteer roster remains accessible after its signed authorization expires.",
    {
      acceptance:
        "Expired authorization blocks roster access offline; immediate server revocation cannot be guaranteed while disconnected.",
    },
  ],
  [
    "story",
    "STORY-11",
    "Restrict organizer publishing",
    "As an organizer, I prevent volunteers and attendees from publishing schedule changes.",
    {
      acceptance:
        "Server authorizes event role on every publish operation even if a client exposes an edit control.",
    },
  ],
  [
    "story",
    "STORY-12",
    "Diagnose a stuck delivery queue",
    "As an operator, I inspect retry counts and lag to find stuck operations without logging attendee names, contact details or roster content.",
    {
      acceptance:
        "A queued operation can be correlated by event/operation ID; redaction behavior still needs an executable scenario.",
      status: "partial; privacy test absent",
    },
  ],

  [
    "component",
    "COMP-01",
    "Volunteer mobile application",
    "Client shell for pack readiness, scanning, provisional/confirmed state and operator queue summary.",
  ],
  [
    "component",
    "COMP-02",
    "Local event repository",
    "On-device database stores authorized roster, agenda snapshots, bookmarks and queued operations; writes use explicit transactions.",
  ],
  [
    "component",
    "COMP-03",
    "Durable synchronization worker",
    "Shared client infrastructure drains queued writes, preserves operation identity across retries and fetches newer versions with bounded backoff.",
  ],
  [
    "component",
    "COMP-04",
    "Check-in service",
    "Server module accepts check-in operations, enforces event authorization and distinguishes replay from independent admission conflicts.",
  ],
  [
    "component",
    "COMP-05",
    "Agenda and publication service",
    "Server module serves agenda snapshots and publishes authorized organizer edits against a supplied base version.",
  ],
  [
    "component",
    "COMP-06",
    "Authorization module",
    "Shared server module evaluates event roles and issues bounded offline roster authorization.",
  ],
  [
    "component",
    "COMP-07",
    "Attendee and organizer web client",
    "Client provides cached agenda/bookmarks plus connected organizer editing and conflict comparison.",
  ],
  [
    "component",
    "COMP-08",
    "Operations telemetry pipeline",
    "Collects structured delivery health and redacts personal data; diagnostic identifiers follow a proposed retention policy.",
  ],
  [
    "component",
    "COMP-09",
    "Event backend",
    "Example deployment contains check-in, agenda and authorization modules in one deployable backend. Logical service boundaries do not require separate microservice deployments.",
  ],

  [
    "contract",
    "API-01",
    "Check-in operation API v1",
    "POST /events/{event}/check-ins accepts operationId, attendeeId, gateId and clientObservedAt. Replaying one operation returns its stored disposition; an independent scan can produce a distinct conflict.",
    {
      compatibility:
        "Server operation identity is scoped to event and issuing device. Retention of replay keys must exceed the supported retry window.",
      status: "draft contract",
    },
  ],
  [
    "contract",
    "API-02",
    "Agenda snapshot API v1",
    "GET /events/{event}/agenda returns agendaVersion, generatedAt and session entries. Conditional fetch permits reuse of a downloaded version.",
  ],
  [
    "contract",
    "API-03",
    "Organizer publication API v1",
    "POST /events/{event}/agenda-edits includes baseVersion and proposed field edits; responds with the new version or an explicit conflict containing the current values.",
  ],
  [
    "contract",
    "API-04",
    "Offline event-pack contract",
    "Authorized pack includes rosterVersion, agendaVersion, event identity, expiresAt and an offline authorization envelope; partial downloads are not committed as ready.",
  ],
  [
    "contract",
    "EVT-01",
    "AgendaPublished event v1",
    "Event includes eventId, agendaVersion and publication time; consumers fetch the snapshot rather than treating notification receipt as synchronized state.",
  ],
  [
    "contract",
    "EVT-02",
    "DeliveryHealth diagnostic event v1",
    "Event includes operation ID, retry category and lag bucket; excludes attendee identity and payload contents. Retention and redaction are draft decisions.",
  ],

  [
    "decision",
    "ADR-01",
    "Commit local state and outbox together",
    "Use one local transaction for a provisional scan and its outgoing operation. Persist the operation ID before acknowledging capture.",
    {
      context: "A phone may lose power between UI acknowledgment and network delivery.",
      alternatives: "Send first; save a volatile retry queue; persist record and queue separately.",
      consequences:
        "Requires durable local storage and queue migration; protects against a stranded acknowledged local scan.",
      status: "accepted in fictional baseline",
    },
  ],
  [
    "decision",
    "ADR-02",
    "Reuse operation IDs and separate admission conflicts",
    "Preserve the same operation ID across transport retries. Server stores replay dispositions, while different operation IDs for the same attendee trigger an admission-conflict workflow.",
    {
      context:
        "Timeouts do not tell the client whether a server write succeeded; another gate may scan the same attendee independently.",
      alternatives: "New ID per retry; deduplicate only by attendee; last write wins.",
      consequences:
        "Replay-key retention and conflict handling require separate policies; expiry remains an open contract issue.",
      status: "accepted in fictional baseline",
    },
  ],
  [
    "decision",
    "ADR-03",
    "Last-write-wins organizer edits — retired",
    "Earlier fictional prototype proposed accepting the latest timestamped schedule edit.",
    {
      context: "An early single-organizer assumption hid concurrent editing.",
      alternatives: "Explicit revision conflicts.",
      consequences: "Silently drops another organizer's room/time change; replaced by ADR-04.",
      status: "superseded",
    },
  ],
  [
    "decision",
    "ADR-04",
    "Use version conflicts for schedule publishing",
    "Reject organizer edits based on an old agenda version and require explicit comparison before publication.",
    {
      context: "Two organizers may edit the same session concurrently.",
      alternatives:
        "Timestamp last write wins; lock all editing; field-level merge without review.",
      consequences:
        "Adds conflict UI and connected publish step; offline agenda reading remains available.",
      status: "accepted in fictional baseline",
    },
  ],
  [
    "decision",
    "ADR-05",
    "Expire offline roster access explicitly",
    "Issue a bounded offline authorization envelope and show expiry before a volunteer starts a shift.",
    {
      context: "Server revocation cannot immediately reach a disconnected phone.",
      alternatives: "Require network for every scan; indefinite offline authorization.",
      consequences:
        "Expiry bounds exposure but may block a long outage; actual duration and threat review remain open.",
      status: "proposed",
    },
  ],
  [
    "decision",
    "ADR-06",
    "Queue telemetry without personal payloads",
    "Diagnostic events use operation IDs and categorized errors with explicit redaction before enqueueing.",
    {
      context: "Support needs correlation without creating a second attendee-data repository.",
      alternatives: "Raw request logging; no delivery diagnostics.",
      consequences:
        "Some debugging detail is lost; redaction tests and retention policy are incomplete.",
      status: "proposed",
    },
  ],

  [
    "implementation",
    "WORK-01",
    "Local scan transaction",
    "Illustrative work item describes scan-repository.ts transaction that writes provisional admission and outbox operation together; no actual code is imported.",
    { artifact: "Invented path mobile/data/scan-repository.ts" },
  ],
  [
    "implementation",
    "WORK-02",
    "Persistent queue restart recovery",
    "Illustrative work item restores persisted operations after app startup and retains their original IDs.",
    { artifact: "Invented path mobile/sync/outbox-store.ts" },
  ],
  [
    "implementation",
    "WORK-03",
    "Retry worker and acknowledgment reconciliation",
    "Illustrative work item shares backoff, operation identity and confirmation handling between check-in and bookmark queues.",
    {
      artifact: "Invented path shared/sync/drain-worker.ts",
      status: "partial — replay retention unresolved",
    },
  ],
  [
    "implementation",
    "WORK-04",
    "Server replay-disposition store",
    "Illustrative work item stores check-in operation dispositions and returns them for transport replays.",
    { artifact: "Invented path server/checkin/replay-store.ts" },
  ],
  [
    "implementation",
    "WORK-05",
    "Independent admission conflict handler",
    "Illustrative work item detects different operation IDs for one attendee and creates an organizer-resolvable conflict.",
    { artifact: "Invented path server/checkin/admission-conflicts.ts" },
  ],
  [
    "implementation",
    "WORK-06",
    "Cached agenda and bookmarks",
    "Illustrative work item persists agenda snapshots and local session choices, reconciling removed sessions after refresh.",
    { artifact: "Invented path web/data/agenda-repository.ts" },
  ],
  [
    "implementation",
    "WORK-07",
    "Publish version guard",
    "Illustrative work item compares baseVersion atomically while applying a schedule edit and emitting AgendaPublished.",
    { artifact: "Invented path server/agenda/publish.ts" },
  ],
  [
    "implementation",
    "WORK-08",
    "Organizer conflict comparison UI",
    "Illustrative work item displays the proposed and current room/time values and retains rejected edits.",
    {
      artifact: "Invented path web/organizer/conflict-editor.tsx",
      status: "planned; implementation mapping incomplete",
    },
  ],
  [
    "implementation",
    "WORK-09",
    "Event authorization middleware",
    "Illustrative work item checks roles for publishing and issues/validates offline pack envelopes.",
    { artifact: "Invented path server/auth/event-role.ts" },
  ],
  [
    "implementation",
    "WORK-10",
    "Queue health instrumentation",
    "Illustrative work item emits categorized retry/lag events before sending to telemetry; redaction scope is not yet fully implemented.",
    { artifact: "Invented path shared/sync/health.ts", status: "partial" },
  ],
  [
    "implementation",
    "WORK-11",
    "Atomic event-pack installer",
    "Illustrative work item validates event identity, versions and authorization, then swaps in a completely downloaded pack.",
    { artifact: "Invented path mobile/data/install-pack.ts" },
  ],

  [
    "test_scenario",
    "TEST-01",
    "Offline scan survives process termination",
    "Disable connectivity, record a scan, terminate the process before delivery, restart and confirm provisional record and original operation ID remain.",
    { layer: "client integration", acceptance: "No acknowledged scan loses its queued operation." },
  ],
  [
    "test_scenario",
    "TEST-02",
    "Replay after a lost server response",
    "Server commits a check-in then the transport drops the response. Retry the same persisted operation and compare disposition and admission count.",
    {
      layer: "API integration",
      acceptance: "One operation produces one disposition and no additional admission.",
    },
  ],
  [
    "test_scenario",
    "TEST-03",
    "Two gates independently scan one attendee",
    "Two clients send different operation IDs for the same attendee; confirm the second becomes a resolvable admission conflict.",
    { layer: "API integration" },
  ],
  [
    "test_scenario",
    "TEST-04",
    "Incomplete pack never becomes ready",
    "Interrupt pack download and restart; confirm the previous complete pack remains usable and the partial pack stays unavailable.",
    { layer: "client integration" },
  ],
  [
    "test_scenario",
    "TEST-05",
    "Agenda and bookmarks remain readable offline",
    "Download the agenda, save bookmarks, disable networking and restart; retain content and saved-version information.",
    { layer: "browser end-to-end" },
  ],
  [
    "test_scenario",
    "TEST-06",
    "Concurrent organizer publishing",
    "Two organizers edit from one base version; publish the first and reject the second without discarding its proposed values.",
    { layer: "API and UI end-to-end" },
  ],
  [
    "test_scenario",
    "TEST-07",
    "Published update preserves reading context",
    "Refresh a changed agenda while viewing a session; retain surviving session context and explain a removed session.",
    { layer: "browser end-to-end" },
  ],
  [
    "test_scenario",
    "TEST-08",
    "Offline authorization expires",
    "Advance the controlled clock beyond pack expiry while disconnected; confirm roster access is blocked and renewal action is clear.",
    { layer: "client security", status: "defined; no run" },
  ],
  [
    "test_scenario",
    "TEST-09",
    "Volunteer cannot publish",
    "Call the publication API as volunteer and attendee roles, including a manipulated client request; expect server rejection.",
    { layer: "server security" },
  ],
  [
    "test_scenario",
    "TEST-10",
    "Retry after replay-key retention boundary",
    "Delay a queued scan beyond the server's replay-disposition retention window, then replay it; establish behavior before supporting the extended outage window.",
    {
      layer: "API integration",
      acceptance: "Unresolved — define expiry response and supported retry horizon.",
      status: "open; no run",
    },
  ],
  [
    "test_run",
    "RUN-TECH-01",
    "Simulated restart-recovery run",
    "SIMULATED: local scan and outgoing operation survived the fictional process-termination sequence with the original ID.",
    { outcome: "SIMULATED pass", build: "Invented mobile build 0.6.0" },
  ],
  [
    "test_run",
    "RUN-TECH-02",
    "Simulated dropped-response replay run",
    "SIMULATED: immediate retry reused the operation ID and returned one server disposition. This run predates the extended queue-retention requirement.",
    { outcome: "SIMULATED pass for short retry", build: "Invented backend build 0.6.0" },
  ],
  [
    "test_run",
    "RUN-TECH-03",
    "Simulated two-gate conflict run",
    "SIMULATED: independent scans incorrectly created two confirmed admissions. Conflict resolution remains open.",
    { outcome: "SIMULATED fail", build: "Invented backend build 0.6.0" },
  ],
  [
    "test_run",
    "RUN-TECH-04",
    "Simulated cached-agenda run",
    "SIMULATED: cached sessions and bookmarks remained readable through offline restart; one removed-session reconciliation case was not exercised.",
    { outcome: "SIMULATED partial", build: "Invented web build 0.6.0" },
  ],
  [
    "test_run",
    "RUN-TECH-05",
    "Simulated stale-publication run",
    "SIMULATED: stale baseVersion was rejected; proposed edit comparison remains a planned UI task.",
    { outcome: "SIMULATED API pass; UI missing", build: "Invented backend build 0.6.0" },
  ],
  [
    "test_run",
    "RUN-TECH-06",
    "Simulated role-authorization run",
    "SIMULATED: volunteer and attendee requests were rejected by the publication endpoint; offline expiry behavior was not exercised.",
    { outcome: "SIMULATED pass for publish roles", build: "Invented backend build 0.6.0" },
  ],

  [
    "release",
    "REL-01",
    "Pilot 0.6 — fictional candidate",
    "Planned limited pilot contains check-in capture/retry and cached agenda. Duplicate admission handling, offline authorization expiry and redaction testing remain open.",
    { disposition: "Blocked pending explicit handling of open issues; no deployment occurred." },
  ],
  [
    "release",
    "REL-02",
    "Follow-up 0.7 — proposed",
    "Proposed follow-up addresses admission conflicts, replay-retention alignment and organizer conflict comparison.",
    { disposition: "Planning only; no release evidence." },
  ],
  [
    "incident",
    "INC-01",
    "Duplicate admission after lost acknowledgment",
    "Fictional pilot rehearsal incident: a client generated a new operation ID after a timeout and the server treated it as an independent scan.",
    {
      impact: "Attendance count inflated; no real event or users affected.",
      status: "open follow-up",
    },
  ],
  [
    "incident",
    "INC-02",
    "Organizer room edit silently replaced",
    "Fictional early prototype rehearsal: last-write-wins publishing removed another organizer's room change without comparison.",
    {
      impact: "Motivates replacing ADR-03 with ADR-04; no actual production incident.",
      status: "architecture addressed; UI follow-up open",
    },
  ],
];

const { links, connect } = exampleLinks();
connect("breaks_down_into", "APP-01", ["OUTCOME-01", "OUTCOME-02", "OUTCOME-03"]);
connect("breaks_down_into", "OUTCOME-01", ["CAP-01", "CAP-02", "CAP-03", "CAP-07"]);
connect("breaks_down_into", "OUTCOME-02", ["CAP-04", "CAP-06"]);
connect(
  "breaks_down_into",
  "OUTCOME-03",
  ["CAP-05", "CAP-06", "CAP-07", "CAP-08"],
  "Shared freshness and authorization capabilities remain single records across outcomes.",
);
for (const [capability, stories] of [
  ["CAP-01", ["STORY-01"]],
  ["CAP-02", ["STORY-02", "STORY-03"]],
  ["CAP-03", ["STORY-04"]],
  ["CAP-04", ["STORY-05", "STORY-06"]],
  ["CAP-05", ["STORY-07", "STORY-08"]],
  ["CAP-06", ["STORY-09"]],
  ["CAP-07", ["STORY-10", "STORY-11"]],
  ["CAP-08", ["STORY-12"]],
] as const)
  connect("breaks_down_into", capability, stories);
connect("contains", "APP-01", ["COMP-01", "COMP-07", "COMP-09", "COMP-08"]);
connect("contains", "COMP-01", ["COMP-02", "COMP-03"]);
connect(
  "contains",
  "COMP-07",
  ["COMP-02", "COMP-03"],
  "Shared component definitions used by both clients; not copied nodes or a deployment assertion.",
);
connect("contains", "COMP-09", ["COMP-04", "COMP-05", "COMP-06"]);
for (const [story, work] of [
  ["STORY-01", ["WORK-11"]],
  ["STORY-02", ["WORK-01", "WORK-03"]],
  ["STORY-03", ["WORK-02", "WORK-03"]],
  ["STORY-04", ["WORK-04", "WORK-05"]],
  ["STORY-05", ["WORK-06"]],
  ["STORY-06", ["WORK-06", "WORK-03"]],
  ["STORY-07", ["WORK-07", "WORK-09"]],
  ["STORY-08", ["WORK-08"]],
  ["STORY-09", ["WORK-06", "WORK-03"]],
  ["STORY-10", ["WORK-09", "WORK-11"]],
  ["STORY-11", ["WORK-09"]],
  ["STORY-12", ["WORK-10"]],
] as const)
  connect(
    "implemented_by",
    story,
    work,
    "Illustrative work allocation; code references are native descriptions, not imported implementations.",
  );
for (const [work, components] of [
  ["WORK-01", ["COMP-02"]],
  ["WORK-02", ["COMP-02", "COMP-03"]],
  ["WORK-03", ["COMP-03"]],
  ["WORK-04", ["COMP-04"]],
  ["WORK-05", ["COMP-04"]],
  ["WORK-06", ["COMP-02", "COMP-07"]],
  ["WORK-07", ["COMP-05"]],
  ["WORK-08", ["COMP-07"]],
  ["WORK-09", ["COMP-06"]],
  ["WORK-10", ["COMP-03", "COMP-08"]],
  ["WORK-11", ["COMP-02"]],
] as const)
  connect("changes", work, components);
connect("provides", "COMP-04", ["API-01"]);
connect("provides", "COMP-05", ["API-02", "API-03", "EVT-01"]);
connect("provides", "COMP-06", ["API-04"]);
connect("provides", "COMP-03", ["EVT-02"]);
connect("consumes", "COMP-03", ["API-01", "API-02", "EVT-01"]);
connect("consumes", "COMP-01", ["API-04"]);
connect("consumes", "COMP-07", ["API-02", "API-03", "EVT-01"]);
connect("consumes", "COMP-08", ["EVT-02"]);
connect("depends_on", "COMP-03", ["COMP-02"]);
connect("depends_on", "COMP-04", ["COMP-06"]);
connect("depends_on", "COMP-05", ["COMP-06"]);
for (const [decision, targets] of [
  ["ADR-01", ["STORY-02", "STORY-03", "COMP-02", "WORK-01", "WORK-02"]],
  ["ADR-02", ["STORY-03", "STORY-04", "API-01", "WORK-03", "WORK-04", "WORK-05"]],
  ["ADR-03", ["API-03"]],
  ["ADR-04", ["STORY-07", "STORY-08", "API-03", "WORK-07", "WORK-08"]],
  ["ADR-05", ["STORY-10", "API-04", "WORK-09"]],
  ["ADR-06", ["STORY-12", "EVT-02", "WORK-10"]],
] as const)
  connect(
    "guides",
    decision,
    targets,
    "Decision rationale and tradeoffs; stored status is a fictional project annotation.",
  );
connect(
  "supersedes",
  "ADR-04",
  ["ADR-03"],
  "New record preserves the retired decision and explains the changed assumption.",
);
for (const [scenario, records] of [
  ["TEST-01", ["STORY-02", "STORY-03", "WORK-01", "WORK-02"]],
  ["TEST-02", ["STORY-03", "WORK-03", "WORK-04", "API-01"]],
  ["TEST-03", ["STORY-04", "WORK-05", "API-01"]],
  ["TEST-04", ["STORY-01", "WORK-11", "API-04"]],
  ["TEST-05", ["STORY-05", "STORY-06", "WORK-06"]],
  ["TEST-06", ["STORY-07", "STORY-08", "WORK-07", "WORK-08", "API-03"]],
  ["TEST-07", ["STORY-09", "WORK-06", "EVT-01"]],
  ["TEST-08", ["STORY-10", "WORK-09", "API-04"]],
  ["TEST-09", ["STORY-11", "WORK-09", "API-03"]],
  ["TEST-10", ["STORY-03", "WORK-03", "WORK-04", "API-01"]],
] as const)
  for (const record of records)
    connect(
      "checked_by",
      record,
      [scenario],
      "Acceptance/test definition only; no executed result is inferred.",
    );
for (const [scenario, run] of [
  ["TEST-01", "RUN-TECH-01"],
  ["TEST-02", "RUN-TECH-02"],
  ["TEST-03", "RUN-TECH-03"],
  ["TEST-05", "RUN-TECH-04"],
  ["TEST-06", "RUN-TECH-05"],
  ["TEST-09", "RUN-TECH-06"],
] as const)
  connect("exercised_as", scenario, [run], "Invented run for UI exploration; no app was executed.");
connect("includes", "REL-01", [
  "WORK-01",
  "WORK-02",
  "WORK-03",
  "WORK-04",
  "WORK-06",
  "WORK-07",
  "WORK-09",
  "WORK-11",
]);
connect("includes", "REL-02", ["WORK-05", "WORK-08", "WORK-10"]);
connect(
  "evaluated_by",
  "REL-01",
  ["RUN-TECH-01", "RUN-TECH-02", "RUN-TECH-03", "RUN-TECH-04", "RUN-TECH-05", "RUN-TECH-06"],
  "Mixed simulated results; no release approval or deployment.",
);
connect("reveals", "INC-01", ["API-01", "COMP-03", "WORK-03", "WORK-05", "STORY-03", "TEST-10"]);
connect("reveals", "INC-02", ["API-03", "WORK-08", "STORY-08"]);
connect("motivates", "INC-01", ["ADR-02"]);
connect("motivates", "INC-02", ["ADR-04"]);

export const technologyExample: ExampleDefinition = {
  title: "Gatherline — fictional offline event app",
  description:
    "Gatherline is a fictional offline-first collaboration product. Follow product outcomes through capabilities, mobile and service components, implementation and delivery evidence. Compare release candidates, incidents and feedback. All work paths, test runs and outcomes are invented.",
  sources: [
    {
      title: "Android offline-first architecture",
      url: "https://developer.android.com/topic/architecture/data-layer/offline-first",
      use: "Grounds durable local data, queued writes, retry and task-specific conflict handling. Gatherline contracts and acceptance details are original fictional choices.",
    },
    {
      title: "Microsoft architecture decision records",
      url: "https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record",
      use: "Grounds recording context, alternatives, consequences, status and linked replacement decisions rather than deleting old rationale.",
    },
  ],
  schema: exampleSchema(
    {
      application: [],
      outcome: [],
      capability: [],
      story: ["acceptance"],
      component: [],
      contract: ["compatibility"],
      decision: ["context", "alternatives", "consequences"],
      implementation: ["artifact"],
      test_scenario: ["layer", "acceptance"],
      test_run: ["outcome", "build"],
      release: ["disposition"],
      incident: ["impact"],
    },
    {
      breaks_down_into: [
        ["application", "outcome", "capability"],
        ["outcome", "capability", "story"],
      ],
      implemented_by: [["story"], ["implementation"]],
      checked_by: [["story", "implementation", "contract"], ["test_scenario"]],
      exercised_as: [["test_scenario"], ["test_run"]],
      contains: [["application", "component"], ["component"]],
      changes: [["implementation"], ["component"]],
      provides: [["component"], ["contract"]],
      consumes: [["component"], ["contract"]],
      depends_on: [["component"], ["component"]],
      guides: [["decision"], ["story", "component", "contract", "implementation"]],
      supersedes: [["decision"], ["decision"]],
      includes: [["release"], ["implementation"]],
      evaluated_by: [["release"], ["test_run"]],
      reveals: [
        ["incident"],
        ["story", "component", "contract", "implementation", "test_scenario"],
      ],
      motivates: [["incident"], ["decision"]],
    },
  ),
  items,
  links,
  receipts: [
    {
      output: "RUN-TECH-01",
      inputs: ["TEST-01", "STORY-02", "STORY-03", "WORK-01", "WORK-02"],
      outcome: "SIMULATED restart recovery pass",
    },
    {
      output: "RUN-TECH-02",
      inputs: ["TEST-02", "STORY-03", "WORK-03", "WORK-04", "API-01"],
      outcome: "SIMULATED immediate retry pass; predates extended retry horizon",
    },
    {
      output: "RUN-TECH-03",
      inputs: ["TEST-03", "STORY-04", "WORK-05", "API-01"],
      outcome: "SIMULATED fail — duplicate admissions",
    },
    {
      output: "RUN-TECH-04",
      inputs: ["TEST-05", "STORY-05", "WORK-06"],
      outcome: "SIMULATED cached-agenda pass; refresh coverage partial",
    },
    {
      output: "RUN-TECH-05",
      inputs: ["TEST-06", "STORY-07", "STORY-08", "WORK-07", "API-03"],
      outcome: "SIMULATED API pass; conflict UI untested",
    },
    {
      output: "RUN-TECH-06",
      inputs: ["TEST-09", "STORY-11", "WORK-09", "API-03"],
      outcome: "SIMULATED publish-role checks pass; expiry untested",
    },
  ],
  changes: [
    {
      key: "STORY-03",
      statement:
        "As a volunteer, I restart the app after recording scans and retain queued operations and their original operation IDs for up to 72 hours offline. The supported retry horizon must agree with server replay-disposition retention; expired operations require an explicit disposition rather than silent re-submission.",
      reason:
        "INC-01 follow-up: expand draft retry horizon and expose client/server retention mismatch; prior runs remain recorded.",
    },
  ],
  tasks: [
    {
      title: "Product outcomes, capability siblings and stories",
      root: "APP-01",
      relationship: "breaks_down_into",
      inspect: ["OUTCOME-01", "OUTCOME-02", "OUTCOME-03", "CAP-02", "STORY-02", "STORY-03"],
      explanation:
        "Descend the product hierarchy; compare stories under Capture and recover check-ins. Freshness and permissions contribute to more than one outcome.",
    },
    {
      title: "A different hierarchy: component containment",
      root: "COMP-09",
      relationship: "contains",
      inspect: ["COMP-04", "COMP-05", "COMP-06"],
      explanation:
        "Compare server modules independently of product hierarchy; check-in and agenda share authorization. No automatic equivalence between a service and a feature.",
    },
    {
      title: "Shared implementation across sibling features",
      presentation: {
        layout: "trace",
        columns: [
          {
            relationshipType: "implemented_by",
            targetType: "implementation",
            direction: "outgoing",
          },
          { relationshipType: "checked_by", targetType: "test_scenario", direction: "outgoing" },
        ],
      },
      root: "WORK-03",
      relationship: "implemented_by",
      direction: "incoming",
      inspect: ["STORY-02", "STORY-03", "STORY-06", "STORY-09"],
      explanation:
        "One sync-worker work item supports check-in capture, restart, bookmarks and agenda refresh. Browse its component, contracts and tests to assess a retry-policy change.",
    },
    {
      title: "Contract providers and consumers",
      root: "API-01",
      relationship: "consumes",
      direction: "incoming",
      inspect: ["COMP-03", "COMP-04", "ADR-02", "TEST-02", "TEST-10"],
      explanation:
        "The sync worker consumes the check-in API; the check-in module provides it. Trace the replay-retention rule to decisions, implementation and missing long-outage testing.",
    },
    {
      title: "Why the architecture changed",
      root: "ADR-04",
      relationship: "supersedes",
      inspect: ["ADR-03", "INC-02", "STORY-08", "WORK-08"],
      explanation:
        "Retired last-write-wins rationale is preserved in a separate record. New conflict behavior has an API result but its comparison UI is still planned.",
    },
    {
      title: "Start from a failure and trace backward",
      root: "INC-01",
      relationship: "reveals",
      inspect: ["API-01", "WORK-03", "STORY-03", "TEST-10", "RUN-TECH-02"],
      explanation:
        "The incident identifies real stored dependencies in this fictional project. STORY-03 changed to a 72-hour horizon after receipts captured v1; short-retry evidence now compares as changed.",
    },
    {
      title: "Release readiness with mixed evidence",
      root: "REL-01",
      relationship: "evaluated_by",
      inspect: ["RUN-TECH-02", "RUN-TECH-03", "RUN-TECH-05", "STORY-12"],
      explanation:
        "Compare a changed receipt, failed admission test and incomplete UI coverage. Privacy has no test link; a permission to connect is not a release acceptance rule.",
    },
  ],
  chains: [
    {
      title: "Product-to-pilot trace across eight columns",
      query: {
        type: "application",
        search: "APP-01",
        steps: [
          { type: "outcome", relationshipType: "breaks_down_into" },
          { type: "capability", relationshipType: "breaks_down_into" },
          { type: "story", relationshipType: "breaks_down_into" },
          { type: "implementation", relationshipType: "implemented_by" },
          { type: "test_scenario", relationshipType: "checked_by" },
          { type: "test_run", relationshipType: "exercised_as" },
          { type: "release", relationshipType: "evaluated_by", direction: "incoming" },
        ],
      },
    },
  ],
};
