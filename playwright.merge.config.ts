import { defineConfig } from "@playwright/test";

/**
 * Used only by `playwright merge-reports` in CI.
 *
 * Emits four things from the same set of blob reports:
 *  - Playwright's HTML report, uploaded as a build artifact
 *  - a plain HTML page without scripts, published to GitHub Pages when a run
 *    fails (see .github/scripts/plain-html-reporter.ts)
 *  - a JSON summary, parsed by .github/scripts/report-stats.js to build
 *    the Slack message on failure
 *  - GitHub annotations on the run for each failure
 *
 * The JSON reporter writes to stdout unless `outputFile` is set, which is why
 * this goes through a config file rather than `--reporter=html,json`.
 */
export default defineConfig({
  reporter: [
    ["html", { open: "never" }],
    [
      "./.github/scripts/plain-html-reporter.ts",
      { outputFolder: "plain-report" },
    ],
    ["json", { outputFile: "merged-report.json" }],
    ["github"],
  ],
});
