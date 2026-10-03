import { chromium, type Browser, type FullConfig } from "@playwright/test";
import { heirs, type Heir } from "./heirs";

/**
 * Logs in to Digitalt dødsbo as the heir, saves the session to the heir's
 * storage state file, and returns the URL the heir lands on and the name the
 * app shows in its header.
 */
async function logIn(browser: Browser, heir: Heir) {
  const page = await browser.newPage();
  await page.goto("https://af.tt02.altinn.no/?mock=true");

  // Select the high level test ID
  await page.getByRole("link", { name: "TestID på nivå høyt" }).click();

  // Fill in the SSN and authenticate
  await page
    .getByRole("textbox", { name: "Personidentifikator" })
    .fill(process.env[heir.ssnVariable]!);
  await page.getByRole("button", { name: "Autentiser" }).click();

  // Open the Altinn message and click on the link to access Digitalt dødsbo
  await page
    .getByRole("link", { name: "Tilgang til Digitalt dødsbo" })
    .first()
    .click();
  await page.getByRole("link", { name: "Åpne Digitalt dødsbo" }).click();

  // The heir should land on the estate's front page. If not, say where they
  // landed instead, and keep a screenshot: CI uploads test-results/ when a run
  // fails, while an error in the global setup has no trace of its own.
  const frontPage = page.getByRole("heading", {
    name: /^Digitalt dødsbo etter /,
    level: 1,
  });
  try {
    await frontPage.waitFor({ timeout: 30_000 });
  } catch {
    const screenshot = `test-results/global-setup-${heir.label
      .toLowerCase()
      .replace(/\s+/g, "-")}.png`;
    await page.screenshot({ path: screenshot, fullPage: true });
    throw new Error(
      `${heir.label} (${heir.ssnVariable}) did not reach the estate's front ` +
        `page after logging in. Landed on ${page.url()} with the title ` +
        `"${await page.title()}". Screenshot: ${screenshot}`
    );
  }

  // The name of the logged-in heir is the only paragraph in the page header,
  // <header id="app-header">. It only labels the heir in titles and the
  // report, so a missing name is logged rather than failing the run.
  const name = (
    await page
      .getByRole("banner")
      .getByRole("paragraph")
      .first()
      .textContent({ timeout: 5_000 })
      .catch(() => null)
  )?.trim();
  if (!name) {
    console.warn(`${heir.label}: could not read the name from the page header`);
  }

  await page.context().storageState({ path: heir.storageState });
  const url = page.url();
  await page.close();
  return { url, name };
}

async function globalSetup(_config: FullConfig) {
  const allHeirs = Object.values(heirs);

  const missing = allHeirs
    .map((heir) => heir.ssnVariable)
    .filter((variable) => !process.env[variable]);
  if (!process.env.HEIR_NAME) missing.push("HEIR_NAME");
  if (missing.length > 0) {
    throw new Error(`${missing.join(", ")} environment variables must be set`);
  }

  const browser = await chromium.launch();
  const logins = await Promise.all(
    allHeirs.map((heir) => logIn(browser, heir))
  );
  await browser.close();

  allHeirs.forEach((heir, index) => {
    const { name } = logins[index];
    // HEIR_NAME is given, and the tests check that the app shows it; the
    // other heirs' names are taken from the app, for titles and the report.
    if (!process.env[heir.nameVariable] && name) {
      process.env[heir.nameVariable] = name;
    }
    console.log(
      `${heir.label} (${heir.relation}): ${
        process.env[heir.nameVariable] ?? "name not found"
      }`
    );
  });

  // The heirs share the estate, so they all land on the same URL.
  process.env.BASE_URL = logins[0].url;
  console.log(`Base URL set to: ${process.env.BASE_URL}`);
}

export default globalSetup;
