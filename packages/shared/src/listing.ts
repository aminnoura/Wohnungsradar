export type Furnished = 'none' | 'partly' | 'full';
export type BuildingType = 'altbau' | 'neubau';
export type Offerer = 'private' | 'agent' | 'company';

/** Normalized listing as stored in the DB and returned by the API. Unknown values are null. */
export interface Listing {
  id: string;
  source: string;
  sourceId: string;
  url: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;

  city: string | null;
  plz: string | null;
  bezirk: string | null;
  ortsteil: string | null;
  street: string | null;
  lat: number | null;
  lng: number | null;

  coldRent: number | null;
  warmRent: number | null;
  extraCosts: number | null;
  deposit: number | null;
  noCommission: boolean | null;

  sizeM2: number | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;

  wbsRequired: boolean | null;
  wbsLevel: number | null;
  isSwap: boolean | null;
  indexOrStaffel: boolean | null;
  seniorsOnly: boolean | null;

  availableFrom: string | null;
  limitedTerm: boolean | null;
  isSublet: boolean | null;
  furnished: Furnished | null;
  isWgRoom: boolean | null;

  floor: number | null;
  totalFloors: number | null;
  elevator: boolean | null;
  buildingType: BuildingType | null;
  yearBuilt: number | null;
  energyClass: string | null;
  heatingType: string | null;
  barrierFree: boolean | null;
  firstOccupancy: boolean | null;

  balcony: boolean | null;
  garden: boolean | null;
  kitchen: boolean | null;
  cellar: boolean | null;
  parking: boolean | null;
  guestWc: boolean | null;
  bathtub: boolean | null;
  floorHeating: boolean | null;

  petsAllowed: boolean | null;
  wgSuitable: boolean | null;

  offerer: Offerer | null;
  isPaywalled: boolean;
  postedAt: string | null;
  firstSeenAt: string;
  /** Other portals where the same flat was found (dedup). */
  alsoOn?: { source: string; url: string }[];
}

/** What an adapter emits before normalization. Anything may be missing; `text` is free-form card/detail text. */
export interface RawListing {
  source: string;
  sourceId: string;
  url: string;
  title: string;
  text?: string;
  imageUrl?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  postedAt?: string | null;
  isPaywalled?: boolean;
  /** Already-structured values from JSON sources; override text extraction. */
  fields?: Partial<Omit<Listing, 'id' | 'source' | 'sourceId' | 'url' | 'title' | 'firstSeenAt'>>;
}
