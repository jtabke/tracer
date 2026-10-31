import { useCallback, useEffect, useState } from "react";
export function useReferenceDrafts(onDirty: (value: boolean) => void) {
  const [flags, setFlags] = useState({
    editor: false,
    evaluation: false,
    paths: {} as Record<string, boolean>,
  });
  const editor = useCallback(
    (value: boolean) =>
      setFlags((before) => (before.editor === value ? before : { ...before, editor: value })),
    [],
  );
  const evaluation = useCallback(
    (value: boolean) =>
      setFlags((before) =>
        before.evaluation === value ? before : { ...before, evaluation: value },
      ),
    [],
  );
  const path = useCallback(
    (id: string, value: boolean) =>
      setFlags((before) =>
        Boolean(before.paths[id]) === value
          ? before
          : { ...before, paths: { ...before.paths, [id]: value } },
      ),
    [],
  );
  const dirty = flags.editor || flags.evaluation || Object.values(flags.paths).some(Boolean);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  return { dirty, editor, evaluation, path };
}
