import { test, expect, type Page } from "@playwright/test";
import { heirAnnotation, heirName, heirs, heirTitle } from "../../heirs";

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

for (const choice of choices) {
  test.describe(
    `${choice.name}, chosen by ${heirTitle(choice.heir)}`,
    { annotation: heirAnnotation(choice.heir) },
    () => {
      test.use({ storageState: choice.heir.storageState });
      // Choosing again can delete the saved choice (see below), so the tests run
      // one at a time, and the test that saves the choice runs last.
      test.describe.configure({ mode: "serial" });

      test.beforeEach(async ({ page, baseURL }) => {
        const panel = await openYourChoice(page, baseURL);

        // The heir may have saved a choice in an earlier run, and then the tab
        // shows that choice instead of the forms. Before anyone in the estate
        // has started a privat skifte declaration, "Velg på nytt" only shows the
        // forms again. After that, it asks to confirm, and confirming deletes
        // the saved choice.
        const chooseAgain = panel.getByRole("button", {
          name: /^Velg på nytt/,
        });
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
        const saved = page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            response.url().includes("/subapps/invoke")
        );
        await page.getByRole("button", { name: "Lagre" }).click();
        expect((await saved).ok()).toBe(true);

        // The last step confirms the choice, and it cannot be saved twice.
        await expect(
          page.getByRole("heading", { name: choice.saved, level: 2 })
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "Lagre" })).toHaveCount(
          0
        );
        await expect(page.getByRole("button", { name: "Avbryt" })).toHaveCount(
          0
        );

        // The choice stays saved when step 4 is opened again.
        const panel = await openYourChoice(page, baseURL);
        await expect(
          panel.getByRole("heading", { name: choice.chosen, level: 3 })
        ).toBeVisible();
        await expect(
          panel.getByRole("button", { name: /^Velg på nytt/ })
        ).toBeEnabled();

        // The other heirs see the choice next to this heir's name.
        await page
          .getByRole("tab", { name: "Alles valg", exact: true })
          .click();
        const heirRow = page
          .locator(visiblePanel)
          .getByRole("listitem")
          .filter({ hasText: heirName(choice.heir) });
        await expect(heirRow).toHaveCount(1);
        await expect(heirRow).toContainText(choice.allChoices);
      });
    }
  );
}
