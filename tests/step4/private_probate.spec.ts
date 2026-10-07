import { test, expect, type Locator, type Page } from "@playwright/test";
import { heirAnnotation, heirName, heirs, heirTitle } from "../../heirs";

/**
 * Privat skifte, the probate form on the "Ditt valg" tab in step 4 that is
 * digitalised. Choosing it opens a form in a separate app where the heir
 * answers questions about the estate, and then signs and submits a
 * declaration to the district court.
 *
 * Heir 2 of the shared test estate (see heirs.ts) does this, and only this,
 * so no other test changes what heir 2 has chosen.
 *
 * Signing cannot be undone: afterwards the heir can no longer choose a
 * probate form in Digitalt dødsbo. The form is to be checked on every run, so
 * heir 2 must be unsigned when the run starts. The estate is reset every night
 * at 03:00 Oslo time, before the scheduled run; a run that finds heir 2
 * already signed fails, since the form was then not checked. Run again after
 * resetting the estate.
 *
 * The tests run in order and are not retried: a retry would find the heir
 * signed by the attempt before it, and fail for that reason instead.
 */
const heir = heirs.privateProbate;
test.describe.configure({ mode: "serial", retries: 0 });
test.use({ storageState: heir.storageState });

/** Picks an option in one of the form's searchable dropdowns. */
const select = async (page: Page, combobox: Locator, option: string) => {
  await combobox.click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

/**
 * Chooses to enter a person's details by hand instead of looking them up by
 * national identity number, and fills in the name and date of birth.
 */
const fillInPerson = async (
  main: Locator,
  identifyQuestion: string,
  person: { firstName: string; lastName: string; born: string }
) => {
  await main
    .getByRole("radiogroup", {
      name: new RegExp(`^${escapeRegExp(identifyQuestion)}`),
    })
    .getByRole("radio", { name: "Oppgi opplysninger manuelt" })
    .check();
  await main.getByRole("textbox", { name: "Fornavn" }).fill(person.firstName);
  await main.getByRole("textbox", { name: "Etternavn" }).fill(person.lastName);
  await main.getByRole("textbox", { name: "Født" }).fill(person.born);
};

/**
 * The pages of the form before the summary. Every question is answered so
 * that the form asks for as much as possible, and where it then asks for
 * details, one entry is filled in. The summary and the signed declaration
 * must repeat each of them.
 */
const formPages: {
  title: string;
  heading: string;
  progress?: string;
  question: string;
  answer: string;
  /** An alert the answer brings up. */
  alert?: string;
  fillIn?: (main: Locator, page: Page) => Promise<void>;
  /** The details filled in, as label and value. */
  details?: [label: string, value: string][];
}[] = [
  {
    title: "Gjeldsansvar",
    heading: "Gjeldsansvar",
    question: "Påtar du deg gjeldsansvar?",
    answer: "Ja",
  },
  {
    // The deceased is registered as married, and the surviving spouse is one
    // of the heirs.
    title: "Sivilstand",
    heading: "Gi opplysninger om den dødes sivilstand",
    progress: "1/8",
    question: "Hva var den dødes faktiske sivilstand?",
    answer: "Gift",
  },
  {
    title: "Samboer",
    heading: "Gi opplysninger om samboer med arverett",
    progress: "2/8",
    question: "Etterlater den døde seg samboer med arverett?",
    answer: "Ja",
    fillIn: async (main) => {
      await fillInPerson(main, "Hvordan vil du identifisere samboeren?", {
        firstName: "Testsamboer",
        lastName: "Testesen",
        born: "01.01.1970",
      });
      await main
        .getByRole("textbox", { name: "Gateadresse" })
        .fill("Testveien 1");
      await main.getByRole("textbox", { name: "Postnr" }).fill("0150");
      // The postal town is looked up from the postcode.
      await expect(main.getByRole("textbox", { name: "Poststed" })).toHaveValue(
        "OSLO"
      );
    },
    details: [
      ["Navn", "Testsamboer Testesen"],
      ["Født", "01.01.1970"],
      ["Adresse", "Testveien 1 0150 OSLO"],
    ],
  },
  {
    // Missing heirs cannot be added in the form, only reported to the court.
    title: "Arvinger",
    heading: "Gi opplysninger om arvinger",
    progress: "3/8",
    question: "Kjenner du til flere arvinger?",
    answer: "Ja",
    alert: "Kontakt tingretten",
  },
  {
    title: "Uskifte",
    heading: "Gi opplysninger om uskifte",
    progress: "4/8",
    question: "Satt den døde i uskifte?",
    answer: "Ja",
    fillIn: async (main, page) => {
      await fillInPerson(
        main,
        "Hvordan vil du identifisere personen den døde satt i uskifte etter?",
        { firstName: "Testektefelle", lastName: "Testesen", born: "01.01.1940" }
      );
      await main.getByRole("textbox", { name: "Dødsår" }).fill("2010");
      await select(
        page,
        main.getByRole("combobox", {
          name: /^Siste registrerte bostedskommune/,
        }),
        "Oslo"
      );
    },
    details: [
      ["Navn", "Testektefelle Testesen"],
      ["Født", "01.01.1940"],
      ["Dødsår", "2010"],
      ["Siste registrerte bostedskommune", "Oslo"],
    ],
  },
  {
    title: "Ektepakt",
    heading: "Gi opplysninger om ektepakt",
    progress: "5/8",
    question: "Etterlater den døde seg andre ektepakter?",
    answer: "Ja",
    fillIn: async (main, page) => {
      await select(
        page,
        main.getByRole("combobox", { name: "Type ektepakt" }),
        "Ikke tinglyst ektepakt"
      );
      await main
        .getByRole("textbox", { name: "DD.MM.YYYY" })
        .fill("15.06.1990");
    },
    details: [
      ["Type ektepakt", "Ikke tinglyst ektepakt"],
      ["Dato på dokumentet", "15.06.1990"],
    ],
  },
  {
    title: "Testament",
    heading: "Gi opplysninger om testament",
    progress: "6/8",
    question: "Etterlater den døde seg testament?",
    answer: "Ja",
    fillIn: async (main, page) => {
      await select(
        page,
        main.getByRole("combobox", { name: "Type testament" }),
        "Testament oppbevart andre steder"
      );
      await main
        .getByRole("textbox", { name: "DD.MM.YYYY" })
        .fill("01.03.2015");
    },
    details: [
      ["Type testament", "Testament oppbevart andre steder"],
      ["Dato på dokumentet", "01.03.2015"],
    ],
  },
  {
    title: "Landbrukseiendom",
    heading: "Gi opplysninger om landbrukseiendom",
    progress: "7/8",
    question:
      "Eide den døde landbrukseiendom som ikke er registrert i Landbruksregisteret?",
    answer: "Ja",
    fillIn: async (main, page) => {
      await select(
        page,
        main.getByRole("combobox", { name: "Kommune" }),
        "Oslo"
      );
      await main.getByRole("textbox", { name: "Gårdsnr." }).fill("12");
      await main.getByRole("textbox", { name: "Bruksnr." }).fill("34");
    },
    details: [
      ["Kommune", "Oslo"],
      ["Gårdsnr.", "12"],
      ["Bruksnr.", "34"],
    ],
  },
];

const signedChoice = "Du har valgt privat skifte med gjeldsansvar";
const declarationLink = "Innsendt erklæring.pdf (last ned)";

// The visible tab panel; all other panels are hidden.
const visiblePanel = "[role=tabpanel]:visible";

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Opens the "Ditt valg" tab in step 4 and returns its panel. */
const openYourChoice = async (page: Page, baseURL: string | undefined) => {
  await page.goto(baseURL || "/");
  await page
    .getByRole("button", { name: "Velg skifteform for dødsboet" })
    .click();
  await page.getByRole("tab", { name: "Ditt valg", exact: true }).click();
  return page.locator(visiblePanel);
};

/**
 * Matches a label followed by its value, as the summary and the declaration
 * show them: with or without a colon, and with any whitespace (or none, where
 * the value is split over lines) between the words.
 */
const labelled = (label: string, value: string) => {
  const words = (text: string) =>
    text.trim().split(/\s+/).map(escapeRegExp).join("\\s*");
  return new RegExp(`${words(label)}\\s*:?\\s*${words(value)}`);
};

/** Downloads a PDF with the heir's session and returns its text. */
const downloadPdfText = async (page: Page, href: string) => {
  const response = await page.request.get(new URL(href, page.url()).href);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toBe("application/pdf");

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await response.body()),
    verbosity: 0,
  }).promise;
  let text = "";
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    for (const item of content.items) {
      if ("str" in item) text += item.str + (item.hasEOL ? "\n" : "");
    }
  }
  return text;
};

/**
 * The declaration PDF maps the lowercase "l" to a private use character
 * (U+E050) instead of "l", so the letter is missing from its text even though
 * it is drawn. The content is compared with it put back until that is fixed;
 * the test "the text of the declaration can be copied" tracks the bug.
 */
const restoreL = (text: string) => text.replace(//g, "l");

/** Asserts that the declaration contains a label and its value. */
const expectDeclarationToContain = (
  declaration: string,
  label: string,
  value = ""
) =>
  expect(
    restoreL(declaration),
    `the declaration says "${label} ${value}"`
  ).toMatch(labelled(label, value));

test.describe(
  `Privat skifte, declared by ${heirTitle(heir)}`,
  { annotation: heirAnnotation(heir) },
  () => {
    test("the heir fills in, signs and submits the declaration", async ({
      page,
      baseURL,
    }) => {
      const deceasedName = process.env.DECEASED_NAME;
      if (!deceasedName) {
        throw new Error("DECEASED_NAME environment variable is not defined");
      }

      const panel = await openYourChoice(page, baseURL);

      // The heir has either not started, has started a declaration in an earlier
      // run that did not finish, or has already signed.
      const choose = panel.getByRole("button", { name: "Velg privat skifte" });
      const continueDeclaration = panel.getByRole("button", {
        name: /^Fortsett utfylling/,
      });
      const signed = panel.getByRole("heading", { name: signedChoice });
      await expect(
        choose.or(continueDeclaration).or(signed).first()
      ).toBeVisible();

      if (await signed.isVisible()) {
        throw new Error(
          `${heirTitle(heir)}, ${heirName(heir)}, has already signed a privat ` +
            "skifte declaration in this estate, so the form could not be " +
            "checked. The estate is reset every night at 03:00 Oslo time, so " +
            "either that reset did not clear the declaration, or the tests have " +
            "already run since. Reset the estate and run the tests again."
        );
      }

      if (await continueDeclaration.isVisible()) {
        await continueDeclaration.click();
      } else {
        await choose.click();
      }

      // The form is a separate app, which can take a while to open a new form.
      const main = page.getByRole("main");
      await expect(
        main.getByRole("heading", { name: "Privat skifte av dødsbo", level: 1 })
      ).toBeVisible({ timeout: 30_000 });

      for (const formPage of formPages) {
        await expect(
          main.getByRole("heading", { name: formPage.heading, level: 2 })
        ).toBeVisible();
        await expect(page).toHaveTitle(
          new RegExp(`^${formPage.title} - Privat skifte av dødsbo`)
        );
        if (formPage.progress) {
          await expect(
            main.getByRole("img").filter({ hasText: formPage.progress })
          ).toBeVisible();
        }

        await main
          .getByRole("radiogroup", {
            name: new RegExp(`^${escapeRegExp(formPage.question)}`),
          })
          .getByRole("radio", { name: formPage.answer, exact: true })
          .check();
        if (formPage.alert) {
          await expect(
            main.getByRole("alert", { name: formPage.alert })
          ).toBeVisible();
        }
        await formPage.fillIn?.(main, page);
        await main.getByRole("button", { name: "Neste" }).click();
      }

      // The summary repeats every answer, and each one can be changed from there.
      await expect(page).toHaveTitle(/^Oppsummering - Privat skifte av dødsbo/);
      await expect(
        main.getByRole("heading", {
          name: "Erklæring om privat skifte",
          level: 2,
        })
      ).toBeVisible();
      await expect(
        main.getByRole("img").filter({ hasText: "8/8" })
      ).toBeVisible();
      await expect(main).toContainText(
        new RegExp(`Dødsboet etter\\s*${escapeRegExp(deceasedName.trim())}`)
      );
      for (const formPage of formPages) {
        await expect(main).toContainText(
          labelled(formPage.question, formPage.answer)
        );
        for (const [label, value] of formPage.details ?? []) {
          await expect(main).toContainText(labelled(label, value));
        }
      }

      // The declaration lists the same heirs and conditions as the summary.
      const heirs = await main
        .getByRole("listitem")
        .filter({ hasText: /, født \d{2}\.\d{2}\.\d{4}/ })
        .allTextContents();
      expect(heirs.length).toBeGreaterThan(0);
      const conditions = await main
        .getByRole("list")
        .filter({ hasText: "Jeg samtykker til at dødsboet kan skiftes privat" })
        .getByRole("listitem")
        .allTextContents();
      expect(conditions.length).toBeGreaterThan(0);
      await expect(main.getByRole("button", { name: "Endre" })).toHaveCount(
        formPages.length - 1
      );
      await expect(
        main.getByRole("heading", { name: "Privat skifte med gjeldsansvar" })
      ).toBeVisible();

      const submitted = page.waitForResponse(
        (response) =>
          response.request().method() === "PUT" &&
          response.url().includes("/process/next")
      );
      await main.getByRole("button", { name: "Signer og send inn" }).click();
      expect((await submitted).ok()).toBe(true);

      await expect(
        main.getByRole("heading", { name: "Kvittering", level: 1 })
      ).toBeVisible();
      await expect(
        main.getByRole("heading", { name: "Skjema er sendt inn", level: 2 })
      ).toBeVisible();
      const pdfLink = main.getByRole("link", {
        name: /Privat skifte av dødsbo.*\.pdf/,
      });
      await expect(pdfLink).toBeVisible();

      // The signed declaration is what the district court receives, so it must
      // say what the heir answered and agreed to.
      const declaration = await downloadPdfText(
        page,
        (await pdfLink.getAttribute("href"))!
      );
      const receipt = async (label: string) =>
        (await main
          .getByRole("row", { name: new RegExp(`^${label}:`) })
          .getByRole("cell")
          .nth(1)
          .textContent())!.trim();

      expectDeclarationToContain(declaration, "Erklæring om privat skifte");
      for (const label of ["Avsender", "Mottaker", "Referansenummer"]) {
        expectDeclarationToContain(declaration, label, await receipt(label));
      }
      // The declaration is stamped when it is made, a moment before the receipt,
      // so the two times can be a minute or so apart.
      const sentAt = (text: string) => {
        const [, day, month, year, hour, minute] = text.match(
          /(\d{2})\.(\d{2})\.(\d{4})\s*\/\s*(\d{2}):(\d{2})/
        )!;
        return new Date(+year, +month - 1, +day, +hour, +minute).getTime();
      };
      const declarationSentAt = restoreL(declaration).match(
        /Dato sendt:?\s*(\d{2}\.\d{2}\.\d{4}\s*\/\s*\d{2}:\d{2})/
      );
      expect(
        declarationSentAt,
        "the declaration says when it was sent"
      ).not.toBeNull();
      expect(
        Math.abs(
          sentAt(declarationSentAt![1]) - sentAt(await receipt("Dato sendt"))
        ),
        "milliseconds between the time in the declaration and on the receipt"
      ).toBeLessThanOrEqual(2 * 60_000);
      expectDeclarationToContain(
        declaration,
        "Dødsboet etter",
        deceasedName.trim()
      );
      for (const formPage of formPages) {
        expectDeclarationToContain(
          declaration,
          formPage.question,
          formPage.answer
        );
        for (const [label, value] of formPage.details ?? []) {
          expectDeclarationToContain(declaration, label, value);
        }
      }
      for (const heir of heirs) {
        expectDeclarationToContain(declaration, heir);
      }
      expectDeclarationToContain(
        declaration,
        "Betingelser ved privat skifte med gjeldsansvar"
      );
      for (const condition of conditions) {
        expectDeclarationToContain(declaration, condition);
      }
    });

    test("a signed declaration is shown to the heir and the other heirs", async ({
      page,
      baseURL,
    }) => {
      const deceasedName = process.env.DECEASED_NAME;
      if (!deceasedName) {
        throw new Error("DECEASED_NAME environment variable is not defined");
      }

      // The receipt is made after the declaration is signed, and until it is
      // ready the tab says "Vent litt mens kvitteringen lages." without a link.
      test.setTimeout(180_000);
      const panel = page.locator(visiblePanel);
      await expect(async () => {
        await openYourChoice(page, baseURL);
        await expect(
          panel.getByRole("link", { name: declarationLink })
        ).toBeVisible({ timeout: 10_000 });
      }).toPass({ timeout: 120_000 });

      await expect(
        panel.getByRole("heading", { name: signedChoice, level: 3 })
      ).toBeVisible();
      // The choice is final once the declaration is signed.
      await expect(panel).toContainText(
        "Du kan ikke lenger velge skifteform i Digitalt dødsbo."
      );
      await expect(
        panel.getByRole("button", { name: /^Velg på nytt/ })
      ).toHaveCount(0);
      const yourDeclaration = panel.getByRole("link", {
        name: declarationLink,
      });
      await expect(yourDeclaration).toBeVisible();
      const yourHref = (await yourDeclaration.getAttribute("href"))!;

      // The other heirs see the choice and the declaration next to this
      // heir's name.
      await page.getByRole("tab", { name: "Alles valg", exact: true }).click();
      const heirRow = page
        .locator(visiblePanel)
        .getByRole("listitem")
        .filter({ hasText: heirName(heir) });
      await expect(heirRow).toHaveCount(1);
      await expect(heirRow).toContainText("Privat skifte (med gjeldsansvar)");
      const othersDeclaration = heirRow.getByRole("link", {
        name: declarationLink,
      });
      await expect(othersDeclaration).toBeVisible();
      const othersHref = (await othersDeclaration.getAttribute("href"))!;

      // Both links lead to the signed declaration. The answers in it are checked
      // when it is signed, since a later run may find one signed with other
      // answers before the estate was reset.
      for (const href of [yourHref, othersHref]) {
        const declaration = await downloadPdfText(page, href);
        expectDeclarationToContain(declaration, "Erklæring om privat skifte");
        expectDeclarationToContain(
          declaration,
          "Dødsboet etter",
          deceasedName.trim()
        );
      }
    });

    test("the text of the declaration can be copied", async ({
      page,
      baseURL,
    }) => {
      // Copying, searching and screen readers use the text of the PDF, not the
      // drawn letters.
      test.fail(
        true,
        "The declaration PDF maps the lowercase l to U+E050 instead of U+006C, " +
          "so the letter is missing from its text. Remove restoreL() when fixed."
      );

      const panel = await openYourChoice(page, baseURL);
      const href = await panel
        .getByRole("link", { name: declarationLink })
        .getAttribute("href");
      const declaration = await downloadPdfText(page, href!);

      expect(declaration).toContain("Erklæring om privat skifte");
    });
  }
);
