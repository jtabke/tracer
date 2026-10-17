export function startWorkbench(options?: {
  staticData?: () => Promise<unknown>;
  staticDatabases?: () => Promise<unknown[]>;
}): Promise<void>;
