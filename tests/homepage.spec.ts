import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto(baseURL || "/");
});

test("has title", async ({ page }) => {
  await expect(page).toHaveTitle(/Startside - Digitalt Dødsbo/);
});

test("has heading with the name of the deceased", async ({ page }) => {
  const deceasedName = process.env.DECEASED_NAME;
  if (!deceasedName) {
    throw new Error("DECEASED_NAME environment variable is not defined");
  }

  const heading = page.getByRole("heading", {
    name: deceasedName,
    level: 1,
  });
  // The name is fetched after load, so the heading can take longer to appear
  // than the default 5s expect timeout allows on a slow tt02.
  await expect(heading).toBeVisible({ timeout: 15000 });
});

test.skip("has the name of the logged-in heir", async ({ page }) => {
  const heirName = process.env.HEIR_NAME;
  if (!heirName) {
    throw new Error("HEIR_NAME environment variable is not defined");
  }

  // TODO: should be replaced with a more robust check using data-testid or similar
  const heirElement = page.getByText(heirName, { exact: true });
  await expect(heirElement).toBeVisible();
});






