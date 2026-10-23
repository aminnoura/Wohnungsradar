// Sources reached through Brave Search: portals that block plain HTTP (Immowelt, meinestadt), sites that render
// client-side (Vonovia, Berlinovo, …), open-web discovery, and the ImmoScout "Suchen+" cross-search.
import type { City } from '@wr/geo';
import type { RawListing } from '@wr/shared';
import * as cheerio from 'cheerio';
import { braveEnabled, braveSearch, type BraveResult } from '../brave';
import { fetchText } from '../http';
import { extractFromText } from '../parse';
import { clean } from './cards';
import type { SourceAdapter } from './types';

interface SiteRule {
  source: string;
  host: RegExp;
  /** URL must look like a single listing, not a category page. */
  listing: RegExp;
  id?: (url: string) => string | null;
  /** Site blocks plain HTTP, so don't try to fetch the detail page. */
  blocked?: boolean;
  fields?: RawListing['fields'];
}

/** Known hosts: a URL found anywhere is attributed to its real portal (so it dedups with that portal's crawl). */
export const SITE_RULES: SiteRule[] = [
  { source: 'immoscout24', host: /immobilienscout24\.de$/, listing: /\/expose\/\d+/, id: (u) => /expose\/(\d+)/.exec(u)?.[1] ?? null, blocked: true },
  { source: 'kleinanzeigen', host: /kleinanzeigen\.de$/, listing: /\/s-anzeige\//, id: (u) => /\/(\d+)-\d+-\d+/.exec(u)?.[1] ?? null },
  { source: 'wggesucht', host: /wg-gesucht\.de$/, listing: /\.\d+\.html/, id: (u) => /\.(\d+)\.html/.exec(u)?.[1] ?? null },
  { source: 'ohnemakler', host: /ohne-makler\.net$/, listing: /\/immobilie\/\d+/, id: (u) => /immobilie\/(\d+)/.exec(u)?.[1] ?? null },
  { source: 'immowelt', host: /immowelt\.de$|immonet\.de$/, listing: /\/expose\/|\/classified\//, blocked: true },
  { source: 'meinestadt', host: /meinestadt\.de$/, listing: /\/immobilien\/.*\d{5,}|expose/, blocked: true },
  { source: 'vonovia', host: /vonovia\.de$/, listing: /\/zuhause-finden\/immobilien\/[^?]+/ },
  { source: 'deutschewohnen', host: /deutsche-wohnen\.com$/, listing: /expose|immobilie|wohnung\/.+/i },
  { source: 'heimstaden', host: /heimstaden\.de$/, listing: /wohnung|expose|immobilie/i },
  { source: 'covivio', host: /covivio\.immo$/, listing: /mieten\/.+|expose/i },
  { source: 'berlinovo', host: /berlinovo\.de$/, listing: /\/(?:wohnung|apartment|housing)\/.+\d/ },
  { source: 'tauschwohnung', host: /tauschwohnung\.com$/, listing: /\/\d{4,}|tausch-?angebot|wohnung\/.+/i, fields: { isSwap: true } },
  { source: 'wunderflats', host: /wunderflats\.com$/, listing: /furnished-apartment\//, id: (u) => /furnished-apartment\/[^/]+\/([a-f0-9]+)/.exec(u)?.[1] ?? null },
];

function ruleFor(url: string): SiteRule | null {
  const host = new URL(url).host.replace(/^www\./, '');
  return SITE_RULES.find((r) => r.host.test(host)) ?? null;
}

const DETAIL_FETCHES_PER_RUN = 15;

/** Pull title, image and readable text from a detail page we found via search. */
async function fetchDetail(url: string): Promise<{ text: string; imageUrl: string | null; title: string | null } | null> {
  try {
    const $ = cheerio.load(await fetchText(url, { retries: 0 }));
    const ld = $('script[type="application/ld+json"]').map((_, s) => $(s).text()).get().join(' ');
    $('script,style,noscript,svg,nav,footer,header').remove();
    const main = $('main').length ? $('main') : $('body');
    return {
      title: $('meta[property="og:title"]').attr('content') ?? ($('h1').first().text() || null),
      imageUrl: $('meta[property="og:image"]').attr('content') ?? null,
      text: clean(`${$('meta[name="description"]').attr('content') ?? ''} ${main.text()} ${ld}`).slice(0, 8000),
    };
  } catch {
    return null;
  }
}

/**
 * Turn search results into raw listings. Results must point at a single listing and mention a price or size;
 * for hosts that allow it we fetch the page for full details (bounded per run).
 */
export async function resultsToListings(results: BraveResult[], fallbackSource: string, extraFields?: RawListing['fields']): Promise<RawListing[]> {
  const out: RawListing[] = [];
  let fetches = 0;
  for (const r of results) {
    let url: URL;
    try {
      url = new URL(r.url);
    } catch {
      continue;
    }
    const rule = ruleFor(r.url);
    if (rule && !rule.listing.test(url.pathname + url.search)) continue;
    if (!rule && !/\d{4,}|expose|anzeige|wohnung-|objekt/i.test(url.pathname)) continue;
    const source = rule?.source ?? fallbackSource;
    const sourceId = rule?.id?.(r.url) ?? url.host + url.pathname;
    let text = clean(`${r.title} ${r.description ?? ''} ${(r.extra_snippets ?? []).join(' ')}`.replace(/<[^>]+>/g, ''));
    let imageUrl: string | null = null;
    let title = clean(r.title.replace(/<[^>]+>/g, ''));
    if (!rule?.blocked && fetches < DETAIL_FETCHES_PER_RUN) {
      fetches++;
      const d = await fetchDetail(r.url);
      if (d) {
        text = `${text} ${d.text}`;
        imageUrl = d.imageUrl;
        title = d.title ? clean(d.title) : title;
      }
    }
    const x = extractFromText(text);
    if (x.coldRent == null && x.warmRent == null && x.sizeM2 == null) continue;
    out.push({
      source,
      sourceId,
      url: r.url,
      title: title.slice(0, 200),
      text,
      imageUrl,
      postedAt: r.page_age ?? null,
      fields: { ...rule?.fields, ...extraFields },
    });
  }
  return out;
}

function braveSite(source: string, domain: string, opts: { query?: (c: City) => string; berlinOnly?: boolean; fields?: RawListing['fields'] } = {}): SourceAdapter {
  return {
    id: source,
    intervalMin: 6 * 60,
    supports: (city) => braveEnabled() && (!opts.berlinOnly || city.slug === 'berlin'),
    async crawl(city) {
      const q = `site:${domain} ${opts.query ? opts.query(city) : `Wohnung mieten ${city.name}`}`;
      return resultsToListings(await braveSearch(q, { freshness: 'pw' }), source, opts.fields);
    },
  };
}

export const immowelt = braveSite('immowelt', 'immowelt.de', { query: (c) => `Wohnung mieten ${c.name} expose` });
export const meinestadt = braveSite('meinestadt', 'meinestadt.de', { query: (c) => `Mietwohnung ${c.name}` });
export const vonovia = braveSite('vonovia', 'vonovia.de', { query: (c) => `zuhause finden Wohnung ${c.name}` });
export const deutschewohnen = braveSite('deutschewohnen', 'deutsche-wohnen.com', { query: (c) => `Wohnung mieten ${c.name}` });
export const heimstaden = braveSite('heimstaden', 'heimstaden.de', { query: (c) => `Wohnung ${c.name} mieten` });
export const covivio = braveSite('covivio', 'covivio.immo', { query: (c) => `Wohnung mieten ${c.name}` });
export const berlinovo = braveSite('berlinovo', 'berlinovo.de', { query: () => 'Wohnung mieten Berlin', berlinOnly: true });
export const tauschwohnung = braveSite('tauschwohnung', 'tauschwohnung.com', { query: (c) => `Wohnungstausch ${c.name}`, fields: { isSwap: true } });

export const web: SourceAdapter = {
  id: 'web',
  intervalMin: 3 * 60,
  supports: () => braveEnabled(),
  async crawl(city) {
    const q = `Wohnung ${city.name} "Kaltmiete" OR "Warmmiete" zu vermieten -site:immobilienscout24.de -site:immowelt.de`;
    return resultsToListings(await braveSearch(q, { freshness: 'pd' }), 'web');
  },
};

/**
 * Cross-search for one ImmoScout "Suchen+" listing: the same flat is often posted on Kleinanzeigen,
 * a landlord's own site or elsewhere. Matching results go through normal dedup, which links them as "also on".
 */
export async function crossSearchPaywalled(l: { street: string | null; plz: string | null; ortsteil: string | null; sizeM2: number | null; rooms: number | null }) {
  const size = l.sizeM2 ? `"${Math.round(l.sizeM2)} m²"` : '';
  const q = l.street
    ? `"${l.street.replace(/\s+\d+\w?$/, '')}" ${l.plz ?? ''} Wohnung miete -site:immobilienscout24.de`
    : `${l.ortsteil ?? ''} ${l.plz ?? ''} ${size} ${l.rooms ? `${l.rooms} Zimmer` : ''} Wohnung miete -site:immobilienscout24.de`;
  return resultsToListings(await braveSearch(q.replace(/\s+/g, ' ').trim(), { freshness: 'pw' }), 'web');
}
