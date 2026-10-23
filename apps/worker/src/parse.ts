import type { Furnished, Listing } from '@wr/shared';

/**
 * Parse German (and English) formatted numbers: "1.599" → 1599, "758,28" → 758.28, "1,790" → 1790, "2,0" → 2.
 * A lone separator followed by exactly three digits is treated as a thousands separator.
 */
export function parseNumber(s: string | null | undefined): number | null {
  if (!s) return null;
  let t = s.replace(/[^\d.,-]/g, '');
  if (!/\d/.test(t)) return null;
  const lastDot = t.lastIndexOf('.');
  const lastComma = t.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    t = t.split(thou).join('').replace(dec, '.');
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const parts = t.split(sep);
    const tail = parts[parts.length - 1];
    t = parts.length > 2 || tail.length === 3 ? parts.join('') : parts.join('.');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const NUM = String.raw`(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
const EUR = String.raw`(?:€|EUR|Euro)`;

function labeled(text: string, labels: string): number | null {
  // "Kaltmiete: 758,28 €" / "Kaltmiete ab 652,71€" / "863,50 € Warmmiete"
  const before = new RegExp(String.raw`(?:${labels})\s*(?:\([^)]*\))?\s*[:\s]\s*(?:ab|ca\.?|von)?\s*${NUM}\s*${EUR}`, 'i').exec(text);
  if (before) return parseNumber(before[1]);
  const after = new RegExp(String.raw`${NUM}\s*${EUR}\s*(?:${labels})`, 'i').exec(text);
  return after ? parseNumber(after[1]) : null;
}

export function firstEuroAmount(text: string): number | null {
  const m = new RegExp(String.raw`${NUM}\s*${EUR}|${EUR}\s*${NUM}`, 'i').exec(text);
  if (!m) return null;
  return parseNumber(m[1] ?? m[2]);
}

export function parseSize(text: string): number | null {
  const label = new RegExp(String.raw`(?:Wohnfläche|Fläche|Größe)\s*:?\s*(?:ca\.?)?\s*${NUM}\s*(?:m²|m2|qm)`, 'i').exec(text);
  if (label) return parseNumber(label[1]);
  const re = new RegExp(String.raw`(?<![€/\d,]|\d\.)${NUM}\s*(?:m²|m2|qm|sqm)(?!\s*Grund)`, 'gi');
  for (const m of text.matchAll(re)) {
    const n = parseNumber(m[1]);
    if (n && n >= 8 && n <= 1000) return n;
  }
  return null;
}

export function parseRooms(text: string): number | null {
  const label = /Zimmer(?:anzahl)?\s*:\s*(\d+(?:[.,]\d)?)/i.exec(text);
  if (label) return parseNumber(label[1]);
  const m = /(\d+(?:[.,]5|[.,]0)?)\s*(?:-\s*)?(?:Zimmer|Zi\.|Zi\b|Raum|Räume|Rooms?(?![a-z]))/i.exec(text);
  if (!m) return null;
  const n = parseNumber(m[1]);
  return n && n > 0 && n <= 20 ? n : null;
}

export function parsePlz(text: string): string | null {
  const m = /(?<![\d.,])(0[1-9]\d{3}|[1-9]\d{4})(?:,)?\s+[A-ZÄÖÜ]/.exec(text);
  return m ? m[1] : null;
}

export function parseGermanDate(s: string): string | null {
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(s);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  const d = new Date(Date.UTC(y, +m[2] - 1, +m[1]));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** true if `pos` matches and `neg` doesn't; false if `neg` matches; otherwise null (unknown). */
function flag(text: string, pos: RegExp, neg?: RegExp): boolean | null {
  if (neg?.test(text)) return false;
  return pos.test(text) ? true : null;
}

type Extracted = Partial<Omit<Listing, 'id' | 'source' | 'sourceId' | 'url' | 'title' | 'firstSeenAt'>>;

export interface ExtractOptions {
  /** What an unlabeled price means on this portal. */
  priceIs?: 'cold' | 'warm';
}

/** Pull every structured field we can find out of free text. Returns only known (non-null) values. */
export function extractFromText(text: string, opts: ExtractOptions = {}): Extracted {
  const t = text.replace(/\s+/g, ' ');
  const out: Extracted = {};
  const set = <K extends keyof Extracted>(k: K, v: Extracted[K] | null | undefined) => {
    if (v !== null && v !== undefined) out[k] = v;
  };

  set('coldRent', labeled(t, 'Kaltmiete|Nettokaltmiete|Grundmiete|Kalt\\b|cold rent'));
  set('warmRent', labeled(t, 'Warmmiete|Gesamtmiete|Bruttomiete|Miete inkl\\.? NK|Warm\\b|total rent'));
  set('extraCosts', labeled(t, 'Nebenkosten|Betriebskosten|NK\\b'));
  set('deposit', labeled(t, 'Kaution|Mietsicherheit|deposit'));
  if (out.coldRent == null && out.warmRent == null) {
    const p = firstEuroAmount(t);
    if (p != null && p >= 100 && p < 20000) set(opts.priceIs === 'warm' ? 'warmRent' : 'coldRent', p);
  }

  set('sizeM2', parseSize(t));
  set('rooms', parseRooms(t));
  const bedrooms = /(\d+)\s*(?:Schlafzimmer|bedrooms?)/i.exec(t);
  if (bedrooms) set('bedrooms', +bedrooms[1]);
  const baths = /(?:Badezimmer|Bäder)\s*:\s*(\d+)|(\d+)\s*(?:Badezimmer|bathrooms?)/i.exec(t);
  if (baths) set('bathrooms', +(baths[1] ?? baths[2]));
  set('plz', parsePlz(t));

  // WBS. "WBS: nicht erforderlich", "kein WBS", "WBS 140 erforderlich", "mit WBS", "WBS: ja"
  const noWbs = /(?:WBS|Wohnberechtigungsschein)\s*:?\s*(?:nicht erforderlich|nein|nicht notwendig|nicht nötig)|(?:kein|ohne)(?:en)?\s+(?:WBS|Wohnberechtigungsschein)/i;
  const yesWbs = /(?:WBS|Wohnberechtigungsschein)(?:\s*\d{2,3})?(?:\s*\([^)]*\))?\s*:?\s*(?:ja|erforderlich|notwendig|nötig|benötigt|vorausgesetzt|required|zwingend)|(?:mit|nur mit|nur für)\s+(?:WBS|Wohnberechtigungsschein)|WBS[-\s]?(?:pflichtig|Wohnung)|Wohnberechtigungsschein mit besonderem Wohnbedarf/i;
  set('wbsRequired', flag(t, yesWbs, noWbs));
  const lvl = /WBS[\s-]*(?:mit\s+)?(100|140|160|180|220)\b/i.exec(t);
  if (lvl && out.wbsRequired !== false) {
    set('wbsLevel', +lvl[1]);
    set('wbsRequired', true);
  }

  set('isSwap', flag(t, /wohnungstausch|tauschwohnung|tauschangebot|zum tausch|\btausch\b|tausche\b|swap/i, /kein(?:e)?\s+tausch|nicht\s+zum\s+tausch/i));
  set('indexOrStaffel', flag(t, /indexmiete|staffelmiete|index-?miet|staffel-?miet/i));
  set('seniorsOnly', flag(t, /seniorenwohnung|service für senioren|(?:nur )?für senioren|ab (?:55|60|65|70) jahren?|seniorenwohnen/i));

  const avail = /(?:frei ab|bezugsfrei ab|verfügbar ab|bezugsfertig ab|einzug ab|bezug ab|available from|frei zum)\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/i.exec(t);
  if (avail) set('availableFrom', parseGermanDate(avail[1]));
  else if (/(?:frei|bezugsfrei|verfügbar)\s*(?:ab\s*)?:?\s*sofort|sofort frei/i.test(t)) set('availableFrom', new Date().toISOString().slice(0, 10));

  const dateRange = /\d{1,2}\.\d{1,2}\.\d{4}\s*[-–]\s*\d{1,2}\.\d{1,2}\.\d{4}/.test(t);
  set('limitedTerm', /unbefristet/i.test(t) ? false : flag(t, /befristet|zeitlich begrenzt|zwischenmiete|für \d+ (?:monate|wochen|tage)|limited/i) ?? (dateRange ? true : null));
  set('isSublet', flag(t, /zwischenmiete|untermiete|sublet|untervermietung/i));
  const furnished: Furnished | null = /unmöbliert|unfurnished/i.test(t)
    ? 'none'
    : /teilmöbliert|teilweise möbliert|partly furnished/i.test(t)
      ? 'partly'
      : /möbliert|furnished|vollausgestattet/i.test(t) ? 'full' : null;
  set('furnished', furnished);
  set('isWgRoom', flag(t, /wg-zimmer|zimmer in (?:einer |unserer )?wg|room in (?:a )?(?:shared|flatshare)|\bwg\b.*\bzimmer frei/i));

  // Floor: "Etage: 5 von (insg. 6)", "3. OG", "Erdgeschoss", "Dachgeschoss"
  const etage = /Etage\s*:?\s*(-?\d+)(?:\s*von\s*(?:\(?\s*insg\.?\s*)?(\d+))?/i.exec(t);
  const og = /(\d+)\.\s*(?:OG|Obergeschoss|Etage|Stock)/i.exec(t);
  if (etage) {
    set('floor', +etage[1]);
    if (etage[2]) set('totalFloors', +etage[2]);
  } else if (og) set('floor', +og[1]);
  else if (/\b(?:EG|Erdgeschoss|ground floor)\b/i.test(t)) set('floor', 0);
  const geschosse = /(\d+)\s*(?:Geschosse|Etagen gesamt|floors total)/i.exec(t);
  if (geschosse) set('totalFloors', +geschosse[1]);
  if (out.floor != null && out.totalFloors == null && /Dachgeschoss|\bDG\b|Penthouse|unterm Dach/i.test(t)) set('totalFloors', out.floor);

  set('elevator', flag(t, /aufzug|fahrstuhl|\blift\b|elevator/i, /(?:kein|ohne)(?:en)?\s+(?:aufzug|fahrstuhl|lift)/i));
  set('buildingType', /altbau/i.test(t) ? 'altbau' : /neubau|erstbezug|new build/i.test(t) ? 'neubau' : null);
  const year = /Baujahr\s*:?\s*(1[6-9]\d{2}|20\d{2})/i.exec(t);
  if (year) set('yearBuilt', +year[1]);
  const energy = /Energie(?:effizienz)?klasse\s*:?\s*([A-H]\+?)(?![a-z])/i.exec(t);
  if (energy) set('energyClass', energy[1].toUpperCase());
  // Energy source first (Fernwärme, Gas, …), distribution (Zentral-/Fußbodenheizung) only as fallback.
  const heating = HEATING_PRIORITY.find((re) => re.test(t))?.exec(t);
  if (heating) set('heatingType', normalizeHeating(heating[0]));
  set('barrierFree', flag(t, /barrierefrei|rollstuhlgerecht|stufenlos|wheelchair/i, /nicht barrierefrei|kein barrierearmer|nicht rollstuhl/i));
  set('firstOccupancy', flag(t, /erstbezug|first occupancy/i));

  set('balcony', flag(t, /balkon|terrasse|loggia|dachterrasse|balcony|terrace/i, /(?:kein|ohne)(?:en)?\s+balkon/i));
  set('garden', flag(t, /\bgarten\b|gartenanteil|gartennutzung|mietergarten|garden/i, /(?:kein|ohne)(?:en)?\s+garten/i));
  set('kitchen', flag(t, /einbauküche|\bEBK\b|küche vorhanden|küchenzeile|fitted kitchen|equipped kitchen/i, /(?:keine|ohne)\s+(?:einbau)?küche|ohne EBK/i));
  set('cellar', flag(t, /\bkeller\b|kellerabteil|mieterkeller|kellerraum|abstellraum im keller|cellar|basement/i, /(?:kein|ohne)(?:en)?\s+keller/i));
  set('parking', flag(t, /stellplatz|tiefgarage|garage|parkplatz|carport|parking/i));
  set('guestWc', flag(t, /gäste-?wc|gäste-?toilette|separates wc|guest (?:wc|toilet)/i));
  set('bathtub', flag(t, /badewanne|bad mit wanne|wannenbad|bathtub/i));
  set('floorHeating', flag(t, /fußbodenheizung|underfloor heating/i));

  set('petsAllowed', flag(t, /haustiere?\s*(?:sind\s*)?(?:erlaubt|willkommen|gestattet|nach absprache|ja)|tierhaltung erlaubt|pets allowed|pet-friendly/i, /keine haustiere|haustiere?\s*(?:sind\s*)?(?:nicht|verboten|nein)|no pets/i));
  set('wgSuitable', flag(t, /wg-geeignet|wg geeignet|wg-tauglich|für wg|suitable for flatshare/i, /nicht wg-geeignet|keine wg/i));
  set('noCommission', flag(t, /provisionsfrei|ohne makler|keine (?:makler)?provision|courtagefrei|ohne provision|von privat/i, /zzgl\.? (?:provision|courtage)|käuferprovision|mieterprovision/i));

  return out;
}

const HEATING_PRIORITY = [/Fernwärme|Fernheizung/i, /Wärmepumpe/i, /Gas-?Etagenheizung|Gasheizung|Erdgas|\bGas\b/i, /Ölheizung|\bÖl\b/i, /Etagenheizung/i, /Zentralheizung/i, /Ofenheizung/i, /Nachtspeicher|Elektroheizung/i, /Fußbodenheizung/i];

function normalizeHeating(h: string): string {
  const l = h.toLowerCase();
  if (l.includes('fern')) return 'Fernwärme';
  if (l.includes('gas')) return 'Gas';
  if (l.includes('etagen')) return 'Etagenheizung';
  if (l.includes('zentral')) return 'Zentralheizung';
  if (l.includes('wärmepumpe')) return 'Wärmepumpe';
  if (l.includes('öl')) return 'Öl';
  if (l.includes('ofen')) return 'Ofenheizung';
  if (l.includes('fußboden')) return 'Fußbodenheizung';
  return 'Elektro';
}
