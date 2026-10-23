import { sql } from '@wr/db';
import type { City } from '@wr/geo';
import { braveEnabled } from './brave';
import { crossSearchPaywalled, web } from './sources/discovery';
import type { SourceAdapter } from './sources/types';
import { storeListings } from './store';

/** Crawl one source for one city and store the results. Errors are recorded, never thrown. */
export async function runJob(adapter: SourceAdapter, city: City) {
  const [run] = await sql<{ id: number }[]>`INSERT INTO crawl_runs (source, city) VALUES (${adapter.id}, ${city.slug}) RETURNING id`;
  const t0 = Date.now();
  try {
    const raws = await adapter.crawl(city);
    const { found, inserted } = await storeListings(raws, adapter, city.name);
    await sql`UPDATE crawl_runs SET finished_at = now(), found = ${found}, inserted = ${inserted.length} WHERE id = ${run.id}`;
    console.log(`[${adapter.id}/${city.slug}] ${found} found, ${inserted.length} new (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    return { found, inserted };
  } catch (e) {
    const msg = (e as Error).message;
    await sql`UPDATE crawl_runs SET finished_at = now(), error = ${msg} WHERE id = ${run.id}`;
    console.warn(`[${adapter.id}/${city.slug}] failed: ${msg}`);
    return { found: 0, inserted: [] as string[], error: msg };
  }
}

/** Look for fresh ImmoScout "Suchen+" listings on other sites (bounded per run to protect the Brave budget). */
export async function runCrossSearch(limit = Number(process.env.CROSS_SEARCH_PER_RUN ?? 5)) {
  if (!braveEnabled()) return;
  const rows = await sql<{ id: string; street: string | null; plz: string | null; ortsteil: string | null; size_m2: number | null; rooms: number | null; city: string | null }[]>`
    SELECT id, street, plz, ortsteil, size_m2, rooms, city FROM listings
    WHERE source = 'immoscout24' AND is_paywalled AND NOT cross_searched AND active
      AND first_seen_at > now() - interval '2 days'
    ORDER BY first_seen_at DESC LIMIT ${limit}`;
  for (const r of rows) {
    await sql`UPDATE listings SET cross_searched = true WHERE id = ${r.id}`;
    const raws = await crossSearchPaywalled({ street: r.street, plz: r.plz, ortsteil: r.ortsteil, sizeM2: r.size_m2, rooms: r.rooms });
    const { inserted } = await storeListings(raws, web, r.city ?? 'Berlin');
    const [linked] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM listings WHERE canonical_id = ${r.id}`;
    console.log(`[cross-search] ${r.street ?? r.plz}: ${raws.length} candidates, ${inserted.length} new, ${linked.n} linked`);
  }
}
