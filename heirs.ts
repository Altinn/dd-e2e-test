/** The languages the app and its correspondence are written in. */
export type Language = "nb" | "nn";

/**
 * The five heirs of the test estate that the tests log in as, and what each
 * one is used for. They share one estate, which is reset every night at 03:00
 * Oslo time, so each probate choice is made by its own heir and the choices do
 * not overwrite each other.
 *
 * Only the SSNs come from the environment. The global setup logs each heir in
 * once, saves the session to `storageState`, and sets `nameVariable` to the
 * name the app shows in its header, so the tests and the report can name them.
 */
export type Heir = {
  /** How the report and the test titles refer to the heir. */
  label: string;
  /** The heir's relation to the deceased. */
  relation: string;
  /** What the heir is used for. */
  purpose: string;
  /**
   * The heir's language in Altinn Profile. The app and the correspondence
   * are in this language for the heir.
   */
  language: Language;
  ssnVariable: string;
  nameVariable: string;
  storageState: string;
};

export const heirs = {
  spouse: {
    label: "Heir 1",
    relation: "surviving spouse",
    purpose:
      "Logs in for every test that is not about one of the other heirs, and " +
      "chooses uskifte, which only a surviving spouse or partner can.",
    language: "nb",
    ssnVariable: "HEIR_SSN",
    nameVariable: "HEIR_NAME",
    storageState: "storageState.json",
  },
  privateProbate: {
    label: "Heir 2",
    relation: "child",
    purpose:
      "Fills in, signs and submits the privat skifte declaration, and checks " +
      "the PDF the district court receives. Signing is final, so this heir " +
      "must be unsigned when the run starts, i.e. after the nightly reset.",
    language: "nb",
    ssnVariable: "HEIR2_SSN",
    nameVariable: "HEIR2_NAME",
    storageState: "storageState.heir2.json",
  },
  lowValueEstate: {
    label: "Heir 3",
    relation: "child",
    purpose: "Chooses bo av liten verdi, which is submitted on paper.",
    language: "nb",
    ssnVariable: "HEIR3_SSN",
    nameVariable: "HEIR3_NAME",
    storageState: "storageState.heir3.json",
  },
  publicProbate: {
    label: "Heir 4",
    relation: "child",
    purpose:
      "Chooses offentlig skifte, which is requested by contacting the court.",
    language: "nb",
    ssnVariable: "HEIR4_SSN",
    nameVariable: "HEIR4_NAME",
    storageState: "storageState.heir4.json",
  },
  nynorsk: {
    label: "Heir 5",
    relation: "grandchild",
    purpose:
      "Has nynorsk as their language in Altinn Profile, and checks the app " +
      "and the correspondence in nynorsk. Does not choose a probate form.",
    language: "nn",
    ssnVariable: "HEIR5_SSN",
    nameVariable: "HEIR5_NAME",
    storageState: "storageState.heir5.json",
  },
} satisfies Record<string, Heir>;

/**
 * One heir per language, for the tests that check the app's text in each
 * language: heir 1 in bokmål and heir 5 in nynorsk.
 */
export const languageHeirs = [heirs.spouse, heirs.nynorsk];

/** "bokmål" or "nynorsk", for test titles. */
export const languageName = (language: Language) =>
  language === "nb" ? "bokmål" : "nynorsk";

/** The heir's name as the app shows it, set by the global setup. */
export const heirName = (heir: Heir) => {
  const name = process.env[heir.nameVariable]?.trim();
  if (!name) {
    throw new Error(`${heir.nameVariable} environment variable is not defined`);
  }
  return name;
};

/** "Heir 2 (child)" */
export const heirTitle = (heir: Heir) => `${heir.label} (${heir.relation})`;

/**
 * An annotation that says which heir a test logs in as and why. The plain
 * report shows it on the test, and lists every heir it finds in its summary.
 */
export const heirAnnotation = (heir: Heir) => ({
  type: "heir",
  description: `${heirTitle(heir)}, ${
    process.env[heir.nameVariable]?.trim() ?? "name unknown"
  } (${heir.ssnVariable}): ${heir.purpose}`,
});
