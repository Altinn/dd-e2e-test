import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright'; // 1

// Pin the rules to WCAG 2.0, 2.1 and 2.2 at level A and AA, instead of relying
// on whatever axe enables by default. uu-forskriften requires WCAG 2.1 AA; 2.2
// and best-practice are kept so no rule that axe ran before is dropped.
const WCAG_TAGS = [
  'wcag2a', 'wcag2aa',
  'wcag21a', 'wcag21aa',
  'wcag22aa',
  'best-practice',
];

// The viewport WCAG 1.4.10 (Reflow) uses: 1280x1024 zoomed to 400%.
const REFLOW_VIEWPORT = { width: 320, height: 256 };

// On narrow screens the tabs are replaced by an accordion where only one
// section is open at a time, with a u-details per tab.
const MOBILE_TAB_SECTION = '.tabs-navigation__details';
const CLOSED_MOBILE_TAB_SECTION = `${MOBILE_TAB_SECTION}:not([open])`;

const runAxeScan = async (page: Page) => {
  await waitForPageToSettle(page);

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    // The content of a closed mobile tab section stays laid out under the
    // open one, so axe would measure it as touch targets hidden behind it.
    .exclude(`${CLOSED_MOBILE_TAB_SECTION} > div`)
    // Known issue: the decorative icons have role="img" but no accessible
    // name, so screen readers can announce an empty image in the buttons and
    // links they sit in. Enable the rule again when they get aria-hidden:
    // https://github.com/Altinn/oed/issues/1827
    .disableRules(['svg-img-alt'])
    .analyze();

  // Axe reports what it cannot decide on its own, such as the contrast of text
  // over an image, as incomplete. Attach those for manual review rather than
  // failing on them.
  const { incomplete } = accessibilityScanResults;
  if (incomplete.length > 0) {
    test.info().annotations.push({
      type: 'axe needs review',
      description: `${page.url()}: ${incomplete.map((result) => result.id).join(', ')}`,
    });
    await test.info().attach('axe-needs-review', {
      body: JSON.stringify(incomplete, null, 2),
      contentType: 'application/json',
    });
  }

  expect(accessibilityScanResults.violations).toEqual([]);

  if (isReflowViewport(page)) {
    await expectNoHorizontalScroll(page);
  }
};

const runAxeScanForRules = async (page: Page, rules: string[]) => {
  await waitForPageToSettle(page);

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withRules(rules)
    .exclude(`${CLOSED_MOBILE_TAB_SECTION} > div`)
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
};

// Scan the loaded content, not the skeletons shown while it is fetched, and
// not a section that is still animating open or closed over its neighbours.
// Closed sections keep their skeletons, which shimmer forever, so only the
// visible skeletons and the finite animations count.
const waitForPageToSettle = async (page: Page) => {
  await expect(page.locator('.ds-skeleton').filter({ visible: true }))
    .toHaveCount(0, { timeout: 15000 });
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) =>
      animation.playState !== 'running' ||
      animation.effect?.getComputedTiming().iterations === Infinity));

  // The sections open and close inside the shadow DOM of u-details, where
  // getAnimations() does not see them, so also wait for the height to settle.
  let previousHeight = -1;
  await expect.poll(async () => {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const settled = height === previousHeight;
    previousHeight = height;
    return settled;
  }, { intervals: [200] }).toBe(true);
};

const isReflowViewport = (page: Page) =>
  page.viewportSize()?.width === REFLOW_VIEWPORT.width;

// WCAG 1.4.10: at 320 CSS pixels wide the content must fit without scrolling
// sideways. Axe does not check this.
const expectNoHorizontalScroll = async (page: Page) => {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(scrollWidth, 'the page scrolls horizontally').toBeLessThanOrEqual(clientWidth);
};

const clickAllButtonsInGroup = async (page: Page) => {
  await waitForPageToSettle(page);

  // Leave the mobile tab sections alone: opening one closes the one that
  // goToTab opened. Skip what is inside the closed sections too, as it can
  // not be seen.
  const groups = page
    .getByRole('group')
    .and(page.locator(`:not(${MOBILE_TAB_SECTION}, ${CLOSED_MOBILE_TAB_SECTION} *)`));
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
    if (isReflowViewport(page)) {
      const section = page
          .locator(MOBILE_TAB_SECTION)
          .getByRole("button", { name: tabName, exact: true });
      if (await section.getAttribute("aria-expanded") !== "true") {
        await section.click();
      }
      return;
    }

    await page
        .getByRole("tab", { name: tabName })
        .click();
}

test.use({ screenshot: 'only-on-failure' });

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto(baseURL || "/", { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/Startside - Digitalt Dødsbo/, { timeout: 15000 });
});

const definePageScans = () => {
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

      await goToTab(page, "Personalia");
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
      // The points of the checklist are expanded when the page opens, so scan
      // first as loaded, then again after toggling every point and question.
      await runAxeScan(page);

      await clickAllButtonsInGroup(page);
      await runAxeScan(page);
    });

    test('the checkbox for marking a point as done should have an accessible name', async ({ page }) => {
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

  test.describe('probate form decision page', () => { // 2
    test('should not have any automatically detectable accessibility issues', async ({ page }) => {
      await page
          .getByRole("button", { name: "Se beslutning om skifteform" })
          .click();
      // The page keeps the title of the homepage, so wait for the heading.
      await expect(page.getByRole("heading", { name: "Beslutning om skifteform", level: 1 }))
          .toBeVisible();

      await runAxeScan(page);
    });
  });
};

definePageScans();

test.describe('320px wide (reflow)', () => {
  test.use({ viewport: REFLOW_VIEWPORT });

  definePageScans();
});
