const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/** Minimum delay between two requests to the same host. Some portals (WG-Gesucht) captcha quickly. */
const HOST_INTERVAL_MS: Record<string, number> = {
  'www.wg-gesucht.de': 8000,
  'www.kleinanzeigen.de': 4000,
  'nominatim.openstreetmap.org': 1100,
  'api.search.brave.com': 1100,
};
const DEFAULT_INTERVAL_MS = 1500;
const nextSlot = new Map<string, number>();

async function throttle(url: string) {
  const host = new URL(url).host;
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, slot + (HOST_INTERVAL_MS[host] ?? DEFAULT_INTERVAL_MS));
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

export class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
  }
}

export interface FetchOpts {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  retries?: number;
}

export async function fetchRaw(url: string, opts: FetchOpts = {}): Promise<Response> {
  const retries = opts.retries ?? 2;
  for (let attempt = 0; ; attempt++) {
    await throttle(url);
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      body: opts.body,
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
      headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8', ...opts.headers },
    });
    if (res.ok) return res;
    if (attempt < retries && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 5000 * 2 ** attempt));
      continue;
    }
    throw new HttpError(res.status, url);
  }
}

export async function fetchText(url: string, opts?: FetchOpts) {
  return (await fetchRaw(url, opts)).text();
}

export async function fetchJson<T = unknown>(url: string, opts?: FetchOpts): Promise<T> {
  return (await fetchRaw(url, { ...opts, headers: { Accept: 'application/json', ...opts?.headers } })).json() as Promise<T>;
}

/** Make a possibly-relative href absolute. */
export const abs = (href: string, base: string) => new URL(href, base).toString();
