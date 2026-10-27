// Persists the in-progress Save attempt for a shared Trip so its ID survives a remount, the
// sign-in round trip and an app restart. Holds only an ID and bookkeeping, never Trip content.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AttemptStore, SaveAttempt } from '@/trips/shared-trip-save';

const KEY_PREFIX = 'tripideas.sharedTripSaveAttempt.v1.';

type KeyValueStorage = Pick<typeof AsyncStorage, 'getItem' | 'removeItem' | 'setItem'>;

function parseAttempt(value: unknown, shareId: string): SaveAttempt | null {
  if (!value || typeof value !== 'object') return null;
  const attempt = value as Record<string, unknown>;
  const phases = ['awaiting-auth', 'submitting', 'saved'];
  if (
    attempt.shareId !== shareId ||
    typeof attempt.attemptId !== 'string' ||
    attempt.attemptId.length === 0 ||
    typeof attempt.createdAt !== 'number' ||
    typeof attempt.phase !== 'string' ||
    !phases.includes(attempt.phase) ||
    (attempt.ownerUserId !== null && typeof attempt.ownerUserId !== 'string') ||
    (attempt.tripId !== undefined && typeof attempt.tripId !== 'string')
  ) {
    return null;
  }
  return attempt as SaveAttempt;
}

export function createAsyncStorageAttemptStore(
  storage: KeyValueStorage = AsyncStorage
): AttemptStore {
  return {
    clear: (shareId) => storage.removeItem(KEY_PREFIX + shareId),
    load: async (shareId) => {
      try {
        const raw = await storage.getItem(KEY_PREFIX + shareId);
        return raw ? parseAttempt(JSON.parse(raw), shareId) : null;
      } catch {
        return null;
      }
    },
    save: (attempt) =>
      storage.setItem(KEY_PREFIX + attempt.shareId, JSON.stringify(attempt)),
  };
}
