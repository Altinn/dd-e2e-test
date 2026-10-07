import { test, expect } from "@playwright/test";
import { heirName, heirs } from "../../heirs";

/**
 * Step 4 on the front page: "Velg skifteform for dødsboet".
 * The page explains the probate forms (skifteformer), shows what the other
 * heirs have chosen, and lets the heir make their own choice.
 *
 * Choosing a probate form signs and submits a declaration to the district
 * court, and it cannot be undone from the outside, so these tests stop at
 * checking that the choices are offered.
 */
const tabs = [
  {
    name: "Om skifte",
    heading: "Skifte av dødsbo er det samme som arveoppgjør",
    slug: "about",
  },
  {
    name: "Skifteformer",
    heading: "Om de ulike skifteformene",
    slug: "details",
  },
  {
    name: "Alles valg",
    heading: "Alle arvingenes valg",
    slug: "all-choices",
  },
  {
    name: "Ditt valg",
    heading: "Velg én skifteform",
    slug: "your-choice",
  },
];

/** The probate forms the page describes, in the order they are presented. */
const probateForms = [
  "Uskifte",
  "Privat skifte",
  "Dødsbo av liten verdi",
  "Offentlig skifte",
];

// The visible tab panel; all other panels are hidden.
const visiblePanel = "[role=tabpanel]:visible";

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto(baseURL || "/");
  await page
    .getByRole("button", { name: "Velg skifteform for dødsboet" })
    .click();
});

test("has title", async ({ page }) => {
  await expect(page).toHaveTitle(/Velg skifteform - Digitalt Dødsbo/);
});

test("has heading with the name of the step", async ({ page }) => {
  const heading = page.getByRole("heading", {
    name: "Velg skifteform for dødsboet",
    level: 1,
  });
  await expect(heading).toBeVisible();
});

test("has a tab for each part of the choice", async ({ page }) => {
  await expect(page.getByRole("tab")).toHaveText(tabs.map((tab) => tab.name));
});

test("the information about probate opens first", async ({ page }) => {
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

test("the skifteformer tab explains every probate form", async ({ page }) => {
  await page.getByRole("tab", { name: "Skifteformer", exact: true }).click();
  const panel = page.locator(visiblePanel);

  for (const probateForm of probateForms) {
    await expect(
      panel.getByRole("heading", { name: probateForm, exact: true })
    ).toBeVisible();
    await expect(
      panel.getByRole("heading", { name: `Hvem kan be om ${probateForm}?` })
    ).toBeVisible();
  }

  // Each probate form also states its deadline and what to be aware of.
  await expect(panel.getByRole("heading", { name: "Frist" })).toHaveCount(
    probateForms.length
  );
  await expect(
    panel.getByRole("heading", { name: "Viktig å vite" })
  ).toHaveCount(probateForms.length);
  await expect(
    panel.getByRole("link", { name: "Les mer om skifteformen på domstol.no" })
  ).toHaveCount(probateForms.length);
});

test("the alles valg tab shows every heir's choice", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Alles valg", exact: true }).click();
  const panel = page.locator(visiblePanel);

  for (const heir of Object.values(heirs)) {
    await expect(panel).toContainText(heirName(heir));
  }
  // Either the heir has not chosen yet, or the choice and the debt
  // responsibility that follows from it is shown.
  await expect(panel).toContainText(
    /Har ikke valgt skifteform|Privat skifte|Offentlig skifte|gjeldsansvar/
  );
});

test("the ditt valg tab offers the probate forms the heir can choose", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Ditt valg", exact: true }).click();
  const panel = page.locator(visiblePanel);

  // The tab renders one of three states depending on the heir this run logs
  // in as: either the probate forms are offered, the heir has already saved a
  // choice, or the heir has already started a declaration and is offered to
  // continue it or start over. Waiting for whichever arrives first keeps the
  // branches below from reading a panel that is still rendering.
  const continueDeclaration = panel.getByRole("button", {
    name: /^Fortsett utfylling/,
  });
  const savedChoice = panel.getByRole("heading", { name: /^Du har valgt / });
  const firstProbateForm = panel.getByRole("heading", {
    name: "Uskifte",
    exact: true,
  });
  await expect(
    continueDeclaration.or(savedChoice).or(firstProbateForm).first()
  ).toBeVisible();

  if (await savedChoice.isVisible()) {
    // The choices themselves are tested in static_choices.spec.ts, which
    // leaves the heir with a saved choice.
    test.info().annotations.push({
      type: "state",
      description: "the heir has already saved a choice",
    });

    await expect(
      panel.getByRole("button", { name: /^Velg på nytt/ })
    ).toBeEnabled();
    await expect(
      panel.getByRole("button", { name: "Velg privat skifte" })
    ).toHaveCount(0);
    return;
  }

  if (await continueDeclaration.isVisible()) {
    // A declaration is already in progress. The choice cannot be remade from
    // the outside without discarding it, so this only checks that both ways
    // out are offered.
    test.info().annotations.push({
      type: "state",
      description: "the heir has already started a declaration",
    });

    await expect(
      panel.getByRole("heading", { name: /^Du har startet utfylling/ })
    ).toBeVisible();
    await expect(continueDeclaration).toBeEnabled();
    await expect(
      panel.getByRole("button", { name: /^Velg på nytt/ })
    ).toBeEnabled();

    // The forms are not offered again while a declaration is in progress.
    await expect(
      panel.getByRole("button", { name: "Velg privat skifte" })
    ).toHaveCount(0);
    return;
  }

  // "Dødsbo av liten verdi" is called "Bo av liten verdi" on this tab.
  for (const probateForm of [
    "Uskifte",
    "Privat skifte",
    "Bo av liten verdi",
    "Offentlig skifte",
  ]) {
    await expect(
      panel.getByRole("heading", { name: probateForm, exact: true })
    ).toBeVisible();
  }

  // Choosing privat skifte starts signing a declaration, so these are left
  // alone here. The other choices are tested in static_choices.spec.ts.
  for (const choice of [
    "Velg uskifte",
    "Velg privat skifte",
    "Velg bo av liten verdi",
    "Velg offentlig skifte",
  ]) {
    await expect(panel.getByRole("button", { name: choice })).toBeEnabled();
  }

  // 2026-10-02: Test-heir is now the surviving spouse of the deceased, so Uskifte is offered. The test below is left commented out, because it is no longer true that Uskifte is only for the surviving spouse or partner, and the heir the tests log in as is not, so it is not offered as a choice.
  // Uskifte is only for the surviving spouse or partner, and the heir the
  // tests log in as is not, so it is not offered as a choice.
  // await expect(panel).toContainText("Bare for ektefelle/samboer");
  // await expect(panel.getByRole("button", { name: "Velg uskifte" })).toHaveCount(0);
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
