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
      {
        outputFolder: "plain-report",
        // The report's sections, in the order of the steps on the front page.
        sections: {
          "homepage.spec.ts": "Front page",
          "step1/tab_contents.spec.ts": "Step 1: The deceased's information",
          "step2/tab_contents.spec.ts": "Step 2: Assets and debts",
          "step3/checklist.spec.ts": "Step 3: Checklist",
          "step4/probate_choice.spec.ts": "Step 4: Choosing a probate form",
          "step4/static_choices.spec.ts":
            "Step 4: Probate forms submitted on paper or to the court",
          "step4/private_probate.spec.ts": "Step 4: Privat skifte declaration",
          "axe.spec.ts": "Accessibility",
          "link-validation.spec.ts": "Links",
        },
      },
    ],
    ["json", { outputFile: "merged-report.json" }],
    ["github"],
  ],
});
