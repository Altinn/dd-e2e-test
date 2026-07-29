import { test, expect, type Page } from "@playwright/test";

/**
 * Step 3 on the front page: "Bruk din egen sjekkliste".
 * The checklist is a list of points the heir should check before choosing a
 * probate form. Each point can be marked as done, and most of them link to the
 * page and tab in Digitalt dødsbo where the information can be found.
 */
const points = [
  "Andre forhold",
  "Personalia",
  "Dødsboet",
  "Arvinger",
  "Ektepakt",
  "Testament",
  "Skatt",
  "Eiendom",
  "Kjøretøy",
  "Bank",
  "Forsikring",
  "Innbo og løsøre",
  "Næringsvirksomhet",
  "Digitale verdier",
  "Verdier i utlandet",
  "Proklama",
];

/** The points that link to where the information can be checked. */
const pointLinks = [
  {
    linkName: "Sjekk personalia",
    title: /den dødes opplysninger/i,
    tab: "Personalia",
  },
  {
    linkName: "Sjekk dødsboet",
    title: /den dødes opplysninger/i,
    tab: "Dødsboet",
  },
  {
    linkName: "Sjekk arvinger",
    title: /den dødes opplysninger/i,
    tab: "Arvinger",
  },
  {
    linkName: "Sjekk ektepakter",
    title: /den dødes opplysninger/i,
    tab: "Ektepakt",
  },
  {
    linkName: "Sjekk testamentopplysninger",
    title: /den dødes opplysninger/i,
    tab: "Testament",
  },
  {
    linkName: "Sjekk skatteopplysninger",
    title: /Formue og gjeld/i,
    tab: "Skatt",
  },
  { linkName: "Sjekk eiendommer", title: /Formue og gjeld/i, tab: "Eiendom" },
  { linkName: "Sjekk kjøretøy", title: /Formue og gjeld/i, tab: "Kjøretøy" },
  { linkName: "Sjekk bank", title: /Formue og gjeld/i, tab: "Bank" },
  {
    linkName: "Sjekk livs- og pensjonforsikring",
    title: /Formue og gjeld/i,
    tab: "Forsikring",
  },
];

/**
 * A point in the checklist. The heading of a point is the button that expands
 * and collapses its explanation.
 */
const checklistPoint = (page: Page, title: string) =>
  page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: title, exact: true }) });

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto(baseURL || "/");
  await page.getByRole("button", { name: "Bruk din egen sjekkliste" }).click();
});

test("has title", async ({ page }) => {
  await expect(page).toHaveTitle(/Sjekkliste - Digitalt Dødsbo/);
});

test("has heading with the purpose of the checklist", async ({ page }) => {
  const heading = page.getByRole("heading", {
    name: "Sjekk at du har informasjonen du trenger",
    level: 1,
  });
  await expect(heading).toBeVisible();
});

test("lists every point to check", async ({ page }) => {
  for (const point of points) {
    await expect(checklistPoint(page, point)).toBeVisible();
  }
});

test("every point can be marked as done", async ({ page }) => {
  for (const point of points) {
    await expect(checklistPoint(page, point).getByRole("checkbox")).toHaveCount(
      1
    );
  }
});

test("a point that is marked as done stays marked", async ({ page }) => {
  // "Proklama" is only used by this test, so marking it does not interfere
  // with the other tests running in parallel.
  const proklama = checklistPoint(page, "Proklama").getByRole("checkbox");

  // The marks are stored per heir, so start from a known state.
  await proklama.uncheck();
  await proklama.check();
  await expect(proklama).toBeChecked();

  await page.reload();

  const proklamaAfterReload = checklistPoint(page, "Proklama").getByRole(
    "checkbox"
  );
  await expect(proklamaAfterReload).toBeChecked();

  // Leave the checklist as it was found.
  await proklamaAfterReload.uncheck();
  await expect(proklamaAfterReload).not.toBeChecked();
});

for (const point of pointLinks) {
  test(`"${point.linkName}" opens the ${point.tab} tab`, async ({ page }) => {
    await page.getByRole("link", { name: point.linkName, exact: true }).click();

    await expect(page).toHaveTitle(point.title);
    await expect(
      page.getByRole("tab", { name: point.tab, exact: true })
    ).toHaveAttribute("aria-selected", "true");
  });
}

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
