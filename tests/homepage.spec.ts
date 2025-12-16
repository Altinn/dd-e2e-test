import { test, expect } from '@playwright/test';

test.describe('Homepage Interactions', () => {

  test('debug homepage structure', async ({ page }) => {
    // Navigate to the saved URL
    if (process.env.BASE_URL) {
      console.log('Navigating to BASE_URL:', process.env.BASE_URL);
      await page.goto(process.env.BASE_URL);
    } else {
      console.warn('process.env.BASE_URL is not set, test might fail or show blank page.');
    }

    // Wait for the page to reach a stable state
    await page.waitForLoadState('networkidle');

    // Take a screenshot to verify what Playwright sees
    await page.screenshot({ path: 'debug-homepage.png', fullPage: true });

    // The failing check
    await expect(page.locator('h1').first()).toContainText('Digitalt dødsbo etter');
  });
});
