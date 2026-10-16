/* Isolated fictional interaction study: no engine, network, database or storage calls. */
(() => {
  const requirements = [
    {
      id: "REQ-01",
      version: 2,
      title: "Browse categories",
      statement: "Users shall browse categories and search within a selected category.",
      code: [{ artifact: "discovery", extent: "Partial", note: "Browsing only" }],
      tests: 1,
    },
    {
      id: "REQ-02",
      version: 1,
      title: "Filter results",
      statement:
        "Users shall narrow the service list by category without losing their current search text.",
      code: [],
      tests: 0,
    },
    {
      id: "REQ-03",
      version: 1,
      title: "Handle sparse results",
      statement:
        "Users shall retain useful category context when a search returns few or no services.",
      code: [{ artifact: "discovery", extent: "Mapped", note: "Extent unreviewed" }],
      tests: 0,
    },
  ];
  // Human-authored context for this bounded family, not inferred parentage or satisfaction.
  const intent = { id: "INT-01", title: "Find suitable services", relationship: "contributes to" };
  const artifacts = [
    {
      id: "discovery",
      name: "discovery.ts",
      path: "src/discovery.ts",
      description: "Category organization and sparse-result helpers.",
      source:
        "// Fictional fixture — not repository code\nexport function organizeDiscovery(items) {\n  return groupByCategory(items);\n}\n\n// Filtering relevance has not been assessed.",
    },
    {
      id: "filters",
      name: "filters.ts",
      path: "src/filters.ts",
      description: "A fictional category-filter helper.",
      source:
        "// Fictional fixture — not repository code\nexport function filterByCategory(items, category) {\n  return items.filter(item =>\n    item.category === category\n  );\n}\n\n// Preservation of search text is unassessed.",
    },
    {
      id: "category",
      name: "category-index.ts",
      path: "src/category-index.ts",
      description: "Category index preparation.",
      source:
        "// Fictional fixture — not repository code\nexport function categoryIndex(items) {\n  return new Set(items.map(item => item.category));\n}",
    },
  ];
  const state = {
    selected: "REQ-02",
    focusedArtifact: null,
    view: "grid",
    links: [],
    candidate: null,
    pickerSource: null,
    inspecting: false,
    readOnly: false,
  };
  const $ = (id) => document.getElementById(id);
  const escape = (text) =>
    String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const selected = () => requirements.find((r) => r.id === state.selected);
  const codeLinks = (r) => [...r.code, ...state.links.filter((l) => l.requirement === r.id)];
  const file = (id) => artifacts.find((a) => a.id === id);
  const picker = $("picker");
  let origin = null;
  let toastTimer;
  function notify(text) {
    clearTimeout(toastTimer);
    $("toast").textContent = text;
    $("toast").classList.add("visible");
    toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 4500);
  }
  function mappingButton(r, link) {
    return `<button class="file-name mapping-button" data-mapping="${link.artifact}" data-requirement="${r.id}" aria-label="Inspect ${escape(file(link.artifact).name)} mapping for ${r.id}">${escape(file(link.artifact).name)}</button>`;
  }
  function remainder(r) {
    const links = codeLinks(r);
    const code = !links.length
      ? "No code mapping recorded; existing code may be unlinked."
      : `Code mappings recorded; ${links.some((l) => l.extent === "Partial") ? "partial coverage needs attention; " : ""}mapping extent still needs review.`;
    return `${code} ${r.tests ? "Test mapping targets an older requirement version." : "No test mapping recorded."}`;
  }
  function codeCell(r) {
    const links = codeLinks(r);
    return links.length
      ? links
          .map(
            (l) =>
              `${mappingButton(r, l)}<span class="mapping-status ${l.extent === "Partial" ? "amber" : ""}"><span class="state-dot"></span>${escape(l.extent)}</span><span class="cell-note">${escape(l.note)}</span>`,
          )
          .join("<br>")
      : '<span class="untraced">— Not traced</span>';
  }
  function renderGrid() {
    return `<table class="requirements"><thead><tr><th scope="col">REQUIREMENT</th><th scope="col">CODE MAPPING</th><th scope="col">TEST MAPPING</th></tr></thead><tbody>${requirements.map((r) => `<tr class="${r.id === state.selected ? "selected" : ""}"><td><button class="row-select" data-select="${r.id}" aria-pressed="${r.id === state.selected}"><span class="req-key">${r.id} <span> / v${r.version}</span></span><span class="req-title">${escape(r.title)} <span class="row-arrow" aria-hidden="true">↗</span></span></button></td><td>${codeCell(r)}</td><td>${r.tests ? '<span class="file-name">discovery.spec.ts</span><span class="mapping-status purple"><span class="state-dot"></span>Outdated mapping</span><span class="cell-note">Linked to REQ-01 v1</span>' : '<span class="untraced">— Not traced</span>'}</td></tr>`).join("")}</tbody></table>`;
  }
  function laneEmphasis(r, links) {
    if (!state.focusedArtifact) return r.id === state.selected ? "selected" : "unrelated";
    return links.some((link) => link.artifact === state.focusedArtifact) ? "related" : "unrelated";
  }
  function laneSelection(related, isSelected) {
    return state.focusedArtifact
      ? related
        ? "Recorded mapping to selected artifact"
        : "No recorded mapping to selected artifact"
      : isSelected
        ? "Selected"
        : "Inspect requirement ↗";
  }
  function laneRemainder(links, partial) {
    if (!links.length) return "No code mapping recorded; existing code may be unlinked.";
    if (partial)
      return `Browsing mapped; search within category not mapped.${links.length > 1 ? " Other mapping extent unreviewed." : ""}`;
    return "Code mapping recorded; extent unreviewed.";
  }
  function laneAction(r, links, partial) {
    return `${!links.length ? `<button class="context-action" data-find-code="${r.id}">Find existing code ↗</button>` : partial ? `<button class="context-action" data-mapping="${links.find((l) => l.extent === "Partial").artifact}" data-requirement="${r.id}" aria-label="Review covered scope for ${r.id}">Review covered scope ↗</button>` : ""}`;
  }
  function artifactIdentity(mappings) {
    return `${mappings.length > 1 ? "One shared identity" : "One artifact identity"} · ${mappings.length} recorded ${mappings.length === 1 ? "mapping" : "mappings"}`;
  }
  function laneTestContext(r) {
    return `${r.tests ? '<p class="outdated-scope">Test mapping outdated · REQ-01 v1</p><details class="version-context"><summary>Compare linked version</summary><p>discovery.spec.ts maps to REQ-01 v1; the current requirement is v2. The older statement and test result are not provided in this fixture. Reassessment is needed; this is not a failed test.</p></details>' : "<p>No test mapping recorded.</p>"}`;
  }
  function renderRelationships() {
    const lanes = requirements
      .map((r) => {
        const links = codeLinks(r);
        const partial = links.some((link) => link.extent === "Partial");
        const related =
          state.focusedArtifact && links.some((link) => link.artifact === state.focusedArtifact);
        const isSelected = !state.focusedArtifact && r.id === state.selected;
        const emphasis = laneEmphasis(r, links);
        const code = laneRemainder(links, partial);
        return `<section class="contribution-lane ${emphasis}" data-lane="${r.id}" data-emphasis="${emphasis}" aria-label="${r.id} contribution"><button class="contribution-select" data-select="${r.id}" aria-pressed="${isSelected}"><span class="req-key">${r.id} / v${r.version}</span><strong>${escape(r.title)}</strong><span class="lane-selection">${laneSelection(related, isSelected)}</span></button><p class="contribution-statement">${escape(r.statement)}</p><div class="contribution-remainder"><span class="lane-label">UNRESOLVED SCOPE</span><p class="${partial ? "partial-scope" : ""}">${escape(code)}</p>${laneAction(r, links, partial)}${laneTestContext(r)}</div></section>`;
      })
      .join("");
    const groups = artifacts
      .map((a) => {
        const mappings = requirements.flatMap((r) =>
          codeLinks(r)
            .filter((l) => l.artifact === a.id)
            .map((link) => ({ r, link })),
        );
        if (!mappings.length) return "";
        const highlighted = state.focusedArtifact
          ? state.focusedArtifact === a.id
          : mappings.some(({ r }) => r.id === state.selected);
        const emphasis = highlighted ? "related" : "unrelated";
        return `<section class="realization-group ${emphasis}" data-artifact="${a.id}" data-emphasis="${emphasis}" aria-label="${escape(a.name)} recorded mappings"><div class="artifact-identity"><h3><button class="artifact-select file-name" data-artifact-select="${a.id}" aria-pressed="${state.focusedArtifact === a.id}" aria-label="Select ${escape(a.name)} artifact">${escape(a.name)}</button></h3><span>${escape(a.path)}</span><p>${artifactIdentity(mappings)}</p></div><div class="contribution-mappings">${mappings.map(({ r, link }) => `<button class="contribution-mapping ${(state.focusedArtifact ? state.focusedArtifact === a.id : r.id === state.selected) ? "selected" : "unrelated"}" data-mapping="${a.id}" data-requirement="${r.id}" style="--lane-index: ${requirements.indexOf(r) + 1}" aria-label="Inspect ${escape(a.name)} mapping for ${r.id}"><span class="req-key">${r.id} / v${r.version} <span aria-hidden="true">↗</span></span><span class="mapping-qualifier ${link.extent === "Partial" ? "partial-scope" : ""}">${escape(link.extent)} · ${escape(link.note)}</span></button>`).join("")}</div></section>`;
      })
      .join("");
    return `<div class="contribution-view"><section class="parent-intent" aria-label="Illustrative parent intent"><div><span class="lane-label">${intent.id} · PARENT INTENT</span><h2>${escape(intent.title)}</h2></div><p>Illustrative family · each requirement <strong>${escape(intent.relationship)}</strong> this intent.</p></section><div class="family-direction"><span aria-hidden="true">↓</span> REQUIREMENT CONTRIBUTIONS <span>Compare obligations and unresolved scope</span></div><div class="relationship-focus" role="status">${state.focusedArtifact ? `Selected ${escape(file(state.focusedArtifact).name)} · highlighted requirements have recorded mappings to this artifact.` : `Selected ${state.selected} · highlighted artifacts have recorded mappings from this requirement.`}${state.focusedArtifact ? `<button id="clear-emphasis" class="context-action">Return to ${state.selected}</button>` : ""}</div><div class="contribution-lanes">${lanes}</div><section class="realization-context" aria-label="Recorded code contributions"><div class="family-direction"><span aria-hidden="true">↓</span> RECORDED CODE MAPPINGS <span>Select an artifact to trace its recorded contributions</span></div>${groups}</section></div>`;
  }
  function renderArtifactInspector() {
    const a = file(state.focusedArtifact);
    const mappings = requirements.flatMap((r) =>
      codeLinks(r)
        .filter((l) => l.artifact === a.id)
        .map((link) => ({ r, link })),
    );
    return `<div class="inspector-label">SELECTED CODE ARTIFACT</div><h2>${escape(a.name)}</h2><p class="artifact-path">${escape(a.path)}</p><p>${escape(a.description)}</p><h3 class="inspector-section">Recorded contributions</h3><div class="inspector-link-list">${mappings.map(({ r, link }) => `<div><button class="context-action" data-mapping="${a.id}" data-requirement="${r.id}" aria-label="Inspect ${escape(a.name)} mapping for ${r.id}">${r.id} · ${escape(r.title)}</button><span class="cell-note">v${r.version} · ${escape(link.extent)} · ${escape(link.note)}</span></div>`).join("")}</div><details class="artifact-source"><summary>Inspect fictional source</summary><pre class="source-preview">${escape(a.source)}</pre></details><button id="return-requirement" class="context-action">Return to ${state.selected}</button>`;
  }
  function requirementMetrics(r, links) {
    return `<div class="inspector-mappings"><div><small>CODE MAPPINGS</small><span class="count">${links.length}</span><span class="count-label">${links.length ? "recorded" : "not traced"}</span></div><div><small>TEST MAPPINGS</small><span class="count">${r.tests}</span><span class="count-label">${r.tests ? "outdated" : "not traced"}</span></div></div>`;
  }
  function requirementGuidance(r, links) {
    return `${state.view === "grid" ? `<div class="remaining-work" id="remaining-work"><strong>What needs attention</strong><p>${escape(remainder(r))}</p></div>` : `<p class="inspector-guidance">${links.length ? "Inspect a recorded mapping for covered scope and source." : "Find a code candidate, then assess it against the requirement."}</p>`}`;
  }
  function renderRequirementInspector(r, links) {
    return `<div class="inspector-label">SELECTED REQUIREMENT <span class="selection-mark" aria-hidden="true"></span></div><div class="inspector-id">${r.id} / version ${r.version}</div><h2>${escape(r.title)}</h2>${state.view === "grid" ? `<p class="requirement-statement">${escape(r.statement)}</p>` : ""}${requirementMetrics(r, links)}${requirementGuidance(r, links)}${links.length ? `<div class="inspector-link-list">${links.map((l) => `<div>${mappingButton(r, l)}<span class="cell-note">${escape(l.extent)} · ${escape(l.note)}</span>${state.links.includes(l) ? `<button class="undo-link" data-undo="${l.artifact}" data-requirement="${r.id}" aria-label="Undo link to ${escape(file(l.artifact).name)} for ${r.id}">Undo this session link</button>` : ""}</div>`).join("")}</div>` : ""}<button id="open-picker" class="primary-button">${links.length ? "Link artifact" : "Find existing code"} <span aria-hidden="true">↗</span></button>`;
  }
  function artifactIsSelected() {
    return state.view === "relationships" && state.focusedArtifact;
  }
  function render() {
    const r = selected(),
      links = codeLinks(r),
      gaps = requirements.filter((item) => codeLinks(item).length === 0).length;
    $("gap-count").innerHTML =
      `Service discovery · <b>${gaps} / ${requirements.length}</b> requirements without code mappings`;
    $("view").innerHTML = state.view === "grid" ? renderGrid() : renderRelationships();
    $("inspector").setAttribute(
      "aria-label",
      artifactIsSelected() ? "Selected artifact" : "Selected requirement",
    );
    $("inspector").innerHTML = artifactIsSelected()
      ? renderArtifactInspector()
      : renderRequirementInspector(r, links);
    document
      .querySelectorAll("[data-view]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.view)));
  }
  function renderResults() {
    const query = $("search").value.trim().toLowerCase();
    const results = artifacts.filter((a) => `${a.name} ${a.path}`.toLowerCase().includes(query));
    $("result-count").textContent =
      `${results.length} ${results.length === 1 ? "match" : "matches"}`;
    $("results").innerHTML = results.length
      ? results
          .map(
            (a) =>
              `<button class="artifact-result" data-candidate="${a.id}" aria-pressed="${state.candidate === a.id}"><span class="artifact-icon" aria-hidden="true">ts</span><span><span class="artifact-title">${escape(a.name)}</span><small>${escape(a.path)}</small></span><span class="check" aria-hidden="true">${state.candidate === a.id ? "✓" : "+"}</span></button>`,
          )
          .join("")
      : '<div class="no-results">No artifacts match. Try a filename or path.</div>';
  }
  function candidateInstruction(source, a, duplicate, mapping) {
    return state.readOnly
      ? `Recorded mapping: ${source.id} / v${source.version} → ${a.name} · ${mapping.extent} · ${mapping.note}. Read-only; nothing changed.`
      : duplicate
        ? `Already mapped: ${source.id} → ${a.name}. No duplicate will be added.`
        : a
          ? `Draft: ${source.id} → ${a.name} · code mapping · extent unreviewed. Nothing recorded yet.`
          : "Choose a candidate. Nothing is linked yet.";
  }
  function recordedCandidateMappings(a) {
    const recorded = a
      ? requirements.flatMap((item) =>
          codeLinks(item)
            .filter((link) => link.artifact === a.id)
            .map((link) => `${item.id}: ${link.extent.toLowerCase()} · ${link.note.toLowerCase()}`),
        )
      : [];
    return recorded;
  }
  function candidateSource(a) {
    return `${state.inspecting ? `<div class="source-label">FICTIONAL SOURCE PREVIEW / NOT YOUR REPOSITORY</div><pre class="source-preview">${escape(a.source)}</pre>` : ""}`;
  }
  function candidateDetail(a, recorded) {
    return `<div class="detail-top"><h3>${state.readOnly ? "Recorded artifact" : "Candidate context"}</h3><button data-inspect="true" aria-expanded="${state.inspecting}">${state.inspecting ? "Hide source ↑" : "Inspect source ↓"}</button></div><p>${escape(a.description)}</p><p>${recorded.length ? `Recorded here: ${escape(recorded.join("; "))}.` : "No recorded mappings in this toy session."}</p>${candidateSource(a)}`;
  }
  function canRecordCandidate(a, duplicate) {
    return !state.readOnly && a && !duplicate;
  }
  function renderCandidate() {
    const a = file(state.candidate),
      source = requirements.find((r) => r.id === state.pickerSource);
    const duplicate = a && codeLinks(source).some((l) => l.artifact === a.id);
    $("confirm-link").disabled = !canRecordCandidate(a, duplicate);
    const mapping = a && codeLinks(source).find((l) => l.artifact === a.id);
    $("draft-line").textContent = candidateInstruction(source, a, duplicate, mapping);
    const detail = $("artifact-detail");
    detail.hidden = !a;
    const recorded = recordedCandidateMappings(a);
    if (a) detail.innerHTML = candidateDetail(a, recorded);
  }
  function openPicker(button, requirement = state.selected, artifact = null) {
    origin = button;
    state.candidate = artifact;
    state.readOnly = !!artifact;
    state.inspecting = !!artifact;
    state.pickerSource = requirement;
    const r = requirements.find((item) => item.id === requirement);
    $("picker-key").textContent = r.id;
    $("picker-title").textContent = state.readOnly
      ? "Inspect recorded mapping"
      : "Assess a code candidate";
    $("picker-context").innerHTML =
      `<strong>${escape(r.title)} · ${r.id} / v${r.version}</strong><p>${escape(r.statement)}</p>`;
    $("candidate-search").hidden = state.readOnly;
    $("confirm-link").hidden = state.readOnly;
    $("cancel-picker").textContent = state.readOnly ? "Done" : "Cancel";
    $("search").value = "";
    renderResults();
    renderCandidate();
    picker.showModal();
    (state.readOnly ? $("close-picker") : $("search")).focus();
  }
  function closePicker() {
    picker.close();
  }
  function changeView(button) {
    if (button.dataset.view) {
      state.view = button.dataset.view;
      render();
    }
  }
  function chooseRequirement(button) {
    if (button.dataset.select) {
      state.focusedArtifact = null;
      state.selected = button.dataset.select;
      render();
      const restored = document.querySelector(`[data-select="${state.selected}"]`);
      restored?.focus({ preventScroll: true });
    }
  }
  function chooseArtifact(button) {
    if (button.dataset.artifactSelect) {
      state.focusedArtifact = button.dataset.artifactSelect;
      render();
      document
        .querySelector(`[data-artifact-select="${state.focusedArtifact}"]`)
        ?.focus({ preventScroll: true });
    }
  }
  function returnRequirement(button) {
    if (["clear-emphasis", "return-requirement"].includes(button.id)) {
      state.focusedArtifact = null;
      render();
      document.querySelector(`[data-select="${state.selected}"]`)?.focus({ preventScroll: true });
    }
  }
  function findExistingCode(button) {
    if (button.dataset.findCode) openPicker(button, button.dataset.findCode);
  }
  function openSelectedPicker(button) {
    if (button.id === "open-picker") openPicker(button);
  }
  function inspectRecordedMapping(button) {
    if (button.dataset.mapping)
      openPicker(button, button.dataset.requirement, button.dataset.mapping);
  }
  function undoSessionLink(button) {
    if (button.dataset.undo) {
      const index = state.links.findIndex(
        (link) =>
          link.requirement === button.dataset.requirement && link.artifact === button.dataset.undo,
      );
      if (index < 0) return false;
      const [link] = state.links.splice(index, 1);
      render();
      $("open-picker").focus();
      notify(
        `Session link undone: ${link.requirement} → ${file(link.artifact).name}. Other mappings retained.`,
      );
    }
    return true;
  }
  function closeRequestedPicker(button) {
    if (["close-picker", "cancel-picker"].includes(button.id)) closePicker();
  }
  function chooseCandidate(button) {
    if (button.dataset.candidate && !state.readOnly) {
      state.candidate = button.dataset.candidate;
      renderResults();
      renderCandidate();
      document
        .querySelector(`[data-candidate="${state.candidate}"]`)
        ?.focus({ preventScroll: true });
    }
  }
  function toggleCandidateSource(button) {
    if (button.dataset.inspect) {
      state.inspecting = !state.inspecting;
      renderCandidate();
      document.querySelector("[data-inspect]")?.focus();
    }
  }
  function canConfirmCandidate(button) {
    return button.id === "confirm-link" && state.candidate && !state.readOnly;
  }
  function canResetSession(button) {
    return (
      button.id === "reset" &&
      (!state.links.length ||
        window.confirm("Discard this tab’s recorded toy links and reset the study?"))
    );
  }
  function recordCandidate(button) {
    if (canConfirmCandidate(button)) {
      const r = requirements.find((item) => item.id === state.pickerSource);
      if (codeLinks(r).some((l) => l.artifact === state.candidate)) return false;
      const a = file(state.candidate);
      state.links.push({
        requirement: r.id,
        artifact: a.id,
        extent: "Mapped",
        note: "Extent unreviewed",
      });
      state.selected = r.id;
      state.focusedArtifact = null;
      closePicker();
      render();
      $("open-picker").focus();
      notify(`Link recorded in this tab: ${r.id} → ${a.name}. Extent unreviewed.`);
    }
    return true;
  }
  function resetSession(button) {
    if (canResetSession(button)) {
      state.links = [];
      state.selected = "REQ-02";
      state.focusedArtifact = null;
      state.view = "grid";
      render();
      notify("Toy workspace reset. No repository data changed.");
    }
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    changeView(button);
    chooseRequirement(button);
    chooseArtifact(button);
    returnRequirement(button);
    findExistingCode(button);
    openSelectedPicker(button);
    inspectRecordedMapping(button);
    if (!undoSessionLink(button)) return;
    closeRequestedPicker(button);
    chooseCandidate(button);
    toggleCandidateSource(button);
    if (!recordCandidate(button)) return;
    resetSession(button);
  });
  $("search").addEventListener("input", () => {
    state.candidate = null;
    renderResults();
    renderCandidate();
  });
  picker.addEventListener("close", () => {
    state.candidate = null;
    state.pickerSource = null;
    state.inspecting = false;
    state.readOnly = false;
    origin?.focus();
  });
  function atTabBoundary(event, first, last) {
    return event.shiftKey ? document.activeElement === first : document.activeElement === last;
  }
  function canFocusPickerSearch(event) {
    return (
      picker.open &&
      !state.readOnly &&
      event.key === "/" &&
      !["INPUT", "TEXTAREA"].includes(event.target.tagName)
    );
  }
  picker.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [...picker.querySelectorAll("button:not(:disabled), input")].filter(
      (element) => element.getClientRects().length,
    );
    const first = controls[0],
      last = controls.at(-1);
    if (atTabBoundary(event, first, last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (canFocusPickerSearch(event)) {
      event.preventDefault();
      $("search").focus();
    }
  });
  render();
})();
