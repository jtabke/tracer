const prototypeName = document.body.dataset.prototype;
const pageTitles = {
  home: "Project",
  work: "Work",
  author: "Create requirement",
  saved: "Saved without connection",
  candidates: "Existing requirements",
  connection: "Review connection",
  connected: "Connection recorded",
  receipt: "Captured result",
};
const lensScroll = { compare: 0, map: 0 };
const candidates = {
  "REQ-R02": {
    key: "REQ-R02",
    type: "requirement",
    version: 1,
    title: "Brush and duct contribution",
    statement:
      "The brush geometry and duct path shall support the specified pickup task without assuming suction alone determines cleaning performance.",
  },
  "REQ-R06": {
    key: "REQ-R06",
    type: "requirement",
    version: 1,
    title: "Shared power-rail transient response",
    statement:
      "The shared rail shall retain the required controller supply during the defined blower-start and traction-transient scenarios.",
  },
};

let activeLens = "compare";
let activeCandidate = "REQ-R02";
let activeConnectionSource;
let authorResumePage;
let authorReturnState;
let candidateReturnPage = "work";
let connectionReturnPage = "saved";
let pageReturnState;

function reveal(selector, attribute, name) {
  document.querySelectorAll(selector).forEach((element) => {
    element.hidden = element.dataset[attribute] !== name;
  });
}

function mark(selector, attribute, stateAttribute, activeValue, name) {
  document.querySelectorAll(selector).forEach((control) => {
    control.setAttribute(
      stateAttribute,
      control.dataset[attribute] === name ? activeValue : "false",
    );
  });
}

function currentPage() {
  return document.querySelector("[data-page]:not([hidden])")?.dataset.page;
}

function setPage(name) {
  reveal("[data-page]", "page", name);
  mark("[data-page-target]", "pageTarget", "aria-current", "page", name);
  document.querySelector("[data-breadcrumb-current]")?.replaceChildren(pageTitles[name]);
  history.replaceState(null, "", `#${name}`);
  window.scrollTo({ top: 0 });
}

function setLens(name) {
  reveal("[data-lens]", "lens", name);
  mark("[data-lens-target]", "lensTarget", "aria-pressed", "true", name);
  activeLens = name;
}

function focusStep(name) {
  requestAnimationFrame(() => {
    const step = document.querySelector(`[data-step="${name}"]`);
    const heading = step?.querySelector("h2");
    step?.scrollIntoView({ block: "start" });
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  });
}

function setStep(name, moveFocus = false) {
  reveal("[data-step]", "step", name);
  mark("[data-step-target]", "stepTarget", "aria-pressed", "true", name);
  history.replaceState(null, "", `#${name}`);
  if (moveFocus) focusStep(name);
}

function restoreReadingPosition(id) {
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "center" }));
}

function focusPage(name) {
  requestAnimationFrame(() => {
    const heading = document.querySelector(`[data-page="${name}"] h1, [data-page="${name}"] h2`);
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  });
}

function rememberAuthorReturn(control) {
  if (currentPage() !== "work") return;
  authorReturnState = { origin: control, scrollY: window.scrollY };
}

function rememberPageReturn(nextPage, control) {
  if (nextPage !== "receipt") return;
  pageReturnState = { lens: activeLens, origin: control, scrollY: window.scrollY };
}

function focusFrameOrigin(origin) {
  if (origin?.isConnected) origin.focus({ preventScroll: true });
  else focusPage("work");
}

function clearReceiptReturn(frame, shouldClear) {
  if (shouldClear && frame === pageReturnState) pageReturnState = undefined;
}

function restoreWorkFrame(frame, shouldClear = false) {
  if (!frame) return false;
  clearReceiptReturn(frame, shouldClear);
  const lens = frame.lens ?? activeLens;
  setLens(lens);
  lensScroll[lens] = frame.scrollY;
  requestAnimationFrame(() => {
    window.scrollTo({ top: frame.scrollY });
    focusFrameOrigin(frame.origin);
  });
  return true;
}

function finishPageActivation(nextPage, control) {
  focusPage(nextPage);
  restoreReadingPosition(control.dataset.returnTarget);
}

function visibleResumeFrame(selector, frame) {
  return document.querySelector(selector).hidden ? undefined : frame;
}

function pendingWorkFrame(interruption) {
  const interruptedFrames = { author: authorReturnState, review: pageReturnState };
  const authorFrame = visibleResumeFrame("[data-author-resume]", authorReturnState);
  const reviewFrame = visibleResumeFrame("[data-review-resume]", pageReturnState);
  return [interruptedFrames[interruption], authorFrame, reviewFrame].find(Boolean);
}

function finishWorkActivation(nextPage, control, interruption) {
  if (restoreWorkFrame(pendingWorkFrame(interruption))) return;
  if (restoreWorkFrame(pageReturnState, true)) return;
  finishPageActivation(nextPage, control);
}

const pageActivators = { work: finishWorkActivation };

function activatePage(control) {
  const previousPage = currentPage();
  const nextPage = control.dataset.pageTarget;
  if (nextPage === "author") rememberAuthorReturn(control);
  rememberPageReturn(nextPage, control);
  const interruption = retainInterruptedTask(previousPage);
  setPage(nextPage);
  (pageActivators[nextPage] ?? finishPageActivation)(nextPage, control, interruption);
}

function activateLens(control) {
  lensScroll[activeLens] = Math.max(lensScroll[activeLens], window.scrollY);
  setLens(control.dataset.lensTarget);
  requestAnimationFrame(() => window.scrollTo({ top: lensScroll[activeLens] }));
}

function jumpToObligation(control, event) {
  event.preventDefault();
  const prefix = activeLens === "map" ? "map-" : "obligation-";
  document
    .getElementById(`${prefix}${control.dataset.obligationTarget}`)
    ?.scrollIntoView({ block: "center", inline: "center" });
}

function bind(selector, action) {
  document.querySelectorAll(selector).forEach((control) => {
    control.addEventListener("click", (event) => action(control, event));
  });
}

function requestedState(allowed, fallback) {
  return allowed.find((name) => name === location.hash.slice(1)) ?? fallback;
}

function authorValues() {
  const form = document.querySelector("[data-author-form]");
  return {
    key: "REQ-P01",
    type: "requirement",
    version: 1,
    title: form.elements.title.value.trim(),
    statement: form.elements.statement.value.trim(),
    status: form.elements.status.value.trim(),
    owner: form.elements.owner.value.trim(),
  };
}

function updateSavedItem() {
  const value = authorValues();
  document.querySelector("[data-saved-title]").textContent = value.title;
  document.querySelector("[data-draft-statement]").textContent = value.statement;
  document.querySelector("[data-saved-status]").textContent =
    `status · ${value.status || "not recorded"}`;
  document.querySelector("[data-saved-owner]").textContent =
    `owner · ${value.owner || "not recorded"}`;
  return value;
}

function showAuthorResume(page) {
  authorResumePage = page;
  const labels = {
    author: "Requirement draft retained",
    saved: "REQ-P01 saved without a connection",
    connection: "Connection proposal retained",
    connected: "Recorded study connection ready to return",
  };
  document.querySelector("[data-author-resume-title]").textContent =
    labels[page] ?? "Task retained";
  document.querySelector("[data-author-resume]").hidden = false;
}

function reviewDraftIsDirty() {
  const form = document.querySelector("[data-review-form]");
  return (
    !form.hidden &&
    (form.elements.decision.value !== "" || form.elements.rationale.value.trim() !== "")
  );
}

function showReviewResume() {
  document.querySelector("[data-review-resume]").hidden = false;
}

const authorInterruptions = {
  author: "author",
  saved: "saved",
  connection: "connection",
  connected: "connected",
};

function interruptedAuthorPage(page) {
  const candidatePage =
    page === "candidates" ? authorInterruptions[candidateReturnPage] : undefined;
  return authorInterruptions[page] ?? candidatePage;
}

function retainInterruptedTask(page) {
  const authorPage = interruptedAuthorPage(page);
  if (authorPage) {
    showAuthorResume(authorPage);
    return "author";
  }
  if (page === "receipt" && reviewDraftIsDirty()) {
    showReviewResume();
    return "review";
  }
}

function pauseAuthor() {
  const page = currentPage();
  showAuthorResume(page);
  setPage("work");
  restoreWorkFrame(authorReturnState);
}

function resumeAuthor() {
  const page = authorResumePage ?? "author";
  document.querySelector("[data-author-resume]").hidden = true;
  setPage(page);
  focusPage(page);
}

function cancelAuthor() {
  document.querySelector("[data-author-form]").reset();
  authorResumePage = undefined;
  document.querySelector("[data-author-resume]").hidden = true;
  setPage("work");
  restoreWorkFrame(authorReturnState);
}

function saveStudyItem() {
  const form = document.querySelector("[data-author-form]");
  if (!form.reportValidity()) return;
  updateSavedItem();
  authorResumePage = "saved";
  setPage("saved");
  focusPage("saved");
}

function openCandidates(control) {
  candidateReturnPage = control.dataset.openCandidates;
  const returnLabels = {
    work: "← Return to Related requirements for DES-01",
    author: "← Return to requirement draft",
    saved: "← Return to saved REQ-P01",
  };
  document.querySelector("[data-candidate-back]").textContent = returnLabels[candidateReturnPage];
  if (candidateReturnPage === "work") rememberAuthorReturn(control);
  setPage("candidates");
  focusPage("candidates");
}

function returnFromCandidates() {
  setPage(candidateReturnPage);
  if (candidateReturnPage === "work") restoreWorkFrame(authorReturnState);
  else focusPage(candidateReturnPage);
}

function selectCandidate(key) {
  activeCandidate = key;
  reveal("[data-candidate-detail]", "candidateDetail", key);
  mark("[data-candidate-target]", "candidateTarget", "aria-pressed", "true", key);
}

function updateConnectionSource(source) {
  activeConnectionSource = source;
  document.querySelector("[data-connection-source-key]").textContent =
    `${source.key} · ${source.type.toUpperCase()} · V${source.version}`;
  document.querySelector("[data-connection-source-title]").textContent = source.title;
  document.querySelector("[data-connection-source-statement]").textContent = source.statement;
  document.querySelector("[name=source_version]").value = String(source.version);
}

function prepareConnection(sourceName) {
  const source = sourceName === "draft" ? updateSavedItem() : candidates[sourceName];
  updateConnectionSource(source);
  connectionReturnPage = sourceName === "draft" ? "saved" : "candidates";
  authorResumePage = "connection";
  setPage("connection");
  focusPage("connection");
}

function returnFromConnection() {
  setPage(connectionReturnPage);
  focusPage(connectionReturnPage);
}

function relationshipValues() {
  const form = document.querySelector(".relationship-form");
  return {
    scope: form.elements.scope.value.trim(),
    sourceVersion: form.elements.source_version.value,
    review: form.elements.review.value.trim(),
  };
}

function updateProposalRow(source, relationship = relationshipValues()) {
  document.querySelector("[data-proposal-key]").textContent = `${source.key} · STUDY PROPOSAL`;
  document.querySelector("[data-proposal-title]").textContent = source.title;
  document.querySelector("[data-proposal-statement]").textContent = source.statement;
  document.querySelector("[data-proposal-triple]").textContent =
    `${source.key} → realized_by → DES-01`;
  document.querySelector("[data-connected-triple]").textContent =
    `${source.key} → realized_by → DES-01`;
  document.querySelector("[data-connected-scope]").textContent = relationship.scope;
  document.querySelector("[data-connected-version]").textContent = relationship.sourceVersion;
  document.querySelector("[data-connected-review]").textContent = relationship.review;
  document.querySelector("[data-connected-item-note]").textContent =
    source.key === "REQ-P01"
      ? "REQ-P01 was previously saved without a connection. This separate action now adds one browser-memory relationship proposal."
      : `${source.key} was selected from the recorded project candidates. This action adds one browser-memory relationship proposal and does not alter the fixture.`;
}

function recordStudyConnection() {
  const form = document.querySelector(".relationship-form");
  if (!form.reportValidity()) return;
  updateProposalRow(activeConnectionSource, relationshipValues());
  setPage("connected");
  focusPage("connected");
}

function completeConnectionReturn() {
  document.querySelector("[data-proposal-row]").hidden = false;
  document.querySelector("[data-author-resume]").hidden = true;
  authorResumePage = undefined;
  setPage("work");
  setLens("compare");
  requestAnimationFrame(() => {
    const proposal = document.querySelector("[data-proposal-row]");
    proposal.scrollIntoView({ block: "center" });
    proposal.setAttribute("tabindex", "-1");
    proposal.focus({ preventScroll: true });
  });
}

function pauseReview() {
  showReviewResume();
  setPage("work");
  restoreWorkFrame(pageReturnState);
}

function focusReviewForm() {
  requestAnimationFrame(() => {
    const heading = document.querySelector("[data-review-form] h2");
    heading?.scrollIntoView({ block: "center" });
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  });
}

function openReview() {
  document.querySelector("[data-review-form]").hidden = false;
  document.querySelector("[data-open-review]").hidden = true;
  focusReviewForm();
}

function resumeReview() {
  document.querySelector("[data-review-resume]").hidden = true;
  setPage("receipt");
  document.querySelector("[data-review-form]").hidden = false;
  document.querySelector("[data-open-review]").hidden = true;
  focusReviewForm();
}

function returnFromReceipt() {
  if (reviewDraftIsDirty()) {
    pauseReview();
    return;
  }
  document.querySelector("[data-review-form]").hidden = true;
  document.querySelector("[data-open-review]").hidden = false;
  document.querySelector("[data-review-resume]").hidden = true;
  setPage("work");
  if (restoreWorkFrame(pageReturnState, true)) return;
  setLens("compare");
  restoreReadingPosition("obligation-REQ-R03");
}

function retainReview() {
  const form = document.querySelector("[data-review-form]");
  if (!form.reportValidity()) return;
  document.querySelector("[data-review-note]").textContent =
    "Review proposal retained in client memory. No review was appended; the immutable outcome remains unchanged.";
  document.querySelector("[data-review-resume]").hidden = false;
}

function initializeBoard() {
  const initialPage = requestedState(
    ["home", "work", "author", "saved", "candidates", "connection", "connected", "receipt"],
    "work",
  );
  setPage(initialPage);
  setLens("compare");
  selectCandidate(activeCandidate);
  document.querySelector("[data-author-context]").open =
    !window.matchMedia("(max-width: 900px)").matches;
  if (initialPage === "connection" || initialPage === "connected") {
    const source = authorValues();
    updateConnectionSource(source);
    if (initialPage === "connected") updateProposalRow(source);
  }
}

function initializeDossier() {
  setStep(requestedState(["change", "subjects", "evidence", "review"], "evidence"));
}

bind("[data-page-target]", activatePage);
bind("[data-lens-target]", activateLens);
bind("[data-step-target]", (control) => setStep(control.dataset.stepTarget, true));
bind("[data-obligation-target]", jumpToObligation);
bind("[data-author-pause]", pauseAuthor);
bind("[data-author-cancel]", cancelAuthor);
bind("[data-resume-author]", resumeAuthor);
bind("[data-open-candidates]", openCandidates);
bind("[data-candidate-back]", returnFromCandidates);
bind("[data-candidate-target]", (control) => selectCandidate(control.dataset.candidateTarget));
bind("[data-use-candidate]", (control) => prepareConnection(control.dataset.useCandidate));
bind("[data-connection-source]", (control) => prepareConnection(control.dataset.connectionSource));
bind("[data-connection-back]", returnFromConnection);
bind("[data-complete-return]", completeConnectionReturn);
bind("[data-open-review]", openReview);
bind("[data-receipt-return]", returnFromReceipt);
bind("[data-review-pause]", pauseReview);
bind("[data-resume-review]", resumeReview);
bind("[data-study-action=save-item]", saveStudyItem);
bind("[data-study-action=record-connection]", recordStudyConnection);
bind("[data-study-action=retain-review]", retainReview);

const initializers = { board: initializeBoard, dossier: initializeDossier };
initializers[prototypeName]?.();
