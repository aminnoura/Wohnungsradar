import type { City } from '@wr/geo';
import { fetchJson, fetchText } from '../http';
import { parseCards } from './cards';
import type { SourceAdapter } from './types';

const locationIds = new Map<string, string>();

/** Kleinanzeigen needs its internal location id ("l3331" for Berlin); resolve it via the suggestion endpoint. */
async function locationId(city: City): Promise<string | null> {
  if (locationIds.has(city.slug)) return locationIds.get(city.slug)!;
  const res = await fetchJson<Record<string, string>>(
    `https://www.kleinanzeigen.de/s-ort-empfehlungen.json?query=${encodeURIComponent(city.name)}`,
  );
  const hit = Object.entries(res).find(([k, v]) => k !== '_0' && v.toLowerCase() === city.name.toLowerCase()) ?? Object.entries(res).find(([k]) => k !== '_0');
  const id = hit ? hit[0].replace(/^_/, '') : null;
  if (id) locationIds.set(city.slug, id);
  return id;
}

export function parseKleinanzeigen(html: string) {
  return parseCards(html, {
    source: 'kleinanzeigen',
    base: 'https://www.kleinanzeigen.de',
    card: 'article[data-adid]',
    link: 'a[href*="/s-anzeige/"]',
    title: 'h2',
    idFromUrl: (u) => /\/(\d+)-\d+-\d+/.exec(u)?.[1] ?? null,
  }).map((l) => ({
    ...l,
    // Card text starts with "12359 Neukölln…": PLZ + district, a good address hint.
    address: /(\d{5}\s+[A-ZÄÖÜ][\wäöüß-]+(?:\s[A-ZÄÖÜ][\wäöüß-]+)?)/.exec(l.text ?? '')?.[1] ?? null,
  }));
}

export const kleinanzeigen: SourceAdapter = {
  id: 'kleinanzeigen',
  intervalMin: 5,
  extract: { priceIs: 'cold' },
  supports: () => true,
  async crawl(city) {
    const lid = await locationId(city);
    if (!lid) return [];
    const html = await fetchText(`https://www.kleinanzeigen.de/s-wohnung-mieten/${city.slug}/sortierung:neuste/c203l${lid}`);
    return parseKleinanzeigen(html);
  },
};
