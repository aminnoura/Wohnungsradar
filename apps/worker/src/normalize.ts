import { detectBerlinArea, isBerlinPlz } from '@wr/geo';
import type { Listing, RawListing } from '@wr/shared';
import { extractFromText, parsePlz } from './parse';
import type { SourceAdapter } from './sources/types';

export type ListingRow = Omit<Listing, 'id' | 'firstSeenAt' | 'alsoOn'> & { searchText: string };

const EMPTY: Omit<ListingRow, 'source' | 'sourceId' | 'url' | 'title' | 'searchText' | 'isPaywalled'> = {
  excerpt: null, imageUrl: null,
  city: null, plz: null, bezirk: null, ortsteil: null, street: null, lat: null, lng: null,
  coldRent: null, warmRent: null, extraCosts: null, deposit: null, noCommission: null,
  sizeM2: null, rooms: null, bedrooms: null, bathrooms: null,
  wbsRequired: null, wbsLevel: null, isSwap: null, indexOrStaffel: null, seniorsOnly: null,
  availableFrom: null, limitedTerm: null, isSublet: null, furnished: null, isWgRoom: null,
  floor: null, totalFloors: null, elevator: null, buildingType: null, yearBuilt: null, energyClass: null, heatingType: null,
  barrierFree: null, firstOccupancy: null,
  balcony: null, garden: null, kitchen: null, cellar: null, parking: null, guestWc: null, bathtub: null, floorHeating: null,
  petsAllowed: null, wgSuitable: null, offerer: null, postedAt: null,
};

const withoutNulls = <T extends object>(o: T | undefined) =>
  Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;

const SUFFIX = '(?:[Ss]tra(?:ß|ss)e|[Ss]tr\\.|[Ww]eg|[Aa]llee|[Pp]latz|[Dd]amm|[Rr]ing|[Uu]fer|[Cc]haussee|[Gg]asse|[Pp]romenade|[Ss]teig|[Pp]fad|[Zz]eile|[Mm]arkt|[Gg]raben|[Bb]ogen|[Kk]orso|[Hh]öfe)';
// "Frankfurter Allee 12" (two words) or "Huronseestraße 80" / "Karl-Marx-Allee 5" (one word ending in a street suffix)
const STREET_RE = new RegExp(
  `(?<![\\wäöüßÄÖÜ.-])((?:[A-ZÄÖÜ][\\wäöüß.-]+\\s(?:Straße|Strasse|Str\\.|Allee|Weg|Platz|Damm|Ring|Ufer|Chaussee|Promenade|Markt|Steig))|(?:[A-ZÄÖÜ][\\wäöüß-]*?${SUFFIX}))` +
    `\\s+(\\d+\\s?[a-zA-Z]?(?:\\s?[-/]\\s?\\d+\\s?[a-zA-Z]?)?)(?!\\d)`,
);

/** "Platz für zwei Hellersdorfer Straße 91B, 12619 Berlin" → "Hellersdorfer Straße 91B" */
export function parseStreet(address: string | null | undefined): string | null {
  const m = address ? STREET_RE.exec(address) : null;
  return m ? `${m[1]} ${m[2]}`.trim() : null;
}

function parseCity(address: string, plz: string | null, fallback: string): string {
  if (plz && isBerlinPlz(plz)) return 'Berlin';
  if (/\bBerlin\b/.test(address)) return 'Berlin';
  // "Finkenkruger Straße 90 | Falkensee" – the part after the bar is a Berlin area or another town.
  const place = /\|\s*([^|]+)$/.exec(address.split('\n')[0])?.[1]?.trim();
  if (place) return detectBerlinArea(place).bezirk ? 'Berlin' : place;
  const m = /\d{5}\s+([A-ZÄÖÜ][\wäöüß.-]+(?:\s(?:am|an der|im|in|ob der|\(\w+\))\s?[\wäöüß.()-]*)?)/.exec(address);
  return m ? m[1].replace(/[,(].*$/, '').trim() : fallback;
}

export function normalize(raw: RawListing, adapter: Pick<SourceAdapter, 'extract' | 'offerer'>, crawlCity: string, detailText?: string | null): ListingRow {
  const fullText = [raw.title, raw.address, raw.text, detailText].filter(Boolean).join(' \n ');
  const extracted = extractFromText(fullText, adapter.extract);
  const fields = { ...EMPTY, ...withoutNulls(extracted), ...(adapter.offerer ? { offerer: adapter.offerer } : {}), ...withoutNulls(raw.fields) };

  const address = raw.address ?? '';
  const plz = parsePlz(address) ?? fields.plz;
  const city = parseCity(address || raw.title, plz, crawlCity);
  let area = { bezirk: null as string | null, ortsteil: null as string | null };
  if (city === 'Berlin') {
    area = detectBerlinArea(address);
    if (!area.bezirk) area = detectBerlinArea(`${raw.title} ${raw.text ?? ''}`.slice(0, 600));
  }

  const body = (raw.text ?? '').replace(raw.title, '').trim();
  return {
    ...fields,
    source: raw.source,
    sourceId: raw.sourceId,
    url: raw.url,
    title: raw.title,
    excerpt: body ? body.slice(0, 240) : null,
    imageUrl: raw.imageUrl ?? null,
    city,
    plz: plz ?? null,
    bezirk: fields.bezirk ?? area.bezirk,
    ortsteil: fields.ortsteil ?? area.ortsteil,
    street: fields.street ?? parseStreet(address),
    lat: raw.lat ?? null,
    lng: raw.lng ?? null,
    isPaywalled: !!raw.isPaywalled,
    postedAt: raw.postedAt && !Number.isNaN(Date.parse(raw.postedAt)) ? new Date(raw.postedAt).toISOString() : null,
    searchText: fullText.toLowerCase().slice(0, 20000),
  };
}
