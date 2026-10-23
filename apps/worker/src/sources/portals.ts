import { fetchText } from '../http';
import { parseCards } from './cards';
import { anyCity, oncePerCycle, type SourceAdapter } from './types';

export function parseOhneMakler(html: string) {
  return parseCards(html, {
    source: 'ohnemakler',
    base: 'https://www.ohne-makler.net',
    card: 'a[href^="/immobilie/"]',
    title: 'h3, h2',
    idFromUrl: (u) => /immobilie\/(\d+)/.exec(u)?.[1] ?? null,
  }).map((l) => ({
    ...l,
    address: /(\d{5}\s+[A-ZÄÖÜ][^()\d]*?(?:\([^)]+\))?)(?=\s*\d|$)/.exec(l.text ?? '')?.[1]?.trim() ?? null,
    fields: { offerer: 'private' as const, noCommission: true },
  }));
}

export const ohnemakler: SourceAdapter = {
  id: 'ohnemakler',
  intervalMin: 15,
  extract: { priceIs: 'cold' },
  supports: anyCity,
  async crawl(city) {
    return parseOhneMakler(await fetchText(`https://www.ohne-makler.net/immobilien/wohnung-mieten/${city.state}/${city.slug}/`));
  },
};

export const wunderflats: SourceAdapter = {
  id: 'wunderflats',
  intervalMin: 30,
  extract: { priceIs: 'warm' },
  supports: anyCity,
  async crawl(city) {
    const html = await fetchText(`https://wunderflats.com/en/furnished-apartments/${city.slug}`);
    return parseCards(html, {
      source: 'wunderflats',
      base: 'https://wunderflats.com',
      card: 'article.Listing',
      link: 'a[href*="/furnished-apartment/"]',
      idFromUrl: (u) => /furnished-apartment\/[^/]+\/([a-f0-9]+)/.exec(u)?.[1] ?? null,
    }).map((l) => ({
      ...l,
      url: l.url.split('?')[0],
      fields: { furnished: 'full' as const, limitedTerm: true, offerer: 'company' as const },
    }));
  },
};

export const adler: SourceAdapter = {
  id: 'adler',
  intervalMin: 30,
  extract: { priceIs: 'warm' },
  // The Adler search page lists all German units; the normalizer assigns each one's city from its address.
  supports: oncePerCycle,
  async crawl() {
    const html = await fetchText('https://www.adler-group.com/suche/wohnung');
    return parseCards(html, {
      source: 'adler',
      base: 'https://www.adler-group.com',
      card: '.single-object',
      link: 'a[href*="expose"]',
      title: 'h2, h3, .object-title',
      idFromUrl: (u) => /listing%5D=(\d+)|listing\]=(\d+)/.exec(u)?.slice(1).find(Boolean) ?? null,
    }).map((l) => ({
      ...l,
      address: /([A-ZÄÖÜ][\wäöüß.\s-]+\s[\d/]+\w?)\s+[\d,]+\s*qm\s+(\d{5}\s+[A-ZÄÖÜ][\wäöüß-]+)/.exec(l.text ?? '')?.slice(1).join(', ') ?? null,
      fields: { offerer: 'company' as const, noCommission: true },
    }));
  },
};

export const housinganywhere: SourceAdapter = {
  id: 'housinganywhere',
  intervalMin: 30,
  extract: { priceIs: 'warm' },
  supports: anyCity,
  async crawl(city) {
    const name = city.name.replace(/\s+/g, '-');
    const html = await fetchText(`https://housinganywhere.com/s/${encodeURIComponent(name)}--Germany/apartment-for-rent`);
    return parseCards(html, {
      source: 'housinganywhere',
      base: 'https://housinganywhere.com',
      card: 'a[href*="/room/"]',
      idFromUrl: (u) => /\/room\/([^/]+)/.exec(u)?.[1] ?? null,
    }).map((l) => ({
      ...l,
      title: /^(?:Tenant-verified)?\d*\s*(.+?)(?=\d\.\d\s*\(|\d+\s*m²)/.exec(l.text ?? '')?.[1] ?? l.title,
      address: /in (.+?, [A-ZÄÖÜ][\wäöüß-]+)/.exec(l.text ?? '')?.[1] ?? null,
      fields: { furnished: 'full' as const, offerer: 'company' as const },
    }));
  },
};
