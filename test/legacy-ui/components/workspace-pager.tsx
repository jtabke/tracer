export function WorkspacePager({
  noun,
  previous,
  next,
  paused = false,
  onPrevious,
  onNext,
}: {
  noun: string;
  previous: boolean;
  next: boolean;
  paused?: boolean;
  onPrevious(): void;
  onNext(): void;
}) {
  if (!previous && !next) return null;
  return (
    <div className="toolbar">
      <button disabled={paused || !previous} onClick={onPrevious}>
        Previous {noun}
      </button>
      <button disabled={paused || !next} onClick={onNext}>
        Next {noun}
      </button>
    </div>
  );
}
