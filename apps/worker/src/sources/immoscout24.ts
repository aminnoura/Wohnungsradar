import type { RawListing } from '@wr/shared';
import { fetchJson } from '../http';
import type { SourceAdapter } from './types';

// ImmoScout24's mobile app API. Unlike the website it is not behind the bot wall, and it also returns
// "Suchen+" (paywalled early-access) listings with address, coordinates, price, size and rooms.
const API = 'https://api.mobile.immobilienscout24.de';
const HEADERS = { 'User-Agent': 'ImmoScout_27.12_26.2_._', 'Content-Type': 'application/json' };
const PAGES = 2;
const DETAIL_LIMIT = 25;

interface ListItem {
  id: string;
  title: string;
  address?: { line?: string; lat?: number; lon?: number };
  attributes?: { value: string }[];
  isPrivate?: boolean;
  isProject?: boolean;
  paywallListing?: { active?: boolean };
  titlePicture?: { preview?: string };
}

interface Expose {
  sections: { type: string; title?: string; text?: string; addressLine1?: string; addressLine2?: string; attributes?: { label?: string; text?: string }[] }[];
}

/** Flatten an expose into "Label: value" lines our text extractor understands. */
export function exposeText(e: Expose): string {
  const lines: string[] = [];
  for (const s of e.sections) {
    if (s.type === 'TOP_ATTRIBUTES' || s.type === 'ATTRIBUTE_LIST') {
      for (const a of s.attributes ?? []) lines.push(`${(a.label ?? '').replace(/:$/, '')}: ${a.text ?? ''}`.trim());
    } else if (s.type === 'TEXT_AREA') lines.push(`${s.title}: ${s.text}`);
    else if (s.type === 'MAP') lines.push(`Adresse: ${s.addressLine1 ?? ''}, ${s.addressLine2 ?? ''}`);
  }
  return lines.join('\n');
}

export const immoscout24: SourceAdapter = {
  id: 'immoscout24',
  intervalMin: 5,
  extract: { priceIs: 'cold' },
  supports: () => true,
  async crawl(city) {
    const out: RawListing[] = [];
    for (let page = 1; page <= PAGES; page++) {
      const qs = new URLSearchParams({
        searchType: 'region',
        realestatetype: 'apartmentrent',
        geocodes: `/de/${city.state}/${city.slug}`,
        sorting: '-firstactivation',
        pagenumber: String(page),
        pagesize: '50',
      });
      const res = await fetchJson<{ resultListItems: { type: string; item: ListItem }[] }>(`${API}/search/list?${qs}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ supportedResultListTypes: [], userData: {} }),
      });
      for (const { type, item } of res.resultListItems ?? []) {
        if (type !== 'EXPOSE_RESULT' || item.isProject) continue;
        const [price, size, rooms] = (item.attributes ?? []).map((a) => a.value);
        out.push({
          source: 'immoscout24',
          sourceId: item.id,
          url: `https://www.immobilienscout24.de/expose/${item.id}`,
          title: item.title,
          text: [item.title, price && `Kaltmiete: ${price}`, size, rooms && rooms.replace('Zi.', 'Zimmer')].filter(Boolean).join(' · '),
          address: item.address?.line ?? null,
          lat: item.address?.lat ?? null,
          lng: item.address?.lon ?? null,
          imageUrl: item.titlePicture?.preview ?? null,
          isPaywalled: !!item.paywallListing?.active,
          fields: { offerer: item.isPrivate ? 'private' : 'agent' },
        });
      }
    }
    return out;
  },
};

/** Enrich new listings with the expose (WBS, features, Nebenkosten, …). Called by the runner for unseen ids only. */
export async function immoscoutDetail(sourceId: string): Promise<string | null> {
  try {
    const e = await fetchJson<Expose>(`${API}/expose/${sourceId}`, { headers: HEADERS });
    return exposeText(e);
  } catch {
    return null;
  }
}

export const IMMOSCOUT_DETAIL_LIMIT = DETAIL_LIMIT;
