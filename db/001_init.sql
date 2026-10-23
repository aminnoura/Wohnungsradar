CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS listings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source           text NOT NULL,
  source_id        text NOT NULL,
  url              text NOT NULL,
  title            text NOT NULL,
  excerpt          text,
  -- full text is kept only for keyword filtering and feature extraction; the API never returns it
  search_text      text,
  image_url        text,

  city             text,
  plz              text,
  bezirk           text,
  ortsteil         text,
  street           text,
  lat              double precision,
  lng              double precision,
  geom             geography(Point, 4326) GENERATED ALWAYS AS (
                     CASE WHEN lat IS NOT NULL AND lng IS NOT NULL
                     THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography END) STORED,

  cold_rent        numeric,
  warm_rent        numeric,
  extra_costs      numeric,
  deposit          numeric,
  no_commission    boolean,

  size_m2          numeric,
  rooms            numeric,
  bedrooms         numeric,
  bathrooms        numeric,

  wbs_required     boolean,
  wbs_level        int,
  is_swap          boolean,
  index_or_staffel boolean,
  seniors_only     boolean,

  available_from   date,
  limited_term     boolean,
  is_sublet        boolean,
  furnished        text,
  is_wg_room       boolean,

  floor            int,
  total_floors     int,
  elevator         boolean,
  building_type    text,
  year_built       int,
  energy_class     text,
  heating_type     text,
  barrier_free     boolean,
  first_occupancy  boolean,

  balcony          boolean,
  garden           boolean,
  kitchen          boolean,
  cellar           boolean,
  parking          boolean,
  guest_wc         boolean,
  bathtub          boolean,
  floor_heating    boolean,

  pets_allowed     boolean,
  wg_suitable      boolean,

  offerer          text,
  is_paywalled     boolean NOT NULL DEFAULT false,
  posted_at        timestamptz,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  active           boolean NOT NULL DEFAULT true,

  canonical_id     uuid REFERENCES listings(id) ON DELETE SET NULL,
  -- set once alerts for this listing have been evaluated
  alerted          boolean NOT NULL DEFAULT false,
  -- ImmoScout "Suchen+" listings: whether we already searched the web for the same flat elsewhere
  cross_searched   boolean NOT NULL DEFAULT false,

  UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS listings_geom_idx ON listings USING gist (geom);
CREATE INDEX IF NOT EXISTS listings_first_seen_idx ON listings (first_seen_at DESC);
CREATE INDEX IF NOT EXISTS listings_plz_idx ON listings (plz) WHERE canonical_id IS NULL;
CREATE INDEX IF NOT EXISTS listings_canonical_idx ON listings (canonical_id);
CREATE INDEX IF NOT EXISTS listings_city_idx ON listings (city, bezirk, ortsteil);
CREATE INDEX IF NOT EXISTS listings_alerted_idx ON listings (alerted) WHERE NOT alerted;

CREATE TABLE IF NOT EXISTS saved_searches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id        text NOT NULL,
  name             text NOT NULL,
  filters          jsonb NOT NULL,
  notify           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_searches_device_idx ON saved_searches (device_id);

CREATE TABLE IF NOT EXISTS favorites (
  device_id        text NOT NULL,
  listing_id       uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'saved', -- saved | contacted | viewing | applied | rejected
  note             text,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, listing_id)
);

CREATE TABLE IF NOT EXISTS seen (
  device_id        text NOT NULL,
  listing_id       uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  PRIMARY KEY (device_id, listing_id)
);

CREATE TABLE IF NOT EXISTS push_tokens (
  device_id        text PRIMARY KEY,
  token            text NOT NULL,
  platform         text NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id        text NOT NULL,
  saved_search_id  uuid REFERENCES saved_searches(id) ON DELETE CASCADE,
  listing_id       uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  read             boolean NOT NULL DEFAULT false,
  UNIQUE (device_id, listing_id)
);
CREATE INDEX IF NOT EXISTS notifications_device_idx ON notifications (device_id, created_at DESC);

CREATE TABLE IF NOT EXISTS geocode_cache (
  query            text PRIMARY KEY,
  lat              double precision,
  lng              double precision,
  plz              text,
  city             text,
  bezirk           text,
  ortsteil         text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crawl_runs (
  id               bigserial PRIMARY KEY,
  source           text NOT NULL,
  city             text,
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  found            int,
  inserted         int,
  error            text
);

CREATE TABLE IF NOT EXISTS brave_usage (
  month            text PRIMARY KEY,
  queries          int NOT NULL DEFAULT 0
);
