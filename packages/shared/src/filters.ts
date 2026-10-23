import { z } from 'zod';
import type { Listing } from './listing';

/**
 * Every search filter is declared once here. The app renders its filter sheet from FILTER_DEFS,
 * the API validates with SearchFiltersSchema and turns generic kinds (range/bool/tri/select)
 * into SQL via `column`. Kinds marked `custom` have bespoke handling in the API query builder.
 */
export type FilterGroup =
  | 'location' | 'price' | 'size' | 'berlin' | 'lease' | 'building' | 'features' | 'rules' | 'meta';

type Col = keyof Listing;

export type FilterDef =
  | { key: string; group: FilterGroup; label: string; kind: 'range'; column: Col; unit?: string; step?: number }
  | { key: string; group: FilterGroup; label: string; kind: 'min' | 'max'; column: Col; unit?: string; step?: number }
  | { key: string; group: FilterGroup; label: string; kind: 'bool'; column: Col }
  | { key: string; group: FilterGroup; label: string; kind: 'tri'; column: Col }
  | { key: string; group: FilterGroup; label: string; kind: 'select'; column?: Col; options: { value: string; label: string }[] }
  | { key: string; group: FilterGroup; label: string; kind: 'custom'; input: 'multi' | 'number' | 'text' | 'date' | 'bool' | 'polygon' | 'center' };

export const GROUP_LABELS: Record<FilterGroup, string> = {
  location: 'Ort',
  price: 'Preis',
  size: 'Größe',
  berlin: 'WBS & Tausch',
  lease: 'Mietvertrag',
  building: 'Gebäude',
  features: 'Ausstattung',
  rules: 'Haustiere & WG',
  meta: 'Quellen & Sortierung',
};

export const FILTER_DEFS: FilterDef[] = [
  // Location (6)
  { key: 'city', group: 'location', label: 'Stadt', kind: 'custom', input: 'text' },
  { key: 'bezirke', group: 'location', label: 'Bezirke', kind: 'custom', input: 'multi' },
  { key: 'ortsteile', group: 'location', label: 'Ortsteile', kind: 'custom', input: 'multi' },
  { key: 'plz', group: 'location', label: 'Postleitzahlen', kind: 'custom', input: 'multi' },
  { key: 'center', group: 'location', label: 'Umkreis (km)', kind: 'custom', input: 'center' },
  { key: 'polygon', group: 'location', label: 'Auf Karte zeichnen', kind: 'custom', input: 'polygon' },

  // Price (6)
  { key: 'coldRent', group: 'price', label: 'Kaltmiete', kind: 'range', column: 'coldRent', unit: '€', step: 50 },
  { key: 'warmRent', group: 'price', label: 'Warmmiete', kind: 'range', column: 'warmRent', unit: '€', step: 50 },
  { key: 'pricePerM2Max', group: 'price', label: 'Max. €/m² (kalt)', kind: 'custom', input: 'number' },
  { key: 'extraCostsMax', group: 'price', label: 'Max. Nebenkosten', kind: 'max', column: 'extraCosts', unit: '€', step: 25 },
  { key: 'depositMax', group: 'price', label: 'Max. Kaution', kind: 'max', column: 'deposit', unit: '€', step: 250 },
  { key: 'noCommission', group: 'price', label: 'Provisionsfrei', kind: 'bool', column: 'noCommission' },

  // Size (4)
  { key: 'size', group: 'size', label: 'Wohnfläche', kind: 'range', column: 'sizeM2', unit: 'm²', step: 5 },
  { key: 'rooms', group: 'size', label: 'Zimmer', kind: 'range', column: 'rooms', step: 0.5 },
  { key: 'bedroomsMin', group: 'size', label: 'Min. Schlafzimmer', kind: 'min', column: 'bedrooms', step: 1 },
  { key: 'bathroomsMin', group: 'size', label: 'Min. Badezimmer', kind: 'min', column: 'bathrooms', step: 1 },

  // Berlin specials (5)
  { key: 'wbs', group: 'berlin', label: 'WBS erforderlich', kind: 'tri', column: 'wbsRequired' },
  { key: 'wbsLevelMax', group: 'berlin', label: 'Mein WBS (max. Stufe)', kind: 'custom', input: 'number' },
  { key: 'swap', group: 'berlin', label: 'Tauschwohnung', kind: 'tri', column: 'isSwap' },
  { key: 'noIndexStaffel', group: 'berlin', label: 'Keine Index-/Staffelmiete', kind: 'custom', input: 'bool' },
  { key: 'seniors', group: 'berlin', label: 'Seniorenwohnung', kind: 'tri', column: 'seniorsOnly' },

  // Lease (5)
  { key: 'availableBy', group: 'lease', label: 'Bezugsfrei bis', kind: 'custom', input: 'date' },
  {
    key: 'term', group: 'lease', label: 'Mietdauer', kind: 'select', column: 'limitedTerm',
    options: [{ value: 'any', label: 'Egal' }, { value: 'unlimited', label: 'Unbefristet' }, { value: 'limited', label: 'Befristet' }],
  },
  { key: 'sublet', group: 'lease', label: 'Zwischenmiete', kind: 'tri', column: 'isSublet' },
  {
    key: 'furnished', group: 'lease', label: 'Möbliert', kind: 'select', column: 'furnished',
    options: [{ value: 'any', label: 'Egal' }, { value: 'furnished', label: 'Möbliert' }, { value: 'unfurnished', label: 'Unmöbliert' }],
  },
  { key: 'wgRoom', group: 'lease', label: 'WG-Zimmer', kind: 'tri', column: 'isWgRoom' },

  // Building (10)
  { key: 'floor', group: 'building', label: 'Etage', kind: 'range', column: 'floor', step: 1 },
  { key: 'notGroundFloor', group: 'building', label: 'Nicht Erdgeschoss', kind: 'custom', input: 'bool' },
  { key: 'notTopFloor', group: 'building', label: 'Nicht Dachgeschoss', kind: 'custom', input: 'bool' },
  { key: 'elevator', group: 'building', label: 'Aufzug', kind: 'bool', column: 'elevator' },
  {
    key: 'buildingType', group: 'building', label: 'Bauart', kind: 'select', column: 'buildingType',
    options: [{ value: 'any', label: 'Egal' }, { value: 'altbau', label: 'Altbau' }, { value: 'neubau', label: 'Neubau' }],
  },
  { key: 'yearBuilt', group: 'building', label: 'Baujahr', kind: 'range', column: 'yearBuilt', step: 10 },
  {
    key: 'energyClassMax', group: 'building', label: 'Energieklasse (mind.)', kind: 'select', column: 'energyClass',
    options: ['any', 'A+', 'A', 'B', 'C', 'D', 'E', 'F'].map((v) => ({ value: v, label: v === 'any' ? 'Egal' : v })),
  },
  { key: 'heatingTypes', group: 'building', label: 'Heizungsart', kind: 'custom', input: 'multi' },
  { key: 'barrierFree', group: 'building', label: 'Barrierefrei', kind: 'bool', column: 'barrierFree' },
  { key: 'firstOccupancy', group: 'building', label: 'Erstbezug', kind: 'bool', column: 'firstOccupancy' },

  // Features (8)
  { key: 'balcony', group: 'features', label: 'Balkon/Terrasse', kind: 'bool', column: 'balcony' },
  { key: 'garden', group: 'features', label: 'Garten', kind: 'bool', column: 'garden' },
  { key: 'kitchen', group: 'features', label: 'Einbauküche', kind: 'bool', column: 'kitchen' },
  { key: 'cellar', group: 'features', label: 'Keller', kind: 'bool', column: 'cellar' },
  { key: 'parking', group: 'features', label: 'Stellplatz/Garage', kind: 'bool', column: 'parking' },
  { key: 'guestWc', group: 'features', label: 'Gäste-WC', kind: 'bool', column: 'guestWc' },
  { key: 'bathtub', group: 'features', label: 'Badewanne', kind: 'bool', column: 'bathtub' },
  { key: 'floorHeating', group: 'features', label: 'Fußbodenheizung', kind: 'bool', column: 'floorHeating' },

  // Rules (2)
  { key: 'petsAllowed', group: 'rules', label: 'Haustiere erlaubt', kind: 'bool', column: 'petsAllowed' },
  { key: 'wgSuitable', group: 'rules', label: 'WG-geeignet', kind: 'bool', column: 'wgSuitable' },

  // Meta (9)
  { key: 'sources', group: 'meta', label: 'Portale', kind: 'custom', input: 'multi' },
  { key: 'postedWithinHours', group: 'meta', label: 'Neu in den letzten … Std.', kind: 'custom', input: 'number' },
  {
    key: 'offerer', group: 'meta', label: 'Anbieter', kind: 'select', column: 'offerer',
    options: [{ value: 'any', label: 'Egal' }, { value: 'private', label: 'Privat' }, { value: 'agent', label: 'Makler' }, { value: 'company', label: 'Wohnungsbaugesellschaft' }],
  },
  { key: 'withPhotos', group: 'meta', label: 'Nur mit Fotos', kind: 'custom', input: 'bool' },
  { key: 'keywords', group: 'meta', label: 'Stichwörter', kind: 'custom', input: 'text' },
  { key: 'excludeKeywords', group: 'meta', label: 'Ausschließen', kind: 'custom', input: 'text' },
  { key: 'hideSeen', group: 'meta', label: 'Gesehene ausblenden', kind: 'custom', input: 'bool' },
  { key: 'showHandled', group: 'meta', label: 'Beworbene & ausgeblendete anzeigen', kind: 'custom', input: 'bool' },
  { key: 'strict', group: 'meta', label: 'Unbekannte Werte ausblenden', kind: 'custom', input: 'bool' },
  {
    key: 'sort', group: 'meta', label: 'Sortierung', kind: 'select',
    options: [
      { value: 'newest', label: 'Neueste' },
      { value: 'priceAsc', label: 'Preis aufsteigend' },
      { value: 'priceDesc', label: 'Preis absteigend' },
      { value: 'sizeDesc', label: 'Größte zuerst' },
      { value: 'pricePerM2', label: '€/m² aufsteigend' },
    ],
  },
];

const num = z.number().finite();
const range = z.object({ min: num.optional(), max: num.optional() }).optional();
const tri = z.enum(['any', 'only', 'exclude']).optional();

export const SearchFiltersSchema = z
  .object({
    city: z.string().optional(),
    bezirke: z.array(z.string()).optional(),
    ortsteile: z.array(z.string()).optional(),
    plz: z.array(z.string().regex(/^\d{5}$/)).optional(),
    center: z.object({ lat: num, lng: num, radiusKm: num.positive().max(200) }).optional(),
    polygon: z.array(z.tuple([num, num])).min(3).max(500).optional(),

    coldRent: range,
    warmRent: range,
    pricePerM2Max: num.optional(),
    extraCostsMax: num.optional(),
    depositMax: num.optional(),
    noCommission: z.boolean().optional(),

    size: range,
    rooms: range,
    bedroomsMin: num.optional(),
    bathroomsMin: num.optional(),

    wbs: tri,
    wbsLevelMax: num.optional(),
    swap: tri,
    noIndexStaffel: z.boolean().optional(),
    seniors: tri,

    availableBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    term: z.enum(['any', 'unlimited', 'limited']).optional(),
    sublet: tri,
    furnished: z.enum(['any', 'furnished', 'unfurnished']).optional(),
    wgRoom: tri,

    floor: range,
    notGroundFloor: z.boolean().optional(),
    notTopFloor: z.boolean().optional(),
    elevator: z.boolean().optional(),
    buildingType: z.enum(['any', 'altbau', 'neubau']).optional(),
    yearBuilt: range,
    energyClassMax: z.enum(['any', 'A+', 'A', 'B', 'C', 'D', 'E', 'F']).optional(),
    heatingTypes: z.array(z.string()).optional(),
    barrierFree: z.boolean().optional(),
    firstOccupancy: z.boolean().optional(),

    balcony: z.boolean().optional(),
    garden: z.boolean().optional(),
    kitchen: z.boolean().optional(),
    cellar: z.boolean().optional(),
    parking: z.boolean().optional(),
    guestWc: z.boolean().optional(),
    bathtub: z.boolean().optional(),
    floorHeating: z.boolean().optional(),

    petsAllowed: z.boolean().optional(),
    wgSuitable: z.boolean().optional(),

    sources: z.array(z.string()).optional(),
    postedWithinHours: num.positive().optional(),
    offerer: z.enum(['any', 'private', 'agent', 'company']).optional(),
    withPhotos: z.boolean().optional(),
    keywords: z.string().max(200).optional(),
    excludeKeywords: z.string().max(200).optional(),
    hideSeen: z.boolean().optional(),
    showHandled: z.boolean().optional(),
    strict: z.boolean().optional(),
    sort: z.enum(['newest', 'priceAsc', 'priceDesc', 'sizeDesc', 'pricePerM2']).optional(),
  })
  .strict();

export type SearchFilters = z.infer<typeof SearchFiltersSchema>;
export type TriState = 'any' | 'only' | 'exclude';

/** Merkliste statuses. HANDLED ones are dropped from search, map and alerts unless `showHandled` is set. */
export const FAVORITE_STATUSES = ['saved', 'contacted', 'viewing', 'applied', 'rejected', 'hidden'] as const;
export type FavoriteStatus = (typeof FAVORITE_STATUSES)[number];
export const HANDLED_STATUSES: FavoriteStatus[] = ['applied', 'rejected', 'hidden'];

export const HEATING_TYPES = ['Fernwärme', 'Gas', 'Zentralheizung', 'Etagenheizung', 'Fußbodenheizung', 'Wärmepumpe', 'Öl', 'Ofenheizung', 'Elektro'];
export const ENERGY_CLASSES = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** Number of filters the user has set (for the "Filter (7)" badge). */
export function countActiveFilters(f: SearchFilters): number {
  return Object.entries(f).filter(([k, v]) => {
    if (k === 'sort' || k === 'city') return false;
    if (v == null || v === 'any' || v === false || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.values(v).some((x) => x != null);
    return true;
  }).length;
}
