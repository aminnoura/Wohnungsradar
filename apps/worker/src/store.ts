import { LISTING_FIELDS, sql, toSnake } from '@wr/db';
import type { RawListing } from '@wr/shared';
import { geocode } from './geocode';
import { normalize, type ListingRow } from './normalize';
import { IMMOSCOUT_DETAIL_LIMIT, immoscoutDetail } from './sources/immoscout24';
import type { SourceAdapter } from './sources/types';

const COLUMNS = [...LISTING_FIELDS, 'searchText'] as const;

export interface StoreResult {
  found: number;
  inserted: string[];
}

/** Insert new listings (normalized, enriched, geocoded, deduped) and refresh the ones we already know. */
export async function storeListings(raws: RawListing[], adapter: SourceAdapter, crawlCity: string): Promise<StoreResult> {
  if (!raws.length) return { found: 0, inserted: [] };
  const bySource = new Map<string, RawListing[]>();
  for (const r of raws) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r]);

  const inserted: string[] = [];
  let detailBudget = IMMOSCOUT_DETAIL_LIMIT;
  for (const [source, list] of bySource) {
    const known = await sql<{ source_id: string }[]>`
      UPDATE listings SET last_seen_at = now(), active = true
      WHERE source = ${source} AND source_id = ANY(${list.map((r) => r.sourceId)})
      RETURNING source_id`;
    const knownIds = new Set(known.map((k) => k.source_id));

    for (const raw of list) {
      if (knownIds.has(raw.sourceId)) continue;
      knownIds.add(raw.sourceId);
      const detail = raw.source === 'immoscout24' && detailBudget-- > 0 ? await immoscoutDetail(raw.sourceId) : null;
      const row = normalize(raw, adapter, crawlCity, detail);
      await enrichLocation(row, raw.address);
      const id = await insertRow(row);
      if (id) {
        inserted.push(id);
        await dedup(id, row);
      }
    }
  }
  return { found: raws.length, inserted };
}

async function enrichLocation(row: ListingRow, address: string | null | undefined) {
  if (row.lat != null && row.bezirk) return;
  const query = row.street && (row.plz || row.city) ? `${row.street}, ${row.plz ?? ''} ${row.city ?? ''}` : address && /\d{5}/.test(address) ? address : null;
  if (!query) return;
  const hit = await geocode(query);
  if (!hit) return;
  row.lat ??= hit.lat;
  row.lng ??= hit.lng;
  row.plz ??= hit.plz;
  row.bezirk ??= hit.bezirk;
  row.ortsteil ??= hit.ortsteil;
}

async function insertRow(row: ListingRow): Promise<string | null> {
  const values = Object.fromEntries(COLUMNS.map((k) => [toSnake(k), (row as Record<string, unknown>)[k] ?? null]));
  const [r] = await sql<{ id: string }[]>`
    INSERT INTO listings ${sql(values)}
    ON CONFLICT (source, source_id) DO UPDATE SET last_seen_at = now(), active = true
    RETURNING id, (xmax = 0) AS fresh`;
  return r && (r as unknown as { fresh: boolean }).fresh ? r.id : null;
}

/**
 * Same flat on another portal? Match on location (PLZ or within 150 m), size (±1.5 m²), rooms and
 * cold or warm rent (±3 %). The earlier listing stays canonical; this one becomes an "also on" link.
 */
async function dedup(id: string, row: ListingRow) {
  if (row.sizeM2 == null || (row.coldRent == null && row.warmRent == null)) return;
  if (!row.plz && row.lat == null) return;
  const [match] = await sql<{ id: string }[]>`
    SELECT id FROM listings
    WHERE id <> ${id} AND canonical_id IS NULL AND source <> ${row.source} AND active
      AND first_seen_at > now() - interval '45 days'
      AND (
        (${row.plz}::text IS NOT NULL AND plz = ${row.plz})
        OR (${row.lat}::float8 IS NOT NULL AND geom IS NOT NULL
            AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint(${row.lng}::float8, ${row.lat}::float8), 4326)::geography, 150))
      )
      AND abs(size_m2 - ${row.sizeM2}) <= 1.5
      AND (rooms IS NULL OR ${row.rooms}::numeric IS NULL OR rooms = ${row.rooms})
      AND (
        (cold_rent IS NOT NULL AND ${row.coldRent}::numeric IS NOT NULL AND abs(cold_rent - ${row.coldRent}) <= cold_rent * 0.03)
        OR (warm_rent IS NOT NULL AND ${row.warmRent}::numeric IS NOT NULL AND abs(warm_rent - ${row.warmRent}) <= warm_rent * 0.03)
      )
    ORDER BY first_seen_at
    LIMIT 1`;
  if (match) await sql`UPDATE listings SET canonical_id = ${match.id}, alerted = true WHERE id = ${id}`;
}

/** Mark listings that have disappeared from their portal as inactive. */
export async function expireStale() {
  await sql`
    UPDATE listings SET active = false
    WHERE active AND (
      (source NOT IN ('web', 'immowelt', 'meinestadt', 'vonovia', 'deutschewohnen', 'heimstaden', 'covivio', 'berlinovo', 'tauschwohnung')
        AND last_seen_at < now() - interval '3 days')
      OR last_seen_at < now() - interval '21 days'
    )`;
}

/**
 * Geocode listings that missed the per-cycle geocoding cap at insert time (or arrived without
 * coordinates), a few per cycle so Nominatim stays within its 1 req/s policy.
 */
export async function backfillGeocodes(limit = 30) {
  const rows = await sql<{ id: string; street: string; plz: string | null; city: string | null; bezirk: string | null; ortsteil: string | null }[]>`
    SELECT id, street, plz, city, bezirk, ortsteil FROM listings
    WHERE active AND lat IS NULL AND street IS NOT NULL AND (plz IS NOT NULL OR city IS NOT NULL)
    ORDER BY first_seen_at DESC LIMIT ${limit}`;
  for (const r of rows) {
    const hit = await geocode(`${r.street}, ${r.plz ?? ''} ${r.city ?? ''}`);
    await sql`
      UPDATE listings SET
        lat = ${hit?.lat ?? null}, lng = ${hit?.lng ?? null},
        plz = COALESCE(plz, ${hit?.plz ?? null}),
        bezirk = COALESCE(bezirk, ${hit?.bezirk ?? null}),
        ortsteil = COALESCE(ortsteil, ${hit?.ortsteil ?? null}),
        -- a miss is cached as null; stop retrying this row
        street = CASE WHEN ${hit == null} THEN NULL ELSE street END
      WHERE id = ${r.id}`;
  }
  return rows.length;
}
