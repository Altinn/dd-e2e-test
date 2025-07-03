import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("https://tt02.altinn.no/ui/messagebox/");
  await page
    .getByRole("link", { name: "Tilgang til Digitalt dødsbo" })
    .first()
    .click();
  await page.getByRole("link", { name: "Åpne Digitalt dødsbo" }).click();
});

test("has title", async ({ page }) => {
  await expect(page).toHaveTitle(/Startside - Digitalt Dødsbo/);
});

test("has heading with the name of the deceased", async ({ page }) => {
  const deceasedName = process.env.DECEASSED_NAME;
  const heading = page.getByRole("heading", {
    name: deceasedName,
    level: 1,
  });
  await expect(heading).toBeVisible();
});

test("has the name of the logged-in heir", async ({ page }) => {
  const heirName = process.env.HEIR_NAME;
  if (!heirName) {
    throw new Error("HEIR_NAME environment variable is not defined");
  }

  // TODO: should be replaced with a more robust check using data-testid or similar
  const heirElement = page.getByText(heirName, { exact: true });
  await expect(heirElement).toBeVisible();
});
