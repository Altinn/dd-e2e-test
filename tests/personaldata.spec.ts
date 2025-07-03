import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("https://tt02.altinn.no/ui/messagebox/");
  await page
    .getByRole("link", { name: "Tilgang til Digitalt dødsbo" })
    .first()
    .click();
  await page.getByRole("link", { name: "Åpne Digitalt dødsbo" }).click();
  await page
    .getByRole("link", { name: "Sjekk den dødes opplysninger" })
    .click();
});

test("has title", async ({ page }) => {
  await expect(page).toHaveTitle(/den dødes opplysninger/i);
});

test("heirs tab includes the logged-in heir", async ({ page }) => {
  const heirName = process.env.HEIR_NAME;
  if (!heirName) {
    throw new Error("HEIR_NAME environment variable is not defined");
  }

  await page.getByRole("tab", { name: "Arvinger" }).click();

  // Check if the heir's name is visible in the heirs list
  const heirElement = page.getByText(heirName, { exact: true });
  await expect(heirElement).toBeVisible();
});
