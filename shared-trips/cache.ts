// A per-user, on-device copy of the last Shared Trips the server confirmed, so a Trip that was
// opened before can still be read offline. It is read-only data: nothing is ever queued or replayed
// from it (offline editing is deferred; see the Stage 3B report).
//
//  - keyed by user id, so one account can never read another's copy;
//  - cleared with the rest of a user's caches when their session is cleared (like notebooks);
//  - bounded: only the most recently loaded Trips are kept;
//  - re-validated with the same strict parsers as a live response, so a corrupted or outdated entry is
//    dropped rather than shown.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseSharedTripDetail, parseSharedTripList } from '@/shared-trips/parse';
import type { SharedTripDetail, SharedTripSummary } from '@/shared-trips/types';

export const CACHE_KEY_PREFIX = 'tripideas.sharedTrips.cache.v1.';
export const MAX_CACHED_TRIPS = 20;

export type CachedSnapshot = {
  details: Record<string, { data: SharedTripDetail; loadedAt: number }>;
  sharedWithMe: { data: SharedTripSummary[]; loadedAt: number } | null;
};

export type SharedTripsCache = {
  clear: (userId: string) => Promise<void>;
  load: (userId: string) => Promise<CachedSnapshot | null>;
  save: (userId: string, snapshot: CachedSnapshot) => Promise<void>;
};

type KeyValueStorage = Pick<
  typeof AsyncStorage,
  'getAllKeys' | 'getItem' | 'multiRemove' | 'removeItem' | 'setItem'
>;

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export function parseSnapshot(value: unknown): CachedSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { details?: unknown; sharedWithMe?: unknown };
  const snapshot: CachedSnapshot = { details: {}, sharedWithMe: null };

  const list = raw.sharedWithMe as { data?: unknown; loadedAt?: unknown } | null | undefined;
  if (list && isTime(list.loadedAt)) {
    try {
      snapshot.sharedWithMe = {
        data: parseSharedTripList({ sharedTrips: list.data }),
        loadedAt: list.loadedAt,
      };
    } catch {
      snapshot.sharedWithMe = null;
    }
  }

  if (raw.details && typeof raw.details === 'object') {
    for (const [id, entry] of Object.entries(raw.details as Record<string, unknown>)) {
      const item = entry as { data?: unknown; loadedAt?: unknown } | null;
      if (!item || !isTime(item.loadedAt)) continue;
      try {
        const data = parseSharedTripDetail(item.data);
        if (data.collection.id === id) snapshot.details[id] = { data, loadedAt: item.loadedAt };
      } catch {
        // A damaged entry is dropped, not shown.
      }
    }
  }
  return snapshot;
}

/** Keeps the most recently loaded Trips only. */
export function boundSnapshot(snapshot: CachedSnapshot): CachedSnapshot {
  const kept = Object.entries(snapshot.details)
    .sort(([, a], [, b]) => b.loadedAt - a.loadedAt)
    .slice(0, MAX_CACHED_TRIPS);
  return { ...snapshot, details: Object.fromEntries(kept) };
}

export function createAsyncStorageSharedTripsCache(
  storage: KeyValueStorage = AsyncStorage
): SharedTripsCache & { clearAll: () => Promise<void> } {
  return {
    clear: (userId) => storage.removeItem(CACHE_KEY_PREFIX + userId),
    clearAll: async () => {
      const keys = (await storage.getAllKeys()).filter((key) => key.startsWith(CACHE_KEY_PREFIX));
      if (keys.length) await storage.multiRemove(keys);
    },
    load: async (userId) => {
      try {
        const raw = await storage.getItem(CACHE_KEY_PREFIX + userId);
        return raw ? parseSnapshot(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    },
    save: (userId, snapshot) =>
      storage.setItem(CACHE_KEY_PREFIX + userId, JSON.stringify(boundSnapshot(snapshot))),
  };
}

export const sharedTripsCache = createAsyncStorageSharedTripsCache();

/** Used with the other per-user caches when a session is cleared. */
export async function clearSharedTripsCache(userId: string): Promise<void> {
  await sharedTripsCache.clear(userId);
}
