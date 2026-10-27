import { test, expect, type Page } from "@playwright/test";
import { languageHeirs, languageName } from "../../heirs";
import { containing, texts } from "../../texts";

/**
 * The skiftefullmakt pages under step 5 ("Se beslutning om skifteform").
 * An heir with debt responsibility can give someone else the right to act on
 * their behalf in the estate. The pages are:
 *   decision/give-probate-proxy                   "Skiftefullmakt"
 *   decision/give-probate-proxy/give              "Gi skiftefullmakt"
 *   decision/give-probate-proxy/give/add-person   "Legg til person"
 *
 * The choice only opens when the estate goes to private probate and the
 * probate certificate (skifteattest) shows that the heir has debt
 * responsibility. The court has not decided on a probate form for the test
 * estate, so these tests check that the pages explain skiftefullmakt and do
 * not offer to give one.
 *
 * Giving a skiftefullmakt notifies the person who receives it, so the tests
 * must never complete it, even once the choice is open.
 */
const paths = {
  proxy: "decision/give-probate-proxy",
  give: "decision/give-probate-proxy/give",
  addPerson: "decision/give-probate-proxy/give/add-person",
} as const;

type ProxyPage = { path: string; heading: string };

const expectOn = async (page: Page, target: ProxyPage) => {
  await expect(
    page.getByRole("heading", { name: target.heading, level: 1 })
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/${target.path}$`));
};

// The pages are only linked from the decision page once the court has decided
// on private probate, so they are opened by their address.
const open = async (
  page: Page,
  baseURL: string | undefined,
  target: ProxyPage
) => {
  await page.goto(`${baseURL ?? ""}/${target.path}`);
  await expectOn(page, target);
};

for (const heir of languageHeirs) {
  const t = texts[heir.language];
  const pp = t.probateProxy;

  const decision = { path: "decision", heading: pp.decision.heading };
  const proxy = { path: paths.proxy, heading: pp.proxy.heading };
  const give = { path: paths.give, heading: pp.give.heading };
  const addPerson = { path: paths.addPerson, heading: pp.addPerson.heading };

  const pages = [
    {
      ...proxy,
      parent: decision,
      breadcrumb: [pp.frontPage, pp.decision.breadcrumb, pp.proxy.heading],
    },
    {
      ...give,
      parent: proxy,
      breadcrumb: [
        pp.frontPage,
        pp.decision.breadcrumb,
        pp.proxy.heading,
        pp.give.heading,
      ],
    },
    {
      ...addPerson,
      parent: give,
      breadcrumb: [
        pp.frontPage,
        pp.decision.breadcrumb,
        pp.proxy.heading,
        pp.give.heading,
        pp.addPerson.heading,
      ],
    },
  ];

  const breadcrumb = (page: Page) =>
    page.getByRole("navigation", { name: t.breadcrumbs });

  test.describe(languageName(heir.language), () => {
    test.use({ storageState: heir.storageState });

    for (const target of pages) {
      test.describe(`${target.heading} page`, () => {
        test.beforeEach(async ({ page, baseURL }) => {
          await open(page, baseURL, target);
        });

        test("the breadcrumb shows where the page is", async ({ page }) => {
          await expect(breadcrumb(page).getByRole("listitem")).toHaveText(
            target.breadcrumb
          );
        });

        test(`the previous level link leads to the ${target.parent.heading} page`, async ({
          page,
        }) => {
          await page.getByRole("link", { name: pp.previousLevel }).click();

          await expectOn(page, target.parent);
        });
      });
    }

    test.describe(`${pp.proxy.heading} page`, () => {
      test.beforeEach(async ({ page, baseURL }) => {
        await open(page, baseURL, proxy);
      });

      test("explains what a skiftefullmakt is", async ({ page }) => {
        await expect(page.getByRole("main")).toContainText(pp.proxy.about);
      });

      test("does not offer to give skiftefullmakt", async ({ page }) => {
        const main = page.getByRole("main");
        // The text is only shown to an heir who cannot give a skiftefullmakt,
        // so once it is there the page knows what the heir may do.
        await expect(main).toContainText(pp.proxy.about);

        await expect(main.getByText(pp.proxy.giveLink)).toHaveCount(0);
        await expect(
          main.getByRole("heading", { name: pp.give.heading, level: 2 })
        ).toHaveCount(0);
      });
    });

    test.describe(`${pp.give.heading} page`, () => {
      test.beforeEach(async ({ page, baseURL }) => {
        await open(page, baseURL, give);
      });

      test("advises giving skiftefullmakt to only one person", async ({
        page,
      }) => {
        await expect(page.getByRole("main")).toContainText(
          pp.give.description
        );
      });

      test("does not offer anyone to give skiftefullmakt to", async ({
        page,
      }) => {
        const main = page.getByRole("main");
        await expect(
          main.getByRole("heading", { name: pp.give.who })
        ).toHaveCount(0);
        await expect(
          main.getByRole("button", { name: pp.give.button })
        ).toHaveCount(0);
        await expect(
          main.getByRole("link", { name: pp.addPerson.heading })
        ).toHaveCount(0);
      });
    });

    test.describe(`${pp.addPerson.heading} page`, () => {
      test.beforeEach(async ({ page, baseURL }) => {
        await open(page, baseURL, addPerson);
      });

      test("explains who can be added", async ({ page }) => {
        await expect(page.getByRole("main")).toContainText(
          pp.addPerson.description
        );
      });

      test("does not show the form for looking up a person", async ({
        page,
      }) => {
        const main = page.getByRole("main");
        await expect(
          main.getByRole("textbox", { name: pp.addPerson.nin })
        ).toHaveCount(0);
        await expect(
          main.getByRole("button", { name: pp.addPerson.fetch })
        ).toHaveCount(0);
      });
    });

    // Each link in the breadcrumb leads to its own level, not only the one
    // just above the page.
    for (const ancestor of [
      { ...give, link: pp.give.heading },
      { ...proxy, link: pp.proxy.heading },
      { ...decision, link: pp.decision.breadcrumb },
    ]) {
      test(`the breadcrumb on the ${pp.addPerson.heading} page leads back to the ${ancestor.heading} page`, async ({
        page,
        baseURL,
      }) => {
        await open(page, baseURL, addPerson);

        await breadcrumb(page)
          .getByRole("link", { name: ancestor.link, exact: true })
          .click();

        await expectOn(page, ancestor);
      });
    }

    test("the breadcrumb leads back to the front page", async ({
      page,
      baseURL,
    }) => {
      await open(page, baseURL, proxy);

      await breadcrumb(page)
        .getByRole("link", { name: t.backToFrontPage })
        .click();

      await expect(page).toHaveTitle(containing(t.home.pageTitle));
    });
  });
}
