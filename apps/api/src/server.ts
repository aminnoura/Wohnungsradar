import cors from '@fastify/cors';
import { listingSelect, rowToListing, searchListings, sql } from '@wr/db';
import { BERLIN_BEZIRKE, CITIES } from '@wr/geo';
import { FAVORITE_STATUSES, FILTER_DEFS, HEATING_TYPES, SearchFiltersSchema, SOURCES, TenantProfileSchema, type Listing } from '@wr/shared';
import Fastify, { type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { generateMessage } from './message';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
void app.register(cors, { origin: true });

/** Anonymous per-install id sent by the app; scopes saved searches, favorites and notifications. */
function deviceId(req: FastifyRequest): string {
  const id = req.headers['x-device-id'];
  if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id)) throw Object.assign(new Error('x-device-id header required'), { statusCode: 400 });
  return id;
}

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw Object.assign(new Error(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')), { statusCode: 400 });
  return r.data;
}

app.get('/health', async () => ({ ok: true }));

app.get('/meta', async () => {
  const counts = await sql<{ source: string; n: number }[]>`
    SELECT source, count(*)::int AS n FROM listings WHERE active GROUP BY source`;
  const byId = Object.fromEntries(counts.map((c) => [c.source, c.n]));
  return {
    sources: SOURCES.map((s) => ({ ...s, active: byId[s.id] ?? 0 })),
    filters: FILTER_DEFS,
    bezirke: BERLIN_BEZIRKE,
    cities: CITIES.map(({ slug, name, lat, lng }) => ({ slug, name, lat, lng })),
    heatingTypes: HEATING_TYPES,
  };
});

const SearchBody = z.object({
  filters: SearchFiltersSchema.default({}),
  limit: z.number().int().min(1).max(500).default(30),
  offset: z.number().int().min(0).default(0),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});

app.post('/search', async (req) => {
  const body = parse(SearchBody, req.body ?? {});
  const id = typeof req.headers['x-device-id'] === 'string' ? req.headers['x-device-id'] : undefined;
  const { rows, total } = await searchListings(body.filters, { deviceId: id, limit: body.limit, offset: body.offset, bbox: body.bbox });
  return { total, items: rows.map(rowToListing) };
});

app.get<{ Params: { id: string } }>('/listings/:id', async (req, reply) => {
  const { id } = parse(z.object({ id: z.string().uuid() }), req.params);
  const [row] = await sql`
    SELECT ${sql.unsafe(listingSelect('l'))},
      (SELECT COALESCE(json_agg(json_build_object('source', d.source, 'url', d.url)), '[]'::json)
         FROM listings d WHERE d.canonical_id = l.id) AS "alsoOn"
    FROM listings l WHERE l.id = ${id}`;
  if (!row) return reply.code(404).send({ error: 'not found' });
  return rowToListing(row);
});

/** Suggested contact message for a listing, written for the applicant profile sent along (not stored). */
app.post<{ Params: { id: string } }>('/listings/:id/message', async (req, reply) => {
  const { id } = parse(z.object({ id: z.string().uuid() }), req.params);
  const body = parse(
    z.object({ profile: TenantProfileSchema, lang: z.enum(['de', 'en']).default('de'), fresh: z.boolean().default(false) }),
    req.body,
  );
  const [row] = await sql`SELECT ${sql.unsafe(listingSelect('l'))}, l.search_text AS "searchText" FROM listings l WHERE l.id = ${id}`;
  if (!row) return reply.code(404).send({ error: 'not found' });
  const { searchText, ...rest } = row;
  return generateMessage(rowToListing(rest) as Listing, searchText as string | null, body.profile, body.lang, body.fresh, req.log);
});

// Saved searches
app.get('/saved-searches', async (req) => {
  return sql`
    SELECT s.id, s.name, s.filters, s.notify, s.created_at AS "createdAt",
      (SELECT count(*)::int FROM notifications n WHERE n.saved_search_id = s.id AND NOT n.read) AS unread
    FROM saved_searches s WHERE device_id = ${deviceId(req)} ORDER BY created_at DESC`;
});

app.post('/saved-searches', async (req) => {
  const body = parse(z.object({ name: z.string().min(1).max(80), filters: SearchFiltersSchema, notify: z.boolean().default(true) }), req.body);
  const [row] = await sql`
    INSERT INTO saved_searches (device_id, name, filters, notify)
    VALUES (${deviceId(req)}, ${body.name}, ${sql.json(body.filters)}, ${body.notify})
    RETURNING id, name, filters, notify, created_at AS "createdAt"`;
  return row;
});

app.patch<{ Params: { id: string } }>('/saved-searches/:id', async (req) => {
  const body = parse(z.object({ name: z.string().min(1).max(80).optional(), notify: z.boolean().optional(), filters: SearchFiltersSchema.optional() }), req.body);
  const [row] = await sql`
    UPDATE saved_searches SET
      name = COALESCE(${body.name ?? null}, name),
      notify = COALESCE(${body.notify ?? null}, notify),
      filters = COALESCE(${body.filters ? sql.json(body.filters) : null}, filters)
    WHERE id = ${req.params.id} AND device_id = ${deviceId(req)}
    RETURNING id, name, filters, notify`;
  return row ?? {};
});

app.delete<{ Params: { id: string } }>('/saved-searches/:id', async (req) => {
  await sql`DELETE FROM saved_searches WHERE id = ${req.params.id} AND device_id = ${deviceId(req)}`;
  return { ok: true };
});

// Favorites / application tracker (status 'hidden' = never show again)

app.get('/favorites', async (req) => {
  const rows = await sql`
    SELECT ${sql.unsafe(listingSelect('l'))}, f.status, f.note, f.updated_at AS "updatedAt"
    FROM favorites f JOIN listings l ON l.id = f.listing_id
    WHERE f.device_id = ${deviceId(req)} ORDER BY f.updated_at DESC`;
  return rows.map((r) => ({ listing: rowToListing(r), status: r.status, note: r.note, updatedAt: r.updatedAt }));
});

app.put<{ Params: { listingId: string } }>('/favorites/:listingId', async (req) => {
  const body = parse(z.object({ status: z.enum(FAVORITE_STATUSES).default('saved'), note: z.string().max(2000).nullable().optional() }), req.body ?? {});
  await sql`
    INSERT INTO favorites (device_id, listing_id, status, note)
    VALUES (${deviceId(req)}, ${req.params.listingId}, ${body.status}, ${body.note ?? null})
    ON CONFLICT (device_id, listing_id) DO UPDATE
      SET status = EXCLUDED.status, note = COALESCE(EXCLUDED.note, favorites.note), updated_at = now()`;
  return { ok: true };
});

app.delete<{ Params: { listingId: string } }>('/favorites/:listingId', async (req) => {
  await sql`DELETE FROM favorites WHERE device_id = ${deviceId(req)} AND listing_id = ${req.params.listingId}`;
  return { ok: true };
});

app.post('/seen', async (req) => {
  const { ids } = parse(z.object({ ids: z.array(z.string().uuid()).max(200) }), req.body);
  const dev = deviceId(req);
  if (ids.length) {
    await sql`INSERT INTO seen ${sql(ids.map((listing_id) => ({ device_id: dev, listing_id })))} ON CONFLICT DO NOTHING`;
  }
  return { ok: true };
});

// Notifications (push + in-app inbox)
app.post('/push-token', async (req) => {
  const body = parse(z.object({ token: z.string().min(10), platform: z.enum(['ios', 'android', 'web']) }), req.body);
  await sql`
    INSERT INTO push_tokens (device_id, token, platform) VALUES (${deviceId(req)}, ${body.token}, ${body.platform})
    ON CONFLICT (device_id) DO UPDATE SET token = EXCLUDED.token, platform = EXCLUDED.platform, updated_at = now()`;
  return { ok: true };
});

app.get('/notifications', async (req) => {
  const rows = await sql`
    SELECT n.id AS "notificationId", n.read, n.created_at AS "createdAt", s.name AS "searchName", ${sql.unsafe(listingSelect('l'))}
    FROM notifications n
    JOIN listings l ON l.id = n.listing_id
    LEFT JOIN saved_searches s ON s.id = n.saved_search_id
    WHERE n.device_id = ${deviceId(req)}
    ORDER BY n.created_at DESC LIMIT 200`;
  return rows.map((r) => ({ id: r.notificationId, read: r.read, createdAt: r.createdAt, searchName: r.searchName, listing: rowToListing(r) }));
});

app.post('/notifications/read', async (req) => {
  await sql`UPDATE notifications SET read = true WHERE device_id = ${deviceId(req)} AND NOT read`;
  return { ok: true };
});

/** Crawl health per source: last run, last error, listings found in the last 24 h. */
app.get('/status', async () => {
  return sql`
    SELECT DISTINCT ON (source) source, city, started_at AS "lastRun", error, found,
      (SELECT count(*)::int FROM listings l WHERE l.source = r.source AND l.first_seen_at > now() - interval '24 hours') AS "new24h"
    FROM crawl_runs r ORDER BY source, started_at DESC`;
});

const port = Number(process.env.API_PORT ?? 4000);
app.listen({ port, host: '0.0.0.0' }).catch((e) => {
  app.log.error(e);
  process.exit(1);
});
