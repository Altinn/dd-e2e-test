import { chromium, type Browser, type FullConfig } from "@playwright/test";

/**
 * The heirs that the tests log in as besides the default one, by the
 * environment variable that holds their SSN. Each is logged in once here and
 * its session saved to its own file, so a test can act as that heir with
 * `test.use({ storageState: heirStorageState("HEIR3_SSN") })`.
 */
export const otherHeirs = ["HEIR3_SSN", "HEIR4_SSN"];

export const heirStorageState = (ssnVariable: string) =>
  `storageState.${ssnVariable.replace(/_SSN$/, "").toLowerCase()}.json`;

/**
 * Logs in to Digitalt dødsbo as the heir with the given SSN, saves the session
 * and returns the URL the heir lands on.
 */
async function logIn(browser: Browser, ssn: string, storageState: string) {
  const page = await browser.newPage();
  await page.goto("https://af.tt02.altinn.no/?mock=true");

  // Select the high level test ID
  await page.getByRole("link", { name: "TestID på nivå høyt" }).click();

  // Fill in the SSN and authenticate
  await page.getByRole("textbox", { name: "Personidentifikator" }).fill(ssn);
  await page.getByRole("button", { name: "Autentiser" }).click();

  // Open the Altinn message and click on the link to access Digitalt dødsbo
  await page
    .getByRole("link", { name: "Tilgang til Digitalt dødsbo" })
    .first()
    .click();
  await page.getByRole("link", { name: "Åpne Digitalt dødsbo" }).click();

  await page.context().storageState({ path: storageState });
  const url = page.url();
  await page.close();
  return url;
}

async function globalSetup(config: FullConfig) {
  const { storageState } = config.projects[0].use;

  if (!process.env.HEIR_SSN || !process.env.HEIR_NAME) {
    throw new Error("SSN and HEIR environment variables must be set");
  }
  const missing = otherHeirs.filter((variable) => !process.env[variable]);
  if (missing.length > 0) {
    throw new Error(`${missing.join(", ")} environment variables must be set`);
  }

  const browser = await chromium.launch();
  const [baseURL] = await Promise.all([
    logIn(browser, process.env.HEIR_SSN, storageState as string),
    ...otherHeirs.map((variable) =>
      logIn(browser, process.env[variable]!, heirStorageState(variable))
    ),
  ]);
  await browser.close();

  // The heirs share the estate, so they all land on the same URL.
  process.env.BASE_URL = baseURL;
  console.log(`Base URL set to: ${process.env.BASE_URL}`);
}

export default globalSetup;
