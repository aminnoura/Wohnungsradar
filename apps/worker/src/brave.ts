import { sql } from '@wr/db';
import { fetchJson } from './http';

export interface BraveResult {
  title: string;
  url: string;
  description?: string;
  extra_snippets?: string[];
  page_age?: string;
}

const BUDGET = Number(process.env.BRAVE_MONTHLY_BUDGET ?? 2000);

export const braveEnabled = () => !!process.env.BRAVE_API_KEY;

/** Reserve one query from this month's budget. Returns false when the budget is spent. */
async function reserve(): Promise<boolean> {
  const month = new Date().toISOString().slice(0, 7);
  const [row] = await sql<{ queries: number }[]>`
    INSERT INTO brave_usage (month, queries) VALUES (${month}, 1)
    ON CONFLICT (month) DO UPDATE SET queries = brave_usage.queries + 1
    WHERE brave_usage.queries < ${BUDGET}
    RETURNING queries`;
  return !!row;
}

export async function braveSearch(q: string, opts: { freshness?: 'pd' | 'pw' | 'pm'; count?: number } = {}): Promise<BraveResult[]> {
  if (!braveEnabled()) return [];
  if (!(await reserve())) {
    console.warn('[brave] monthly budget exhausted, skipping:', q);
    return [];
  }
  const qs = new URLSearchParams({
    q,
    country: 'DE',
    search_lang: 'de',
    count: String(opts.count ?? 20),
    extra_snippets: 'true',
    ...(opts.freshness ? { freshness: opts.freshness } : {}),
  });
  const res = await fetchJson<{ web?: { results?: BraveResult[] } }>(`https://api.search.brave.com/res/v1/web/search?${qs}`, {
    headers: { 'X-Subscription-Token': process.env.BRAVE_API_KEY! },
  });
  return res.web?.results ?? [];
}
