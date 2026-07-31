// Reads Playwright's merged JSON report and writes counts as GitHub Actions
// step outputs (key=value lines on stdout, redirected to $GITHUB_OUTPUT).
//
// Written defensively: a failure to read or parse the report must not fail the
// notification step, since the whole point is to report on a run that already
// went wrong. Missing values fall back to 0 and `available=false`, which the
// workflow uses to soften the Slack message.

const fs = require("fs");

const file = process.argv[2];
const count = (value) => (Number.isFinite(value) ? value : 0);

let stats = null;

try {
  stats = JSON.parse(fs.readFileSync(file, "utf8")).stats;
} catch (error) {
  console.error(`Could not read stats from ${file}: ${error.message}`);
}

const outputs = stats
  ? {
      available: true,
      passed: count(stats.expected),
      failed: count(stats.unexpected),
      flaky: count(stats.flaky),
      skipped: count(stats.skipped),
    }
  : { available: false, passed: 0, failed: 0, flaky: 0, skipped: 0 };

for (const [key, value] of Object.entries(outputs)) {
  console.log(`${key}=${value}`);
}
