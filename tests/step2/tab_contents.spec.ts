import { test, expect } from "@playwright/test";

/**
 * Step 2 on the front page: "Sett deg inn i formue og gjeld".
 * The page shows one tab per source of wealth/debt information.
 */
const tabs = [
  {
    name: "Skatt",
    heading: "Skatteopplysninger etter den døde",
    slug: "tax",
    noDataText: null,
  },
  {
    name: "Eiendom",
    heading: "Eiendommer tinglyst på den døde",
    slug: "property",
    noDataText: "Ingen eiendommer er funnet tinglyst på den døde.",
  },
  {
    name: "Kjøretøy",
    heading: "Kjøretøy registrert på den døde",
    slug: "vehicle",
    noDataText: "Ingen kjøretøy er funnet registrert på den døde.",
  },
  {
    name: "Bank",
    heading: "Bankkontoer etter den døde",
    slug: "bank",
    noDataText: "Kundeforhold funnet, men ingen konto. Kontakt banken.",
  },
  {
    name: "Forsikring",
    heading: "Livs- og pensjonsforsikringer etter den døde",
    slug: "insurance",
    noDataText:
      "Ingen livs- og personsforsikringer er funnet registrert på den døde.",
  },
];

// The tabs that list data fetched from an external register, and therefore
// have a message for the case where the register has nothing on the deceased.
const dataTabs = tabs.filter(
  (tab): tab is (typeof tabs)[number] & { noDataText: string } =>
    tab.noDataText !== null
);

// The visible tab panel; all other panels are hidden.
const visiblePanel = "[role=tabpanel]:visible";

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto(baseURL || "/");
  await page
    .getByRole("button", { name: "Sett deg inn i formue og gjeld" })
    .click();
});

test("has title", async ({ page }) => {
  await expect(page).toHaveTitle(/Formue og gjeld/i);
});

test("has heading with the name of the step", async ({ page }) => {
  const heading = page.getByRole("heading", {
    name: "Sett deg inn i formue og gjeld",
    level: 1,
  });
  await expect(heading).toBeVisible();
});

test("has a tab for each source of wealth and debt", async ({ page }) => {
  await expect(page.getByRole("tab")).toHaveText(tabs.map((tab) => tab.name));
});

test("the skatt tab is selected when the page opens", async ({ page }) => {
  const firstTab = page.getByRole("tab", { name: tabs[0].name, exact: true });
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
    await expect(dataOrNoData.first()).toBeVisible({ timeout: 20000 });
    await expect(panel).not.toContainText(/ikke tilgjengelig for øyeblikket/i);
  });
}

test("the skatt tab links to Skatteetaten", async ({ page }) => {
  await page.getByRole("tab", { name: "Skatt", exact: true }).click();

  const panel = page.locator(visiblePanel);
  const taxLink = panel.getByRole("link", { name: "Gå til Skatteetaten" });
  await expect(taxLink).toBeVisible({ timeout: 20000 });
  await expect(taxLink).toHaveAttribute("href", /skatt/i);
  await expect(panel).not.toContainText(/ikke tilgjengelig for øyeblikket/i);
});

test("the breadcrumb leads back to the front page", async ({ page }) => {
  await page
    .getByRole("navigation", { name: "Brødsmulesti" })
    .getByRole("link", { name: "Tilbake til forsiden" })
    .click();

  await expect(page).toHaveTitle(/Startside - Digitalt Dødsbo/);
});

test("the link at the bottom of the page leads back to the front page", async ({
  page,
}) => {
  // The breadcrumb has the same accessible name, so match on the visible text.
  await page.getByText("Tilbake til forsiden", { exact: true }).click();

  await expect(page).toHaveTitle(/Startside - Digitalt Dødsbo/);
});
