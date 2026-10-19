import { test, expect } from "@playwright/test";
import { logInToAltinn } from "../altinn";
import {
  heirAnnotation,
  heirTitle,
  languageHeirs,
  languageName,
} from "../heirs";
import { escapeRegExp, texts } from "../texts";

/**
 * Digitalt dødsbo writes its correspondence in the language each heir has
 * chosen in Altinn Profile: nynorsk when it is nynorsk, and bokmål otherwise.
 * Heir 1 has bokmål and heir 5 nynorsk.
 *
 * The message that gives an heir access to the estate is sent again when the
 * estate is reset every night, and becomes visible between 07:00 and 09:00
 * Oslo time, so the newest one may be from the night before.
 */

/** The heirs log in to the inbox here, without the saved sessions. */
test.use({ storageState: { cookies: [], origins: [] } });

for (const heir of languageHeirs) {
  const t = texts[heir.language].correspondence;

  test(
    `${heirTitle(heir)} gets the access message in ${languageName(
      heir.language
    )}`,
    { annotation: heirAnnotation(heir) },
    async ({ page }) => {
      const ssn = process.env[heir.ssnVariable];
      if (!ssn) {
        throw new Error(
          `${heir.ssnVariable} environment variable is not defined`
        );
      }
      const deceasedName = process.env.DECEASED_NAME;
      if (!deceasedName) {
        throw new Error("DECEASED_NAME environment variable is not defined");
      }

      await logInToAltinn(page, ssn);

      // The newest access message, in either language: the bokmål title says
      // "dødsbo", the nynorsk one "dødsbu". Had the language lookup failed,
      // the message would have been sent in bokmål.
      const message = page
        .getByRole("link", {
          name: /Tilgang til Digitalt dødsb[ou] \(arving etter /,
        })
        .first();
      await expect(message).toHaveAccessibleName(
        new RegExp(
          `${escapeRegExp(t.accessTitle)} \\(arving etter [^)]*${escapeRegExp(
            deceasedName
          )}`
        ),
        { timeout: 30_000 }
      );

      await message.click();
      await expect(
        page.getByText(new RegExp(`^${escapeRegExp(t.accessBody)}`))
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("link", { name: t.openApp })).toBeVisible();

      // The link to the app is not also there in the other language.
      const other = texts[heir.language === "nb" ? "nn" : "nb"].correspondence;
      await expect(page.getByRole("link", { name: other.openApp })).toHaveCount(
        0
      );
    }
  );
}
