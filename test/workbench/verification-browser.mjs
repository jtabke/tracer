import { chromium } from "@playwright/test";
import { capturePageCoverage } from "../../test/browser-coverage.ts";
export async function launchVerifiedBrowser(viewport) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  if (process.env.TRACER_WORKBENCH_COVERAGE === "1") {
    const finish = await capturePageCoverage(page, `workbench-${process.pid}`);
    const close = browser.close.bind(browser);
    browser.close = async () => {
      await finish();
      await close();
    };
  }
  return { browser, page };
}
