import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto(baseURL || "/");
  await page
    .getByRole("button", { name: "Sjekk den dødes opplysninger" })
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
  const heirLastName = heirName.split(" ").slice(-1)[0]; // Get the last name of the heir
  const heirElement = page.getByText(new RegExp(`^${heirLastName}.*`), { exact: false });
  await expect(heirElement).toBeVisible();
});
