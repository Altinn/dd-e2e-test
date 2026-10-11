import { test, expect } from "@playwright/test";
import { languageHeirs, languageName } from "../../heirs";
import { containing, texts } from "../../texts";

/**
 * Step 2 on the front page: "Sett deg inn i formue og gjeld".
 * The page shows one tab per source of wealth/debt information.
 */
const slugs = {
  tax: "tax",
  property: "property",
  vehicle: "vehicle",
  bank: "bank",
  insurance: "insurance",
} as const;

// The visible tab panel; all other panels are hidden.
const visiblePanel = "[role=tabpanel]:visible";

for (const heir of languageHeirs) {
  const t = texts[heir.language];
  const w = t.wealthAndDebt;
  const tabs = (Object.keys(slugs) as (keyof typeof slugs)[]).map((key) => ({
    ...w.tabs[key],
    slug: slugs[key],
  }));

  // The tabs that list data fetched from an external register, and therefore
  // have a message for the case where the register has nothing on the deceased.
  const dataTabs = tabs.filter(
    (tab): tab is (typeof tabs)[number] & { noDataText: string } =>
      tab.noDataText !== null
  );

  test.describe(languageName(heir.language), () => {
    test.use({ storageState: heir.storageState });

    test.beforeEach(async ({ page, baseURL }) => {
      await page.goto(baseURL || "/");
      await page.getByRole("button", { name: w.button }).click();
    });

    test("has title", async ({ page }) => {
      await expect(page).toHaveTitle(containing(w.pageTitle));
    });

    test("has heading with the name of the step", async ({ page }) => {
      const heading = page.getByRole("heading", {
        name: w.button,
        level: 1,
      });
      await expect(heading).toBeVisible();
    });

    test("has a tab for each source of wealth and debt", async ({ page }) => {
      await expect(page.getByRole("tab")).toHaveText(
        tabs.map((tab) => tab.name)
      );
    });

    test("the skatt tab is selected when the page opens", async ({ page }) => {
      const firstTab = page.getByRole("tab", {
        name: tabs[0].name,
        exact: true,
      });
      await expect(firstTab).toHaveAttribute("aria-selected", "true");
      await expect(page.locator(visiblePanel)).toContainText(tabs[0].heading);
    });

    for (const tab of tabs) {
      test(`${tab.name.toLowerCase()} tab shows its own content`, async ({
        page,
      }) => {
        await page.getByRole("tab", { name: tab.name, exact: true }).click();

        await expect(
          page.getByRole("tab", { name: tab.name, exact: true })
        ).toHaveAttribute("aria-selected", "true");

        // Exactly one panel is shown at a time, and it is the selected tab's panel.
        const panel = page.locator(visiblePanel);
        await expect(panel).toHaveCount(1);
        await expect(
          panel.getByRole("heading", { name: tab.heading, level: 2 })
        ).toBeVisible();

        // Selecting a tab is reflected in the URL, so the tab can be linked to.
        await expect(page).toHaveURL(new RegExp(`#${tab.slug}$`));
      });
    }

    for (const tab of dataTabs) {
      test(`${tab.name.toLowerCase()} tab lists the registered data or says there is none`, async ({
        page,
      }) => {
        await page.getByRole("tab", { name: tab.name, exact: true }).click();

        // The data is fetched from an external register, so give it more time than
        // the default expect timeout. If the register is unavailable the panel
        // shows <Source>_error_message_no_contact instead, and this fails.
        const panel = page.locator(visiblePanel);
        const dataOrNoData = panel
          .getByRole("table")
          .or(panel.getByText(tab.noDataText));
        await expect(dataOrNoData.first()).toBeVisible({ timeout: 30000 });
        await expect(panel).not.toContainText(w.unavailable);
      });
    }

    test("the skatt tab links to Skatteetaten", async ({ page }) => {
      await page
        .getByRole("tab", { name: w.tabs.tax.name, exact: true })
        .click();

      const panel = page.locator(visiblePanel);
      const taxLink = panel.getByRole("link", { name: w.goToTax });
      await expect(taxLink).toBeVisible({ timeout: 30000 });
      await expect(taxLink).toHaveAttribute("href", /skatt/i);
      await expect(panel).not.toContainText(w.unavailable);
    });

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
