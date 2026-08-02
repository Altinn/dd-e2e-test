// Reads Playwright's merged JSON report and writes counts plus the names of
// the failed tests as GitHub Actions step outputs (key=value lines on stdout,
// redirected to $GITHUB_OUTPUT).
//
// Written defensively: a failure to read or parse the report must not fail the
// notification step, since the whole point is to report on a run that already
// went wrong. Missing values fall back to 0 and `available=false`, which the
// workflow uses to soften the Slack message.

const fs = require("fs");

// Slack section text tops out at 3000 characters, and a wall of failures is
// not readable anyway, so only the first few are listed by name.
const MAX_LISTED = 8;

const file = process.argv[2];
const count = (value) => (Number.isFinite(value) ? value : 0);

let report = null;

try {
  report = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (error) {
  console.error(`Could not read stats from ${file}: ${error.message}`);
}

/**
 * Collect every spec that ended up failing, as "file:line — describe › title".
 *
 * Suites nest: each entry in the report's top-level `suites` is a spec file,
 * and anything below it is a describe block. The file contributes the path
 * already shown by `spec.file`, so only describe titles go into the name.
 */
const walkSuite = (suite, titlePath) => {
  const failures = [];

  for (const spec of suite.specs ?? []) {
    const failed = (spec.tests ?? []).some(
      (test) => test.status === "unexpected"
    );
    if (failed) {
      const name = [...titlePath, spec.title].join(" › ");
      failures.push(`${spec.file}:${spec.line} — ${name}`);
    }
  }

  for (const child of suite.suites ?? []) {
    failures.push(...walkSuite(child, [...titlePath, child.title]));
  }

  return failures;
};

const collectFailures = (suites) =>
  (suites ?? []).flatMap((fileSuite) => walkSuite(fileSuite, []));

// The list is substituted into a JSON payload, so quotes and backslashes have
// to survive that, and line breaks are emitted as the two characters \ and n
// for JSON itself to turn back into newlines.
const forJson = (text) => text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const formatFailures = (failures) => {
  if (failures.length === 0) {
    return "_No failed tests reported — the run may have failed before the tests ran._";
  }

  const listed = failures.slice(0, MAX_LISTED).map((f) => `• ${forJson(f)}`);
  const remaining = failures.length - listed.length;
  if (remaining > 0) {
    listed.push(`_…and ${remaining} more._`);
  }

  return listed.join("\\n");
};

const stats = report?.stats;
const outputs = stats
  ? {
      available: true,
      passed: count(stats.expected),
      failed: count(stats.unexpected),
      flaky: count(stats.flaky),
      skipped: count(stats.skipped),
      failed_tests: formatFailures(collectFailures(report.suites)),
    }
  : {
      available: false,
      passed: 0,
      failed: 0,
      flaky: 0,
      skipped: 0,
      failed_tests: formatFailures([]),
    };

for (const [key, value] of Object.entries(outputs)) {
  console.log(`${key}=${value}`);
}
