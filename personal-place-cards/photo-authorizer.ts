// Short-lived, in-memory photo read authorisations.
//
// A signed read URL is never persisted: it lives in this map only until it is
// about to expire. Concurrent requests for one asset share a single API call.
// clear() (used on sign-out or account switch) drops every URL and makes any
// response that was still in flight unusable, so nothing can cross accounts.

export type PhotoAuthorization = { expiresAt: string; url: string };

export function createPhotoAuthorizer({
  fetchAuthorization,
  now = Date.now,
  skewMs = 30_000,
}: {
  fetchAuthorization: (photoAssetId: string) => Promise<PhotoAuthorization>;
  now?: () => number;
  skewMs?: number;
}) {
  const cache = new Map<string, PhotoAuthorization>();
  const inFlight = new Map<string, Promise<string>>();
  let generation = 0;

  return {
    authorize(photoAssetId: string): Promise<string> {
      const cached = cache.get(photoAssetId);
      if (cached && Date.parse(cached.expiresAt) > now() + skewMs) {
        return Promise.resolve(cached.url);
      }
      const pending = inFlight.get(photoAssetId);
      if (pending) return pending;

      const startedIn = generation;
      const request: Promise<string> = fetchAuthorization(photoAssetId)
        .then((authorization) => {
          // A response that arrives after clear() belongs to a previous
          // identity: it is neither cached nor returned.
          if (startedIn !== generation) throw new Error('photo_authorization_discarded');
          cache.set(photoAssetId, authorization);
          return authorization.url;
        })
        .finally(() => {
          if (inFlight.get(photoAssetId) === request) inFlight.delete(photoAssetId);
        });
      inFlight.set(photoAssetId, request);
      return request;
    },

    invalidate(photoAssetId: string) {
      cache.delete(photoAssetId);
    },

    clear() {
      generation += 1;
      cache.clear();
      inFlight.clear();
    },
  };
}

export type PhotoAuthorizer = ReturnType<typeof createPhotoAuthorizer>;
