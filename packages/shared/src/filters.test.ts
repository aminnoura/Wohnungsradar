import { describe, expect, it } from 'vitest';
import { countActiveFilters, FILTER_DEFS, SearchFiltersSchema } from './filters';
import { SOURCES } from './sources';

describe('filter definitions', () => {
  const schemaKeys = Object.keys(SearchFiltersSchema.shape);

  it('every UI filter has a schema field and vice versa', () => {
    expect(new Set(FILTER_DEFS.map((d) => d.key))).toEqual(new Set(schemaKeys));
  });

  it('offers at least 40 filters with unique keys', () => {
    expect(FILTER_DEFS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(FILTER_DEFS.map((d) => d.key)).size).toBe(FILTER_DEFS.length);
  });

  it('rejects unknown filters', () => {
    expect(SearchFiltersSchema.safeParse({ foo: 1 }).success).toBe(false);
  });

  it('counts only filters that narrow the search', () => {
    expect(countActiveFilters({ city: 'Berlin', sort: 'newest', wbs: 'any', balcony: false })).toBe(0);
    expect(countActiveFilters({ wbs: 'only', warmRent: { max: 900 }, bezirke: ['Neukölln'], plz: [] })).toBe(3);
  });
});

describe('sources', () => {
  it('has at least 20 sources with unique ids', () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
  });
});
