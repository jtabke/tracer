(() => {
  const model = globalThis.TracerToy;
  let state = model.initial();
  const $ = (id) => document.getElementById(id);
  const esc = (text) =>
    String(text ?? "").replace(
      /[&<>"']/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
    );
  const openEditors = new Set();
  const say = (text) => {
    $("status").textContent = text;
  };
  const parentsOf = (id) =>
    model
      .parents(state, id)
      .map(
        (link) =>
          `<button type="button" data-scope="${esc(link.from)}" aria-label="Show ${esc(model.item(state, link.from).title)} family for ${esc(id)}">${esc(link.from)} · ${esc(link.meaning)}</button>`,
      )
      .join("");
  function draftBadge(id, changed) {
    const local = id.startsWith("LOCAL-");
    return {
      draft: changed || local,
      text: changed
        ? "Local wording changed"
        : local
          ? "New local contribution"
          : "Original wording",
    };
  }
  function cardDraftBadge(id, changed) {
    const badge = draftBadge(id, changed);
    return `<span class="badge ${badge.draft ? "draft" : ""}" id="draft-${esc(id)}">${badge.text}</span>`;
  }
  function cardIdentity(item, original, changed, parents) {
    return `      <div class="meta"><span class="identity">${esc(item.id)}</span><span>${esc(item.kind)}</span><span>${esc(original.version)}</span>${cardDraftBadge(item.id, changed)}${parents.length > 1 ? '<span class="badge">One item · two parents</span>' : ""}</div>`;
  }
  function cardContext(item, current, contextual, related) {
    return `      <div class="relationships"><strong>${contextual ? "Outside this family · authored relationship context" : "Contribution context"}</strong><div>${parentsOf(item.id)}</div>${related.map((link) => `<button type="button" data-locate="${esc(link.to)}">${esc(link.meaning)} → ${esc(link.to)}</button>`).join("")}</div>
      <details class="editor" data-editor="${esc(item.id)}" ${openEditors.has(item.id) ? "open" : ""}><summary>Edit ${esc(item.id)} in this context</summary>
        <label for="edit-title-${esc(item.id)}">Title for ${esc(item.id)}</label><input id="edit-title-${esc(item.id)}" data-edit="${esc(item.id)}" data-field="title" value="${esc(current.title)}" maxlength="200" />
        <label for="edit-statement-${esc(item.id)}">Statement for ${esc(item.id)}</label><textarea id="edit-statement-${esc(item.id)}" data-edit="${esc(item.id)}" data-field="statement" maxlength="6000" rows="5">${esc(current.statement)}</textarea>
        <button type="button" data-discard="${esc(item.id)}">Discard local wording edit ${esc(item.id)}</button><p class="subtle">Changes are proposals in this tab. Original wording is not overwritten.</p>
      </details>
`;
  }
  function cardProposal(item, original, changed) {
    return `<div class="comparison"><strong>Original ${esc(original.version)}</strong><p class="before">${esc(original.statement)}</p><strong data-comparison-label="${esc(item.id)}">${changed ? "Local proposed wording above" : "No wording change proposed"}</strong><p class="subtle" data-comparison-note="${esc(item.id)}">${changed ? "A direct draft edit, not proof of downstream impact." : "Needs interpretation; no change is assumed."}</p></div><label for="question-${esc(item.id)}">Assessment question for ${esc(item.id)}</label><textarea id="question-${esc(item.id)}" data-question="${esc(item.id)}" maxlength="6000" rows="2" placeholder="What needs investigation, and why?">${esc(state.questions[item.id] ?? "")}</textarea>`;
  }
  function card(item, contextual = false) {
    const current = model.current(state, item.id),
      original = model.item(state, item.id);
    const changed = model.changed(state, item.id),
      parents = model.parents(state, item.id);
    const related = model
      .links(state)
      .filter((link) => link.from === item.id && model.item(state, link.to).kind !== "Evidence");
    return `<article class="card ${changed ? "changed" : ""}" id="card-${esc(item.id)}" aria-labelledby="title-${esc(item.id)}">
      ${cardIdentity(item, original, changed, parents)}
      <h3 id="title-${esc(item.id)}" tabindex="-1">${esc(current.title)}</h3>
      <p class="statement" id="statement-${esc(item.id)}">${esc(current.statement)}</p>
      ${original.note ? `<p class="note">${esc(original.note)}</p>` : ""}
      ${cardContext(item, current, contextual, related)}
      ${state.lens === "change" ? cardProposal(item, original, changed) : ""}
    </article>`;
  }
  function evidenceCard(item) {
    const changed = model.evidence(state, item.id);
    return `<article class="card" id="evidence-${esc(item.id)}"><div class="meta"><span class="identity">${esc(item.id)}</span><span class="badge">Applicability unknown</span></div><h3>${esc(item.title)}</h3><p>${esc(item.statement)}</p><strong>Original captured inputs</strong><ul class="input-list">${item.inputs.map((id) => `<li>${esc(id)} · ${esc(model.item(state, id).version)}${changed.includes(id) ? ' <span class="input-change">— local proposed wording differs</span>' : " — no local wording difference"}</li>`).join("")}</ul><p class="subtle">${changed.length ? "Reassess against the proposed behavior; do not rewrite this original observation or assume it is invalid." : "No local input edit detected is not proof of applicability."}</p><label for="question-${esc(item.id)}">Assessment question for ${esc(item.id)}</label><textarea id="question-${esc(item.id)}" data-question="${esc(item.id)}" maxlength="6000" rows="2">${esc(state.questions[item.id] ?? "")}</textarea></article>`;
  }
  function render() {
    if (!state.author.title && !state.author.statement) state.author.scope = state.scope;
    $("new-title").value = state.author.title;
    $("new-statement").value = state.author.statement;
    $("new-kind").value = state.author.kind;
    $("author-context").textContent =
      "New contribution belongs to " +
      state.author.scope +
      ". This parent stays captured while you draft, even if you browse another family.";
    $("intents").innerHTML = model.fixture.parents
      .map((id) => {
        const item = model.item(state, id);
        return `<article class="intent ${state.scope === id ? "active" : ""}"><div class="meta"><span class="identity">${esc(id)}</span><span class="badge">Unchanged system intent</span></div><h3>${esc(item.title)}</h3><p>${esc(item.statement)}</p><button data-scope="${esc(id)}" aria-pressed="${state.scope === id}">Work with ${esc(item.title)} family</button></article>`;
      })
      .join("");
    const family = model.family(state),
      ids = new Set(family.map((item) => item.id));
    const visible = model.visible(state),
      evidence = visible.filter((item) => item.kind === "Evidence");
    const related = visible.filter((item) => item.kind !== "Evidence" && !ids.has(item.id));
    $("scope-label").textContent = "Selected family · " + state.scope;
    $("family-heading").textContent =
      model.item(state, state.scope).title + " — contributions together";
    $("scope-detail").textContent =
      `${family.length} contributions · ${related.length} cross-cutting items · ${evidence.length} original observations. Other branches are not included; both system intentions remain visible.`;
    $("family").innerHTML = family.map((item) => card(item)).join("");
    $("related").innerHTML = related.map((item) => card(item, true)).join("");
    $("related-section").hidden = related.length === 0;
    $("evidence").innerHTML = evidence.map(evidenceCard).join("");
    $("proposal").hidden = state.lens !== "change";
    $("family-lens").setAttribute("aria-pressed", String(state.lens === "family"));
    $("change-lens").setAttribute("aria-pressed", String(state.lens === "change"));
    const options = model
      .items(state)
      .filter(
        (item) =>
          !model.fixture.parents.includes(item.id) && item.kind !== "Evidence" && !ids.has(item.id),
      );
    $("existing").innerHTML = options
      .map(
        (item) => `<option value="${esc(item.id)}">${esc(item.id)} · ${esc(item.title)}</option>`,
      )
      .join("");
    $("connect").querySelector("button").disabled = options.length === 0;
    document.querySelectorAll("[data-editor]").forEach((details) =>
      details.addEventListener("toggle", () => {
        if (!details.isConnected) return;
        if (details.open) openEditors.add(details.dataset.editor);
        else openEditors.delete(details.dataset.editor);
      }),
    );
  }
  function focusFamily() {
    $("family-heading").focus({ preventScroll: true });
    $("family-heading").scrollIntoView({ block: "center", behavior: "instant" });
  }
  function focusItem(id) {
    const heading = $("title-" + id);
    if (heading) {
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: "center", behavior: "instant" });
    } else
      say(
        "That item is outside this bounded neighborhood. Change family to inspect it; no proposal was lost.",
      );
  }
  function handleContextClick(button) {
    if (button.dataset.scope) {
      state.scope = button.dataset.scope;
      render();
      focusFamily();
      say(
        "Family changed; local wording and assessment questions retained. Shared items keep the same identity.",
      );
    } else if (button.dataset.locate) focusItem(button.dataset.locate);
    else if (button.dataset.discard) {
      const id = button.dataset.discard;
      delete state.drafts[id];
      render();
      focusItem(id);
      say(
        "Discarded only the local wording edit for " + id + ". Assessment questions are retained.",
      );
    }
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    handleContextClick(button);
  });
  function updateWordingComparison(id, changed) {
    const comparison = document.querySelector('[data-comparison-label="' + id + '"]');
    if (comparison) {
      comparison.textContent = changed
        ? "Local proposed wording above"
        : "No wording change proposed";
      document.querySelector('[data-comparison-note="' + id + '"]').textContent = changed
        ? "A direct draft edit, not proof of downstream impact."
        : "Needs interpretation; no change is assumed.";
    }
  }
  function editWording(input) {
    const id = input.dataset.edit;
    model.edit(state, id, input.dataset.field, input.value);
    $(input.dataset.field === "title" ? "title-" + id : "statement-" + id).textContent =
      input.value;
    const changed = model.changed(state, id),
      badge = $("draft-" + id);
    const badgeState = draftBadge(id, changed);
    badge.textContent = badgeState.text;
    updateWordingComparison(id, changed);
    badge.classList.toggle("draft", badgeState.draft);
    $("card-" + id).classList.toggle("changed", changed);
    // Update observations only; never replace the active editor or sibling cards while typing.
    $("evidence")
      .querySelectorAll("textarea")
      .forEach((textarea) => {
        state.questions[textarea.dataset.question] = textarea.value;
      });
    $("evidence").innerHTML = model
      .visible(state)
      .filter((item) => item.kind === "Evidence")
      .map(evidenceCard)
      .join("");
    say(
      "Local wording retained in this tab; download to preserve it before reload. Original data unchanged.",
    );
  }
  function captureAuthorDraft() {
    if (!state.author.title && !state.author.statement) state.author.scope = state.scope;
    state.author.title = $("new-title").value;
    state.author.statement = $("new-statement").value;
    state.author.kind = $("new-kind").value;
    $("author-context").textContent =
      "Draft captured under " +
      state.author.scope +
      ". Browsing another family will not retarget it.";
  }
  document.addEventListener("input", (event) => {
    const input = event.target;
    if (input.dataset.edit) {
      editWording(input);
    } else if (input.dataset.question) {
      state.questions[input.dataset.question] = input.value;
      say("Assessment question retained locally. No decision or approval recorded.");
    } else if (input.closest("#author")) {
      captureAuthorDraft();
    }
  });
  $("family-lens").onclick = () => {
    state.lens = "family";
    render();
    focusFamily();
    say("Family context retained. Drafts and questions are unchanged.");
  };
  $("change-lens").onclick = () => {
    state.lens = "change";
    render();
    focusFamily();
    say(
      "Proposal lens on the same family. Nothing committed; possible consequences are not established impacts.",
    );
  };
  function replaceProposal(prior) {
    return (
      !prior ||
      !model.changed(state, "SW-LIMIT") ||
      confirm("Replace your local SW-LIMIT wording with the illustrative proposal?")
    );
  }
  $("seed-proposal").onclick = () => {
    const prior = state.drafts["SW-LIMIT"];
    if (!replaceProposal(prior)) return;
    model.edit(state, "SW-LIMIT", "statement", model.fixture.proposal);
    render();
    focusItem("SW-LIMIT");
    say(
      "Illustrative SW-LIMIT proposal filled. Both system intentions, other items and original observations remain unchanged.",
    );
  };
  $("author").onsubmit = (event) => {
    event.preventDefault();
    try {
      const parent = state.author.scope;
      const id = model.add(
        state,
        $("new-title").value,
        $("new-statement").value,
        $("new-kind").value,
        parent,
      );
      state.scope = parent;
      state.author = { scope: parent, title: "", statement: "", kind: "Software" };
      $("author").reset();
      render();
      focusItem(id);
      say(
        "Added " +
          id +
          " with a proposed contribution relationship. Not an established requirement or coverage verdict.",
      );
    } catch (error) {
      say(error.message);
    }
  };
  $("connect").onsubmit = (event) => {
    event.preventDefault();
    try {
      const id = $("existing").value;
      model.connect(state, id);
      render();
      focusItem(id);
      say(
        "Proposed a contribution relationship to existing " + id + "; no duplicate item created.",
      );
    } catch (error) {
      say(error.message);
    }
  };
  $("export").onclick = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "tracer-neighborhood-toy-drafts.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    say(
      "Toy draft download requested. Verify the file saved before closing. Original observations and Tracer records are not changed.",
    );
  };
  function hasWordingDrafts() {
    return Object.keys(state.drafts).length || Object.values(state.questions).some(Boolean);
  }
  function hasAuthoredContributions() {
    return state.addedItems.length || state.addedLinks.length;
  }
  function hasAuthorDraft(title, statement) {
    return title || statement;
  }
  function hasLocalDrafts() {
    return (
      hasWordingDrafts() ||
      hasAuthoredContributions() ||
      hasAuthorDraft(state.author.title, state.author.statement)
    );
  }
  async function readDraftFile(file) {
    if (file.size > 200000) throw Error("Choose a toy workspace smaller than 200 KB.");
    return model.validate(await file.text());
  }
  function confirmResume() {
    return (
      !hasLocalDrafts() ||
      confirm(
        "Replace current local drafts with the downloaded toy workspace? Download first if you need to keep both.",
      )
    );
  }
  $("import").onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const candidate = await readDraftFile(file);
      if (!confirmResume()) {
        say("Resume cancelled. Current drafts retained.");
        return;
      }
      state = candidate;
      openEditors.clear();
      render();
      focusFamily();
      say("Resumed downloaded toy drafts and questions. Original fixture stays unchanged.");
    } catch (error) {
      say("Could not resume: " + error.message + " Current drafts retained.");
    } finally {
      event.target.value = "";
    }
  };
  $("reset").onclick = () => {
    if (
      !confirm(
        "Discard all local drafts, proposed connections and questions? Download first to preserve them.",
      )
    )
      return;
    state = model.initial();
    openEditors.clear();
    $("author").reset();
    render();
    focusFamily();
    say("Reset to the original fictional fixture. Downloaded files are untouched.");
  };
  window.addEventListener("beforeunload", (event) => {
    if (
      hasWordingDrafts() ||
      hasAuthoredContributions() ||
      hasAuthorDraft($("new-title").value, $("new-statement").value)
    ) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  $("unknown").textContent = model.fixture.unmodeled;
  render();
})();
