import { test, expect } from "@playwright/test";
import { heirName, heirs, languageHeirs, languageName } from "../../heirs";
import { containing, texts } from "../../texts";

/**
 * Step 4 on the front page: "Velg skifteform for dødsboet".
 * The page explains the probate forms (skifteformer), shows what the other
 * heirs have chosen, and lets the heir make their own choice.
 *
 * Choosing a probate form signs and submits a declaration to the district
 * court, and it cannot be undone from the outside, so these tests stop at
 * checking that the choices are offered.
 */
const slugs = {
  about: "about",
  details: "details",
  allChoices: "all-choices",
  yourChoice: "your-choice",
} as const;

// The visible tab panel; all other panels are hidden.
const visiblePanel = "[role=tabpanel]:visible";

for (const heir of languageHeirs) {
  const t = texts[heir.language];
  const p = t.probate;
  const tabs = (Object.keys(slugs) as (keyof typeof slugs)[]).map((key) => ({
    ...p.tabs[key],
    slug: slugs[key],
  }));

  test.describe(languageName(heir.language), () => {
    test.use({ storageState: heir.storageState });

    test.beforeEach(async ({ page, baseURL }) => {
      await page.goto(baseURL || "/");
      await page.getByRole("button", { name: p.button }).click();
    });

    test("has title", async ({ page }) => {
      await expect(page).toHaveTitle(containing(p.pageTitle));
    });

    test("has heading with the name of the step", async ({ page }) => {
      const heading = page.getByRole("heading", {
        name: p.heading,
        level: 1,
      });
      await expect(heading).toBeVisible();
    });

    test("has a tab for each part of the choice", async ({ page }) => {
      await expect(page.getByRole("tab")).toHaveText(
        tabs.map((tab) => tab.name)
      );
    });

    test("the information about probate opens first", async ({ page }) => {
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

    test("the skifteformer tab explains every probate form", async ({
      page,
    }) => {
      await page
        .getByRole("tab", { name: p.tabs.details.name, exact: true })
        .click();
      const panel = page.locator(visiblePanel);

      for (const probateForm of p.forms) {
        await expect(
          panel.getByRole("heading", { name: probateForm, exact: true })
        ).toBeVisible();
        await expect(
          panel.getByRole("heading", { name: p.whoCanAsk(probateForm) })
        ).toBeVisible();
      }

      // Each probate form also states its deadline and what to be aware of.
      await expect(
        panel.getByRole("heading", { name: p.deadline })
      ).toHaveCount(p.forms.length);
      await expect(
        panel.getByRole("heading", { name: p.importantToKnow })
      ).toHaveCount(p.forms.length);
      await expect(panel.getByRole("link", { name: p.readMore })).toHaveCount(
        p.forms.length
      );
    });

    test("the alles valg tab shows every heir's choice", async ({ page }) => {
      await page
        .getByRole("tab", { name: p.tabs.allChoices.name, exact: true })
        .click();
      const panel = page.locator(visiblePanel);

      for (const other of Object.values(heirs)) {
        await expect(panel).toContainText(heirName(other));
      }
      // Either the heir has not chosen yet, or the choice and the debt
      // responsibility that follows from it is shown.
      await expect(panel).toContainText(p.heirsChoice);
    });

    test("the ditt valg tab offers the probate forms the heir can choose", async ({
      page,
    }) => {
      await page
        .getByRole("tab", { name: p.tabs.yourChoice.name, exact: true })
        .click();
      const panel = page.locator(visiblePanel);

      // The tab renders one of three states depending on the heir this run logs
      // in as: either the probate forms are offered, the heir has already saved a
      // choice, or the heir has already started a declaration and is offered to
      // continue it or start over. Waiting for whichever arrives first keeps the
      // branches below from reading a panel that is still rendering.
      const continueDeclaration = panel.getByRole("button", {
        name: p.continueFilling,
      });
      const savedChoice = panel.getByRole("heading", { name: p.chosen });
      const firstProbateForm = panel.getByRole("heading", {
        name: p.choices[0],
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
          panel.getByRole("button", { name: p.chooseAgain })
        ).toBeEnabled();
        await expect(
          panel.getByRole("button", { name: p.choose(p.choices[1]) })
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
          panel.getByRole("heading", { name: p.started })
        ).toBeVisible();
        await expect(continueDeclaration).toBeEnabled();
        await expect(
          panel.getByRole("button", { name: p.chooseAgain })
        ).toBeEnabled();

        // The forms are not offered again while a declaration is in progress.
        await expect(
          panel.getByRole("button", { name: p.choose(p.choices[1]) })
        ).toHaveCount(0);
        return;
      }

      // "Dødsbo av liten verdi" is called "Bo av liten verdi" on this tab.
      for (const probateForm of p.choices) {
        await expect(
          panel.getByRole("heading", { name: probateForm, exact: true })
        ).toBeVisible();
      }

      // Choosing privat skifte starts signing a declaration, so these are left
      // alone here. The other choices are tested in static_choices.spec.ts.
      const [undivided, ...others] = p.choices;
      for (const choice of others) {
        await expect(
          panel.getByRole("button", { name: p.choose(choice) })
        ).toBeEnabled();
      }

      // Uskifte is only for the surviving spouse or partner.
      if (heir.relation === "surviving spouse") {
        await expect(
          panel.getByRole("button", { name: p.choose(undivided) })
        ).toBeEnabled();
      } else {
        await expect(panel).toContainText(p.spouseOnly);
        await expect(
          panel.getByRole("button", { name: p.choose(undivided) })
        ).toHaveCount(0);
      }
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
