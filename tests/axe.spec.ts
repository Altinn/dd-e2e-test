import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright'; // 1

const runAxeScan = async (page: Page, disabledRules: string[] = []) => {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .disableRules(['svg-img-alt', ...disabledRules])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
};

const runAxeScanForRules = async (page: Page, rules: string[]) => {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withRules(rules)
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
};

const clickAllButtonsInGroup = async (page: Page) => {
  const groups = page.getByRole('group');
  const groupCount = await groups.count();

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
    const buttons = groups.nth(groupIndex).getByRole('button');
    const buttonCount = await buttons.count();

    for (let buttonIndex = 0; buttonIndex < buttonCount; buttonIndex++) {
      await buttons.nth(buttonIndex).click();
    }
  }
};

const goToTab = async(page: Page, tabName: string) => {
    await page
        .getByRole("tab", { name: tabName })
        .click();
}

test.use({ screenshot: 'only-on-failure' });

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto(baseURL || "/", { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/Startside - Digitalt Dødsbo/, { timeout: 15000 });
});

test.describe('homepage', () => { // 2
  test('should not have any automatically detectable accessibility issues', async ({ page }) => {
    await clickAllButtonsInGroup(page);
    await runAxeScan(page);
  });
});

test.describe('information about the deceased page', () => { // 2
  test('should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page
        .getByRole("button", { name: "Sjekk den dødes opplysninger" })
        .click();
    await expect(page).toHaveTitle(/den dødes opplysninger/i);

    await clickAllButtonsInGroup(page);
    await runAxeScan(page);

    await goToTab(page, "Dødsboet");
    await clickAllButtonsInGroup(page);
    await runAxeScan(page);

    await goToTab(page, "Arvinger");
    await clickAllButtonsInGroup(page);
    await runAxeScan(page);

    await goToTab(page, "Ektepakt");
    await clickAllButtonsInGroup(page);
    await runAxeScan(page);

    await goToTab(page, "Testament");
    await clickAllButtonsInGroup(page);
    await runAxeScan(page);
  });
});

test.describe('wealth and debt page', () => { // 2
  test('should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page
        .getByRole("button", { name: "Sett deg inn i formue og gjeld" })
        .click();
    await expect(page).toHaveTitle(/Formue og gjeld/i);

    for (const tabName of ["Skatt", "Eiendom", "Kjøretøy", "Bank", "Forsikring"]) {
      await goToTab(page, tabName);
      await clickAllButtonsInGroup(page);
      await runAxeScan(page);
    }
  });
});

test.describe('checklist page', () => { // 2
  test.beforeEach(async ({ page }) => {
    await page
        .getByRole("button", { name: "Bruk din egen sjekkliste" })
        .click();
    await expect(page).toHaveTitle(/Sjekkliste - Digitalt Dødsbo/);
  });

  test('should not have any automatically detectable accessibility issues', async ({ page }) => {
    // The "label" rule is checked by the test below, where the missing labels
    // on the checkboxes are a known issue.
    const knownIssues = ['label'];

    // The points of the checklist are expanded when the page opens, so scan
    // first as loaded, then again after toggling every point and question.
    await runAxeScan(page, knownIssues);

    await clickAllButtonsInGroup(page);
    await runAxeScan(page, knownIssues);
  });

  test('the checkbox for marking a point as done should have an accessible name', async ({ page }) => {
    // Known issue: none of the checkboxes have a label, an aria-label or an
    // aria-labelledby, so screen reader users are not told which point they
    // are marking. Remove test.fail() when the app labels them.
    test.fail();

    await runAxeScanForRules(page, ['label']);
  });
});

test.describe('choose probate form page', () => { // 2
  test('should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page
        .getByRole("button", { name: "Velg skifteform for dødsboet" })
        .click();
    await expect(page).toHaveTitle(/Velg skifteform - Digitalt Dødsbo/);

    for (const tabName of ["Om skifte", "Skifteformer", "Alles valg", "Ditt valg"]) {
      await goToTab(page, tabName);
      await runAxeScan(page);
    }
  });
});