import { test, expect } from '@playwright/test';

test.describe('Person Details Page Interactions', () => {

    test.beforeEach(async ({ page }) => {
        // Navigate to the saved URL from global-setup
        if (process.env.BASE_URL) {
            await page.goto(process.env.BASE_URL);
        } else {
            // Fallback navigation
            await page.goto('https://tt02.altinn.no/');
            await page.getByRole('link', { name: 'Tilgang til Digitalt dødsbo' }).first().click();
            await page.getByRole('link', { name: 'Åpne Digitalt dødsbo' }).click();
        }
        await page.waitForLoadState('networkidle');

        // Navigate to "Sjekk den dødes opplysninger"
        await page.getByRole('button', { name: /Sjekk den dødes opplysninger/i }).click();
        await page.waitForLoadState('networkidle');
    });

    test('Navigation and Tab Structure', async ({ page }) => {
        // Verify that we are on the correct page
        await expect(page.getByRole('heading', { name: /Sjekk den dødes opplysninger/i }).first()).toBeVisible();

        // Verify Tabs exist
        const tabs = [
            "Personalia",
            "Dødsboet",
            "Arvinger",
            "Ektepakt",
            "Testament"
        ];

        for (const tabName of tabs) {
            await expect(page.getByRole('tab', { name: tabName })).toBeVisible();
        }
    });

    test('Accordion Interaction', async ({ page }) => {
        // Locate the specific accordion "Hva gjør jeg om dødsdatoen er feil?"
        const accordionButton = page.getByRole('button', { name: /Hva gjør jeg om dødsdatoen er feil\?/i });

        // Ensure it is visible
        await expect(accordionButton).toBeVisible();

        // Click to expand
        await accordionButton.click();

        // Verify the content inside the accordion
        // "Hvis dødsdatoen er feil må du kontakte sykehuset eller legen som registrerte dødsfallet."
        await expect(page.getByText(/Hvis dødsdatoen er feil må du kontakte sykehuset/i).first()).toBeVisible();
    });

});
