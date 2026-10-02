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
 * This is the page published to GitHub Pages. It only holds what is written
 * here, so traces and page snapshots, which carry the heirs' sessions and
 * data, stay in Playwright's own HTML report in the run's artifacts.
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
const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");

const seconds = (milliseconds: number) =>
  `${(milliseconds / 1000).toFixed(1)} s`;

const osloTime = (date: Date) =>
  date.toLocaleString("nb-NO", { timeZone: "Europe/Oslo" });

class PlainHtmlReporter implements Reporter {
  private suite: Suite | undefined;
  private readonly outputFolder: string;

  constructor(options: { outputFolder?: string } = {}) {
    this.outputFolder = path.resolve(options.outputFolder ?? "plain-report");
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
      // The title path is ["", project, file, ...describe blocks, title].
      const file = test.titlePath()[2] ?? "";
      byFile.set(file, [...(byFile.get(file) ?? []), test]);
    }

    let screenshotCount = 0;
    const details = (test: TestCase) => {
      const parts: string[] = [];
      for (const annotation of test.annotations) {
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
        const label =
          test.results.length > 1 ? `Attempt ${index + 1}: ` : "";
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
          screenshotCount += 1;
          const name = `screenshots/${screenshotCount}${path.extname(
            attachment.path
          )}`;
          fs.copyFileSync(attachment.path, path.join(this.outputFolder, name));
          parts.push(
            `<p><a href="${name}"><img src="${name}" alt="${escapeHtml(
              `${label}${attachment.name}`
            )}" width="400"></a></p>`
          );
        }
      });
      return parts.join("");
    };

    const sections = [...byFile].map(([file, fileTests]) => {
      const rows = fileTests.map((test) => {
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
      return `<h2>${escapeHtml(file)}</h2>
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
${sections.join("\n")}
</body>
</html>
`;
    fs.writeFileSync(path.join(this.outputFolder, "index.html"), html);
  }
}

export default PlainHtmlReporter;
