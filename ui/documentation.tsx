import { isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { DocumentationDiagram } from "./documentation-diagram.tsx";
import {
  documentationDestination,
  documentationImage,
  documentationTopics,
  type DocumentationTopic,
} from "./documentation-topics.ts";
import "./documentation.css";

type Location = { topic: DocumentationTopic; heading: string };
export function DocumentationView({ active }: { active: boolean }) {
  const [location, setLocation] = useState<Location>({
    topic: documentationTopics[0],
    heading: "",
  });
  const [previous, setPrevious] = useState<Location[]>([]);
  const article = useRef<HTMLElement>(null);
  useDocumentationReading(article, active, location);
  const navigate = (topic: DocumentationTopic, heading = "") => {
    setPrevious((values) => [...values, location]);
    setLocation({ topic, heading });
  };
  const back = () => {
    const last = previous.at(-1);
    if (!last) return;
    setPrevious((values) => values.slice(0, -1));
    setLocation(last);
  };
  return (
    <section className="documentation-workspace" aria-label="Documentation reader">
      <DocumentationTopics selected={location.topic.id} onChoose={(topic) => navigate(topic)} />
      <div className="documentation-reading">
        {!!previous.length && (
          <div className="documentation-reading-controls">
            <button onClick={back}>Return to {previous.at(-1)!.topic.title}</button>
          </div>
        )}
        <article
          ref={article}
          className="documentation-article"
          aria-label={location.topic.title}
          key={location.topic.id}
        >
          <ReactMarkdown
            skipHtml
            remarkPlugins={[remarkGfm]}
            components={markdownComponents(location.topic, active, navigate)}
          >
            {location.topic.markdown}
          </ReactMarkdown>
        </article>
      </div>
    </section>
  );
}
function useDocumentationReading(
  article: React.RefObject<HTMLElement | null>,
  active: boolean,
  location: Location,
) {
  const retainedScroll = useRef(0);
  const retainedLocation = useRef(location);
  useEffect(() => {
    if (!active) return;
    const changed = retainedLocation.current !== location;
    const target = location.heading
      ? article.current?.querySelector<HTMLElement>(`[id="${CSS.escape(location.heading)}"]`)
      : article.current?.querySelector<HTMLElement>("h1");
    const container = article.current?.closest<HTMLElement>(".native-task");
    const scroller = container ?? window;
    const frame = requestAnimationFrame(() => {
      target?.focus({ preventScroll: true });
      if (changed && location.heading) target?.scrollIntoView({ block: "start" });
      else scroller.scrollTo({ top: changed ? 0 : retainedScroll.current });
    });
    retainedLocation.current = location;
    const remember = () => {
      if (container instanceof HTMLDialogElement && !container.open) return;
      if (article.current?.closest("[hidden]")) return;
      retainedScroll.current = container ? container.scrollTop : window.scrollY;
    };
    scroller.addEventListener("scroll", remember, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", remember);
    };
  }, [article, active, location]);
}
function DocumentationTopics({
  selected,
  onChoose,
}: {
  selected: string;
  onChoose(topic: DocumentationTopic): void;
}) {
  const groups = [...new Set(documentationTopics.map((topic) => topic.group))];
  return (
    <>
      <nav className="documentation-topics" aria-label="Documentation topics">
        {groups.map((group) => (
          <section key={group}>
            <h2>{group}</h2>
            {documentationTopics
              .filter((topic) => topic.group === group)
              .map((topic) => (
                <button
                  key={topic.id}
                  aria-current={selected === topic.id ? "page" : undefined}
                  onClick={() => onChoose(topic)}
                >
                  {topic.title}
                </button>
              ))}
          </section>
        ))}
      </nav>
      <label className="documentation-topic-select">
        Documentation topic
        <select
          aria-label="Documentation topic"
          value={selected}
          onChange={(event) => {
            const topic = documentationTopics.find((topic) => topic.id === event.target.value);
            if (topic) onChoose(topic);
          }}
        >
          {groups.map((group) => (
            <optgroup key={group} label={group}>
              {documentationTopics
                .filter((topic) => topic.group === group)
                .map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
    </>
  );
}
function markdownComponents(
  topic: DocumentationTopic,
  active: boolean,
  navigate: (topic: DocumentationTopic, heading?: string) => void,
): Components {
  const ids = new Map<string, number>();
  const headingId = (children: ReactNode) => {
    const base = textContent(children)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");
    const count = ids.get(base) ?? 0;
    ids.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  };
  return {
    h1: ({ children }) => (
      <h1 id={headingId(children)} tabIndex={-1}>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 id={headingId(children)} tabIndex={-1}>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 id={headingId(children)} tabIndex={-1}>
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 id={headingId(children)} tabIndex={-1}>
        {children}
      </h4>
    ),
    a: ({ href, children }) => (
      <DocumentationLink path={topic.path} href={href} onNavigate={navigate}>
        {children}
      </DocumentationLink>
    ),
    table: ({ children }) => (
      <div
        className="documentation-table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Documentation table"
      >
        <table>{children}</table>
      </div>
    ),
    pre: ({ children }) => <DocumentationCode active={active}>{children}</DocumentationCode>,
    img: ({ src, alt }) => {
      const resolved = src && documentationImage(topic.path, src);
      return resolved ? (
        <img src={resolved} alt={alt ?? ""} />
      ) : (
        <span className="documentation-source-reference">{alt} · Repository image</span>
      );
    },
  };
}
function DocumentationLink({
  path,
  href,
  onNavigate,
  children,
}: {
  path: string;
  href?: string;
  onNavigate(topic: DocumentationTopic, heading?: string): void;
  children: ReactNode;
}) {
  if (!href) return <span>{children}</span>;
  const destination = documentationDestination(path, href);
  if (destination.kind === "topic")
    return (
      <a
        href={`#documentation/${destination.topic.id}/${destination.heading}`}
        onClick={(event) => {
          event.preventDefault();
          onNavigate(destination.topic, destination.heading);
        }}
      >
        {children}
      </a>
    );
  if (destination.kind === "unavailable")
    return (
      <span
        className="documentation-source-reference"
        title={`Repository reference: ${destination.path}`}
      >
        {children} <small>(repository source)</small>
      </span>
    );
  return (
    <a
      href={destination.href}
      target="_blank"
      rel="noopener noreferrer"
      title={destination.kind === "source" ? "Open repository Markdown source" : undefined}
    >
      {children}
      {destination.kind === "source" && <small> (Markdown source)</small>}
    </a>
  );
}
function DocumentationCode({ children, active }: { children: ReactNode; active: boolean }) {
  if (
    isValidElement<{ className?: string; children?: ReactNode }>(children) &&
    children.props.className === "language-mermaid"
  )
    return <DocumentationDiagram source={textContent(children.props.children)} active={active} />;
  return <pre>{children}</pre>;
}
function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textContent(node.props.children);
  return "";
}
