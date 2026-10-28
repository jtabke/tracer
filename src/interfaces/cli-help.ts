export const cliHelp = `Tracer — local engineering knowledge core
Usage: node src/interfaces/cli.ts [OPTIONS] COMMAND
Options (before command): --db project.sqlite --actor local --reason text
                         --schema-version N (required for individual data writes)
Commands:
  application-model resolve JSON
  verification resolve-model JSON    exact native verification model; no lifecycle conclusion
  verification prepare-basis JSON    validate selected criteria/methods without writing a case
  assessment open JSON                guarded model-bound scope; recover with evaluation outcome COMMAND_ID
  assessment get JSON                 assessmentId + openingCommandId; controlled scope and exact model
  assessment locate ID                resolve controlled opening from a record identity
  assessment refresh JSON             guarded rediscovery retains prior obligations; no automatic retry
  assessment analyze JSON             bounded obligations, discovery and effective completion
  assessment disposition JSON         selection + subject; full controlled judgment or null
  assessment set-disposition JSON     guarded judgment/actions/support; explicit assessed basis
  assessment close JSON               complete accounted scope; records immutable conclusion
  assessment reopen JSON              explicit reassessment; preserves historical closure
  evaluation commit JSON              atomic native operations plus receipt; required commandId/schema guard
  evaluation outcome COMMAND_ID       original committed evaluation result or null; no automatic retry
  next-work get [QUERY_JSON]            five separate current-work queues; requirementType/statementField/allocationExpectationId/verificationExpectationId
  project export                       canonical JSON; current state, recorded history/evidence and captures
  schema preview JSON                 ({schema,expectedVersion,limit?}; read only)
  entity get ID
  relationship get ID
  schema set JSON EXPECTED_VERSION     (0 for initial creation)
  schema get
  entity create JSON                   {type, key?, fields}
  entity update ID VERSION JSON        {fields, key?}; replaces all fields
  entity remove ID VERSION [cascade]   rejects connected links unless explicit cascade
  entity list [QUERY_JSON]             paginated, sorted by stable ID
  relationship create JSON             {type, source, target, fields}
  relationship update ID VERSION JSON  {type, source, target, fields}
  relationship remove ID VERSION
  relationship list [QUERY_JSON]
  changeset apply JSON                 {commandId?, expectedSchemaVersion, operations}
  changeset outcome COMMAND_ID          original committed result, or null if not recorded
  changeset list [AFTER_REVISION] [LIMIT]
  external bind JSON                   {entityId,system:git|file,externalId,ownership:external}
  observation record JSON              {entityId,locator:{system,path,repository?,ref?}}
  receipt record JSON                  {outputId,expectedOutputVersion?,outcome,inputs,configurationId?,supersedes?}
  receipt get ID                       exact immutable captured receipt
  receipt compare ID                   last-observed scoped freshness; no automatic polling
  review record JSON                   {receiptId,decision,rationale,expectedComparison}
  evidence list KIND [QUERY_JSON]       external|observation|receipt|review; {subject?,after?,limit?}
  configuration capture JSON           {name,subjectId,expectedSubjectVersion,members:[{entityId,version}],relationships?:[{relationshipId,version}]}
  configuration get ID                 exact immutable capture, including archived native schemas
  configuration list [QUERY_JSON]      {subject?,after?,limit?}; limit 1–100, default 25
  baseline capture JSON                {id?,name,expectedProjectRevision,projectRevision?}; named native commit
  baseline get ID                      exact immutable baseline descriptor
  baseline list [QUERY_JSON]           {after?,limit?}; limit 1–100, default 25
  baseline contents QUERY_JSON         {baselineId,kind:entity|relationship,after?,limit?}; historical pages
  coverage set JSON                    {expectations,expectedSchemaVersion}; replaces versioned project policy
  coverage list [QUERY_JSON]           {baselineId?}; policies from current or captured schema
  coverage evaluate QUERY_JSON         {expectationId,baselineId?,expectedProjectRevision?,after?,limit?}; limit 1–100
  impact get QUERY_JSON                {baselineId,rootId,direction,relationshipTypes:[],depth?,expectedProjectRevision?,after?,limit?}
  native-pin get ID VERSION             exact native entity and its historical schema; readonly
  saved-view save JSON                  {id?,name,definition,expectedVersion,expectedSchemaVersion}
  saved-view list                       project presentation metadata, maximum 50 views
  saved-view remove ID VERSION          version-guarded metadata removal
  graph get QUERY_JSON                  {rootId,depth?,expanded?,atRevision?,compareRevision?}; depth 1–6
  family get QUERY_JSON                 {rootId,relationshipType?,direction?,after?,limit?}; at most 20 members/page
  working-context get QUERY_JSON        {focusId,recipe,after?,limit?,trace?,receipts?}; one bounded native/evidence snapshot
  chain get QUERY_JSON                  {type,steps,search?,after?,limit?}; at most 20 roots/page
  connections get QUERY_JSON            {id,type?,after?,limit?}; at most 50 links/page
  model-connections get QUERY_JSON      {type,after?,limit?}; at most 25 links/page
  work get [QUERY_JSON]                 counted/filterable current working set
  table get QUERY_JSON                  {type,after?,limit?,focusId?}
  matrix get QUERY_JSON                 {sourceType,targetType,relationshipType,sourceFocus?,targetFocus?,sourceAfter?,targetAfter?,limit?}; at most 25 per axis
  timeline get [BEFORE_REVISION]        bounded native changesets with head/nextBefore
  history [QUERY_JSON]                  {kind?,id?,after?,limit?}
  trace ID [forward|reverse|both] [TYPE|-] [MAX_DEPTH]
Entity query: {type?,key?,after?,limit?,search?}
Relationship query: {type?,source?,target?,incident?,after?,limit?}
Receipt input: {entityId,expectedVersion?,revision?,observationId?,fields?,path?,expectedPathVersions?}
Historical/configuration receipt inputs are direct; do not combine them with current-version or path guards.
Native pages: {items,nextAfter?}; default limit 100, maximum 1000 unless the projection states a tighter bound.
Reads do not create engineering history. Captures/receipts append immutable evidence; saved views are mutable presentation metadata.
Coverage counts distinct qualifying native targets, with exact counts and up to three samples per subject.
Coverage is structural only, not evidence execution or release readiness. Summaries describe this page only.
Current coverage continuation conflicts after native edits; baselines use their own captured policy.
Impact compares baseline/current native context separately from captured-input freshness; current evidence is not baseline evidence.
Impact follows selected native types/directions (depth 1–6), uses bounded context and 1–25 evaluations/page (default 10).
Impact continuation conflicts after native or evidence changes. Drift is scoped and does not establish causation or readiness.
`;
