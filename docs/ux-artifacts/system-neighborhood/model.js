globalThis.TracerToy = (() => {
  const fixture = globalThis.TRACER_TOY_FIXTURE;
  const baseline = new Map(fixture.items.map((item) => [item.id, item]));
  const initial = () => ({
    prototype: "tracer-system-neighborhood",
    version: 1,
    scope: fixture.parents[0],
    lens: "family",
    drafts: {},
    addedItems: [],
    addedLinks: [],
    questions: {},
    author: { scope: fixture.parents[0], title: "", statement: "", kind: "Software" },
  });
  const items = (state) => [...fixture.items, ...state.addedItems];
  const links = (state) => [...fixture.links, ...state.addedLinks];
  const item = (state, id) => items(state).find((value) => value.id === id);
  const current = (state, id) => ({ ...item(state, id), ...state.drafts[id] });
  const changed = (state, id) => {
    const draft = state.drafts[id],
      original = item(state, id);
    return !!draft && (draft.title !== original.title || draft.statement !== original.statement);
  };
  const parents = (state, id) =>
    links(state).filter((link) => fixture.parents.includes(link.from) && link.to === id);
  const family = (state) =>
    links(state)
      .filter((link) => link.from === state.scope)
      .map((link) => current(state, link.to));
  const visible = (state) => {
    const children = family(state);
    const ids = new Set(children.map((value) => value.id));
    const crossIds = new Set(
      links(state)
        .filter((link) => ids.has(link.from))
        .map((link) => link.to),
    );
    const context = items(state).filter(
      (value) => crossIds.has(value.id) || value.inputs?.some((id) => ids.has(id)),
    );
    return [...children, ...context.filter((value) => !ids.has(value.id))];
  };
  const edit = (state, id, field, value) => {
    if (
      !item(state, id) ||
      !["title", "statement"].includes(field) ||
      typeof value !== "string" ||
      value.length > 6000
    )
      throw Error("Unsupported draft edit.");
    state.drafts[id] = {
      title: current(state, id).title,
      statement: current(state, id).statement,
      [field]: value,
    };
    if (!changed(state, id)) delete state.drafts[id];
  };
  const add = (state, title, statement, kind, parent = state.scope) => {
    if (!fixture.parents.includes(parent)) throw Error("Choose a known parent intent.");
    if (!title.trim() || !statement.trim()) throw Error("Enter a title and statement.");
    if (
      state.addedItems.length >= 20 ||
      title.length > 200 ||
      statement.length > 6000 ||
      !["Software", "Mechanical", "Drive / interface"].includes(kind)
    )
      throw Error("Toy authoring limit exceeded.");
    const id = "LOCAL-" + (state.addedItems.length + 1);
    state.addedItems.push({
      id,
      title: title.trim(),
      statement: statement.trim(),
      kind,
      version: "Local draft",
    });
    state.addedLinks.push({ from: parent, to: id, meaning: "proposed contribution" });
    return id;
  };
  const contribution = (state, id) => {
    const value = item(state, id);
    return Boolean(value) && !fixture.parents.includes(id) && value.kind !== "Evidence";
  };
  const connect = (state, id) => {
    if (!contribution(state, id)) throw Error("Choose an existing contribution.");
    if (links(state).some((link) => link.from === state.scope && link.to === id))
      throw Error("This item is already in this family.");
    if (state.addedLinks.length >= 40) throw Error("Toy relationship limit exceeded.");
    state.addedLinks.push({ from: state.scope, to: id, meaning: "proposed contribution" });
  };
  const evidence = (state, id) =>
    (item(state, id).inputs ?? []).filter((input) => changed(state, input));
  const validateAuthor = (author) => {
    if (
      !author ||
      Object.keys(author).length !== 4 ||
      !fixture.parents.includes(author.scope) ||
      typeof author.title !== "string" ||
      author.title.length > 200 ||
      typeof author.statement !== "string" ||
      author.statement.length > 6000 ||
      !["Software", "Mechanical", "Drive / interface"].includes(author.kind)
    )
      throw Error("Invalid unfinished author draft.");
  };
  const validateWorkspaceCollections = (state, keys) => {
    if (
      Object.keys(state).some((key) => !keys.includes(key)) ||
      !Array.isArray(state.addedItems) ||
      !Array.isArray(state.addedLinks) ||
      state.addedItems.length > 20 ||
      state.addedLinks.length > 40
    )
      throw Error("Invalid toy workspace shape.");
  };
  const text = (value, max) => typeof value === "string" && value.length <= max;
  const authoredText = (value, max) => text(value, max) && Boolean(value.trim());
  const validateAuthoredItem = (value, index, ids) => {
    if (
      !value ||
      value.id !== "LOCAL-" + (index + 1) ||
      ids.has(value.id) ||
      !authoredText(value.title, 200) ||
      !authoredText(value.statement, 6000) ||
      !["Software", "Mechanical", "Drive / interface"].includes(value.kind) ||
      value.version !== "Local draft" ||
      Object.keys(value).some(
        (key) => !["id", "title", "statement", "kind", "version"].includes(key),
      )
    )
      throw Error("Invalid authored item.");
  };
  const validateDraftValue = (name, value) => {
    if (
      name === "questions"
        ? !text(value, 6000)
        : !value ||
          Object.keys(value).length !== 2 ||
          !text(value.title, 6000) ||
          !text(value.statement, 6000)
    )
      throw Error("Invalid draft text.");
  };
  const validateDraftsAndQuestions = (state, ids) => {
    for (const name of ["drafts", "questions"]) {
      if (!state[name] || Array.isArray(state[name]) || typeof state[name] !== "object")
        throw Error("Invalid drafts or questions.");
      for (const [id, value] of Object.entries(state[name])) {
        if (!ids.has(id)) throw Error("Unknown item in workspace.");
        validateDraftValue(name, value);
      }
    }
  };
  const validateProposedLinks = (state, ids) => {
    const pairs = new Set(fixture.links.map((link) => link.from + "|" + link.to));
    for (const link of state.addedLinks) {
      if (
        !link ||
        !fixture.parents.includes(link.from) ||
        !ids.has(link.to) ||
        !contribution(state, link.to) ||
        link.meaning !== "proposed contribution" ||
        Object.keys(link).length !== 3 ||
        pairs.has(link.from + "|" + link.to)
      )
        throw Error("Invalid or duplicate proposed relationship.");
      pairs.add(link.from + "|" + link.to);
    }
  };
  const validate = (raw) => {
    if (typeof raw !== "string" || raw.length > 200000)
      throw Error("Choose a small exported toy workspace.");
    const state = JSON.parse(raw);
    if (
      !state ||
      state.prototype !== "tracer-system-neighborhood" ||
      state.version !== 1 ||
      !fixture.parents.includes(state.scope) ||
      !["family", "change"].includes(state.lens)
    )
      throw Error("Not a supported toy workspace.");
    const keys = [
      "prototype",
      "version",
      "scope",
      "lens",
      "drafts",
      "addedItems",
      "addedLinks",
      "questions",
      "author",
    ];
    validateAuthor(state.author);
    validateWorkspaceCollections(state, keys);
    const ids = new Set(baseline.keys());
    state.addedItems.forEach((value, index) => {
      validateAuthoredItem(value, index, ids);
      ids.add(value.id);
    });
    validateDraftsAndQuestions(state, ids);
    validateProposedLinks(state, ids);
    return state;
  };
  return {
    fixture,
    initial,
    items,
    links,
    item,
    current,
    changed,
    parents,
    family,
    visible,
    edit,
    add,
    connect,
    evidence,
    validate,
  };
})();
