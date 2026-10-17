import { test as base } from "@playwright/test";
import { capturePageCoverage } from "./browser-coverage.ts";
export { closeTestPage } from "./browser-coverage.ts";
export * from "@playwright/test";

// Capture before fixture cleanup navigates away; teardown remains a fallback for plain tests.
export const test = base.extend({
  page: async ({ page }, use, info) => {
    const finish = await capturePageCoverage(
      page,
      `${info.workerIndex}-${info.testId.replaceAll(/[^a-zA-Z0-9-]/g, "_")}`,
    );
    try {
      await use(page);
    } finally {
      await finish();
    }
  },
});
