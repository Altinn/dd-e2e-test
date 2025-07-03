import { chromium, type FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseURL!);

  if (!process.env.HEIR_SSN || !process.env.HEIR_NAME) {
    throw new Error("SSN and HEIR environment variables must be set");
  }

  // Log in to Altinn
  await page.getByRole("button", { name: "Logg inn", exact: true }).click();

  // Select the high level test ID
  await page.getByRole("link", { name: "TestID på nivå høyt Lag din" }).click();

  // Fill in the SSN and authenticate
  await page
    .getByRole("textbox", { name: "Personidentifikator" })
    .fill(process.env.HEIR_SSN);
  await page.getByRole("button", { name: "Autentiser" }).click();

  // TODO: Add a more robust check for the correct button
  await page
    .getByRole("button", { name: process.env.HEIR_NAME + " Fødselsnr" })
    .click();

  // Save the storage state
  await page.context().storageState({ path: storageState as string });
  await browser.close();
}

export default globalSetup;
