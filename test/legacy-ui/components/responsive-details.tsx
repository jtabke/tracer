import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

/** Keep secondary controls available when their working surface has room. */
export function ResponsiveDetails({
  title,
  className = "",
  minWidth = 900,
  children,
}: {
  title: string;
  className?: string;
  minWidth?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [wide, setWide] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const surface = ref.current?.parentElement;
    if (!surface) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWide(entry.contentRect.width >= minWidth);
    });
    observer.observe(surface);
    return () => observer.disconnect();
  }, [minWidth]);
  return (
    <details
      ref={ref}
      className={`responsive-details ${className}`}
      data-wide={wide}
      open={wide || expanded}
      onToggle={(event) => {
        if (!wide) setExpanded(event.currentTarget.open);
      }}
    >
      <summary>{title}</summary>
      <p className="responsive-details-heading">{title}</p>
      {children}
    </details>
  );
}
