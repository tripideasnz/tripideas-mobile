import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';

import { useSession } from '@/auth/provider';
import {
  createPersonalPhotoLoader,
  type PersonalPhotoLoader,
  type PersonalPhotoState,
} from './photo-loader';
import { usePersonalPlaceCards } from './provider';
import { personalPhotoCacheKey } from './photo-loader';

/**
 * Loads private Personal Place photos for the assets a component is showing.
 * Only the listed assets are authorised (so unmounted, off-screen cards cost
 * nothing), authorisations come from the provider's shared cache, and failures
 * recover a bounded number of times before a retry state is shown.
 */
export function usePersonalPhotos(
  photoAssetIds: readonly string[],
  { maxAutoRetries }: { maxAutoRetries?: number } = {}
) {
  const { session } = useSession();
  const userId = session?.userId ?? null;
  const { authorizePhoto, invalidatePhotoAuthorization, peekPhotoAuthorization, photoFailures } =
    usePersonalPlaceCards();
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const [loader, setLoader] = useState<PersonalPhotoLoader | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoader(null);
      return;
    }
    const next = createPersonalPhotoLoader({
      authorize: authorizePhoto,
      failures: photoFailures,
      invalidate: invalidatePhotoAuthorization,
      maxAutoRetries,
      onChange: rerender,
      peek: peekPhotoAuthorization,
      userId,
    });
    setLoader(next);
    return () => next.dispose();
  }, [authorizePhoto, invalidatePhotoAuthorization, maxAutoRetries, peekPhotoAuthorization, photoFailures, userId]);

  const assetKey = photoAssetIds.join('|');
  useEffect(() => {
    loader?.setAssets(assetKey ? assetKey.split('|') : []);
  }, [assetKey, loader]);

  // Until the loader has published a state (the first render after a mount), a photo that is
  // already authorised and fresh is ready. This only reads the cache; it never starts a request.
  const get = useCallback(
    (photoAssetId: string): PersonalPhotoState | null => {
      const state = loader?.get(photoAssetId);
      if (state) return state;
      const url = userId ? peekPhotoAuthorization(photoAssetId) : null;
      return userId && url
        ? { attempts: 0, cacheKey: personalPhotoCacheKey(userId, photoAssetId), status: 'ready', url }
        : null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read on every change notification
    [loader, peekPhotoAuthorization, rerender, userId]
  );
  const reportError = useCallback(
    (photoAssetId: string, failedUrl?: string | null) => loader?.reportError(photoAssetId, failedUrl),
    [loader]
  );
  const retry = useCallback((photoAssetId: string) => loader?.retry(photoAssetId), [loader]);

  return useMemo(() => ({ get, reportError, retry }), [get, reportError, retry]);
}
