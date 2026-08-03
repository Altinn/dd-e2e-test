// Reads Playwright's merged JSON report and writes counts plus a description of
// what actually went wrong as GitHub Actions step outputs (key=value lines on
// stdout, redirected to $GITHUB_OUTPUT).
//
// Written defensively: a failure to read or parse the report must not fail the
// notification step, since the whole point is to report on a run that already
// went wrong. Missing values fall back to 0 and `available=false`, which the
// workflow uses to soften the Slack message.
//
// Two distinct kinds of failure have to be reported, because Playwright records
// them in different places:
//
//   - a test failed                  → spec.tests[].results[].error
//   - the run failed outside any test → the report's top-level `errors`
//     (globalSetup, config load, worker crash)
//
// Only the first was read before, so when the login flow in globalSetup timed
// out the message said "0 passed · 0 failed · 0 flaky" and carried no error at
// all — nothing had failed as far as the report was concerned.

const fs = require("fs");

// Slack section text tops out at 3000 characters, and a wall of failures is not
// readable anyway, so the output is capped several ways.
const MAX_LISTED = 8;
const MAX_ERROR_LINES = 3;
const MAX_ERROR_CHARS = 240;
const MAX_TOTAL_CHARS = 2500;

const file = process.argv[2];
const count = (value) => (Number.isFinite(value) ? value : 0);

let report = null;

try {
  report = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (error) {
  console.error(`Could not read stats from ${file}: ${error.message}`);
}

const ESCAPE = 27;
const NEWLINE = 10;
const DELETE = 127;

/**
 * Strip the formatting Playwright puts in its error messages: ANSI colour
 * sequences (ESC, "[", parameters, then a letter that ends the sequence) and
 * any other control characters, which are unreadable in Slack and illegal raw
 * inside a JSON string. Newlines stay — they carry the message's structure.
 */
const clean = (text) => {
  let out = "";
  let inEscape = false;

  for (const char of text) {
    const code = char.charCodeAt(0);

    if (inEscape) {
      inEscape = !/[a-zA-Z]/.test(char);
    } else if (code === ESCAPE) {
      inEscape = true;
    } else if (code === NEWLINE || (code >= 32 && code !== DELETE)) {
      out += char;
    }
  }

  return out;
};

const rootDir = (report?.config?.rootDir ?? "").replace(/\\/g, "/");

// `spec.file` is already relative to the config root, but error locations are
// absolute paths on the runner. Trim the checkout prefix so the two agree.
const relative = (path) => {
  const normalised = path.replace(/\\/g, "/");
  return rootDir && normalised.startsWith(`${rootDir}/`)
    ? normalised.slice(rootDir.length + 1)
    : normalised;
};

/**
 * The opening lines of an error message, which is where Playwright puts the
 * reason: the message itself, then either `Expected:`/`Received:` or the head
 * of a call log. Everything after that is stack and source-snippet noise that
 * belongs in the HTML report rather than in a Slack alert.
 */
const summarise = (error) => {
  const lines = clean(error?.message ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_ERROR_LINES);

  const text = lines.join("\n");
  return text.length > MAX_ERROR_CHARS
    ? `${text.slice(0, MAX_ERROR_CHARS).trimEnd()}…`
    : text;
};

const where = (error) =>
  error?.location?.file
    ? `${relative(error.location.file)}:${error.location.line}`
    : null;

// Consecutive `> ` lines render as a single block quote in Slack, which groups
// an error under the test it belongs to.
const quote = (text) =>
  text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

/** The error a failed test ended on, i.e. from its last attempt that has one. */
const errorFor = (test) => {
  const results = test.results ?? [];
  for (let i = results.length - 1; i >= 0; i -= 1) {
    const error = results[i].error ?? (results[i].errors ?? [])[0];
    if (error?.message) {
      return error;
    }
  }
  return null;
};

/**
 * Collect every spec that ended up failing, as "file:line — describe › title"
 * plus the error it failed with.
 *
 * Suites nest: each entry in the report's top-level `suites` is a spec file,
 * and anything below it is a describe block. The file contributes the path
 * already shown by `spec.file`, so only describe titles go into the name.
 */
const walkSuite = (suite, titlePath) => {
  const failures = [];

  for (const spec of suite.specs ?? []) {
    const failed = (spec.tests ?? []).filter(
      (test) => test.status === "unexpected"
    );
    if (failed.length > 0) {
      const name = [...titlePath, spec.title].join(" › ");
      failures.push({
        name: `${spec.file}:${spec.line} — ${name}`,
        error: failed.map(errorFor).find(Boolean) ?? null,
      });
    }
  }

  for (const child of suite.suites ?? []) {
    failures.push(...walkSuite(child, [...titlePath, child.title]));
  }

  return failures;
};

const collectFailures = (suites) =>
  (suites ?? []).flatMap((fileSuite) => walkSuite(fileSuite, []));

/**
 * Run-level errors, deduplicated. Every shard hits the same globalSetup failure,
 * so without this the message repeats one login error four times; the number of
 * reports is kept as a tally instead.
 */
const collectRunErrors = (errors) => {
  const seen = new Map();

  for (const error of errors ?? []) {
    const summary = summarise(error);
    if (!summary) {
      continue;
    }

    const location = where(error);
    const text = location ? `${summary}\n(at ${location})` : summary;
    seen.set(text, (seen.get(text) ?? 0) + 1);
  }

  return [...seen].map(([text, times]) =>
    times > 1 ? `${text}\n(reported by ${times} shards)` : text
  );
};

const describeFailures = (specFailures, runErrors) => {
  const parts = [];

  if (specFailures.length > 0) {
    const listed = specFailures.slice(0, MAX_LISTED).map(({ name, error }) => {
      const summary = error ? summarise(error) : "";
      return summary ? `• ${name}\n${quote(summary)}` : `• ${name}`;
    });

    const remaining = specFailures.length - listed.length;
    if (remaining > 0) {
      listed.push(`_…and ${remaining} more._`);
    }

    parts.push(`*Failed tests*\n${listed.join("\n")}`);
  }

  if (runErrors.length > 0) {
    parts.push(
      `*Errors outside the tests*\n${runErrors.map(quote).join("\n>\n")}`
    );
  }

  if (parts.length === 0) {
    return "_The report records no failures — the run may have failed before or after the tests, e.g. while installing browsers or merging reports. See the run log._";
  }

  const text = parts.join("\n\n");
  return text.length > MAX_TOTAL_CHARS
    ? `${text.slice(0, MAX_TOTAL_CHARS).trimEnd()}\n_…truncated._`
    : text;
};

// The text is substituted into a JSON payload, so quotes and backslashes have to
// survive that, and line breaks are emitted as the two characters \ and n for
// JSON itself to turn back into newlines. A real newline would also break the
// key=value format $GITHUB_OUTPUT is parsed with.
const forJson = (text) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");

const stats = report?.stats;
const outputs = stats
  ? {
      available: true,
      passed: count(stats.expected),
      failed: count(stats.unexpected),
      flaky: count(stats.flaky),
      skipped: count(stats.skipped),
      failures: forJson(
        describeFailures(
          collectFailures(report.suites),
          collectRunErrors(report.errors)
        )
      ),
    }
  : {
      available: false,
      passed: 0,
      failed: 0,
      flaky: 0,
      skipped: 0,
      failures: forJson(
        "_The report could not be read, so there are no details to show. See the run log._"
      ),
    };

for (const [key, value] of Object.entries(outputs)) {
  console.log(`${key}=${value}`);
}
