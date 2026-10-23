import type { Listing } from '@wr/shared';

/** Listing fields that map 1:1 to a snake_case column. */
export const LISTING_FIELDS = [
  'source', 'sourceId', 'url', 'title', 'excerpt', 'imageUrl',
  'city', 'plz', 'bezirk', 'ortsteil', 'street', 'lat', 'lng',
  'coldRent', 'warmRent', 'extraCosts', 'deposit', 'noCommission',
  'sizeM2', 'rooms', 'bedrooms', 'bathrooms',
  'wbsRequired', 'wbsLevel', 'isSwap', 'indexOrStaffel', 'seniorsOnly',
  'availableFrom', 'limitedTerm', 'isSublet', 'furnished', 'isWgRoom',
  'floor', 'totalFloors', 'elevator', 'buildingType', 'yearBuilt', 'energyClass', 'heatingType', 'barrierFree', 'firstOccupancy',
  'balcony', 'garden', 'kitchen', 'cellar', 'parking', 'guestWc', 'bathtub', 'floorHeating',
  'petsAllowed', 'wgSuitable',
  'offerer', 'isPaywalled', 'postedAt',
] as const satisfies readonly (keyof Listing)[];

export const toSnake = (k: string) => (k === 'sizeM2' ? 'size_m2' : k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`));

/** Column list for SELECTs that return API-shaped Listings (camelCase aliases). */
export const listingSelect = (alias = 'l') =>
  [
    `${alias}.id`,
    `${alias}.first_seen_at AS "firstSeenAt"`,
    ...LISTING_FIELDS.map((f) => `${alias}.${toSnake(f)} AS "${f}"`),
  ].join(', ');

export function rowToListing(row: Record<string, unknown>): Listing {
  const l = { ...row } as Record<string, unknown>;
  for (const k of ['postedAt', 'firstSeenAt']) if (l[k] instanceof Date) l[k] = (l[k] as Date).toISOString();
  if (l.availableFrom instanceof Date) l.availableFrom = (l.availableFrom as Date).toISOString().slice(0, 10);
  return l as unknown as Listing;
}
