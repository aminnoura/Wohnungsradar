import { CITY_BY_SLUG, type City } from '@wr/geo';
import { runAlerts } from './alerts';
import { runCrossSearch, runJob } from './crawl';
import { resetGeocodeBudget } from './geocode';
import { enabledAdapters } from './sources';
import type { SourceAdapter } from './sources/types';
import { expireStale } from './store';

const TICK_MS = 30_000;
const MAX_PARALLEL = 4;

const cities: City[] = (process.env.CRAWL_CITIES || 'berlin')
  .split(',')
  .map((s) => CITY_BY_SLUG[s.trim()])
  .filter(Boolean);

interface Job {
  adapter: SourceAdapter;
  city: City;
  nextAt: number;
  running: boolean;
  failures: number;
}

// Stagger the first runs so all sources don't fire at once.
const jobs: Job[] = enabledAdapters().flatMap((adapter, i) =>
  cities.filter((c) => adapter.supports(c)).map((city, j) => ({ adapter, city, nextAt: Date.now() + (i * 7 + j * 3) * 1000, running: false, failures: 0 })),
);

let lastMaintenance = 0;
let lastCrossSearch = 0;

async function tick() {
  resetGeocodeBudget();
  const now = Date.now();
  const due = jobs.filter((j) => !j.running && j.nextAt <= now);
  const slots = MAX_PARALLEL - jobs.filter((j) => j.running).length;
  await Promise.all(
    due.slice(0, Math.max(0, slots)).map(async (job) => {
      job.running = true;
      const res = await runJob(job.adapter, job.city);
      job.failures = 'error' in res ? job.failures + 1 : 0;
      // Back off exponentially on repeated failures (captcha, 403, layout change), up to 8× the interval.
      job.nextAt = Date.now() + job.adapter.intervalMin * 60_000 * Math.min(8, 2 ** job.failures);
      job.running = false;
    }),
  );
  if (now - lastCrossSearch > 20 * 60_000) {
    lastCrossSearch = now;
    await runCrossSearch().catch((e) => console.warn('[cross-search]', e.message));
  }
  await runAlerts().catch((e) => console.warn('[alerts]', e.message));
  if (now - lastMaintenance > 60 * 60_000) {
    lastMaintenance = now;
    await expireStale().catch((e) => console.warn('[expire]', e.message));
  }
}

console.log(`Wohnungsradar worker: ${jobs.length} jobs across ${cities.map((c) => c.name).join(', ')}`);
for (const j of jobs) console.log(`  ${j.adapter.id.padEnd(16)} ${j.city.slug.padEnd(12)} every ${j.adapter.intervalMin} min`);

let busy = false;
setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    await tick();
  } finally {
    busy = false;
  }
}, TICK_MS);
void tick();
