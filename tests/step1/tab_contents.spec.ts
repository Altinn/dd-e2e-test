import { test, expect } from "@playwright/test";

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

test("heirs tab includes the logged-in heir", async ({ page }) => {
  const heirName = process.env.HEIR_NAME;
  if (!heirName) {
    throw new Error("HEIR_NAME environment variable is not defined");
  }

  await page.getByRole("tab", { name: "Arvinger" }).click();
  const heirsTable = page.getByRole("table");
  await expect(heirsTable).toContainText(heirName.trim());
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