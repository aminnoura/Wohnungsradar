# Wohnungsradar

One search for apartments across 23 German portals, with Berlin-specific filters (WBS, Tauschwohnung, Bezirk/Ortsteil). It runs on **iOS, Android and web** from a single Expo codebase.

- **55 filters**, defined once in [`packages/shared/src/filters.ts`](packages/shared/src/filters.ts). That file drives the filter UI, validation and SQL.
- **Location:** all of Germany or a single city. In Berlin you can narrow to the 12 Bezirke and 96 Ortsteile, postcodes, a radius, or an area drawn on the map.
- **Hidden ImmoScout listings:** ImmoScout24 "Suchen+" (paywalled) listings are fetched through the mobile API. The app then searches the web (Brave Search) for the same flat on Kleinanzeigen and other sites, and links any match as "Auch bei …".
- **Dedup across portals:** listings are matched on location, size, rooms and rent.
- **Saved searches** trigger push notifications (iOS/Android) and appear in an in-app inbox (all platforms).
- **Map view** uses react-native-maps on iOS/Android and Leaflet on web.
- **Favorites tracker:** saved → contacted → viewing → applied → rejected.

## Layout

```
apps/mobile     Expo SDK 58 + Expo Router app (iOS / Android / web)
apps/api        Fastify REST API
apps/worker     Crawlers, normalizer, geocoder, dedup, alerts, Brave discovery
packages/shared Listing model, filter definitions, source registry
packages/geo    Berlin Bezirke/Ortsteile, German cities + portal ids
packages/db     Postgres client, migrations runner, search query builder
db/             SQL migrations (Postgres 16 + PostGIS)
```

## Run it locally

```bash
cp .env.example .env          # add BRAVE_API_KEY to enable the 8 web-discovery sources
pnpm install
pnpm db:up                    # Postgres + PostGIS in Docker
pnpm db:migrate
pnpm worker:once --source=inberlinwohnen,howoge,immoscout24   # optional quick fill
pnpm api                      # http://localhost:4000
pnpm worker                   # continuous crawling + alerts
pnpm app                      # Expo dev server: press w (web), i (iOS), a (Android)
```

On a phone running Expo Go, the app reaches the API on the machine that runs Metro (port 4000). For other setups, set `EXPO_PUBLIC_API_URL`.

Push notifications need an EAS project id (`npx eas-cli init`) and a development build. Without them, matches still show up in the app's "Alarme" inbox.

To run everything in Docker, use `docker compose --profile full up -d`.

Other useful commands:

- `pnpm test` runs the parser/normalizer tests.
- `pnpm typecheck` typechecks all packages.
- `pnpm worker:once --dry --source=<id>` crawls without touching the database and prints parsed rows.
- `pnpm worker:once --cross-search=5` searches the web for 5 recent Suchen+ listings.
- `pnpm worker:once --geocode=50` geocodes listings that don't have coordinates yet. The running worker also does this in small batches.

## Sources

| Source | How | Coverage |
|---|---|---|
| ImmoScout24 | mobile app API (includes Suchen+ listings and exposé details) | DE |
| Kleinanzeigen, WG-Gesucht, Ohne-Makler | list pages | DE (WG-Gesucht: cities with known ids) |
| inberlinwohnen, degewo, Gewobag, HOWOGE (JSON), WBM, Gesobau, Stadt und Land (JSON) | list pages / JSON | Berlin |
| Adler Group, Wunderflats, HousingAnywhere | list pages | DE |
| Immowelt/Immonet, meinestadt, Vonovia, Deutsche Wohnen, Heimstaden, Covivio, Berlinovo, Tauschwohnung | Brave Search `site:` queries (sites block plain HTTP or render client-side) | DE / Berlin |
| Web | Brave Search, open web, plus the Suchen+ cross-search | DE |

Each adapter is one file in [`apps/worker/src/sources`](apps/worker/src/sources). Most HTML adapters only declare a card selector. Field extraction (prices, m², rooms, WBS, Tausch, floor, features, …) is shared, in [`apps/worker/src/parse.ts`](apps/worker/src/parse.ts). Turn sources on or off with `SOURCES_ENABLED`, and add cities with `CRAWL_CITIES` (slugs in [`packages/geo/src/cities.ts`](packages/geo/src/cities.ts)).

Crawl politeness: requests are throttled per host (WG-Gesucht shows a captcha after a few fast requests), and failing jobs back off exponentially. Brave usage is capped by `BRAVE_MONTHLY_BUDGET`. Geocoding uses Nominatim at 1 req/s, results are cached, and each cycle has a cap.

## Before a public store release

Several portals (ImmoScout24, Immowelt, Kleinanzeigen, WG-Gesucht) prohibit automated access in their terms. The app limits what it does with their data:

- It stores facts only: price, size, rooms, area and features.
- It shows one thumbnail and a short excerpt.
- It always links to the original listing.

Before publishing to the App Store or Play Store:

- Get a legal review (UWG, database maker's right §87b UrhG, the portals' ToS).
- Prefer official partner feeds where available.
- Move the backend from a home server to a VPS.
