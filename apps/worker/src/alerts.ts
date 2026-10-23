import { searchListings, sql } from '@wr/db';
import { SearchFiltersSchema } from '@wr/shared';

interface SavedSearch {
  id: string;
  device_id: string;
  name: string;
  filters: unknown;
  created_at: Date;
}

/**
 * Match listings that haven't been evaluated yet against every saved search with notifications on.
 * Matches become in-app notifications (web + app inbox) and an Expo push (iOS/Android).
 */
export async function runAlerts() {
  const fresh = await sql<{ id: string }[]>`
    SELECT id FROM listings WHERE NOT alerted AND canonical_id IS NULL ORDER BY first_seen_at LIMIT 1000`;
  if (!fresh.length) return;
  const ids = fresh.map((r) => r.id);
  const searches = await sql<SavedSearch[]>`SELECT * FROM saved_searches WHERE notify`;

  for (const s of searches) {
    const parsed = SearchFiltersSchema.safeParse(s.filters);
    if (!parsed.success) continue;
    const { rows } = await searchListings(parsed.data, { ids, deviceId: s.device_id, limit: 50 });
    // Only listings that appeared after the search was saved – no flood of old matches.
    const matches = rows.filter((r) => new Date(r.firstSeenAt as string) > s.created_at);
    if (!matches.length) continue;
    const created = await sql<{ listing_id: string }[]>`
      INSERT INTO notifications ${sql(matches.map((m) => ({ device_id: s.device_id, saved_search_id: s.id, listing_id: m.id })))}
      ON CONFLICT (device_id, listing_id) DO NOTHING
      RETURNING listing_id`;
    const newOnes = matches.filter((m) => created.some((c) => c.listing_id === m.id));
    if (newOnes.length) await push(s, newOnes as unknown as PushListing[]);
  }
  await sql`UPDATE listings SET alerted = true WHERE id = ANY(${ids}::uuid[])`;
}

interface PushListing {
  id: string;
  title: string;
  warmRent: number | null;
  coldRent: number | null;
  sizeM2: number | null;
  rooms: number | null;
  ortsteil: string | null;
  city: string | null;
}

const fmt = (l: PushListing) =>
  [
    l.rooms && `${l.rooms} Zi.`,
    l.sizeM2 && `${Math.round(l.sizeM2)} m²`,
    (l.warmRent ?? l.coldRent) && `${Math.round((l.warmRent ?? l.coldRent)!)} €`,
    l.ortsteil ?? l.city,
  ].filter(Boolean).join(' · ');

async function push(s: SavedSearch, listings: PushListing[]) {
  const [t] = await sql<{ token: string }[]>`SELECT token FROM push_tokens WHERE device_id = ${s.device_id}`;
  if (!t) return;
  const msg =
    listings.length === 1
      ? { title: `Neu: ${listings[0].title}`.slice(0, 120), body: fmt(listings[0]), data: { listingId: listings[0].id } }
      : { title: `${listings.length} neue Wohnungen – ${s.name}`, body: listings.slice(0, 3).map(fmt).join('\n'), data: { savedSearchId: s.id } };
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: t.token, sound: 'default', priority: 'high', ...msg }),
    });
  } catch (e) {
    console.warn('[push] failed', (e as Error).message);
  }
}
