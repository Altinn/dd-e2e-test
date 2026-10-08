import { test, expect } from "@playwright/test";
import { heirName, heirs } from "../../heirs";

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto(baseURL || "/");
  await page
    .getByRole("button", { name: "Sjekk den dødes opplysninger" })
    .click();
});

test("has title", async ({ page }) => {
  await expect(page).toHaveTitle(/den dødes opplysninger/i);
});

test("personalia tab includes the deceased's name", async ({ page }) => {
  const deceasedName = process.env.DECEASED_NAME;
  if (!deceasedName) {
    throw new Error("DECEASED_NAME environment variable is not defined");
  }

  await page.getByRole("tab", { name: "Personalia" }).click();
  const personalInfoTable = page.getByRole("table");
  await expect(personalInfoTable).toContainText(deceasedName.trim());
});

test("heirs tab includes every heir", async ({ page }) => {
  await page.getByRole("tab", { name: "Arvinger" }).click();
  const heirsTable = page.getByRole("table");
  for (const heir of Object.values(heirs)) {
    await expect(heirsTable).toContainText(heirName(heir));
  }
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
      await timezonePage
        .getByRole("button", { name: "Sjekk den dødes opplysninger" })
        .click();
      await timezonePage.getByRole("tab", { name: "Arvinger" }).click();

      const heirsTable = timezonePage.getByRole("table");
      const rows = await heirsTable.getByRole("row").allTextContents();
      const dateRows = rows.filter((row) => datePattern.test(row));

      expect(dateRows.length).toBeGreaterThan(0);
      for (const heir of Object.values(heirs)) {
        const name = heirName(heir);
        await expect(heirsTable).toContainText(name);
        expect(
          dateRows.some((row) => row.includes(name) && datePattern.test(row)),
        ).toBe(true);
      }

      dateRowsByTimezone[timezoneId] = dateRows.map((row) => row.trim());
    } finally {
      await context.close();
    }
  }

  expect(dateRowsByTimezone["Pacific/Honolulu"]).toEqual(
    dateRowsByTimezone["Europe/Oslo"],
  );
});

test("testament tab contains text", async ({ page }) => {
  const txt = "Testament og arvepakt";
  await page.getByRole("tab", { name: "Testament" }).click();
  const testamentContent = page.getByRole("document");
  await expect(testamentContent).toContainText(txt.trim());
});

test("ektepakt tab contains text", async ({ page }) => {
  const txt = "Tinglyste ektepakter";
  await page.getByRole("tab", { name: "Ektepakt" }).click();
  const ektepaktContent = page.getByRole("document");
  await expect(ektepaktContent).toContainText(txt.trim());
});