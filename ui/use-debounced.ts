import { useEffect, useState } from "react";

/** Search while typing without a server read on every keystroke. */
export function useDebounced<T>(value: T) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), 200);
    return () => window.clearTimeout(timer);
  }, [value]);
  return settled;
}
