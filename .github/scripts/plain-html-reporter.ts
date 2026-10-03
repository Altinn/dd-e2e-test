import crypto from "crypto";
import fs from "fs";
import path from "path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
} from "@playwright/test/reporter";

/**
 * Writes the results as one static HTML page without scripts: a summary, then
 * a table per spec file with each test's outcome, and for a test that did not
 * pass, its error message, annotations and screenshots.
 *
 * The `sections` option names the spec files, in the order they are shown,
 * e.g. { "step3/checklist.spec.ts": "Step 3: Checklist" }. A file that is not
 * named gets a name made from its path, and is shown after the named ones.
 *
 * This is the page published to GitHub Pages. It only holds what is written
 * here, so traces and page snapshots, which carry the heirs' sessions and
 * data, stay in Playwright's own HTML report in the run's artifacts.
 *
 * Next to the page it writes screenshots.json, which lists the last screenshot
 * of each failed test for the Slack message to show (see report-stats.js).
 * Screenshots are named after their content, so Slack, which caches images by
 * address, never shows an old screenshot under a reused name.
 *
 * Used by `playwright merge-reports`; see playwright.merge.config.ts.
 */

const outcomes = {
  expected: "passed",
  unexpected: "failed",
  flaky: "flaky",
  skipped: "skipped",
} as const;

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Playwright colours its error messages with ANSI escape sequences.
const stripAnsi = (text: string) =>
  text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");

const seconds = (milliseconds: number) =>
  `${(milliseconds / 1000).toFixed(1)} s`;

const osloTime = (date: Date) =>
  date.toLocaleString("nb-NO", { timeZone: "Europe/Oslo" });

/** "step5/decision_letter.spec.ts" → "Step 5: Decision letter" */
const nameFromPath = (file: string) => {
  const words = (text: string) => {
    const spaced = text.replace(/[_-]+/g, " ").trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  };
  return file
    .replace(/\.spec\.[jt]s$/, "")
    .split("/")
    .map((part) => part.replace(/^step(\d+)$/i, "Step $1"))
    .map(words)
    .join(": ");
};

// The title path is ["", project, file, ...describe blocks, title]. The file
// is relative to the test folder, with Windows paths turned into URL-like ones.
const fileOf = (test: TestCase) =>
  (test.titlePath()[2] ?? "").replace(/\\/g, "/");

class PlainHtmlReporter implements Reporter {
  private suite: Suite | undefined;
  private readonly outputFolder: string;
  private readonly sections: Record<string, string>;

  constructor(
    options: { outputFolder?: string; sections?: Record<string, string> } = {}
  ) {
    this.outputFolder = path.resolve(options.outputFolder ?? "plain-report");
    this.sections = options.sections ?? {};
  }

  private sectionName(file: string) {
    return this.sections[file] ?? nameFromPath(file);
  }

  printsToStdio() {
    return false;
  }

  onBegin(_config: FullConfig, suite: Suite) {
    this.suite = suite;
  }

  onEnd(result: FullResult) {
    fs.rmSync(this.outputFolder, { recursive: true, force: true });
    fs.mkdirSync(path.join(this.outputFolder, "screenshots"), {
      recursive: true,
    });

    const tests = this.suite?.allTests() ?? [];
    const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
    const byFile = new Map<string, TestCase[]>();
    for (const test of tests) {
      counts[outcomes[test.outcome()]] += 1;
      const file = fileOf(test);
      byFile.set(file, [...(byFile.get(file) ?? []), test]);
    }
    // Named files first, in the order they are named, then the rest.
    const order = Object.keys(this.sections);
    const position = (file: string) =>
      order.includes(file) ? order.indexOf(file) : order.length;
    const files = [...byFile.keys()].sort(
      (a, b) => position(a) - position(b) || a.localeCompare(b)
    );

    // Tests that log in as a particular heir carry a "heir" annotation, written
    // as "Heir 2 (child), NAME (HEIR2_SSN): purpose" (see heirs.ts). They are
    // summed up per heir at the top of the page.
    const byHeir = new Map<string, TestCase[]>();
    for (const test of tests) {
      for (const annotation of test.annotations) {
        if (annotation.type === "heir" && annotation.description) {
          byHeir.set(annotation.description, [
            ...(byHeir.get(annotation.description) ?? []),
            test,
          ]);
        }
      }
    }
    const heirSummary = [...byHeir]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([description, heirTests]) => {
        const split = description.indexOf("): ");
        const who = split >= 0 ? description.slice(0, split + 1) : description;
        const purpose = split >= 0 ? description.slice(split + 3) : "";
        const tally = Object.values(outcomes)
          .map((outcome) => ({
            outcome,
            count: heirTests.filter(
              (test) => outcomes[test.outcome()] === outcome
            ).length,
          }))
          .filter(({ count }) => count > 0)
          .map(({ outcome, count }) => `${count} ${outcome}`)
          .join(", ");
        const failed = heirTests.some(
          (test) => test.outcome() === "unexpected"
        );
        return `<tr class="${failed ? "failed" : "passed"}">
<td>${escapeHtml(who)}</td>
<td>${escapeHtml(purpose)}</td>
<td>${heirTests.length} tests: ${tally}</td>
</tr>`;
      });
    const heirSection =
      heirSummary.length === 0
        ? ""
        : `<h2>Heirs</h2>
<p>The tests log in as four heirs of the same test estate, which is reset every night at 03:00 Oslo time. Each probate choice is made by its own heir, so the choices do not overwrite each other.</p>
<table>
<thead><tr><th>Heir</th><th>Purpose</th><th>Tests</th></tr></thead>
<tbody>
${heirSummary.join("\n")}
</tbody>
</table>`;

    const failedScreenshots: { test: string; path: string }[] = [];
    const details = (test: TestCase) => {
      const parts: string[] = [];
      // Some annotations only mark how a test ran, e.g. "serial", and have no
      // text worth showing.
      // The heir is named in the test's title and summed up at the top.
      for (const annotation of test.annotations.filter(
        (a) => a.description && a.type !== "heir"
      )) {
        parts.push(
          `<p><b>${escapeHtml(annotation.type)}:</b> ${escapeHtml(
            annotation.description ?? ""
          )}</p>`
        );
      }
      if (test.outcome() === "expected" || test.outcome() === "skipped") {
        return parts.join("");
      }

      test.results.forEach((attempt, index) => {
        const label = test.results.length > 1 ? `Attempt ${index + 1}: ` : "";
        for (const error of attempt.errors) {
          parts.push(
            `<p>${label}${escapeHtml(attempt.status)}</p><pre>${escapeHtml(
              stripAnsi(error.message ?? error.value ?? "")
            )}</pre>`
          );
        }
        for (const attachment of attempt.attachments) {
          if (
            !attachment.contentType.startsWith("image/") ||
            !attachment.path ||
            !fs.existsSync(attachment.path)
          ) {
            continue;
          }
          const content = fs.readFileSync(attachment.path);
          const name = `screenshots/${crypto
            .createHash("sha256")
            .update(content)
            .digest("hex")
            .slice(0, 16)}${path.extname(attachment.path)}`;
          fs.writeFileSync(path.join(this.outputFolder, name), content);
          if (test.outcome() === "unexpected") {
            const testName = `${this.sectionName(fileOf(test))} — ${test
              .titlePath()
              .slice(3)
              .join(" › ")}`;
            // Later attempts replace earlier ones, so the last one is kept.
            const existing = failedScreenshots.find(
              (entry) => entry.test === testName
            );
            if (existing) existing.path = name;
            else failedScreenshots.push({ test: testName, path: name });
          }
          parts.push(
            `<p><a href="${name}"><img src="${name}" alt="${escapeHtml(
              `${label}${attachment.name}`
            )}" width="400"></a></p>`
          );
        }
      });
      return parts.join("");
    };

    const sections = files.map((file) => {
      const rows = byFile.get(file)!.map((test) => {
        const outcome = outcomes[test.outcome()];
        const title = test.titlePath().slice(3).join(" › ");
        const retries =
          test.results.length > 1 ? ` (${test.results.length} attempts)` : "";
        const duration = test.results.reduce(
          (total, attempt) => total + attempt.duration,
          0
        );
        return `<tr class="${outcome}">
<td>${outcome}${retries}</td>
<td>${escapeHtml(title)}<br><small>line ${test.location.line}</small>${details(
          test
        )}</td>
<td>${seconds(duration)}</td>
</tr>`;
      });
      return `<h2>${escapeHtml(this.sectionName(file))}</h2>
<p><small>${escapeHtml(file)}</small></p>
<table>
<thead><tr><th>Outcome</th><th>Test</th><th>Time</th></tr></thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>`;
    });

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>End-to-end test report</title>
<style>
body { font-family: sans-serif; margin: 1rem; }
table { border-collapse: collapse; width: 100%; margin-bottom: 2rem; }
th, td { border: 1px solid #ccc; padding: 0.4rem; text-align: left; vertical-align: top; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; }
.failed td:first-child { background: #fdd; }
.flaky td:first-child { background: #ffd; }
.passed td:first-child { background: #dfd; }
</style>
</head>
<body>
<h1>End-to-end test report</h1>
<p>Run ${escapeHtml(result.status)}, started ${escapeHtml(
      osloTime(result.startTime)
    )}, took ${seconds(result.duration)}.</p>
<p>${counts.passed} passed, ${counts.failed} failed, ${counts.flaky} flaky, ${
      counts.skipped
    } skipped.</p>
${heirSection}
${sections.join("\n")}
</body>
</html>
`;
    fs.writeFileSync(path.join(this.outputFolder, "index.html"), html);
    fs.writeFileSync(
      path.join(this.outputFolder, "screenshots.json"),
      JSON.stringify(failedScreenshots)
    );
  }
}

export default PlainHtmlReporter;
