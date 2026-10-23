import { ENERGY_CLASSES, FILTER_DEFS, HANDLED_STATUSES, type SearchFilters, type TriState } from '@wr/shared';
import type { PendingQuery, Row } from 'postgres';
import { sql } from './client';
import { listingSelect, toSnake } from './columns';

type Frag = PendingQuery<Row[]>;

const col = (name: string) => sql.unsafe(`l.${toSnake(name)}`) as unknown as Frag;
const and = (parts: Frag[]): Frag => parts.reduce((a, c) => sql`${a} AND ${c}`, sql`TRUE`);
const or = (parts: Frag[]): Frag => parts.reduce((a, c) => sql`${a} OR ${c}`, sql`FALSE`);

export interface SearchOptions {
  deviceId?: string;
  limit?: number;
  offset?: number;
  /** Restrict to these listing ids (used by the alert matcher). */
  ids?: string[];
  /** [minLng, minLat, maxLng, maxLat] for the map viewport. */
  bbox?: [number, number, number, number];
}

/**
 * Build the WHERE clause for a set of filters. Unknown (NULL) values pass a filter unless `strict` is set,
 * except for tri-state "only" filters (WBS only, Tausch only, …) which always need a confirmed value.
 */
export function whereFor(f: SearchFilters, opts: SearchOptions = {}): Frag {
  const strict = !!f.strict;
  const c: Frag[] = [sql`l.active`, sql`l.canonical_id IS NULL`];
  const orNull = (column: Frag, cond: Frag) => (strict ? cond : sql`(${column} IS NULL OR ${cond})`);

  for (const def of FILTER_DEFS) {
    const v = (f as Record<string, unknown>)[def.key];
    if (v == null) continue;
    if (def.kind === 'range' && typeof v === 'object') {
      const { min, max } = v as { min?: number; max?: number };
      // A cold-rent max is satisfied when the warm rent is already below it; a warm-rent max falls back to cold × 1.25.
      const column =
        def.key === 'coldRent' ? sql`COALESCE(l.cold_rent, l.warm_rent)`
        : def.key === 'warmRent' ? sql`COALESCE(l.warm_rent, l.cold_rent * 1.25)`
        : col(def.column);
      if (min != null) c.push(orNull(column, sql`${column} >= ${min}`));
      if (max != null) c.push(orNull(column, sql`${column} <= ${max}`));
    } else if ((def.kind === 'min' || def.kind === 'max') && typeof v === 'number') {
      const column = col(def.column);
      c.push(orNull(column, def.kind === 'min' ? sql`${column} >= ${v}` : sql`${column} <= ${v}`));
    } else if (def.kind === 'bool' && v === true) {
      const column = col(def.column);
      c.push(strict ? sql`${column} = TRUE` : sql`${column} IS NOT FALSE`);
    } else if (def.kind === 'tri') {
      const column = col(def.column);
      if ((v as TriState) === 'only') c.push(sql`${column} = TRUE`);
      if ((v as TriState) === 'exclude') c.push(sql`${column} IS NOT TRUE`);
    }
  }

  // Selects with custom semantics
  if (f.term === 'unlimited') c.push(strict ? sql`l.limited_term = FALSE` : sql`l.limited_term IS NOT TRUE`);
  if (f.term === 'limited') c.push(sql`l.limited_term = TRUE`);
  if (f.furnished === 'furnished') c.push(sql`l.furnished IN ('full', 'partly')`);
  if (f.furnished === 'unfurnished') c.push(strict ? sql`l.furnished = 'none'` : sql`l.furnished IS DISTINCT FROM 'full' AND l.furnished IS DISTINCT FROM 'partly'`);
  if (f.buildingType && f.buildingType !== 'any') c.push(orNull(sql`l.building_type`, sql`l.building_type = ${f.buildingType}`));
  if (f.energyClassMax && f.energyClassMax !== 'any') {
    const ok = ENERGY_CLASSES.slice(0, ENERGY_CLASSES.indexOf(f.energyClassMax) + 1);
    c.push(orNull(sql`l.energy_class`, sql`l.energy_class = ANY(${ok})`));
  }
  if (f.offerer && f.offerer !== 'any') c.push(orNull(sql`l.offerer`, sql`l.offerer = ${f.offerer}`));

  // Location: city narrows; Bezirke/Ortsteile/PLZ are alternatives (union); radius and polygon intersect.
  if (f.city) c.push(sql`lower(l.city) = lower(${f.city})`);
  const area: Frag[] = [];
  if (f.bezirke?.length) area.push(sql`l.bezirk = ANY(${f.bezirke})`);
  if (f.ortsteile?.length) area.push(sql`l.ortsteil = ANY(${f.ortsteile})`);
  if (f.plz?.length) area.push(sql`l.plz = ANY(${f.plz})`);
  if (area.length) c.push(sql`(${or(area)})`);
  if (f.center) {
    c.push(sql`ST_DWithin(l.geom, ST_SetSRID(ST_MakePoint(${f.center.lng}, ${f.center.lat}), 4326)::geography, ${f.center.radiusKm * 1000})`);
  }
  if (f.polygon) {
    const ring = [...f.polygon, f.polygon[0]].map(([lat, lng]) => `${lng} ${lat}`).join(',');
    c.push(sql`ST_Within(l.geom::geometry, ST_GeomFromText(${`POLYGON((${ring}))`}, 4326))`);
  }

  if (f.pricePerM2Max != null) {
    c.push(orNull(sql`(l.cold_rent / NULLIF(l.size_m2, 0))`, sql`l.cold_rent / NULLIF(l.size_m2, 0) <= ${f.pricePerM2Max}`));
  }
  if (f.wbsLevelMax != null) c.push(sql`(l.wbs_level IS NULL OR l.wbs_level <= ${f.wbsLevelMax})`);
  if (f.noIndexStaffel) c.push(sql`l.index_or_staffel IS NOT TRUE`);
  if (f.availableBy) c.push(orNull(sql`l.available_from`, sql`l.available_from <= ${f.availableBy}`));
  if (f.notGroundFloor) c.push(strict ? sql`l.floor > 0` : sql`l.floor IS DISTINCT FROM 0`);
  if (f.notTopFloor) {
    c.push(sql`NOT (l.floor IS NOT NULL AND l.total_floors IS NOT NULL AND l.floor >= l.total_floors)`);
    c.push(sql`COALESCE(l.search_text, '') !~* '(dachgeschoss|\mDG\M|penthouse)'`);
  }
  if (f.heatingTypes?.length) c.push(orNull(sql`l.heating_type`, sql`l.heating_type = ANY(${f.heatingTypes})`));

  if (f.sources?.length) {
    c.push(sql`(l.source = ANY(${f.sources}) OR EXISTS (SELECT 1 FROM listings d WHERE d.canonical_id = l.id AND d.source = ANY(${f.sources})))`);
  }
  if (f.postedWithinHours) c.push(sql`COALESCE(l.posted_at, l.first_seen_at) > now() - make_interval(hours => ${f.postedWithinHours})`);
  if (f.withPhotos) c.push(sql`l.image_url IS NOT NULL`);
  for (const kw of splitKeywords(f.keywords)) c.push(sql`(l.title || ' ' || COALESCE(l.search_text, '')) ILIKE ${'%' + kw + '%'}`);
  for (const kw of splitKeywords(f.excludeKeywords)) c.push(sql`(l.title || ' ' || COALESCE(l.search_text, '')) NOT ILIKE ${'%' + kw + '%'}`);
  if (f.hideSeen && opts.deviceId) c.push(sql`NOT EXISTS (SELECT 1 FROM seen s WHERE s.device_id = ${opts.deviceId} AND s.listing_id = l.id)`);
  if (!f.showHandled && opts.deviceId) {
    c.push(sql`NOT EXISTS (SELECT 1 FROM favorites fv WHERE fv.device_id = ${opts.deviceId} AND fv.listing_id = l.id AND fv.status = ANY(${HANDLED_STATUSES}))`);
  }

  if (opts.ids) c.push(sql`l.id = ANY(${opts.ids}::uuid[])`);
  if (opts.bbox) {
    const [x1, y1, x2, y2] = opts.bbox;
    c.push(sql`l.geom && ST_MakeEnvelope(${x1}, ${y1}, ${x2}, ${y2}, 4326)::geography`);
  }
  return and(c);
}

/** Comma-separated phrases, or whitespace-separated words if no comma is used. */
function splitKeywords(s?: string): string[] {
  if (!s?.trim()) return [];
  return (s.includes(',') ? s.split(',') : s.split(/\s+/)).map((x) => x.trim().replace(/[%_]/g, '')).filter(Boolean);
}

function orderBy(sort: SearchFilters['sort']): Frag {
  switch (sort) {
    case 'priceAsc': return sql`COALESCE(l.warm_rent, l.cold_rent) ASC NULLS LAST, l.first_seen_at DESC`;
    case 'priceDesc': return sql`COALESCE(l.warm_rent, l.cold_rent) DESC NULLS LAST, l.first_seen_at DESC`;
    case 'sizeDesc': return sql`l.size_m2 DESC NULLS LAST, l.first_seen_at DESC`;
    case 'pricePerM2': return sql`l.cold_rent / NULLIF(l.size_m2, 0) ASC NULLS LAST, l.first_seen_at DESC`;
    default: return sql`COALESCE(l.posted_at, l.first_seen_at) DESC`;
  }
}

export async function searchListings(f: SearchFilters, opts: SearchOptions = {}) {
  const where = whereFor(f, opts);
  const limit = Math.min(opts.limit ?? 30, 500);
  const [rows, [{ total }]] = await Promise.all([
    sql`
      SELECT ${sql.unsafe(listingSelect('l'))},
        (SELECT COALESCE(json_agg(json_build_object('source', d.source, 'url', d.url)), '[]'::json)
           FROM listings d WHERE d.canonical_id = l.id AND d.active) AS "alsoOn"
      FROM listings l
      WHERE ${where}
      ORDER BY ${orderBy(f.sort)}
      LIMIT ${limit} OFFSET ${opts.offset ?? 0}`,
    sql<{ total: number }[]>`SELECT count(*)::int AS total FROM listings l WHERE ${where}`,
  ]);
  return { rows, total };
}
