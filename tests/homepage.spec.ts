import { test, expect } from "@playwright/test";
import { heirName, heirs } from "../heirs";

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

for (const heir of Object.values(heirs)) {
  test.describe(heir.label, () => {
    test.use({ storageState: heir.storageState });

    test("has the name of the logged-in heir", async ({ page }) => {
      // The name is shown in the page header, next to the link to log out.
      const header = page.getByRole("banner");
      await expect(
        header.getByText(heirName(heir), { exact: true })
      ).toBeVisible();
      await expect(header.getByRole("link", { name: "Logg ut" })).toBeVisible();
    });
  });
}





