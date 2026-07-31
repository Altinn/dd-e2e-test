import { defineConfig } from "@playwright/test";

/**
 * Used only by `playwright merge-reports` in CI.
 *
 * Emits two things from the same set of blob reports:
 *  - the HTML report, uploaded as a build artifact
 *  - a JSON summary, parsed by .github/scripts/report-stats.js to build
 *    the Slack message on failure
 *
 * The JSON reporter writes to stdout unless `outputFile` is set, which is why
 * this goes through a config file rather than `--reporter=html,json`.
 */
export default defineConfig({
  reporter: [
    ["html", { open: "never" }],
    ["json", { outputFile: "merged-report.json" }],
  ],
});
