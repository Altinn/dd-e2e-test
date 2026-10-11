import { test, expect, type Page } from "@playwright/test";
import {
  heirAnnotation,
  heirName,
  heirs,
  heirTitle,
  type Heir,
} from "../../heirs";
import { containing, escapeRegExp, texts } from "../../texts";

/**
 * The probate forms on the "Ditt valg" tab in step 4 that are not digitalised.
 * Choosing one opens a page that explains how to submit it on paper or by
 * contacting the district court, and lets the heir save the choice so the
 * other heirs can see it. Saving is not legally binding, so these tests do it.
 *
 * Each choice is made by its own heir of the shared test estate (see
 * heirs.ts), so the saved choices do not overwrite each other:
 *
 *  - uskifte:           heir 1, the surviving spouse, as only a spouse can
 *  - bo av liten verdi: heir 3
 *  - offentlig skifte:  heir 4
 *
 * Privat skifte is digitalised, and heir 2 fills it in, in
 * private_probate.spec.ts.
 */
const choices = [
  {
    name: "Uskifte",
    heir: heirs.spouse,
    button: "Velg uskifte",
    slug: "undivided-estate",
    heading: "Uskifte",
    intro: "Uskifte er ikke digitalisert",
    steps: [
      "Last ned skjema",
      "Fyll ut og signer",
      "Send per post til tingretten",
    ],
    link: {
      name: "Melding om uskiftet bo for ektefelle (PDF)",
      href: "https://www.domstol.no/globalassets/da/skjema/arv-og-skifte/melding-om-uskiftet-bo-nb.pdf",
    },
    saved: "Du har lagret uskifte",
    chosen: "Du har valgt uskifte",
    allChoices: "Ønsker uskifte (må sendes på papir)",
  },
  {
    name: "Bo av liten verdi",
    heir: heirs.lowValueEstate,
    button: "Velg bo av liten verdi",
    slug: "low-value-estate",
    heading: "Dødsbo av liten verdi",
    intro: "Bo av liten verdi er ikke digitalisert",
    steps: [
      "Last ned skjema",
      "Fyll ut og signer",
      "Send per post til tingretten",
    ],
    link: {
      name: "Erklæring om privat oppgjør av dødsbo av liten verdi (PDF)",
      href: "https://www.domstol.no/globalassets/da/skjema/arv-og-skifte/erklaring-om-privat-oppgjor-av-dodsbo-av-liten-verdi.pdf",
    },
    saved: "Du har lagret dødsbo av liten verdi",
    chosen: "Du har valgt bo av liten verdi",
    allChoices: "Bo av liten verdi (må sendes på papir)",
  },
  {
    name: "Offentlig skifte",
    heir: heirs.publicProbate,
    button: "Velg offentlig skifte",
    slug: "public-probate",
    heading: "Offentlig skifte",
    intro: "Gi beskjed til tingretten hvis offentlig skifte er aktuelt for deg",
    steps: [
      "Finn kontaktinformasjon til tingretten som behandler dødsboet",
      "Kontakt tingretten for å avklare videre prosess",
    ],
    link: {
      name: "Finn kontaktinformasjon på domstol.no",
      href: "https://www.domstol.no/no/finn-domstol/",
    },
    saved: "Du har lagret offentlig skifte",
    chosen: "Du har valgt offentlig skifte",
    allChoices: "Ønsker offentlig skifte (må sendes på papir)",
  },
];

/** The static choice each heir switches to and back from. */
const switchTo: Record<string, string> = {
  Uskifte: "Offentlig skifte",
  "Bo av liten verdi": "Offentlig skifte",
  "Offentlig skifte": "Bo av liten verdi",
};

type Choice = (typeof choices)[number];

// The visible tab panel; all other panels are hidden.
const visiblePanel = "[role=tabpanel]:visible";

/** Opens the "Ditt valg" tab in step 4 and returns its panel. */
const openYourChoice = async (page: Page, baseURL: string | undefined) => {
  await page.goto(baseURL || "/");
  await page
    .getByRole("button", { name: "Velg skifteform for dødsboet" })
    .click();
  await page.getByRole("tab", { name: "Ditt valg", exact: true }).click();
  return page.locator(visiblePanel);
};

/**
 * Opens the page of a static choice from the "Ditt valg" tab.
 *
 * The heir may have saved a choice in an earlier run, and then the tab shows
 * that choice instead of the forms. Before anyone in the estate has started a
 * privat skifte declaration, "Velg på nytt" only shows the forms again. After
 * that, it asks to confirm, and confirming deletes the saved choice.
 */
const openChoicePage = async (
  page: Page,
  baseURL: string | undefined,
  choice: Choice
) => {
  const panel = await openYourChoice(page, baseURL);
  const chooseAgain = panel.getByRole("button", { name: /^Velg på nytt/ });
  const choiceButton = panel.getByRole("button", { name: choice.button });
  await expect(chooseAgain.or(choiceButton).first()).toBeVisible();
  if (await chooseAgain.isVisible()) {
    await chooseAgain.click();
    const confirmDelete = panel.getByRole("button", {
      name: "Ja, slett valg",
    });
    await expect(confirmDelete.or(choiceButton).first()).toBeVisible();
    if (await confirmDelete.isVisible()) {
      await confirmDelete.click();
    }
  }
  await choiceButton.click();
};

/** Saves the choice whose page is open, and waits until it is saved. */
const saveChoice = async (page: Page, choice: Choice) => {
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/subapps/invoke")
  );
  await page.getByRole("button", { name: "Lagre" }).click();
  expect((await saved).ok()).toBe(true);
  await expect(
    page.getByRole("heading", { name: choice.saved, level: 2 })
  ).toBeVisible();
};

/**
 * Checks that the heir's saved choice is the given one, both on the heir's own
 * "Ditt valg" tab and next to the heir's name on "Alles valg".
 */
const expectChosen = async (
  page: Page,
  baseURL: string | undefined,
  choice: Choice,
  heir: Heir
) => {
  const panel = await openYourChoice(page, baseURL);
  await expect(
    panel.getByRole("heading", { name: choice.chosen, level: 3 })
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: /^Velg på nytt/ })
  ).toBeEnabled();

  await page.getByRole("tab", { name: "Alles valg", exact: true }).click();
  const heirRow = page
    .locator(visiblePanel)
    .getByRole("listitem")
    .filter({ hasText: heirName(heir) });
  await expect(heirRow).toHaveCount(1);
  await expect(heirRow).toContainText(choice.allChoices);
};

for (const choice of choices) {
  test.describe(
    `${choice.name}, chosen by ${heirTitle(choice.heir)}`,
    { annotation: heirAnnotation(choice.heir) },
    () => {
      test.use({ storageState: choice.heir.storageState });
      // Choosing again can delete the saved choice, so the tests run one at a
      // time, and the tests that save run last, ending on this heir's choice.
      test.describe.configure({ mode: "serial" });

      test.beforeEach(async ({ page, baseURL }) => {
        await openChoicePage(page, baseURL, choice);
      });

      test("opens its own page", async ({ page }) => {
        await expect(page).toHaveURL(new RegExp(`/signature/${choice.slug}$`));
        await expect(page).toHaveTitle(/Velg skifteform - Digitalt Dødsbo/);
        await expect(
          page.getByRole("heading", { name: choice.heading, level: 1 })
        ).toBeVisible();
      });

      test("explains how to submit the choice", async ({ page }) => {
        await expect(
          page.getByRole("heading", { name: choice.intro, level: 2 })
        ).toBeVisible();

        const steps = page.getByRole("region", { name: "Slik går du frem" });
        await expect(steps.getByRole("listitem")).toHaveText(
          [...choice.steps, "Lagre ditt valg i Digitalt dødsbo"].map(
            (step) => new RegExp(`^${step}`)
          )
        );
        await expect(
          steps.getByRole("link", { name: choice.link.name })
        ).toHaveAttribute("href", choice.link.href);
      });

      test("avbryt returns to the ditt valg tab", async ({ page }) => {
        await page.getByRole("button", { name: "Avbryt" }).click();

        await expect(page).toHaveURL(/#your-choice$/);
        await expect(
          page.getByRole("tab", { name: "Ditt valg", exact: true })
        ).toHaveAttribute("aria-selected", "true");
      });

      test("the link at the bottom of the page returns to the ditt valg tab", async ({
        page,
      }) => {
        await page
          .getByRole("link", { name: "Tilbake til velg skifteform" })
          .click();

        await expect(page).toHaveURL(/#your-choice$/);
        await expect(
          page.getByRole("tab", { name: "Ditt valg", exact: true })
        ).toHaveAttribute("aria-selected", "true");
      });

      test("the breadcrumb leads back to step 4", async ({ page }) => {
        const breadcrumb = page
          .getByRole("navigation", { name: "Brødsmulesti" })
          .first();
        await expect(breadcrumb.getByRole("listitem").last()).toHaveText(
          choice.heading
        );

        await breadcrumb
          .getByRole("link", { name: "Velg skifteform", exact: true })
          .click();

        await expect(
          page.getByRole("heading", {
            name: "Velg skifteform for dødsboet",
            level: 1,
          })
        ).toBeVisible();
      });

      test("a saved choice is shown to the heir and the other heirs", async ({
        page,
        baseURL,
      }) => {
        await saveChoice(page, choice);

        // It cannot be saved twice.
        await expect(page.getByRole("button", { name: "Lagre" })).toHaveCount(
          0
        );
        await expect(page.getByRole("button", { name: "Avbryt" })).toHaveCount(
          0
        );

        // The choice stays saved when step 4 is opened again, and the other
        // heirs see it next to this heir's name.
        await expectChosen(page, baseURL, choice, choice.heir);
      });

      const other = choices.find((c) => c.name === switchTo[choice.name])!;
      test(`switching to ${other.name.toLowerCase()} replaces the choice, and switching back restores it`, async ({
        page,
        baseURL,
      }) => {
        // Start from this heir's own choice, saved.
        await saveChoice(page, choice);
        await expectChosen(page, baseURL, choice, choice.heir);

        // Choosing again and saving another static choice replaces it.
        await openChoicePage(page, baseURL, other);
        await saveChoice(page, other);
        await expectChosen(page, baseURL, other, choice.heir);

        // Switching back leaves the heir as the other tests expect to find it.
        await openChoicePage(page, baseURL, choice);
        await saveChoice(page, choice);
        await expectChosen(page, baseURL, choice, choice.heir);
      });
    }
  );
}

/**
 * The pages of the static choices in nynorsk, opened by heir 5. Heir 5 does
 * not save a choice, so these tests only read the pages. Heir 5 is not the
 * surviving spouse, and is not offered uskifte.
 */
const nynorsk = heirs.nynorsk;
const nn = texts.nn;
const nynorskPages = [
  {
    ...nn.staticChoice.lowValueEstate,
    choice: nn.probate.choices[2],
    slug: "low-value-estate",
    href: choices[1].link.href,
  },
  {
    ...nn.staticChoice.publicProbate,
    choice: nn.probate.choices[3],
    slug: "public-probate",
    href: choices[2].link.href,
  },
];

for (const choicePage of nynorskPages) {
  test.describe(
    `${choicePage.choice} in nynorsk, opened by ${heirTitle(nynorsk)}`,
    { annotation: heirAnnotation(nynorsk) },
    () => {
      test.use({ storageState: nynorsk.storageState });

      test.beforeEach(async ({ page, baseURL }) => {
        await page.goto(baseURL || "/");
        await page.getByRole("button", { name: nn.probate.button }).click();
        await page
          .getByRole("tab", { name: nn.probate.tabs.yourChoice.name, exact: true })
          .click();
        await page
          .locator(visiblePanel)
          .getByRole("button", { name: nn.probate.choose(choicePage.choice) })
          .click();
      });

      test("opens its own page", async ({ page }) => {
        await expect(page).toHaveURL(
          new RegExp(`/signature/${choicePage.slug}$`)
        );
        await expect(page).toHaveTitle(containing(nn.probate.pageTitle));
        await expect(
          page.getByRole("heading", { name: choicePage.heading, level: 1 })
        ).toBeVisible();
      });

      test("explains how to submit the choice", async ({ page }) => {
        await expect(
          page.getByRole("heading", { name: choicePage.intro, level: 2 })
        ).toBeVisible();

        const steps = page.getByRole("region", {
          name: nn.staticChoice.howToProceed,
        });
        await expect(steps.getByRole("listitem")).toHaveText(
          [...choicePage.steps, nn.staticChoice.saveChoiceStep].map(
            (step) => new RegExp(`^${escapeRegExp(step)}`)
          )
        );
        // The form is the same in both languages.
        await expect(
          steps.getByRole("link", { name: choicePage.link })
        ).toHaveAttribute("href", choicePage.href);
      });

      test("avbryt returns to the ditt val tab", async ({ page }) => {
        await page
          .getByRole("button", { name: nn.staticChoice.cancel })
          .click();

        await expect(page).toHaveURL(/#your-choice$/);
        await expect(
          page.getByRole("tab", {
            name: nn.probate.tabs.yourChoice.name,
            exact: true,
          })
        ).toHaveAttribute("aria-selected", "true");
      });

      test("the link at the bottom of the page returns to the ditt val tab", async ({
        page,
      }) => {
        await page
          .getByRole("link", { name: nn.staticChoice.backToProbate })
          .click();

        await expect(page).toHaveURL(/#your-choice$/);
      });

      test("the breadcrumb leads back to step 4", async ({ page }) => {
        const breadcrumb = page
          .getByRole("navigation", { name: nn.breadcrumbs })
          .first();
        await expect(breadcrumb.getByRole("listitem").last()).toHaveText(
          choicePage.heading
        );

        await breadcrumb
          .getByRole("link", { name: nn.probate.breadcrumb, exact: true })
          .click();

        await expect(
          page.getByRole("heading", { name: nn.probate.heading, level: 1 })
        ).toBeVisible();
      });
    }
  );
}
