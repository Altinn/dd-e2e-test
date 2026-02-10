import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for link validation tests
 * This config runs independently without authentication or global setup
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/link-validation.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
