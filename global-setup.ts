import { chromium, type FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  const { storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("https://tt02.altinn.no/");

  if (!process.env.HEIR_SSN || !process.env.HEIR_NAME) {
    throw new Error("SSN and HEIR environment variables must be set");
  }

  // Log in to Altinn
  await page.getByRole("button", { name: "Logg inn", exact: true }).click();

  // Select the high level test ID
  await page.getByRole("link", { name: "TestID på nivå høyt" }).click();

  // Fill in the SSN and authenticate
  await page
    .getByRole("textbox", { name: "Personidentifikator" })
    .fill(process.env.HEIR_SSN);
  await page.getByRole("button", { name: "Autentiser" }).click();

  // TODO: Add a more robust check for the correct button
  await page
    .getByRole("button", { name: process.env.HEIR_NAME + " Fødselsnr" })
    .click();

  await page
    .getByRole("link", { name: "Tilgang til Digitalt dødsbo" })
    .first()
    .click();
  await page.getByRole("link", { name: "Åpne Digitalt dødsbo" }).click();

  // Save the base URL and storage state
  process.env.BASE_URL = page.url();
  await page.context().storageState({ path: storageState as string });
  await browser.close();
}

export default globalSetup;
