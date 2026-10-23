import * as cheerio from 'cheerio';
import type { RawListing } from '@wr/shared';
import { abs } from '../http';

export interface CardSpec {
  source: string;
  base: string;
  /** Selector for one listing card. */
  card: string;
  /** Selector for the link inside the card; omit if the card itself is the <a>. */
  link?: string;
  /** Selector for the title; defaults to the first heading, then the link text. */
  title?: string;
  /** Derive the portal's listing id from the absolute URL; defaults to the URL path. */
  idFromUrl?: (url: string) => string | null;
  /** Selector for an element whose text is the address. */
  address?: string;
}

/** Generic list-page parser: find cards, take link/title/image, keep the full card text for field extraction. */
export function parseCards(html: string, spec: CardSpec): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  const seen = new Set<string>();
  $(spec.card).each((_, el) => {
    const $card = $(el);
    $card.find('script,style,noscript,svg').remove();
    const $a = spec.link ? $card.find(spec.link).first() : $card.is('a') ? $card : $card.find('a[href]').first();
    const href = $a.attr('href') ?? $card.attr('href') ?? $card.attr('data-href');
    if (!href || href.startsWith('#') || href.startsWith('javascript')) return;
    const url = abs(href, spec.base);
    const sourceId = spec.idFromUrl ? spec.idFromUrl(url) : new URL(url).pathname + new URL(url).search;
    if (!sourceId || seen.has(sourceId)) return;
    seen.add(sourceId);
    const title = clean(
      (spec.title ? $card.find(spec.title).first().text() : '') ||
        $card.find('h1,h2,h3,h4').first().text() ||
        $a.attr('title') ||
        $a.text(),
    );
    const img = $card.find('img').first();
    const imageUrl = img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src') || null;
    out.push({
      source: spec.source,
      sourceId,
      url,
      title: title.slice(0, 200) || 'Wohnung',
      text: clean($card.text()),
      address: spec.address ? clean($card.find(spec.address).first().text()) || null : null,
      imageUrl: imageUrl && !imageUrl.startsWith('data:') ? abs(imageUrl, spec.base) : null,
    });
  });
  return out;
}

export const clean = (s: string | undefined | null) => (s ?? '').replace(/\s+/g, ' ').trim();
