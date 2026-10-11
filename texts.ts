import type { Language } from "./heirs";

/**
 * The text the tests look for, in each language the app is written in. The
 * nynorsk texts are taken from the app's `resource.nn.json`; the comments name
 * the resource where a text is put together from more than one.
 */
const nb = {
  correspondence: {
    /** Correspondence_new_estate_title, up to the name of the deceased. */
    accessTitle: "Tilgang til Digitalt dødsbo",
    accessBody: "Digitalt dødsbo har samlet opplysninger",
    openApp: "Åpne Digitalt dødsbo",
  },
  home: {
    pageTitle: "Startside - Digitalt Dødsbo",
    /** TitleText, followed by the name of the deceased. */
    heading: "Digitalt dødsbo etter",
    logOut: "Logg ut",
  },
  breadcrumbs: "Brødsmulesti",
  backToFrontPage: "Tilbake til forsiden",
  deceasedInformation: {
    button: "Sjekk den dødes opplysninger",
    pageTitle: "Den dødes opplysninger - Digitalt Dødsbo",
    personalia: "Personalia",
    dateOfDeath: "Dødsdato",
    heirs: "Arvinger",
    testament: "Testament",
    testamentText: "Testament og arvepakt",
    marriagePact: "Ektepakt",
    marriagePactText: "Tinglyste ektepakter",
  },
  wealthAndDebt: {
    button: "Sett deg inn i formue og gjeld",
    pageTitle: "Formue og gjeld - Digitalt Dødsbo",
    tabs: {
      tax: {
        name: "Skatt",
        heading: "Skatteopplysninger etter den døde",
        noDataText: null,
      },
      property: {
        name: "Eiendom",
        heading: "Eiendommer tinglyst på den døde",
        noDataText: "Ingen eiendommer er funnet tinglyst på den døde.",
      },
      vehicle: {
        name: "Kjøretøy",
        heading: "Kjøretøy registrert på den døde",
        noDataText: "Ingen kjøretøy er funnet registrert på den døde.",
      },
      bank: {
        name: "Bank",
        heading: "Bankkontoer etter den døde",
        noDataText: "Kundeforhold funnet, men ingen konto. Kontakt banken.",
      },
      insurance: {
        name: "Forsikring",
        heading: "Livs- og pensjonsforsikringer etter den døde",
        noDataText:
          "Ingen livs- og personsforsikringer er funnet registrert på den døde.",
      },
    } as Record<
      "tax" | "property" | "vehicle" | "bank" | "insurance",
      { name: string; heading: string; noDataText: string | null }
    >,
    /** <Source>_error_message_no_contact */
    unavailable: /ikke tilgjengelig for øyeblikket/i,
    goToTax: "Gå til Skatteetaten",
  },
  checklist: {
    button: "Bruk din egen sjekkliste",
    pageTitle: "Sjekkliste - Digitalt Dødsbo",
    heading: "Sjekk at du har oversikt",
    points: [
      "Andre forhold",
      "Personalia",
      "Dødsboet",
      "Arvinger",
      "Ektepakt",
      "Testament",
      "Skatt",
      "Eiendom",
      "Kjøretøy",
      "Bank",
      "Forsikring",
      "Innbo og løsøre",
      "Næringsvirksomhet",
      "Digitale verdier",
      "Verdier i utlandet",
      "Proklama",
    ],
    /** The point that is marked and unmarked. */
    proklama: "Proklama",
    links: {
      personalia: "Sjekk personalia",
      estate: "Sjekk dødsboet",
      heirs: "Sjekk arvinger",
      marriagePact: "Sjekk ektepakt",
      testament: "Sjekk testament",
      tax: "Sjekk skatt",
      property: "Sjekk eiendom",
      vehicle: "Sjekk kjøretøy",
      bank: "Sjekk bank",
      pension: "Sjekk pensjon",
    },
    estateTab: "Dødsboet",
  },
  probate: {
    button: "Velg skifteform for dødsboet",
    pageTitle: "Velg skifteform - Digitalt Dødsbo",
    heading: "Velg skifteform for dødsboet",
    breadcrumb: "Velg skifteform",
    tabs: {
      about: {
        name: "Om skifte",
        heading: "Skifte av dødsbo er det samme som arveoppgjør",
      },
      details: { name: "Skifteformer", heading: "Om de ulike skifteformene" },
      allChoices: { name: "Alles valg", heading: "Alle arvingenes valg" },
      yourChoice: { name: "Ditt valg", heading: "Velg én skifteform" },
    },
    /** The probate forms the skifteformer tab describes, in order. */
    forms: [
      "Uskifte",
      "Privat skifte",
      "Dødsbo av liten verdi",
      "Offentlig skifte",
    ],
    /** Pcd_card_who_title, with the probate form. */
    whoCanAsk: (form: string) => `Hvem kan be om ${form}?`,
    deadline: "Frist",
    importantToKnow: "Viktig å vite",
    readMore: "Les mer om skifteformen på domstol.no",
    /** The heir has not chosen, or the choice and the debt responsibility. */
    heirsChoice:
      /Har ikke valgt skifteform|Privat skifte|Offentlig skifte|gjeldsansvar/,
    continueFilling: /^Fortsett utfylling/,
    chosen: /^Du har valgt /,
    chooseAgain: /^Velg på nytt/,
    started: /^Du har startet utfylling/,
    /** The probate forms the ditt valg tab offers, in order. */
    choices: [
      "Uskifte",
      "Privat skifte",
      "Bo av liten verdi",
      "Offentlig skifte",
    ],
    /** ChooseProbate_choose_button_label, with the choice in lower case. */
    choose: (choice: string) => `Velg ${choice.toLocaleLowerCase("nb")}`,
    spouseOnly: "Bare for ektefelle/samboer",
  },
  staticChoice: {
    howToProceed: "Slik går du frem",
    saveChoiceStep: "Lagre ditt valg i Digitalt dødsbo",
    cancel: "Avbryt",
    /** Navigation_back_to_parent_prefix, with the breadcrumb of step 4. */
    backToProbate: "Tilbake til velg skifteform",
    lowValueEstate: {
      heading: "Dødsbo av liten verdi",
      intro: "Bo av liten verdi er ikke digitalisert",
      steps: [
        "Last ned skjema",
        "Fyll ut og signer",
        "Send per post til tingretten",
      ],
      link: "Erklæring om privat oppgjør av dødsbo av liten verdi (PDF)",
    },
    publicProbate: {
      heading: "Offentlig skifte",
      intro:
        "Gi beskjed til tingretten hvis offentlig skifte er aktuelt for deg",
      steps: [
        "Finn kontaktinformasjon til tingretten som behandler dødsboet",
        "Kontakt tingretten for å avklare videre prosess",
      ],
      link: "Finn kontaktinformasjon på domstol.no",
    },
  },
};

export type Texts = typeof nb;

const nn: Texts = {
  correspondence: {
    accessTitle: "Tilgang til Digitalt dødsbu",
    accessBody: "Digitalt dødsbu har samla opplysningar",
    openApp: "Opne Digitalt dødsbu",
  },
  home: {
    pageTitle: "Startside - Digitalt Dødsbu",
    heading: "Digitalt dødsbu etter",
    logOut: "Logg ut",
  },
  breadcrumbs: "Brødsmulesti",
  backToFrontPage: "Tilbake til framsida",
  deceasedInformation: {
    button: "Sjekk den døde sine opplysningar",
    pageTitle: "Den døde sine opplysningar - Digitalt Dødsbu",
    personalia: "Personalia",
    dateOfDeath: "Dødsdato",
    heirs: "Arvingar",
    testament: "Testament",
    testamentText: "Testament og arvepakt",
    marriagePact: "Ektepakt",
    marriagePactText: "Tinglyste ektepakter",
  },
  wealthAndDebt: {
    button: "Set deg inn i formue og gjeld",
    pageTitle: "Formue og gjeld - Digitalt Dødsbu",
    tabs: {
      tax: {
        name: "Skatt",
        heading: "Skatteopplysningar etter den døde",
        noDataText: null,
      },
      property: {
        name: "Eigedom",
        heading: "Eigedomar tinglyste på den døde",
        noDataText: "Ingen eigedomar er funne tinglyste på den døde.",
      },
      vehicle: {
        name: "Køyretøy",
        heading: "Køyretøy registrert på den døde",
        noDataText: "Ingen køyretøy er funne registrerte på den døde.",
      },
      bank: {
        name: "Bank",
        heading: "Bankkontoar etter den døde",
        noDataText: "Kundeforhold funnet, men ingen konto. Kontakt banken.",
      },
      insurance: {
        name: "Forsikring",
        heading: "Livs- og pensjonsforsikring etter den døde",
        noDataText:
          "Ingen livs- og personforsikringar er funne registrerte på den døde.",
      },
    },
    unavailable: /ikkje tilgjengeleg for augneblinken/i,
    goToTax: "Gå til Skatteetaten",
  },
  checklist: {
    button: "Bruk di eiga sjekkliste",
    pageTitle: "Sjekkliste - Digitalt Dødsbu",
    heading: "Sjekk at du har oversikt",
    points: [
      "Andre forhold",
      "Personalia",
      "Dødsbuet",
      "Arvingar",
      "Ektepakt",
      "Testament",
      "Skatt",
      "Eigedom",
      "Køyretøy",
      "Bank",
      "Forsikring",
      "Innbo og lausøyre",
      "Næringsverksemd",
      "Digitale verdiar",
      "Verdiar i utlandet",
      "Proklama",
    ],
    proklama: "Proklama",
    links: {
      personalia: "Sjekk personalia",
      estate: "Sjekk dødsbuet",
      heirs: "Sjekk arvingar",
      marriagePact: "Sjekk ektepakt",
      testament: "Sjekk testament",
      tax: "Sjekk skatt",
      property: "Sjekk eigedom",
      vehicle: "Sjekk køyretøy",
      bank: "Sjekk bank",
      pension: "Sjekk pensjon",
    },
    estateTab: "Dødsbuet",
  },
  probate: {
    button: "Vel skifteform for dødsbuet",
    pageTitle: "Vel skifteform - Digitalt Dødsbu",
    heading: "Vel skifteform for dødsbuet",
    breadcrumb: "Vel skifteform",
    tabs: {
      about: {
        name: "Om skifte",
        heading: "Skifte av dødsbu er det same som arveoppgjer",
      },
      details: { name: "Skifteformar", heading: "Om dei ulike skifteformene" },
      allChoices: {
        name: "Alle sine val",
        heading: "Alle arvingane sine val?",
      },
      yourChoice: { name: "Ditt val", heading: "Vel éin skifteform" },
    },
    forms: [
      "Uskifte",
      "Privat skifte",
      "Dødsbu av liten verdi",
      "Offentleg skifte",
    ],
    whoCanAsk: (form: string) => `Kven kan be om ${form}?`,
    deadline: "Frist",
    importantToKnow: "Viktig å vite",
    readMore: "Les meir om skifteforma på domstol.no",
    heirsChoice:
      /Har ikkje valt skifteform|Privat skifte|Offentleg skifte|gjeldsansvar/,
    continueFilling: /^Fortset utfylling/,
    chosen: /^Du har valt /,
    chooseAgain: /^Vel på nytt/,
    started: /^Du har starta utfylling/,
    choices: [
      "Uskifte",
      "Privat skifte",
      "Bu av liten verdi",
      "Offentleg skifte",
    ],
    choose: (choice: string) => `Vel ${choice.toLocaleLowerCase("nn")}`,
    spouseOnly: "Berre for ektefelle/sambuar",
  },
  staticChoice: {
    howToProceed: "Slik går du fram",
    // Not translated in resource.nn.json.
    saveChoiceStep: "Lagre ditt valg i Digitalt dødsbo",
    cancel: "Avbryt",
    backToProbate: "Tilbake til vel skifteform",
    lowValueEstate: {
      heading: "Dødsbu av liten verdi",
      intro: "Bu av liten verdi er ikkje digitalisert",
      steps: [
        "Last ned skjema",
        "Fyll ut og signer",
        "Send per post til tingretten",
      ],
      link: "Erklæring om privat oppgjer av dødsbu av liten verdi (PDF)",
    },
    publicProbate: {
      heading: "Offentleg skifte",
      intro:
        "Gi beskjed til tingretten dersom offentleg skifte er aktuelt for deg",
      steps: [
        "Finn kontaktinformasjon til tingretten som behandlar dødsbuet",
        "Kontakt tingretten for å avklare vidare prosess",
      ],
      link: "Finn kontaktinformasjon på domstol.no",
    },
  },
};

export const texts: Record<Language, Texts> = { nb, nn };

export const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches any text that contains the given text. */
export const containing = (text: string) => new RegExp(escapeRegExp(text));
