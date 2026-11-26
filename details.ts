import type { Locator, Page } from "@playwright/test";
import { escapeRegExp } from "./texts";

/**
 * The title of a Designsystemet Details, which opens and closes it when
 * clicked.
 *
 * Since Designsystemet 1.24 the title is a native <summary>, which Playwright
 * does not find with getByRole("button") and which has no aria-expanded.
 * Before, it was a <u-summary role="button" aria-expanded>. Matching both keeps
 * the tests working whichever version the app in TT02 runs.
 */
export const detailsSummary = (scope: Page | Locator, title: string) =>
  scope
    .locator("summary, u-summary")
    .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(title)}\\s*$`) });

/**
 * The Details a title belongs to: <details>, or <u-details> before
 * Designsystemet 1.24. Both carry an `open` attribute while open.
 */
export const detailsOf = (summary: Locator) => summary.locator("xpath=..");
