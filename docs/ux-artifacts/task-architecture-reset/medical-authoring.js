const cases = {
  zero: {
    key: "PRS-14",
    version: 1,
    title: "Establish clinical measurement performance",
    statement:
      "Establish blood-pressure measurement performance for the intended adult population using an applicable clinical evaluation plan.",
    acceptance:
      "Study design, reference method, population and acceptance criteria require a qualified clinical/regulatory review. Static sensor calibration is insufficient.",
    status: "planned; protocol missing",
    question: "What subsystem requirements are recorded for PRS-14?",
    detail:
      "A complete read of recorded decomposes into connections. It does not judge whether decomposition is required or clinically sufficient.",
    count: "No recorded subsystem requirements",
  },
  next: {
    key: "PRS-02",
    version: 2,
    title: "Pressure-channel accuracy budget",
    statement:
      "The static cuff-pressure channel shall have error no greater than ±3 mmHg over 0–300 mmHg at 10–40 °C. Expanded operating band requires review of earlier allocations, compensation design and bench evidence.",
    acceptance:
      "Compare the pressure channel against a calibrated reference across the stated range. This draft target is not a clinical BP-accuracy criterion.",
    status: "illustrative draft",
    question: "How would I add a subsystem requirement to PRS-02?",
    detail:
      "A narrow author/connect rehearsal after choosing an additive path. Revising SYS-02 is also plausible work and remains outside this study.",
    count: "2 recorded subsystem requirements",
  },
};

const candidates = [
  {
    key: "SYS-01",
    title: "Acquire calibrated pressure samples",
    statement:
      "The pressure acquisition subsystem shall provide calibrated cuff-pressure samples to the estimator at 100 samples per second.",
  },
  {
    key: "SYS-02",
    title: "Allocate pressure error",
    statement:
      "At 15–35 °C, sensor calibration residual shall be within ±1.5 mmHg and conversion/compensation contribution within ±1.0 mmHg; retain 0.5 mmHg integration margin.",
  },
  {
    key: "SYS-03",
    title: "Reject motion-corrupted estimates",
    statement:
      "The measurement estimator shall expose an invalid-quality state that prevents completion and storage when the motion rejection rule is triggered.",
  },
  {
    key: "SYS-09",
    title: "Separate results from errors",
    statement:
      "The presentation layer shall render completed-result and retry/error states using distinct layouts and labels.",
  },
  {
    key: "SYS-13",
    title: "Evaluate battery state under load",
    statement:
      "The power supervisor shall assess battery voltage under the proposed pump load before permitting a cycle and provide low/unavailable states to the display.",
  },
];

let activeCase = "zero";
let draft = null;
let saved = null;
let selectedCandidate = null;
let connectionTarget = null;
let connectionOrigin = "saved";
let linkDraft = null;
const unlinkedRecords = { zero: [], next: [] };
let createdCount = 0;
const proposals = {};

const one = (selector) => document.querySelector(selector);
const all = (selector) => document.querySelectorAll(selector);

function setText(selector, value) {
  one(selector).textContent = value;
}

function showPage(name) {
  all("[data-page]").forEach((page) => (page.hidden = page.dataset.page !== name));
  const titles = {
    board: "Work",
    author: "Create subsystem requirement",
    saved: "Saved without connection",
    connection: "Review connection",
    connected: "Connection recorded",
    candidates: "Existing subsystem requirements",
  };
  setText("[data-crumb]", titles[name]);
  history.replaceState(null, "", `#${name}`);
  window.scrollTo({ top: 0 });
  requestAnimationFrame(() => {
    const heading = one(`[data-page="${name}"] h1`);
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  });
}

function visiblePage() {
  return one("[data-page]:not([hidden])")?.dataset.page;
}

function populateParent() {
  const item = cases[activeCase];
  setText("[data-question]", item.question);
  setText("[data-question-detail]", item.detail);
  setText("[data-parent-key]", `${item.key} · CURRENT V${item.version}`);
  setText("[data-parent-title]", item.title);
  setText("[data-parent-statement]", item.statement);
  setText("[data-parent-acceptance]", item.acceptance);
  setText("[data-parent-status]", item.status);
  setText("[data-canonical-count]", item.count);
  setText("[data-context-key]", `${item.key} · CURRENT V${item.version}`);
  setText("[data-context-title]", item.title);
  setText("[data-context-statement]", item.statement);
  setText("[data-context-acceptance]", item.acceptance);
  one("[data-zero-state]").hidden = activeCase !== "zero";
  one("[data-next-state]").hidden = activeCase !== "next";
  one("[data-sibling-context]").hidden = activeCase !== "next";
  one("[data-zero-caution]").hidden = activeCase !== "zero";
  one("[data-revise-existing]").hidden = activeCase !== "next";
  all("[data-case]").forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.case === activeCase)),
  );
  updatePrimaryActions();
  updateProposal();
  updateUnlinkedItems();
}

function updatePrimaryActions() {
  const create = one("[data-create]");
  const connect = one("[data-connect-existing]");
  const ownerCase = [linkDraft, saved, draft].find(Boolean)?.parentCase;
  const mode = primaryActionMode(ownerCase);
  const labels = {
    different: () => `Resume work for ${cases[ownerCase].key} first`,
    link: () => "Resume connection draft first",
    saved: () => "Continue saved subsystem requirement",
    draft: () => "Continue subsystem requirement draft",
    new: () => "Create subsystem requirement",
  };
  create.disabled = new Set(["different", "link"]).has(mode);
  connect.disabled = mode !== "new";
  create.textContent = labels[mode]();
}

function primaryActionMode(ownerCase) {
  return [
    [Boolean(ownerCase) && ownerCase !== activeCase, "different"],
    [Boolean(linkDraft), "link"],
    [Boolean(saved), "saved"],
    [Boolean(draft), "draft"],
    [true, "new"],
  ].find(([matches]) => matches)[1];
}

function updateProposal() {
  const proposal = proposals[activeCase];
  one("[data-proposal-board]").hidden = !proposal;
  if (!proposal) return;
  setText("[data-proposal-title]", `${itemIdentity(proposal.target)} · ${proposal.target.title}`);
  setText("[data-proposal-statement]", proposal.target.statement);
  setText(
    "[data-proposal-route]",
    `${cases[activeCase].key} v${cases[activeCase].version} → decomposes_into → ${itemRouteIdentity(proposal.target)}`,
  );
}

function updateUnlinkedItems() {
  const records = unlinkedRecords[activeCase];
  const section = one("[data-unlinked-board]");
  const list = one("[data-unlinked-list]");
  section.hidden = records.length === 0;
  list.replaceChildren(...records.map(unlinkedRecord));
}

function unlinkedRecord(record) {
  const article = document.createElement("article");
  const key = document.createElement("span");
  const title = document.createElement("h3");
  const statement = document.createElement("p");
  const facts = document.createElement("dl");
  key.className = "record-key";
  key.textContent = `${record.studyIdentity} · subsystem_requirement v1`;
  title.textContent = record.title;
  statement.textContent = record.statement;
  facts.className = "unlinked-facts";
  facts.append(
    recordFact("status", record.status),
    recordFact("owner", record.owner),
    recordFact("notes", record.notes),
  );
  const connect = document.createElement("button");
  connect.className = "text-action";
  connect.textContent = "Review optional connection →";
  connect.addEventListener("click", () => prepareConnection(record, "board"));
  article.append(key, title, statement, facts, connect);
  return article;
}

function recordFact(label, value) {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = displayValue(value);
  wrapper.append(term, description);
  return wrapper;
}

function displayValue(value) {
  return value || "not recorded";
}

function formValues() {
  const form = one("[data-author-form]");
  const values = Object.fromEntries(
    ["title", "statement", "status", "owner", "notes"].map((name) => [
      name,
      form.elements[name].value.trim(),
    ]),
  );
  return { studyIdentity: nextStudyIdentity(), version: 1, ...values };
}

function nextStudyIdentity() {
  return `STUDY ITEM ${String(createdCount + 1).padStart(2, "0")}`;
}

function itemIdentity(item) {
  return item.key ?? item.studyIdentity;
}

function itemRouteIdentity(item) {
  return item.key
    ? `${item.key} v${item.version}`
    : `${item.studyIdentity} · subsystem_requirement v1`;
}

function populateForm() {
  const form = one("[data-author-form]");
  const value = draft ?? { title: "", statement: "", status: "", owner: "", notes: "" };
  for (const name of ["title", "statement", "status", "owner", "notes"])
    form.elements[name].value = value[name] ?? "";
}

function startCreate() {
  if (saved) {
    resumeSavedItem();
    return;
  }
  beginAuthorTask();
}

function beginAuthorTask() {
  if (draft?.parentCase !== activeCase) draft = null;
  populateForm();
  showPage("author");
}

function resumeSavedItem() {
  activeCase = saved.parentCase;
  populateParent();
  showPage("saved");
}

function updateResume() {
  one("[data-draft-resume]").hidden = !draft;
  if (draft) setText("[data-resume-title]", draft.title || "Untitled SYS proposal retained");
  updatePrimaryActions();
}

function connectionValues() {
  return Object.fromEntries(new FormData(one("[data-connection-form]")));
}

function updateLinkResume() {
  one("[data-link-resume]").hidden = !linkDraft;
  if (linkDraft)
    setText(
      "[data-link-resume-title]",
      `${cases[linkDraft.parentCase].key} → decomposes_into → ${itemIdentity(linkDraft.target)}`,
    );
  updatePrimaryActions();
}

function updateSavedResume() {
  one("[data-saved-resume]").hidden = !saved;
  if (saved)
    setText(
      "[data-saved-resume-title]",
      `${saved.studyIdentity} · ${saved.title} · no connections`,
    );
  updatePrimaryActions();
}

function pauseConnection() {
  linkDraft = {
    fields: connectionValues(),
    target: connectionTarget,
    parentCase: activeCase,
    origin: connectionOrigin,
  };
  updateLinkResume();
  showPage("board");
}

function goBoard() {
  if (visiblePage() === "author") return pauseDraft();
  if (visiblePage() === "connection") return pauseConnection();
  showPage("board");
}

function pauseDraft() {
  draft = { ...formValues(), parentCase: activeCase };
  updateResume();
  showPage("board");
}

function cancelDraft() {
  draft = null;
  updateResume();
  one("[data-author-form]").reset();
  showPage("board");
}

function saveItem(event) {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  saved = { ...formValues(), parentCase: activeCase };
  createdCount += 1;
  draft = null;
  updateResume();
  updateSavedResume();
  setText("[data-saved-title]", saved.title);
  setText("[data-saved-key]", saved.studyIdentity);
  setText("[data-saved-record-key]", `${saved.studyIdentity} · subsystem_requirement v1`);
  setText("[data-saved-statement]", saved.statement);
  setText("[data-saved-status]", `status · ${displayValue(saved.status)}`);
  setText("[data-saved-owner]", `owner · ${displayValue(saved.owner)}`);
  setText("[data-saved-notes]", `notes · ${displayValue(saved.notes)}`);
  showPage("saved");
}

function prepareConnection(target, origin) {
  connectionTarget = target;
  connectionOrigin = origin;
  const parent = cases[activeCase];
  setText("[data-route-source]", `${parent.key} · V${parent.version}`);
  setText("[data-route-source-title]", parent.title);
  setText("[data-route-source-statement]", parent.statement);
  setText("[data-route-target]", itemRouteIdentity(target));
  setText("[data-route-target-title]", target.title);
  setText("[data-route-target-statement]", target.statement);
  const details = one("[data-route-target-details]");
  details.hidden = !target.studyIdentity;
  if (target.studyIdentity) {
    setText("[data-route-target-status]", `status · ${displayValue(target.status)}`);
    setText("[data-route-target-owner]", `owner · ${displayValue(target.owner)}`);
    setText("[data-route-target-notes]", `notes · ${displayValue(target.notes)}`);
  }
  setText("[data-current-parent]", `Current parent revision · ${parent.key} v${parent.version}`);
  const form = one("[data-connection-form]");
  form.elements.source_version.value = parent.version;
  form.elements.scope.value = "Study proposal; assess the connected statements for its extent.";
  form.elements.review.value = "unreviewed study proposal";
  showPage("connection");
}

function finishUnlinkedItem() {
  unlinkedRecords[saved.parentCase].push(saved);
  saved = null;
  updateSavedResume();
  updateUnlinkedItems();
  showPage("board");
  requestAnimationFrame(() => {
    const section = one("[data-unlinked-board]");
    section.setAttribute("tabindex", "-1");
    section.scrollIntoView({ block: "center" });
    section.focus({ preventScroll: true });
  });
}

function resumeConnection() {
  const retained = linkDraft;
  activeCase = retained.parentCase;
  populateParent();
  prepareConnection(retained.target, retained.origin);
  const form = one("[data-connection-form]");
  for (const [name, value] of Object.entries(retained.fields)) form.elements[name].value = value;
  linkDraft = null;
  updateLinkResume();
}

function recordConnection(event) {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const parent = cases[activeCase];
  const fields = new FormData(event.currentTarget);
  completeConnection(parent, fields);
}

function completeConnection(parent, fields) {
  proposals[activeCase] = { target: connectionTarget, fields: Object.fromEntries(fields) };
  releaseConnectedItem();
  linkDraft = null;
  updateLinkResume();
  updateSavedResume();
  setText(
    "[data-connected-summary]",
    `${itemIdentity(connectionTarget)} is now shown as a study proposal beside the unchanged canonical ${parent.key} scope.`,
  );
  setText(
    "[data-connected-route]",
    `${parent.key} v${parent.version} → decomposes_into → ${itemRouteIdentity(connectionTarget)}`,
  );
  setText(
    "[data-connected-fields]",
    `scope · ${fields.get("scope")}   source_version · ${fields.get("source_version")}   review · ${fields.get("review")}`,
  );
  setText("[data-return-connected]", `Return to ${parent.key} contribution board →`);
  showPage("connected");
}

function releaseConnectedItem() {
  if (saved === connectionTarget) saved = null;
  for (const name of ["zero", "next"])
    unlinkedRecords[name] = unlinkedRecords[name].filter((record) => record !== connectionTarget);
  updateUnlinkedItems();
}

function renderCandidates(filter = "") {
  const query = filter.trim().toLowerCase();
  const list = one("[data-candidate-list]");
  list.replaceChildren();
  candidates
    .filter((candidate) =>
      `${candidate.key} ${candidate.title} ${candidate.statement}`.toLowerCase().includes(query),
    )
    .forEach((candidate) => {
      const duplicate = activeCase === "next" && ["SYS-01", "SYS-02"].includes(candidate.key);
      const button = document.createElement("button");
      button.className = "candidate-row";
      button.disabled = duplicate;
      button.innerHTML = `<span class="record-key">${candidate.key} · V1</span><strong>${candidate.title}</strong><small>${duplicate ? "Exact pair already recorded" : "Schema-compatible · inspect"}</small>`;
      button.addEventListener("click", () => inspectCandidate(candidate));
      list.append(button);
    });
}

function inspectCandidate(candidate) {
  selectedCandidate = { ...candidate, version: 1 };
  setText("[data-candidate-key]", `${candidate.key} · V1`);
  setText("[data-candidate-title]", candidate.title);
  setText("[data-candidate-statement]", candidate.statement);
  setText(
    "[data-candidate-context]",
    activeCase === "next"
      ? "No PRS-02 pair is recorded for this candidate in the loaded study context."
      : "No PRS-14 pair is recorded for this candidate in the complete outgoing scope.",
  );
  one("[data-select-candidate]").disabled = false;
  all(".candidate-row").forEach((row) =>
    row.classList.toggle("is-selected", row.textContent.includes(candidate.key)),
  );
}

all("[data-case]").forEach((button) =>
  button.addEventListener("click", () => {
    activeCase = button.dataset.case;
    selectedCandidate = null;
    populateParent();
    renderCandidates();
  }),
);
all("[data-go-board]").forEach((button) => button.addEventListener("click", goBoard));
one("[data-create]").addEventListener("click", startCreate);
one("[data-pause]").addEventListener("click", pauseDraft);
one("[data-cancel]").addEventListener("click", cancelDraft);
one("[data-author-form]").addEventListener("submit", saveItem);
one("[data-resume]").addEventListener("click", () => {
  activeCase = draft.parentCase;
  populateParent();
  startCreate();
});
one("[data-resume-link]").addEventListener("click", resumeConnection);
one("[data-resume-saved]").addEventListener("click", resumeSavedItem);
one("[data-finish-unlinked]").addEventListener("click", finishUnlinkedItem);
one("[data-review-connection]").addEventListener("click", () => prepareConnection(saved, "saved"));
all("[data-back-connection]").forEach((button) =>
  button.addEventListener("click", () => {
    linkDraft = null;
    updateLinkResume();
    showPage(connectionOrigin);
  }),
);
one("[data-connection-form]").addEventListener("submit", recordConnection);
one("[data-return-connected]").addEventListener("click", () => {
  populateParent();
  showPage("board");
  requestAnimationFrame(() => {
    const proposal = one("[data-proposal-board]");
    proposal.setAttribute("tabindex", "-1");
    proposal.scrollIntoView({ block: "center" });
    proposal.focus({ preventScroll: true });
  });
});
one("[data-connect-existing]").addEventListener("click", () => {
  selectedCandidate = null;
  one("[data-select-candidate]").disabled = true;
  setText("[data-candidate-key]", "Select a candidate");
  setText("[data-candidate-title]", "Inspect full intent here");
  setText("[data-candidate-statement]", "Choose from the five loaded representative results.");
  setText("[data-candidate-context]", "Inspect recorded connections before saving.");
  renderCandidates(one("[data-candidate-search]").value);
  showPage("candidates");
});
one("[data-candidate-search]").addEventListener("input", (event) =>
  renderCandidates(event.target.value),
);
one("[data-select-candidate]").addEventListener("click", () =>
  prepareConnection(selectedCandidate, "candidates"),
);
one("[data-author-form]").addEventListener("input", () => {
  draft = { ...formValues(), parentCase: activeCase };
});
for (const form of [one("[data-author-form]"), one("[data-connection-form]")]) {
  form.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && ["INPUT", "SELECT"].includes(event.target.tagName))
      event.preventDefault();
  });
}

populateParent();
renderCandidates();
updateResume();
updateLinkResume();
updateSavedResume();
const initialPage = ["author", "candidates"].includes(location.hash.slice(1))
  ? location.hash.slice(1)
  : "board";
showPage(initialPage);
