(() => {
  const nodeWidth = 128,
    nodeHeight = 60;
  const palette = ["hierarchy", "design", "verification", "validation"];
  function escape(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
    );
  }
  function nodeMarkup(node) {
    return `<button type="button" class="overview-graph-node ${escape(node.kind || "")}" data-model-type="${escape(node.key)}" style="left:${node.x}px;top:${node.y}px;width:${nodeWidth}px;height:${nodeHeight}px" aria-label="Open ${escape(node.label)} items"><strong>${escape(node.label)}</strong><small>${escape(node.detail ?? `${node.count} ${node.count === 1 ? "item" : "items"}`)}</small></button>`;
  }
  function edgePath(edge, nodes) {
    if (edge.source === edge.target)
      return selfPath(nodes.find((node) => node.key === edge.source));
    if (edge.path) return edge.path;
    const source = nodes.find((node) => node.key === edge.source),
      target = nodes.find((node) => node.key === edge.target);
    const start = border(source, target),
      end = border(target, source),
      mid = (start.x + end.x) / 2;
    return `M ${start.x} ${start.y} C ${mid} ${start.y} ${mid} ${end.y} ${end.x} ${end.y}`;
  }
  function selfPath(node) {
    return `M ${node.x + nodeWidth} ${node.y + 20} C ${node.x + nodeWidth + 45} ${node.y - 30} ${node.x + 40} ${node.y - 50} ${node.x + 40} ${node.y}`;
  }
  function border(node, toward) {
    const x = node.x + nodeWidth / 2,
      y = node.y + nodeHeight / 2;
    const dx = toward.x + nodeWidth / 2 - x,
      dy = toward.y + nodeHeight / 2 - y;
    const scale = Math.min(nodeWidth / (2 * Math.abs(dx)), nodeHeight / (2 * Math.abs(dy)));
    return { x: x + dx * scale, y: y + dy * scale };
  }
  function edgeLabel(edge) {
    return edge.label
      ? `<text class="overview-graph-edge-label ${escape(edge.kind)}" x="${edge.x}" y="${edge.y}" text-anchor="middle">${escape(edge.label)}</text>`
      : "";
  }
  function edgeMarkup(edge, nodes) {
    const dash = edge.dashed ? ' stroke-dasharray="5 4"' : "";
    return `<path class="overview-graph-edge ${escape(edge.kind)}" d="${edgePath(edge, nodes)}" marker-end="url(#model-arrow-${escape(edge.kind)})"${dash}></path>${edgeLabel(edge)}`;
  }
  function marker(kind) {
    return `<marker id="model-arrow-${kind}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="overview-graph-arrow ${kind}"></path></marker>`;
  }
  function annotation(item) {
    return `<text class="overview-graph-region-label ${escape(item.kind || "")}" x="${item.x}" y="${item.y}">${escape(item.text)}</text>`;
  }
  function render(config) {
    const { width = 1000, height = 410, annotations = [] } = config;
    return `<div class="overview-graph-toolbar"><span>Core model · ${config.nodes.length} of ${config.totalTypeCount} item types · drag to explore</span><div><button class="quiet-button" type="button" data-model-fit>Fit</button><button class="quiet-button" type="button" data-model-zoom="0.8" aria-label="Zoom out">−</button><span data-model-scale></span><button class="quiet-button" type="button" data-model-zoom="1.25" aria-label="Zoom in">+</button></div></div>
    <div class="overview-graph-frame" style="--model-world-height:${height}px" aria-label="Connected project data model" tabindex="0"><div class="overview-graph-canvas" data-model-width="${width}" data-model-height="${height}" style="width:${width}px;height:${height}px">
      <svg class="overview-graph-edges" viewBox="0 0 ${width} ${height}" aria-hidden="true"><defs>${palette.map(marker).join("")}</defs>${config.edges.map((edge) => edgeMarkup(edge, config.nodes)).join("")}${annotations.map(annotation).join("")}</svg>
      ${config.nodes.map(nodeMarkup).join("")}
    </div></div><p class="overview-model-note">${escape(config.legend || "")}</p>`;
  }
  function fitted(context, readable) {
    const { frame, width, height } = context;
    const scale = Math.min(
      (frame.clientWidth - 28) / width,
      (frame.clientHeight - 28) / height,
      1.4,
    );
    const value = readable ? Math.max(scale, 0.8) : scale;
    return {
      x: Math.max(14, (frame.clientWidth - width * value) / 2),
      y: Math.max(14, (frame.clientHeight - height * value) / 2),
      scale: value,
    };
  }
  function draw(context) {
    const camera = context.camera;
    context.canvas.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
    context.root.querySelector("[data-model-scale]").textContent =
      `${Math.round(camera.scale * 100)}%`;
  }
  function persist(context) {
    try {
      sessionStorage.setItem(
        `tracer-model-camera:${document.body.dataset.modelFixture || document.body.dataset.project}:${context.width}`,
        JSON.stringify(context.camera),
      );
    } catch {
      /* The graph remains usable without camera storage. */
    }
  }
  function storedCamera(context) {
    try {
      const value = JSON.parse(
        sessionStorage.getItem(
          `tracer-model-camera:${document.body.dataset.modelFixture || document.body.dataset.project}:${context.width}`,
        ),
      );
      return validCamera(value) ? value : null;
    } catch {
      return null;
    }
  }
  function validCamera(value) {
    if (!value) return false;
    return ["x", "y", "scale"].every((key) => Number.isFinite(value[key])) && value.scale > 0;
  }
  function fit(context) {
    context.camera = fitted(context, false);
    draw(context);
    persist(context);
  }
  function zoom(context, factor) {
    const before = context.camera.scale,
      next = Math.max(0.25, Math.min(2, before * factor));
    const x = context.frame.clientWidth / 2,
      y = context.frame.clientHeight / 2;
    context.camera = {
      x: x - ((x - context.camera.x) * next) / before,
      y: y - ((y - context.camera.y) * next) / before,
      scale: next,
    };
    draw(context);
    persist(context);
  }
  function pointerStart(context, event) {
    if (event.button > 0) return;
    context.drag = {
      x: event.clientX,
      y: event.clientY,
      startX: context.camera.x,
      startY: context.camera.y,
      id: event.pointerId,
    };
    context.moved = false;
  }
  function pointerMove(context, event) {
    if (!context.drag) return;
    const dx = event.clientX - context.drag.x,
      dy = event.clientY - context.drag.y;
    if (!context.moved && Math.hypot(dx, dy) < 5) return;
    context.moved = true;
    context.frame.setPointerCapture(event.pointerId);
    context.camera.x = context.drag.startX + dx;
    context.camera.y = context.drag.startY + dy;
    context.frame.classList.add("is-panning");
    draw(context);
  }
  function pointerEnd(context) {
    context.drag = null;
    context.frame.classList.remove("is-panning");
    persist(context);
  }
  function clicked(context, event, onType) {
    if (context.moved) {
      event.preventDefault();
      event.stopPropagation();
      context.moved = false;
      return;
    }
    const node = event.target.closest("[data-model-type]");
    if (node) onType(node.dataset.modelType);
  }
  function control(context, event) {
    if (event.target.closest("[data-model-fit]")) return fit(context);
    const button = event.target.closest("[data-model-zoom]");
    if (button) zoom(context, Number(button.dataset.modelZoom));
  }
  function wheel(context, event) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoom(context, event.deltaY < 0 ? 1.15 : 0.87);
  }
  function keyboard(context, event) {
    if (event.target !== context.frame) return;
    const move = {
      ArrowLeft: [36, 0],
      ArrowRight: [-36, 0],
      ArrowUp: [0, 36],
      ArrowDown: [0, -36],
    }[event.key];
    if (!move) return;
    event.preventDefault();
    context.camera.x += move[0];
    context.camera.y += move[1];
    draw(context);
    persist(context);
  }
  function attach(root, onType) {
    const frame = root.querySelector(".overview-graph-frame");
    if (!frame) return;
    const context = {
      root,
      frame,
      canvas: frame.querySelector(".overview-graph-canvas"),
    };
    context.width = Number(context.canvas.dataset.modelWidth);
    context.height = Number(context.canvas.dataset.modelHeight);
    context.camera = storedCamera(context) || fitted(context, true);

    draw(context);
    root
      .querySelector(".overview-graph-toolbar")
      .addEventListener("click", (event) => control(context, event));
    frame.addEventListener("pointerdown", (event) => pointerStart(context, event));
    frame.addEventListener("pointermove", (event) => pointerMove(context, event));
    frame.addEventListener("pointerup", () => pointerEnd(context));
    frame.addEventListener("pointercancel", () => pointerEnd(context));
    frame.addEventListener("click", (event) => clicked(context, event, onType));
    frame.addEventListener("wheel", (event) => wheel(context, event), { passive: false });
    frame.addEventListener("keydown", (event) => keyboard(context, event));
  }
  function includesType(types, key) {
    return types === undefined || types.includes(key);
  }
  function permits(definition, edge) {
    if (!definition) return false;
    return (
      includesType(definition.source, edge.source) && includesType(definition.target, edge.target)
    );
  }
  function authoredRows(schema) {
    return Object.entries(schema.relationshipTypes).flatMap(([relationship, definition]) =>
      (definition.workflow || []).map((path) => ({ ...path, relationship })),
    );
  }
  function routeIdentity(edge) {
    return `${edge.relationship}:${edge.source}:${edge.target}`;
  }
  function namedBaseEdge(edge, base) {
    const route = authoredRows(base).find(
      (path) => path.source === edge.source && path.target === edge.target,
    );
    return { ...edge, relationship: route?.relationship };
  }
  function retainedEdges(config, current, base) {
    return config.edges
      .map((edge) => namedBaseEdge(edge, base))
      .filter((edge) => permits(current.relationshipTypes[edge.relationship], edge));
  }
  function newCoreEdges(config, current, retained, base) {
    const types = new Set(config.nodes.map((node) => node.key));
    const identities = new Set([...retained, ...authoredRows(base)].map(routeIdentity));
    return authoredRows(current)
      .filter((edge) => types.has(edge.source) && types.has(edge.target))
      .filter((edge) => !identities.has(routeIdentity(edge)))
      .map((edge) => ({
        ...edge,
        kind: "design",
        label: edge.relationship.replaceAll("_", " "),
        x: config.nodes.find((node) => node.key === edge.target).x,
        y: config.nodes.find((node) => node.key === edge.target).y - 8,
      }));
  }
  function reflect(config, current, base) {
    if (!current || !base) return config;
    const nodes = config.nodes.filter((node) => Object.hasOwn(current.entityTypes, node.key));
    const retained = retainedEdges({ ...config, nodes }, current, base).filter(
      (edge) =>
        nodes.some((node) => node.key === edge.source) &&
        nodes.some((node) => node.key === edge.target),
    );
    return {
      ...config,
      nodes,
      totalTypeCount: Object.keys(current.entityTypes).length,
      edges: [...retained, ...newCoreEdges({ ...config, nodes }, current, retained, base)],
    };
  }
  window.tracerModelGraph = { render, attach, reflect };
})();
