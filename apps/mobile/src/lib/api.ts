import type { FilterDef, Listing, SearchFilters, SourceInfo } from '@wr/shared';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getDeviceId } from './device';

/** EXPO_PUBLIC_API_URL wins; in development we reach the API on the machine running Metro. */
function apiBase(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (Platform.OS !== 'web' && host) return `http://${host}:4000`;
  return 'http://localhost:4000';
}

export const API_BASE = apiBase();

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', 'x-device-id': await getDeviceId() },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type FavoriteStatus = 'saved' | 'contacted' | 'viewing' | 'applied' | 'rejected';

export interface Meta {
  sources: (SourceInfo & { active: number })[];
  filters: FilterDef[];
  bezirke: Record<string, string[]>;
  cities: { slug: string; name: string; lat: number; lng: number }[];
  heatingTypes: string[];
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilters;
  notify: boolean;
  unread: number;
}

export interface SourceStatus {
  source: string;
  lastRun: string;
  error: string | null;
  found: number | null;
  new24h: number;
}

export const api = {
  meta: () => request<Meta>('/meta'),
  search: (filters: SearchFilters, opts: { limit?: number; offset?: number; bbox?: [number, number, number, number] } = {}) =>
    request<{ total: number; items: Listing[] }>('/search', { body: { filters, ...opts } }),
  listing: (id: string) => request<Listing>(`/listings/${id}`),

  savedSearches: () => request<SavedSearch[]>('/saved-searches'),
  saveSearch: (name: string, filters: SearchFilters) => request<SavedSearch>('/saved-searches', { body: { name, filters, notify: true } }),
  updateSearch: (id: string, patch: Partial<Pick<SavedSearch, 'name' | 'notify' | 'filters'>>) =>
    request(`/saved-searches/${id}`, { method: 'PATCH', body: patch }),
  deleteSearch: (id: string) => request(`/saved-searches/${id}`, { method: 'DELETE' }),

  favorites: () => request<{ listing: Listing; status: FavoriteStatus; note: string | null }[]>('/favorites'),
  setFavorite: (listingId: string, status: FavoriteStatus, note?: string | null) =>
    request(`/favorites/${listingId}`, { method: 'PUT', body: { status, note } }),
  removeFavorite: (listingId: string) => request(`/favorites/${listingId}`, { method: 'DELETE' }),

  markSeen: (ids: string[]) => request('/seen', { body: { ids } }),
  pushToken: (token: string, platform: 'ios' | 'android' | 'web') => request('/push-token', { body: { token, platform } }),
  notifications: () => request<{ id: string; read: boolean; createdAt: string; searchName: string | null; listing: Listing }[]>('/notifications'),
  readNotifications: () => request('/notifications/read', { body: {} }),
  status: () => request<SourceStatus[]>('/status'),
};
