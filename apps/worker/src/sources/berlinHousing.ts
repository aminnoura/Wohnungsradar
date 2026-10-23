// The six state-owned Berlin housing companies plus their shared portal inberlinwohnen.de.
// Most listings are WBS-relevant; prices on their own sites are shown as Warm-/Gesamtmiete.
import type { RawListing } from '@wr/shared';
import { abs, fetchJson, fetchText } from '../http';
import { parseNumber } from '../parse';
import { clean, parseCards } from './cards';
import { berlinOnly, type SourceAdapter } from './types';
import * as cheerio from 'cheerio';

const company = { offerer: 'company' as const, noCommission: true };

export function parseInberlinwohnen(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  $('[id^="apartment-"]').each((_, el) => {
    const $el = $(el);
    $el.find('script,style,svg').remove();
    const id = $el.attr('id')!.replace('apartment-', '');
    const summary = clean($el.find('button[aria-label]').first().attr('aria-label')).replace(/^Wohnungsangebot - /, '');
    const text = clean($el.text());
    // The detail link points to the owning company's site.
    const href = $el.find('a[href^="http"]').filter((_, a) => !/inberlinwohnen/.test($(a).attr('href')!)).first().attr('href');
    const address = /Adresse:\s*(.+?)\s+Zimmeranzahl/.exec(text)?.[1] ?? summary.split('|')[1]?.trim() ?? null;
    const img = $el.find('img').first().attr('src');
    out.push({
      source: 'inberlinwohnen',
      sourceId: id,
      url: href ?? `https://inberlinwohnen.de/wohnungsfinder/#apartment-${id}`,
      title: clean($el.find('.list__details span').first().text()) || summary,
      text: `${summary} ${text}`,
      address,
      imageUrl: img ? abs(img, 'https://inberlinwohnen.de') : null,
      fields: company,
    });
  });
  return out;
}

export const inberlinwohnen: SourceAdapter = {
  id: 'inberlinwohnen',
  intervalMin: 3,
  extract: { priceIs: 'cold' },
  supports: berlinOnly,
  async crawl() {
    // Only the newest 10 are rendered server-side; frequent polling catches every new one.
    return parseInberlinwohnen(await fetchText('https://inberlinwohnen.de/wohnungsfinder/'));
  },
};

export const degewo: SourceAdapter = {
  id: 'degewo',
  intervalMin: 5,
  extract: { priceIs: 'warm' },
  supports: berlinOnly,
  async crawl() {
    const html = await fetchText('https://www.degewo.de/immosuche');
    // Address is "Finkenkruger Straße 90 | Falkensee" or "Märkische Allee 200 | Marzahn Mitte".
    return parseCards(html, {
      source: 'degewo',
      base: 'https://www.degewo.de',
      card: '.c-teaser--apartment',
      title: 'h3',
      address: '.c-copy > p',
      idFromUrl: (u) => new URL(u).pathname.split('/').pop() ?? null,
    }).map((l) => ({ ...l, fields: company }));
  },
};

export const gewobag: SourceAdapter = {
  id: 'gewobag',
  intervalMin: 5,
  extract: { priceIs: 'warm' },
  supports: berlinOnly,
  async crawl() {
    const html = await fetchText('https://www.gewobag.de/fuer-mietinteressentinnen/mietangebote/?objekttyp%5B%5D=wohnung');
    return parseCards(html, {
      source: 'gewobag',
      base: 'https://www.gewobag.de',
      card: 'article.angebot-big-box',
      link: 'a[href*="/mietangebote/"]',
      title: 'h3, .angebot-title',
      idFromUrl: (u) => /mietangebote\/([^/]+)\/?$/.exec(u)?.[1] ?? null,
    }).map((l) => ({ ...l, address: /Adresse\s+(.+?)\s+\d,?\d*-?Zimmer|Adresse\s+(.+?Berlin\/[\w-]+)/.exec(l.text ?? '')?.slice(1).find(Boolean) ?? null, fields: company }));
  },
};

interface HowogeItem {
  uid: number; title: string; image?: string; district?: string; rent?: number; area?: number; rooms?: number;
  wbs?: string; features?: string[]; coordinates?: { lat: string; lng: string }; link: string; notice?: string;
}

export const howoge: SourceAdapter = {
  id: 'howoge',
  intervalMin: 5,
  supports: berlinOnly,
  async crawl() {
    const out: RawListing[] = [];
    for (let page = 1; page <= 20; page++) {
      const body = new URLSearchParams({
        'tx_howsite_json_list[page]': String(page),
        'tx_howsite_json_list[limit]': '50',
        'tx_howsite_json_list[rooms]': 'egal',
        'tx_howsite_json_list[wbs]': 'all-offers',
      });
      const res = await fetchJson<{ immoobjects: HowogeItem[] }>('https://www.howoge.de/?type=999&tx_howsite_json_list%5Baction%5D=immoList', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const items = res.immoobjects ?? [];
      for (const i of items) {
        out.push({
          source: 'howoge',
          sourceId: String(i.uid),
          url: abs(i.link, 'https://www.howoge.de'),
          title: i.notice || i.title,
          text: [i.title, i.district, ...(i.features ?? [])].join(' · '),
          address: i.title,
          lat: i.coordinates ? +i.coordinates.lat : null,
          lng: i.coordinates ? +i.coordinates.lng : null,
          imageUrl: i.image ? abs(i.image, 'https://www.howoge.de') : null,
          fields: { ...company, warmRent: i.rent ?? null, sizeM2: i.area ?? null, rooms: i.rooms ?? null, wbsRequired: i.wbs ? i.wbs !== 'nein' : null },
        });
      }
      if (items.length < 50) break;
    }
    return out;
  },
};

export const wbm: SourceAdapter = {
  id: 'wbm',
  intervalMin: 5,
  extract: { priceIs: 'warm' },
  supports: berlinOnly,
  async crawl() {
    const html = await fetchText('https://www.wbm.de/wohnungen-berlin/angebote/');
    return parseCards(html, {
      source: 'wbm',
      base: 'https://www.wbm.de',
      card: '.openimmo-search-list-item',
      link: 'a[href*="/details/"]',
      title: 'h2, h3',
      address: '.address',
      idFromUrl: (u) => /details\/([^/]+)/.exec(u)?.[1] ?? null,
    }).map((l) => ({ ...l, fields: company }));
  },
};

export const gesobau: SourceAdapter = {
  id: 'gesobau',
  intervalMin: 5,
  extract: { priceIs: 'warm' },
  supports: berlinOnly,
  async crawl() {
    const html = await fetchText('https://www.gesobau.de/mieten/wohnungssuche/');
    return parseCards(html, {
      source: 'gesobau',
      base: 'https://www.gesobau.de',
      card: 'article.basicTeaser.apartment',
      title: 'h3, h2, .basicTeaser__title',
      idFromUrl: (u) => /detailseite\/([^/]+)/.exec(u)?.[1] ?? null,
    }).map((l) => ({ ...l, address: /([A-ZÄÖÜ][^,]*\d+\w?,\s*\d{5}\s+Berlin)/.exec(l.text ?? '')?.[1] ?? null, fields: company }));
  },
};

interface SulItem {
  headline: string;
  address: { postal_code: string; city: string; street: string; house_number: string; precinct?: string };
  details: { immoNumber: string; livingSpace: string; rooms: string; barrierFree?: boolean; seniorsFriendly?: boolean; immoSubType?: string };
  costs: { coldRent?: string; warmRent?: string; additionalCosts?: string; deposit?: string };
  image?: { filename?: string };
}

export const stadtundland: SourceAdapter = {
  id: 'stadtundland',
  intervalMin: 5,
  supports: berlinOnly,
  async crawl() {
    const out: RawListing[] = [];
    for (let offset = 0; offset < 300; offset += 10) {
      const res = await fetchJson<{ data: SulItem[] }>('https://d2396ha8oiavw0.cloudfront.net/sul-main/immoSearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offset, cat: 'wohnung' }),
      });
      for (const i of res.data ?? []) {
        const a = i.address;
        out.push({
          source: 'stadtundland',
          sourceId: i.details.immoNumber,
          url: `https://www.stadtundland.de/wohnungssuche/${encodeURIComponent(i.details.immoNumber)}`,
          title: i.headline,
          text: `${i.headline} ${a.precinct ?? ''} ${i.details.immoSubType === 'DACHGESCHOSS' ? 'Dachgeschoss' : ''}`,
          address: `${a.street} ${a.house_number}, ${a.postal_code} ${a.city}`,
          fields: {
            ...company,
            coldRent: parseNumber(i.costs.coldRent),
            warmRent: parseNumber(i.costs.warmRent),
            extraCosts: parseNumber(i.costs.additionalCosts),
            deposit: parseNumber(i.costs.deposit),
            sizeM2: Number(i.details.livingSpace) || null,
            rooms: Number(i.details.rooms) || null,
            barrierFree: i.details.barrierFree ?? null,
          },
        });
      }
      if ((res.data ?? []).length < 10) break;
    }
    return out;
  },
};
