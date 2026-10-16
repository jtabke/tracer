import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test",
  testMatch: "**/*.spec.ts",
  workers: 1,
  timeout: 30000,
  use: {
    browserName: "chromium",
    headless: true,
    actionTimeout: 10000,
    viewport: { width: 1280, height: 900 },
  },
  reporter: "list",
});
