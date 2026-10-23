// Landlords, cooperatives and municipal housing companies that publish vacancies on their own websites.
// Single-city companies set `city` explicitly so the normalizer never falls back to the crawl city.
import { fetchText } from '../http';
import { parseStreet } from '../normalize';
import { parseCards } from './cards';
import { anyCity, berlinOnly, oncePerCycle, type SourceAdapter } from './types';

const company = { offerer: 'company' as const, noCommission: true };

/**
 * Cards without a heading read "<title> <street> <no>, <PLZ> <city> …": split at the street, so the title is
 * what comes before it and the address runs from the street through the city.
 */
function splitTitleAddress(text: string | undefined, city: string, fallbackTitle: string) {
  const t = text ?? '';
  const street = parseStreet(t);
  const i = street ? t.indexOf(street) : -1;
  if (i < 0) return { title: fallbackTitle, address: null };
  const address = new RegExp(`^.*?\\d{5}\\s+${city}`).exec(t.slice(i))?.[0] ?? street;
  return { title: i > 5 ? t.slice(0, i).replace(/[\s–-]+$/, '').slice(0, 200) : fallbackTitle, address };
}

export const grandcity: SourceAdapter = {
  id: 'grandcity',
  intervalMin: 30,
  extract: { priceIs: 'cold' },
  supports: anyCity,
  async crawl(city) {
    const html = await fetchText(`https://www.grandcityproperty.de/wohnungssuche?cityText=${encodeURIComponent(city.name)}`);
    return parseCards(html, {
      source: 'grandcity',
      base: 'https://www.grandcityproperty.de',
      card: '.real-estate-item.real-estate-detail',
      link: 'a[href*="/wohnungssuche/"]',
      idFromUrl: (u) => /\/(\d{4}_\d{5}_\d{3}_\d{4})/.exec(u)?.[1] ?? null,
    })
      // Only flats (the list also has parking spaces, commercial units and storage); the page pads
      // with other cities when a city has few results.
      .filter((l) => /^Wohnung\b/.test(l.text ?? '') && new URL(l.url).pathname.split('/')[2]?.startsWith(city.slug.split('-')[0]))
      .map((l) => ({ ...l, address: /([A-ZÄÖÜ][^,]*\d+\w?,\s*[A-ZÄÖÜ][\wäöüß. ()-]+?)\s+\d[\d.]*\s*€/.exec(l.text ?? '')?.[1] ?? null, fields: { ...company, city: city.name } }));
  },
};

export const charlotte1907: SourceAdapter = {
  id: 'charlotte1907',
  intervalMin: 60,
  extract: { priceIs: 'cold' },
  supports: berlinOnly,
  async crawl() {
    // Weekly offers; each links to a PDF exposé. Most are for members only (Genossenschaftsanteile).
    const html = await fetchText('https://charlotte1907.de/wohnungsangebote/woechentliche-angebote');
    return parseCards(html, {
      source: 'charlotte1907',
      base: 'https://charlotte1907.de',
      card: '.immobilie-list',
      link: 'a[href$=".pdf"]',
      idFromUrl: (u) => /([a-f0-9]{32})\.pdf$/.exec(u)?.[1] ?? null,
    }).map((l) => ({
      ...l,
      title: /WOHNUNGS-Nr\.\s*[\d/]+\s*([A-ZÄÖÜ][\wäöüß-]+)/.exec(l.text ?? '')?.[1] ? `Genossenschaftswohnung in ${/WOHNUNGS-Nr\.\s*[\d/]+\s*([A-ZÄÖÜ][\wäöüß-]+)/.exec(l.text ?? '')![1]}` : l.title,
      address: /([A-ZÄÖÜ][^|*]*\d+\w?\s*\|\s*\d{5}\s+Berlin)/.exec(l.text ?? '')?.[1]?.replace('|', ',') ?? null,
      fields: { ...company, city: 'Berlin' },
    }));
  },
};

export const gagkoeln: SourceAdapter = {
  id: 'gagkoeln',
  intervalMin: 60,
  extract: { priceIs: 'warm' },
  supports: oncePerCycle,
  async crawl() {
    const html = await fetchText('https://www.gag-koeln.de/immobiliensuche/wohnung-mieten');
    return parseCards(html, {
      source: 'gagkoeln',
      base: 'https://www.gag-koeln.de',
      card: '.appartment',
      link: 'a[href*="/immobiliensuche/"]',
      idFromUrl: (u) => /immobiliensuche\/(\d{4}-\d{5}-\d{3}-\d{3})/.exec(u)?.[1] ?? null,
    }).map((l) => ({ ...l, ...splitTitleAddress(l.text, 'Köln', l.title), fields: { ...company, city: 'Köln' } }));
  },
};

export const swd: SourceAdapter = {
  id: 'swd',
  intervalMin: 60,
  extract: { priceIs: 'cold' },
  supports: oncePerCycle,
  async crawl() {
    const html = await fetchText('https://www.swd-duesseldorf.de/wohnungsangebot/wohnungssuche/wohnungssuche-kopie.html?flatfilter_submit=all');
    return parseCards(html, {
      source: 'swd',
      base: 'https://www.swd-duesseldorf.de/',
      card: '.layout_overview.block',
      link: 'a[href*="wohnungsdetails"]',
      title: 'h2, h3, h4',
      idFromUrl: (u) => new URL(u).searchParams.get('flat'),
    })
      .filter((l) => !/Bereits vergeben/i.test(l.text ?? ''))
      .map((l) => ({ ...l, address: /([A-ZÄÖÜ][\wäöüß.-]*(?:\s[\wäöüß.-]+)*\s\d+\w?)\s+Details/.exec(l.text ?? '')?.[1] ?? null, fields: { ...company, city: 'Düsseldorf' } }));
  },
};

export const vbw: SourceAdapter = {
  id: 'vbw',
  intervalMin: 60,
  extract: { priceIs: 'warm' },
  supports: oncePerCycle,
  async crawl() {
    const html = await fetchText('https://www.vbw-bochum.de/zuhause-finden/wohnungsangebote');
    return parseCards(html, {
      source: 'vbw',
      base: 'https://www.vbw-bochum.de',
      card: '.objectcard',
      link: 'a[href*="apartmentRent"]',
      idFromUrl: (u) => /apartmentRent%5D=(\d+)|apartmentRent\]=(\d+)/.exec(u)?.slice(1).find(Boolean) ?? null,
    }).map((l) => ({ ...l, ...splitTitleAddress(l.text, 'Bochum', l.title), fields: { ...company, city: 'Bochum' } }));
  },
};

export const wbgnuernberg: SourceAdapter = {
  id: 'wbgnuernberg',
  intervalMin: 60,
  supports: oncePerCycle,
  async crawl() {
    const html = await fetchText('https://wbg.nuernberg.de/mieten/wohnungen/wohnungssuche');
    return parseCards(html, {
      source: 'wbgnuernberg',
      base: 'https://wbg.nuernberg.de',
      card: '.openimmo-search-list-item',
      link: 'a[title="Details"]',
      idFromUrl: (u) => new URL(u).pathname.split('/').slice(-3).join('-'),
    }).map((l) => {
      const street = /Straße:\s*(.+?)\s+Nettokaltmiete/.exec(l.text ?? '')?.[1];
      const ort = /Ort:\s*(\d{5}\s+[A-ZÄÖÜ][\wäöüß-]+)/.exec(l.text ?? '')?.[1];
      return { ...l, address: street && ort ? `${street}, ${ort}` : null, fields: { ...company, city: 'Nürnberg' } };
    });
  },
};
