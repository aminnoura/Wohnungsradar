// Run sources once and print what was stored:  pnpm worker:once --source=howoge --city=berlin [--dry]
import { sql } from '@wr/db';
import { CITY_BY_SLUG } from '@wr/geo';
import { runAlerts } from './alerts';
import { runCrossSearch, runJob } from './crawl';
import { normalize } from './normalize';
import { ADAPTERS } from './sources';

const args: Record<string, string> = Object.fromEntries(
  process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true']; }),
);
const city = CITY_BY_SLUG[args.city ?? 'berlin'];
const wanted = args.source ? String(args.source).split(',') : ADAPTERS.map((a) => a.id);

async function main() {
  if (args['cross-search']) {
    await runCrossSearch(Number(args['cross-search']) || 3);
    return;
  }
  for (const adapter of ADAPTERS.filter((a) => wanted.includes(a.id))) {
    if (!adapter.supports(city)) {
      console.log(`[${adapter.id}] does not support ${city.slug} (or needs BRAVE_API_KEY)`);
      continue;
    }
    if (args.dry) {
      const raws = await adapter.crawl(city);
      console.log(`[${adapter.id}] ${raws.length} listings (dry run)`);
      for (const r of raws.slice(0, 3)) {
        const n = normalize(r, adapter, city.name);
        console.log(JSON.stringify(Object.fromEntries(Object.entries(n).filter(([k, v]) => v != null && k !== 'searchText')), null, 1));
      }
      continue;
    }
    await runJob(adapter, city);
  }
  if (!args.dry) await runAlerts();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
