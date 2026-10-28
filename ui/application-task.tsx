import { useContext } from "react";
import { MutationControllerContext, useMutation } from "./use-mutation.ts";
import { MutationRecovery } from "./mutation-recovery.tsx";

export function ApplicationTaskHeader({
  title,
  description,
  createLabel,
  refreshLabel,
  busy,
  create,
  refresh,
}: {
  title: string;
  description: string;
  createLabel: string;
  refreshLabel: string;
  busy: boolean;
  create(): void;
  refresh(): void;
}) {
  return (
    <header>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <button disabled={busy} onClick={create}>
        {createLabel}
      </button>
      <button disabled={busy} onClick={refresh}>
        {refreshLabel}
      </button>
    </header>
  );
}

export function ApplicationRecovery({
  report,
  refresh,
}: {
  report(error: unknown): void;
  refresh(): void;
}) {
  const shared = useContext(MutationControllerContext);
  return shared ? <SharedRecovery report={report} refresh={refresh} /> : null;
}

function SharedRecovery({ report, refresh }: { report(error: unknown): void; refresh(): void }) {
  const mutation = useMutation(report);
  return <MutationRecovery mutation={mutation} refreshed={refresh} resumed={refresh} />;
}
