import type { Page } from "@playwright/test";

/**
 * Logs in to the Altinn tt02 inbox with the test ID of the person with the
 * given SSN, and leaves the page on the inbox.
 */
export async function logInToAltinn(page: Page, ssn: string) {
  await page.goto("https://af.tt02.altinn.no/?mock=true", { timeout: 30_000 });

  // Select the high level test ID
  await page
    .getByRole("link", { name: "TestID på nivå høyt" })
    .click({ timeout: 30_000 });

  // Fill in the SSN and authenticate
  await page.getByRole("textbox", { name: "Personidentifikator" }).fill(ssn);
  await page
    .getByRole("button", { name: "Autentiser" })
    .click({ timeout: 30_000 });
}
