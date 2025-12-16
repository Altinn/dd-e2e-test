import { chromium, type FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  const { storageState } = config.projects[0].use;
  const browser = await chromium.launch({ headless: !!process.env.CI });
  const page = await browser.newPage();

  // 1. Navigate to Altinn TT02
  await page.goto("https://tt02.altinn.no/");

  if (!process.env.HEIR_SSN) {
    throw new Error("HEIR_SSN environment variable must be set");
  }

  // 2. Log in
  await page.getByRole('button', { name: 'Logg inn' }).click();
  await page.getByRole('link', { name: 'TestID på nivå høyt Lag din' }).click();

  await page.getByRole('textbox', { name: 'Personidentifikator (' }).click();
  await page.getByRole('textbox', { name: 'Personidentifikator (' }).fill(process.env.HEIR_SSN);
  await page.getByRole('button', { name: 'Autentiser' }).click();

  // 3. Handle potential "Welcome / Intro" and "Search" popups in Altinn

  // 3a. Welcome modal - Wait up to 5s for it to appear
  try {
    const doNotShow = page.getByRole('checkbox', { name: 'Ikke vis denne meldingen igjen' });
    // We wait a bit to see if it pops up
    await doNotShow.waitFor({ state: 'visible', timeout: 5000 });
    await doNotShow.check();
    await page.getByRole('button', { name: 'Ok' }).click();
  } catch (e) {
    // It didn't appear within 5 seconds, so we assume it's not there
    console.log("Welcome modal did not appear.");
  }

  // 3b. Search popup - Wait up to 5s for it to appear
  try {
    const closeSearch = page.getByRole('button', { name: 'Lukk' });
    await closeSearch.waitFor({ state: 'visible', timeout: 5000 });
    await closeSearch.click();
  } catch (e) {
    // It didn't appear within 5 seconds, so we assume it's not there
    console.log("Search popup did not appear.");
  }

  // 4. Navigate to Digitalt Dødsbo
  // We click the first "Tilgang til Digitalt dødsbo" link in the inbox
  await page.getByRole('link', { name: 'Tilgang til Digitalt dødsbo (' }).first().click();
  await page.getByRole('link', { name: 'Åpne Digitalt dødsbo' }).click();

  // 5. Save state
  process.env.BASE_URL = page.url();
  await page.context().storageState({ path: storageState as string });
  await browser.close();
}

export default globalSetup;
