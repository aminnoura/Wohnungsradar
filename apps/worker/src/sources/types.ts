import type { City } from '@wr/geo';
import type { RawListing } from '@wr/shared';
import type { ExtractOptions } from '../parse';

export interface SourceAdapter {
  id: string;
  /** Minutes between crawls of one city. */
  intervalMin: number;
  /** How to read an unlabeled price on this portal. */
  extract?: ExtractOptions;
  /** Default `offerer` for listings from this source. */
  offerer?: 'private' | 'agent' | 'company';
  supports(city: City): boolean;
  crawl(city: City): Promise<RawListing[]>;
}

export const berlinOnly = (city: City) => city.slug === 'berlin';
export const anyCity = () => true;

/** For sources whose list isn't per city (one page for all of Germany, or a single-city company): crawl once per cycle. */
export const oncePerCycle = (city: City) => city.slug === (process.env.CRAWL_CITIES || 'berlin').split(',')[0].trim();
