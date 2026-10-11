# Copilot instructions for `dd-e2e-test`

## Project purpose

This repository is a Playwright end-to-end test suite for the Digitalt Dødsbo application. It does not contain the app itself; it exercises the live Altinn-backed estate flow in a browser and verifies the user-visible behavior of the estate pages.

The project is configured for browser automation against the public TT02 environment, with login handled by `global-setup.ts` and session state saved to `storageState*.json` files.

## Setup and test commands

Before running tests, create `.env` from `.env.example` and fill in the required variables:

- `DECEASED_NAME`
- `HEIR_SSN`, `HEIR_NAME`
- `HEIR2_SSN`, `HEIR3_SSN`, `HEIR4_SSN`, `HEIR5_SSN` (Heir 5 has nynorsk as their Altinn Profile language)

Typical commands:

- Install dependencies: `npm ci`
- Install browser dependencies if Playwright browsers are missing: `npx playwright install --with-deps chromium`
- Run the full suite: `npx playwright test`
- Run a single file: `npx playwright test tests/homepage.spec.ts --project=chromium`
- Run a single test by name: `npx playwright test tests/step1/tab_contents.spec.ts -g "has title"`
- Run a subset of tests in a file: `npx playwright test tests/step4 --project=chromium`
- Run CI-style sharding: `npx playwright test --shard=1/4`

There is no custom `lint` or `build` script in `package.json`; the repo primarily validates through Playwright runs. The GitHub Actions workflow follows the same pattern and shards tests across four jobs.

## Architecture

The important project structure is:

- `playwright.config.ts`: central Playwright configuration. It loads `.env`, enables `globalSetup`, configures `testDir: ./tests`, sets `baseURL` from `BASE_URL`, and uses Norwegian timezone settings.
- `global-setup.ts`: logs in to the Altinn test environment as each heir, saves a browser `storageState` file, and sets `BASE_URL` plus the heir names once the app loads.
- `heirs.ts`: defines the five heirs used by the suite (`Heir 1` to `Heir 5`), their relationship to the deceased, their Altinn Profile language, the environment variable names they use, and the session file each should persist.
- `tests/`: test files are grouped by workflow step (`homepage`, `step1`, `step2`, `step3`, `step4`, plus `link-validation` and `axe`). This mirrors the estate flow rather than a component-centric layout.
- `storageState*.json`: generated session files. These are not source-of-truth app state; they are per-heir login artifacts created by the setup step.
- `infra/`: Docker setup used to bring up the surrounding Digitalt Dødsbo environment for local testing, as described in the README.

The broader app flow is: authenticate as a test heir, land on a shared estate, then run UI assertions against the Norwegian page content and tabs. Most test files assume the estate has already been initialized and that the right heir and `storageState` are in place.

## Key conventions

- Prefer `@playwright/test` locators with semantic queries (`getByRole`, `getByText`, `getByLabel`, `getByTab`) rather than brittle CSS selectors.
- `texts.ts` holds the text the tests assert on, in bokmål and nynorsk. Tests that check text run once per language (`languageHeirs`): Heir 1 in bokmål, Heir 5 in nynorsk. Add new texts to both languages, taken from the app's `resource.nb.json`/`resource.nn.json`.
- The app is localized in Norwegian; tests assert on Norwegian titles, headings, tab names, and role names such as `Personalia`, `Arvinger`, `Testament`, and `Sjekk den dødes opplysninger`.
- The suite depends on environment variables and shared estate data. If a required variable is missing, the setup or a test should fail clearly instead of proceeding with a partially configured run.
- Use the heir-specific flow. The same estate is shared by multiple heirs, and each heir is assigned a single probate path or action (`uskifte`, `privat skifte`, `bo av liten verdi`, `offentlig skifte`). Do not assume the estate state persists between runs. The estate resets nightly.
- `test.beforeEach` is commonly used to navigate to the estate home page for each test. Keep tests independent and not dependent on order.
- Because the app loads asynchronously, some tests add generous timeouts (`15000` ms or more) when waiting for real data to appear after a slow TT02 page load.
- CI intentionally forbids `test.only` usage and runs with retries only on CI; keep the suite clean and deterministic for the pipeline.

## Working in this repo

- Treat this as a browser-level regression suite, not a Node/React application with a local build pipeline.
- If a change affects the flow or a particular heir path, validate the relevant Playwright spec instead of running the entire suite unless the change is cross-cutting.
- When adding new coverage, follow the existing naming and grouping pattern (`tests/<step>/<spec>.spec.ts`) and use the same role-based assertions as nearby tests.
- Do not hand-edit generated `storageState*.json` files; they are produced by `global-setup.ts`.

## Relevant AI assistant config already present

This repo contains `.claude/settings.json`, which includes the standard Playwright / GitHub CLI commands used in this project. Keep the same test command patterns and use `gh` for repo metadata when needed.
