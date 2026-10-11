import { test, expect, type Locator, type Page } from "@playwright/test";
import { languageHeirs, languageName } from "../../heirs";
import { containing, texts, type Texts } from "../../texts";

/**
 * Step 3 on the front page: "Bruk din egen sjekkliste".
 * The checklist is a list of points the heir should check before choosing a
 * probate form. Each point can be marked as done, and most of them link to the
 * page and tab in Digitalt dødsbo where the information can be found.
 */

/** The points that link to where the information can be checked. */
const pointLinks = (t: Texts) => {
  const info = t.deceasedInformation;
  const wealth = t.wealthAndDebt;
  return [
    {
      linkName: t.checklist.links.personalia,
      title: info.pageTitle,
      tab: info.personalia,
    },
    {
      linkName: t.checklist.links.estate,
      title: info.pageTitle,
      tab: t.checklist.estateTab,
    },
    {
      linkName: t.checklist.links.heirs,
      title: info.pageTitle,
      tab: info.heirs,
    },
    {
      linkName: t.checklist.links.marriagePact,
      title: info.pageTitle,
      tab: info.marriagePact,
    },
    {
      linkName: t.checklist.links.testament,
      title: info.pageTitle,
      tab: info.testament,
    },
    {
      linkName: t.checklist.links.tax,
      title: wealth.pageTitle,
      tab: wealth.tabs.tax.name,
    },
    {
      linkName: t.checklist.links.property,
      title: wealth.pageTitle,
      tab: wealth.tabs.property.name,
    },
    {
      linkName: t.checklist.links.vehicle,
      title: wealth.pageTitle,
      tab: wealth.tabs.vehicle.name,
    },
    {
      linkName: t.checklist.links.bank,
      title: wealth.pageTitle,
      tab: wealth.tabs.bank.name,
    },
    {
      linkName: t.checklist.links.pension,
      title: wealth.pageTitle,
      tab: wealth.tabs.insurance.name,
    },
  ];
};

/**
 * A point in the checklist. The heading of a point is the button that expands
 * and collapses its explanation.
 */
const checklistPoint = (page: Page, title: string) =>
  page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: title, exact: true }) });

/**
 * Marks or unmarks a point and waits until the change has been saved, so a
 * reload right after does not show the state from before the change.
 */
const setMark = async (page: Page, checkbox: Locator, checked: boolean) => {
  if ((await checkbox.isChecked()) === checked) return;
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.url().includes("/checklist/")
  );
  await checkbox.setChecked(checked);
  expect((await saved).ok()).toBe(true);
};

for (const heir of languageHeirs) {
  const t = texts[heir.language];
  const c = t.checklist;

  test.describe(languageName(heir.language), () => {
    test.use({ storageState: heir.storageState });

    test.beforeEach(async ({ page, baseURL }) => {
      await page.goto(baseURL || "/");
      await page.getByRole("button", { name: c.button }).click();
    });

    test("has title", async ({ page }) => {
      await expect(page).toHaveTitle(containing(c.pageTitle));
    });

    test("has heading with the purpose of the checklist", async ({ page }) => {
      const heading = page.getByRole("heading", {
        name: c.heading,
        level: 1,
      });
      await expect(heading).toBeVisible();
    });

    test("lists every point to check", async ({ page }) => {
      for (const point of c.points) {
        await expect(checklistPoint(page, point)).toBeVisible();
      }
    });

    test("every point can be marked as done", async ({ page }) => {
      for (const point of c.points) {
        await expect(
          checklistPoint(page, point).getByRole("checkbox")
        ).toHaveCount(1);
      }
    });

    test("a point that is marked as done stays marked", async ({ page }) => {
      // "Proklama" is only used by this test, so marking it does not interfere
      // with the other tests running in parallel.
      const proklama = checklistPoint(page, c.proklama).getByRole("checkbox");

      // The checkboxes are shown disabled and unchecked until the stored marks
      // have loaded, so wait for that before reading or changing the state.
      await expect(proklama).toBeEnabled();

      // The marks are stored per heir, so start from a known state.
      await setMark(page, proklama, false);
      await setMark(page, proklama, true);
      await expect(proklama).toBeChecked();

      await page.reload();

      const proklamaAfterReload = checklistPoint(page, c.proklama).getByRole(
        "checkbox"
      );
      await expect(proklamaAfterReload).toBeEnabled();
      await expect(proklamaAfterReload).toBeChecked();

      // Leave the checklist as it was found.
      await setMark(page, proklamaAfterReload, false);
      await expect(proklamaAfterReload).not.toBeChecked();
    });

    for (const point of pointLinks(t)) {
      test(`"${point.linkName}" opens the ${point.tab} tab`, async ({
        page,
      }) => {
        await page
          .getByRole("link", { name: point.linkName, exact: true })
          .click();

        await expect(page).toHaveTitle(containing(point.title));
        await expect(
          page.getByRole("tab", { name: point.tab, exact: true })
        ).toHaveAttribute("aria-selected", "true");
      });
    }

    test("the breadcrumb leads back to the front page", async ({ page }) => {
      await page
        .getByRole("navigation", { name: t.breadcrumbs })
        .getByRole("link", { name: t.backToFrontPage })
        .click();

      await expect(page).toHaveTitle(containing(t.home.pageTitle));
    });

    test("the link at the bottom of the page leads back to the front page", async ({
      page,
    }) => {
      // The breadcrumb has the same accessible name, so match on the visible text.
      await page.getByText(t.backToFrontPage, { exact: true }).click();

      await expect(page).toHaveTitle(containing(t.home.pageTitle));
    });
  });
}
