import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SearchFilters } from '@wr/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const DEFAULT_FILTERS: SearchFilters = { city: 'Berlin', sort: 'newest' };

interface FilterState {
  filters: SearchFilters;
  set: (patch: Partial<SearchFilters>) => void;
  replace: (f: SearchFilters) => void;
  reset: () => void;
}

/** Current search filters, persisted per device so the last search survives restarts. */
export const useFilters = create<FilterState>()(
  persist(
    (set) => ({
      filters: DEFAULT_FILTERS,
      set: (patch) =>
        set((s) => {
          const next = { ...s.filters, ...patch } as Record<string, unknown>;
          // Drop cleared values so the request (and "active filters" count) stays minimal.
          for (const [k, v] of Object.entries(next)) {
            if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete next[k];
            else if (v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => x == null)) delete next[k];
          }
          return { filters: next as SearchFilters };
        }),
      replace: (filters) => set({ filters }),
      reset: () => set({ filters: DEFAULT_FILTERS }),
    }),
    { name: 'wr.filters', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
