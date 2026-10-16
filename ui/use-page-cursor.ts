import { useState } from "react";

/** Keep cursor and return history together so reset/next/previous cannot diverge. */
export function usePageCursor() {
  const [page, setPage] = useState<{ after?: string; previous: (string | undefined)[] }>({
    previous: [],
  });
  return {
    snapshot: page,
    restore: setPage,
    after: page.after,
    hasPrevious: page.previous.length > 0,
    reset: () => setPage({ previous: [] }),
    next: (after?: string) => {
      if (after !== undefined)
        setPage((current) => ({ after, previous: [...current.previous, current.after] }));
    },
    previous: () =>
      setPage((current) =>
        current.previous.length
          ? { after: current.previous.at(-1), previous: current.previous.slice(0, -1) }
          : current,
      ),
  };
}
