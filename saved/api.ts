import { authenticatedApiFetch as apiFetch } from '@/lib/api-client';

export type FavouriteRecord = {
  id: string;
  placeId: string;
};

// Confirmed against backend source (tripideas-api):
// - addFavourite is an upsert with ON CONFLICT (placeId, userId) DO NOTHING
// - removeFavourite no-ops if the row doesn't exist
// - both always return 200 with an empty body, regardless of whether
//   anything actually changed — safe to treat as success unconditionally.

export async function getFavourites(): Promise<FavouriteRecord[]> {
  return apiFetch<FavouriteRecord[]>('/favourite');
}

export async function addFavourite(placeId: string): Promise<void> {
  await apiFetch<void>(`/favourite/${encodeURIComponent(placeId)}`, {
    method: 'POST',
  });
}

export async function removeFavourite(placeId: string): Promise<void> {
  await apiFetch<void>(`/favourite/${encodeURIComponent(placeId)}`, {
    method: 'DELETE',
  });
}
