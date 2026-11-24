import { test, expect } from "@playwright/test";
import { languageHeirs, languageName } from "../heirs";
import { containing, escapeRegExp, texts } from "../texts";

/**
 * "Praktiske oppgaver", opened from the "Oppgaver" card on the front page.
 * The page lists common practical tasks after a death, one heading and a short
 * explanation per task, from the Practical_matters_list text resource.
 */
for (const heir of languageHeirs) {
  const t = texts[heir.language];
  const p = t.practicalTasks;

  test.describe(languageName(heir.language), () => {
    test.use({ storageState: heir.storageState });

    test.beforeEach(async ({ page, baseURL }) => {
      await page.goto(baseURL || "/");
      // The card's accessible name is its title followed by its description.
      await page
        .getByRole("link", { name: new RegExp(`^${escapeRegExp(p.card)}`) })
        .click();
    });

    test("has title", async ({ page }) => {
      await expect(page).toHaveTitle(containing(p.pageTitle));
    });

    test("has heading", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: p.heading, level: 1 })
      ).toBeVisible();
    });

    test("lists the tasks in order", async ({ page }) => {
      await expect(
        page.getByRole("main").getByRole("heading", { level: 2 })
      ).toHaveText(p.tasks);
    });

    test("explains how to take over a grave lease", async ({ page }) => {
      await expect(page.getByRole("main")).toContainText(p.graveLease);
    });

    test("points to help with deleting social media profiles", async ({
      page,
    }) => {
      await expect(page.getByRole("main")).toContainText(p.socialMediaHelp);
    });

    test("links to Kartverket for transferring property", async ({ page }) => {
      await expect(
        page.getByRole("main").getByRole("link", { name: p.kartverketLink })
      ).toHaveAttribute("href", /kartverket\.no/);
    });

    test("the breadcrumb leads back to the front page", async ({ page }) => {
      await page
        .getByRole("navigation", { name: t.breadcrumbs })
        .getByRole("link", { name: t.backToFrontPage })
        .click();

      await expect(page).toHaveTitle(containing(t.home.pageTitle));
    });
  });
}
