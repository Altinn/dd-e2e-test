import { test, expect, type Page } from "@playwright/test";
import { heirName, heirs, languageHeirs, languageName } from "../../heirs";
import { containing, texts } from "../../texts";

/** Opens the deceased's information from the front page. */
const openDeceasedInformation = async (page: Page, button: string) => {
  await page.getByRole("button", { name: button }).click();
};

for (const heir of languageHeirs) {
  const t = texts[heir.language].deceasedInformation;

  test.describe(languageName(heir.language), () => {
    test.use({ storageState: heir.storageState });

    test.beforeEach(async ({ page, baseURL }) => {
      await page.goto(baseURL || "/");
      await openDeceasedInformation(page, t.button);
    });

    test("has title", async ({ page }) => {
      await expect(page).toHaveTitle(containing(t.pageTitle));
    });

    test("personalia tab includes the deceased's name", async ({ page }) => {
      const deceasedName = process.env.DECEASED_NAME;
      if (!deceasedName) {
        throw new Error("DECEASED_NAME environment variable is not defined");
      }

      await page.getByRole("tab", { name: t.personalia }).click();
      const personalInfoTable = page.getByRole("table");
      await expect(personalInfoTable).toContainText(deceasedName.trim());
      await expect(personalInfoTable).toContainText(t.dateOfDeath);
    });

    test("heirs tab includes every heir", async ({ page }) => {
      await page.getByRole("tab", { name: t.heirs }).click();
      const heirsTable = page.getByRole("table");
      for (const other of Object.values(heirs)) {
        await expect(heirsTable).toContainText(heirName(other));
      }
    });

    test("testament tab contains text", async ({ page }) => {
      await page.getByRole("tab", { name: t.testament }).click();
      const testamentContent = page.getByRole("document");
      await expect(testamentContent).toContainText(t.testamentText);
    });

    test("ektepakt tab contains text", async ({ page }) => {
      await page.getByRole("tab", { name: t.marriagePact }).click();
      const ektepaktContent = page.getByRole("document");
      await expect(ektepaktContent).toContainText(t.marriagePactText);
    });
  });
}

// The dates do not depend on the language, so they are checked in bokmål.
const nb = texts.nb.deceasedInformation;

test("deceased's date of death is independent of the client timezone", async ({
  browser,
  page,
  baseURL,
}) => {
  const storageState = await page.context().storageState();
  const dateRowsByTimezone: Record<string, string> = {};

  for (const timezoneId of ["Europe/Oslo", "Pacific/Honolulu"]) {
    const context = await browser.newContext({ storageState, timezoneId });
    try {
      const timezonePage = await context.newPage();
      await timezonePage.goto(baseURL || "/");
      await openDeceasedInformation(timezonePage, nb.button);
      await timezonePage.getByRole("tab", { name: nb.personalia }).click();

      const dateRow = timezonePage
        .getByRole("table")
        .getByRole("row")
        .filter({ hasText: "Dødsdato" });
      await expect(dateRow).toHaveCount(1);
      const rowText = (await dateRow.textContent())?.trim();
      expect(rowText).toMatch(/Dødsdato.+\d{4}/);
      dateRowsByTimezone[timezoneId] = rowText!;
    } finally {
      await context.close();
    }
  }

  expect(dateRowsByTimezone["Pacific/Honolulu"]).toBe(
    dateRowsByTimezone["Europe/Oslo"]
  );
});

test("heirs' dates of birth are independent of the client timezone", async ({
  browser,
  page,
  baseURL,
}) => {
  const storageState = await page.context().storageState();
  const dateRowsByTimezone: Record<string, string[]> = {};
  const datePattern = /\b\d{2}\.\d{2}\.\d{4}\b/;

  for (const timezoneId of ["Europe/Oslo", "Pacific/Honolulu"]) {
    const context = await browser.newContext({ storageState, timezoneId });
    try {
      const timezonePage = await context.newPage();
      await timezonePage.goto(baseURL || "/");
      await openDeceasedInformation(timezonePage, nb.button);
      await timezonePage.getByRole("tab", { name: nb.heirs }).click();

      const heirsTable = timezonePage.getByRole("table");
      const rows = await heirsTable.getByRole("row").allTextContents();
      const dateRows = rows.filter((row) => datePattern.test(row));

      expect(dateRows.length).toBeGreaterThan(0);
      for (const heir of Object.values(heirs)) {
        const name = heirName(heir);
        await expect(heirsTable).toContainText(name);
        expect(
          dateRows.some((row) => row.includes(name) && datePattern.test(row))
        ).toBe(true);
      }

      dateRowsByTimezone[timezoneId] = dateRows.map((row) => row.trim());
    } finally {
      await context.close();
    }
  }

  expect(dateRowsByTimezone["Pacific/Honolulu"]).toEqual(
    dateRowsByTimezone["Europe/Oslo"]
  );
});
