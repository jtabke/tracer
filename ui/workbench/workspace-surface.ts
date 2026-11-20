type Panel = "graph" | "matrix" | "history" | "task" | "settings" | "evidence";
function element(tag: string, name: string) {
  const node = document.createElement(tag);
  node.className = name;
  return node;
}
// Comment anchors keep the shipped grid/landmark hierarchy, without a disposable wrapper.
function region(parent: HTMLElement, retain = true) {
  const end = document.createComment("");
  parent.append(end);
  let nodes: Node[] = [],
    previous: string | undefined;
  return (markup: string) => {
    if (retain && markup === previous) return;
    const template = document.createElement("template");
    template.innerHTML = markup;
    nodes.forEach((node) => node.parentNode?.removeChild(node));
    nodes = [...template.content.childNodes];
    end.before(template.content);
    previous = markup;
  };
}
type Content = {
  page: string;
  panel: Panel;
  sidebar: string;
  header: string;
  context: string;
  banners: string;
  mode: string;
  backdrop: string;
  view: string;
  inspector: string;
  footer: string;
};
/** The investigation shell, task portal and each perspective have stable DOM owners. Only changed regions are replaced. */
export function createWorkspaceSurface(app: HTMLElement) {
  const shell = element("div", "shell sidebar-shell"),
    main = element("main", "workspace");
  const sidebar = region(shell);
  shell.append(main);
  const header = region(main),
    context = region(main),
    banners = region(main);
  const workarea = element("div", "workarea");
  main.append(workarea);
  const backdrop = region(workarea);
  const anchor = document.createComment("perspective");
  workarea.append(anchor);
  const inspector = region(workarea, false),
    footer = region(main);
  const panels = new Map<Panel, { host: HTMLElement; content: (markup: string) => void }>();
  let active: HTMLElement | undefined, previousPanel: Panel | undefined;
  app.replaceChildren(shell);
  return (value: Content) => {
    if (!shell.isConnected) app.replaceChildren(shell);
    shell.dataset.page = value.page;
    workarea.className = `workarea ${value.mode}`;
    sidebar(value.sidebar);
    header(value.header);
    context(value.context);
    banners(value.banners);
    backdrop(value.backdrop);
    let panel = panels.get(value.panel);
    if (!panel) {
      const host = element("div", "view");
      host.id = "view";
      panel = { host, content: region(host) };
      panels.set(value.panel, panel);
    }
    if (active !== panel.host) {
      active?.remove();
      // A retired perspective must not retain editable DOM or its direct handlers.
      // Authoritative state (and the React task portal) are retained by their owners.
      if (previousPanel) panels.get(previousPanel)?.content("");
      previousPanel = value.panel;
      anchor.before(panel.host);
      active = panel.host;
    }
    const scroll = { left: active.scrollLeft, top: active.scrollTop };
    panel.content(value.view);
    active.scrollTo(scroll.left, scroll.top);
    inspector(value.inspector);
    footer(value.footer);
    for (const node of app.querySelectorAll<HTMLElement>(
      ".topbar[inert],.context[inert],.view[inert],.historybar[inert],.workspace-notice[inert]",
    ))
      node.inert = false;
  };
}
