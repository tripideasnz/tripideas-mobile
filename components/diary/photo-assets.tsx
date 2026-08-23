import { useCallback, useEffect, useState } from 'react';

import { authorizePhotoRead } from '@/notebooks/api';

export type DiaryPhotoImage = { _key: string; alt: string; cacheKey: string; url: string };

const authorizedUrlCache = new Map<string, string>();
const authorizationInFlight = new Map<string, Promise<string>>();

async function authorizedPhotoUrl(assetId: string): Promise<string> {
  const cached = authorizedUrlCache.get(assetId);
  if (cached) return cached;
  const existing = authorizationInFlight.get(assetId);
  if (existing) return existing;
  const request = authorizePhotoRead(assetId).then(({ url }) => {
    authorizedUrlCache.set(assetId, url);
    return url;
  }).finally(() => authorizationInFlight.delete(assetId));
  authorizationInFlight.set(assetId, request);
  return request;
}

export function useDiaryPhotoImages(assetIds: string[], alt: string) {
  const key = assetIds.join('|');
  const [images, setImages] = useState<DiaryPhotoImage[]>([]);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setImages([]);
    void Promise.all(assetIds.map(async (assetId) => {
      try {
        const url = await authorizedPhotoUrl(assetId);
        return { _key: assetId, alt, cacheKey: assetId, url };
      } catch { return null; }
    })).then((resolved) => {
      if (active) setImages(resolved.filter((image): image is DiaryPhotoImage => image !== null));
    });
    return () => { active = false; };
    // Stable PhotoAsset IDs, not expiring URLs, control refresh identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refresh]);
  return {
    images,
    refresh: useCallback(() => {
      assetIds.forEach((assetId) => authorizedUrlCache.delete(assetId));
      setRefresh((value) => value + 1);
    }, [assetIds]),
  };
}

export const useOrderedDiaryPhotoImages = useDiaryPhotoImages;
