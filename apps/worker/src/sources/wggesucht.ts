import { fetchText } from '../http';
import { parseCards } from './cards';
import type { SourceAdapter } from './types';

// Category ids in WG-Gesucht URLs: 0 = WG-Zimmer, 1 = 1-Zimmer-Wohnung, 2 = Wohnung.
const CATEGORIES = [
  { id: 2, path: 'wohnungen-in' },
  { id: 1, path: '1-zimmer-wohnungen-in' },
  { id: 0, path: 'wg-zimmer-in' },
];

export function parseWgGesucht(html: string, wgRoom = false) {
  return parseCards(html, {
    source: 'wggesucht',
    base: 'https://www.wg-gesucht.de',
    card: '.wgg-list-card.offer_list_item, .wgg_card.offer_list_item',
    title: 'h2, h3, .truncate_title',
    idFromUrl: (u) => /\.(\d+)\.html/.exec(u)?.[1] ?? null,
  }).map((l) => ({
    ...l,
    address: /·\s*([^·]+?·\s*[^·\d]+?)(?=\s+\d+\s*m²)/.exec(l.text ?? '')?.[1]?.replace(/\s*·\s*/g, ', ') ?? null,
    fields: { offerer: /\bPrivat\b/.test(l.text ?? '') ? ('private' as const) : null, ...(wgRoom ? { isWgRoom: true } : {}) },
  }));
}

export const wggesucht: SourceAdapter = {
  id: 'wggesucht',
  intervalMin: 10,
  extract: { priceIs: 'warm' },
  supports: (city) => city.wgGesuchtId != null,
  async crawl(city) {
    const name = city.name.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/\s+/g, '-');
    const out = [];
    for (const cat of CATEGORIES) {
      const html = await fetchText(`https://www.wg-gesucht.de/${cat.path}-${name}.${city.wgGesuchtId}.${cat.id}.1.0.html`);
      if (/<title>Überprüfung/.test(html)) throw new Error('WG-Gesucht captcha – backing off');
      out.push(...parseWgGesucht(html, cat.id === 0));
    }
    return out;
  },
};
