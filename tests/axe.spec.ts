import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright'; // 1

const runAxeScan = async (page: Page) => {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .disableRules(['svg-img-alt'])
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
  await expect(page).toHaveTitle(/Startside - Digitalt Dødsbo/);
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