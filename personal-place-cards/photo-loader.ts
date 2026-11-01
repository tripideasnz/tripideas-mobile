// Bounded loading and recovery for private Personal Place photos.
//
// One loader serves one signed-in user. It asks the provider's authoriser for a
// short-lived signed URL (never stored here beyond memory), exposes a stable,
// asset-based cache key for expo-image, and recovers from failures a bounded
// number of times. It has no React or network dependencies of its own.

export const PERSONAL_PHOTO_MAX_AUTO_RETRIES = 2;
export const PERSONAL_PHOTO_RETRY_DELAYS_MS: readonly number[] = [1_000, 3_000];
export const PERSONAL_PHOTO_FAILURE_COOLDOWN_MS = 60_000;

/**
 * Stable identity for expo-image's cache. It is scoped to the signed-in user
 * and the asset, never to the signed URL, so URL refreshes do not re-download
 * and one account's key can never match another's.
 */
export const personalPhotoCacheKey = (userId: string, photoAssetId: string) =>
  `tripideas:personal-photo:v1:${userId}:${photoAssetId}`;

export type PersonalPhotoState =
  | { attempts: number; cacheKey: string; status: 'loading'; url: null }
  | { attempts: number; cacheKey: string; status: 'ready'; url: string }
  | { attempts: number; cacheKey: string; status: 'failed'; url: null };

/** Remembers assets whose automatic recovery was exhausted, across remounts. */
export function createPhotoFailureTracker({
  cooldownMs = PERSONAL_PHOTO_FAILURE_COOLDOWN_MS,
  now = Date.now,
}: { cooldownMs?: number; now?: () => number } = {}) {
  const exhaustedAt = new Map<string, number>();
  return {
    clear(photoAssetId: string) {
      exhaustedAt.delete(photoAssetId);
    },
    clearAll() {
      exhaustedAt.clear();
    },
    isExhausted(photoAssetId: string): boolean {
      const at = exhaustedAt.get(photoAssetId);
      if (at === undefined) return false;
      if (now() - at >= cooldownMs) {
        exhaustedAt.delete(photoAssetId);
        return false;
      }
      return true;
    },
    markExhausted(photoAssetId: string) {
      exhaustedAt.set(photoAssetId, now());
    },
  };
}

export type PhotoFailureTracker = ReturnType<typeof createPhotoFailureTracker>;

export type PersonalPhotoLoaderOptions = {
  authorize: (photoAssetId: string) => Promise<string>;
  delaysMs?: readonly number[];
  failures: PhotoFailureTracker;
  invalidate: (photoAssetId: string) => void;
  maxAutoRetries?: number;
  onChange: () => void;
  /** A still-fresh signed URL that needs no request, or null. Lets a remount start ready. */
  peek?: (photoAssetId: string) => string | null;
  /** Returns a function that cancels the scheduled callback. */
  schedule?: (callback: () => void, delayMs: number) => () => void;
  userId: string;
};

const defaultSchedule = (callback: () => void, delayMs: number) => {
  const handle = setTimeout(callback, delayMs);
  return () => clearTimeout(handle);
};

export function createPersonalPhotoLoader({
  authorize,
  delaysMs = PERSONAL_PHOTO_RETRY_DELAYS_MS,
  failures,
  invalidate,
  maxAutoRetries = PERSONAL_PHOTO_MAX_AUTO_RETRIES,
  onChange,
  peek,
  schedule = defaultSchedule,
  userId,
}: PersonalPhotoLoaderOptions) {
  const states = new Map<string, PersonalPhotoState>();
  const generations = new Map<string, number>();
  const cancels = new Map<string, () => void>();
  let disposed = false;

  const cacheKeyFor = (id: string) => personalPhotoCacheKey(userId, id);
  const bump = (id: string) => {
    const next = (generations.get(id) ?? 0) + 1;
    generations.set(id, next);
    return next;
  };
  const publish = (id: string, state: PersonalPhotoState) => {
    states.set(id, state);
    onChange();
  };
  const cancelPending = (id: string) => {
    cancels.get(id)?.();
    cancels.delete(id);
  };

  const fail = (id: string, attempts: number) => {
    failures.markExhausted(id);
    publish(id, { attempts, cacheKey: cacheKeyFor(id), status: 'failed', url: null });
  };

  const load = (id: string, attempts: number) => {
    const generation = bump(id);
    publish(id, { attempts, cacheKey: cacheKeyFor(id), status: 'loading', url: null });
    authorize(id).then(
      (url) => {
        if (disposed || generations.get(id) !== generation) return;
        publish(id, { attempts, cacheKey: cacheKeyFor(id), status: 'ready', url });
      },
      () => {
        if (disposed || generations.get(id) !== generation) return;
        recover(id, attempts);
      }
    );
  };

  // One automatic recovery step: bounded, delayed, and never overlapping.
  const recover = (id: string, attempts: number) => {
    if (attempts >= maxAutoRetries) {
      fail(id, attempts);
      return;
    }
    const delay = delaysMs[Math.min(attempts, delaysMs.length - 1)] ?? 1_000;
    const generation = bump(id);
    publish(id, { attempts: attempts + 1, cacheKey: cacheKeyFor(id), status: 'loading', url: null });
    cancelPending(id);
    cancels.set(
      id,
      schedule(() => {
        cancels.delete(id);
        if (disposed || generations.get(id) !== generation) return;
        invalidate(id);
        load(id, attempts + 1);
      }, delay)
    );
  };

  return {
    dispose() {
      disposed = true;
      for (const cancel of cancels.values()) cancel();
      cancels.clear();
      states.clear();
    },

    get(photoAssetId: string): PersonalPhotoState | null {
      return states.get(photoAssetId) ?? null;
    },

    /** The image failed to render. Ignored unless it is the current URL. */
    reportError(photoAssetId: string, failedUrl?: string | null) {
      const state = states.get(photoAssetId);
      if (disposed || !state || state.status !== 'ready') return;
      if (failedUrl && failedUrl !== state.url) return;
      recover(photoAssetId, state.attempts);
    },

    /** Explicit user retry: starts a fresh bounded cycle. */
    retry(photoAssetId: string) {
      if (disposed) return;
      cancelPending(photoAssetId);
      failures.clear(photoAssetId);
      invalidate(photoAssetId);
      load(photoAssetId, 0);
    },

    /** Starts the given assets, drops the rest. Only listed assets are fetched. */
    setAssets(photoAssetIds: readonly string[]) {
      if (disposed) return;
      const wanted = new Set(photoAssetIds);
      for (const id of [...states.keys()]) {
        if (wanted.has(id)) continue;
        cancelPending(id);
        bump(id);
        states.delete(id);
      }
      for (const id of wanted) {
        if (states.has(id)) continue;
        if (failures.isExhausted(id)) {
          // Recently exhausted: show the retry state without any request.
          publish(id, { attempts: maxAutoRetries, cacheKey: cacheKeyFor(id), status: 'failed', url: null });
        } else {
          const cachedUrl = peek?.(id) ?? null;
          if (cachedUrl) {
            // Already authorised and fresh: start ready, with no loading state in between.
            publish(id, { attempts: 0, cacheKey: cacheKeyFor(id), status: 'ready', url: cachedUrl });
          } else {
            load(id, 0);
          }
        }
      }
    },
  };
}

export type PersonalPhotoLoader = ReturnType<typeof createPersonalPhotoLoader>;
