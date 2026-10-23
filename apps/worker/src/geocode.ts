import { sql } from '@wr/db';
import { ORTSTEIL_TO_BEZIRK } from '@wr/geo';
import { fetchJson } from './http';

export interface GeoHit {
  lat: number | null;
  lng: number | null;
  plz: string | null;
  city: string | null;
  bezirk: string | null;
  ortsteil: string | null;
}

interface NominatimResult {
  lat: string;
  lon: string;
  address: { postcode?: string; city?: string; town?: string; village?: string; suburb?: string; borough?: string; city_district?: string };
}

const MAX_PER_CYCLE = Number(process.env.GEOCODE_MAX_PER_CYCLE ?? 60);
let usedThisCycle = 0;
export const resetGeocodeBudget = () => (usedThisCycle = 0);

/** Forward-geocode an address via Nominatim (1 req/s, cached forever, bounded per cycle). */
export async function geocode(query: string): Promise<GeoHit | null> {
  const key = query.toLowerCase().replace(/\s+/g, ' ').trim();
  const [cached] = await sql<GeoHit[]>`SELECT lat, lng, plz, city, bezirk, ortsteil FROM geocode_cache WHERE query = ${key}`;
  if (cached) return cached.lat == null ? null : cached;
  if (usedThisCycle >= MAX_PER_CYCLE) return null;
  usedThisCycle++;

  const base = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
  const qs = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', countrycodes: 'de', limit: '1' });
  if (process.env.CONTACT_EMAIL) qs.set('email', process.env.CONTACT_EMAIL);
  let hit: GeoHit | null = null;
  try {
    const [r] = await fetchJson<NominatimResult[]>(`${base}/search?${qs}`, { headers: { 'User-Agent': 'Wohnungsradar/0.1 (apartment search aggregator)' } });
    if (r) {
      const a = r.address;
      const city = a.city ?? a.town ?? a.village ?? null;
      // In Berlin, Nominatim's "suburb" is the Ortsteil and "borough"/"city_district" the Bezirk.
      const ortsteil = city === 'Berlin' && a.suburb && ORTSTEIL_TO_BEZIRK[a.suburb] ? a.suburb : null;
      hit = {
        lat: +r.lat,
        lng: +r.lon,
        plz: a.postcode ?? null,
        city,
        ortsteil,
        bezirk: ortsteil ? ORTSTEIL_TO_BEZIRK[ortsteil] : city === 'Berlin' ? (a.borough ?? a.city_district ?? null) : null,
      };
    }
  } catch (e) {
    console.warn('[geocode] failed', query, (e as Error).message);
    return null;
  }
  await sql`
    INSERT INTO geocode_cache (query, lat, lng, plz, city, bezirk, ortsteil)
    VALUES (${key}, ${hit?.lat ?? null}, ${hit?.lng ?? null}, ${hit?.plz ?? null}, ${hit?.city ?? null}, ${hit?.bezirk ?? null}, ${hit?.ortsteil ?? null})
    ON CONFLICT (query) DO NOTHING`;
  return hit;
}
