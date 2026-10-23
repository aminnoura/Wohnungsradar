/** Berlin's 12 Bezirke and their 96 Ortsteile (official LOR/Ortsteil list). */
export const BERLIN_BEZIRKE: Record<string, string[]> = {
  'Mitte': ['Mitte', 'Moabit', 'Hansaviertel', 'Tiergarten', 'Wedding', 'Gesundbrunnen'],
  'Friedrichshain-Kreuzberg': ['Friedrichshain', 'Kreuzberg'],
  'Pankow': [
    'Prenzlauer Berg', 'Weißensee', 'Blankenburg', 'Heinersdorf', 'Karow', 'Stadtrandsiedlung Malchow', 'Pankow',
    'Blankenfelde', 'Buch', 'Französisch Buchholz', 'Niederschönhausen', 'Rosenthal', 'Wilhelmsruh',
  ],
  'Charlottenburg-Wilmersdorf': ['Charlottenburg', 'Wilmersdorf', 'Schmargendorf', 'Grunewald', 'Westend', 'Charlottenburg-Nord', 'Halensee'],
  'Spandau': ['Spandau', 'Haselhorst', 'Siemensstadt', 'Staaken', 'Gatow', 'Kladow', 'Hakenfelde', 'Falkenhagener Feld', 'Wilhelmstadt'],
  'Steglitz-Zehlendorf': ['Steglitz', 'Lichterfelde', 'Lankwitz', 'Zehlendorf', 'Dahlem', 'Nikolassee', 'Wannsee'],
  'Tempelhof-Schöneberg': ['Schöneberg', 'Friedenau', 'Tempelhof', 'Mariendorf', 'Marienfelde', 'Lichtenrade'],
  'Neukölln': ['Neukölln', 'Britz', 'Buckow', 'Rudow', 'Gropiusstadt'],
  'Treptow-Köpenick': [
    'Alt-Treptow', 'Plänterwald', 'Baumschulenweg', 'Johannisthal', 'Niederschöneweide', 'Altglienicke', 'Adlershof',
    'Bohnsdorf', 'Oberschöneweide', 'Köpenick', 'Friedrichshagen', 'Rahnsdorf', 'Grünau', 'Müggelheim', 'Schmöckwitz',
  ],
  'Marzahn-Hellersdorf': ['Marzahn', 'Biesdorf', 'Kaulsdorf', 'Mahlsdorf', 'Hellersdorf'],
  'Lichtenberg': [
    'Friedrichsfelde', 'Karlshorst', 'Lichtenberg', 'Falkenberg', 'Malchow', 'Wartenberg', 'Neu-Hohenschönhausen',
    'Alt-Hohenschönhausen', 'Fennpfuhl', 'Rummelsburg',
  ],
  'Reinickendorf': [
    'Reinickendorf', 'Tegel', 'Konradshöhe', 'Heiligensee', 'Frohnau', 'Hermsdorf', 'Waidmannslust', 'Lübars',
    'Wittenau', 'Märkisches Viertel', 'Borsigwalde',
  ],
};

export const BEZIRK_NAMES = Object.keys(BERLIN_BEZIRKE);

export const ORTSTEIL_TO_BEZIRK: Record<string, string> = Object.fromEntries(
  Object.entries(BERLIN_BEZIRKE).flatMap(([b, os]) => os.map((o) => [o, b])),
);

/** Colloquial names that appear in listings, mapped to an official Ortsteil. */
const ALIASES: Record<string, string> = {
  'prenzlberg': 'Prenzlauer Berg',
  'p-berg': 'Prenzlauer Berg',
  'hohenschönhausen': 'Alt-Hohenschönhausen',
  'schöneweide': 'Oberschöneweide',
  'treptow': 'Alt-Treptow',
  'xberg': 'Kreuzberg',
  'fhain': 'Friedrichshain',
  'nordneukölln': 'Neukölln',
  'märkisches viertel': 'Märkisches Viertel',
};

const fold = (s: string) => s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');

// Longest names first so "Charlottenburg-Nord" wins over "Charlottenburg", "Neu-Hohenschönhausen" over "Hohenschönhausen".
const ORTSTEIL_PATTERNS: [RegExp, string][] = [
  ...Object.keys(ORTSTEIL_TO_BEZIRK).map((o) => [o, o] as const),
  ...Object.entries(ALIASES),
]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([needle, o]) => [new RegExp(`(^|[^a-z])${fold(needle).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}($|[^a-z])`), o]);

/**
 * Find the Berlin Ortsteil/Bezirk mentioned in free text such as "12043 Berlin - Neukölln" or
 * "Berlin/Steglitz-Zehlendorf". Ortsteil names that equal a Bezirk name (Mitte, Pankow, …) resolve to both.
 */
export function detectBerlinArea(text: string): { bezirk: string | null; ortsteil: string | null } {
  let t = fold(text);
  // Compound Bezirk names ("Steglitz-Zehlendorf") contain Ortsteil names; consume them first so
  // "12207 Berlin/Steglitz-Zehlendorf" yields the Bezirk but no (wrong) Ortsteil.
  let bezirk: string | null = null;
  for (const b of COMPOUND_BEZIRKE) {
    const fb = fold(b);
    if (t.includes(fb)) {
      bezirk = b;
      t = t.split(fb).join(' ');
      break;
    }
  }
  for (const [re, o] of ORTSTEIL_PATTERNS) {
    if (re.test(t) && (!bezirk || ORTSTEIL_TO_BEZIRK[o] === bezirk)) return { ortsteil: o, bezirk: ORTSTEIL_TO_BEZIRK[o] };
  }
  return { bezirk, ortsteil: null };
}

const COMPOUND_BEZIRKE = BEZIRK_NAMES.filter((b) => b.includes('-'));

/** Berlin postcodes are 10115–14199. */
export const isBerlinPlz = (plz: string) => /^1[0-4]\d{3}$/.test(plz) && +plz >= 10115 && +plz <= 14199;
