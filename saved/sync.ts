import { addFavourite, getFavourites } from '@/saved/api';
import {
  getAnonSavedPlaceIds,
  getUserSavedPlaceIds,
  setAnonSavedPlaceIds,
  setUserSavedPlaceIds,
} from '@/saved/storage';

function union(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

// Runs once per sign-in (or restored session) for a given user.
//
// Phase A — local-only, no network:
//   merge anon-mode saves into this user's scoped cache, then clear the anon
//   key. Clearing happens immediately after the local merge is persisted, so
//   it never depends on the network call succeeding — this is what prevents
//   anon-origin saves from being re-migrated into a *different* account later.
//
// Phase B — server reconciliation, best-effort:
//   pull the server's favourites, union with the merged local set, push
//   whatever's local-only. No deletes are pulled or pushed here — additive
//   only. If the network call fails, Phase A's result still stands.
export async function reconcileFavouritesForUser(userId: string): Promise<string[]> {
  const anonIds = await getAnonSavedPlaceIds();
  const userIds = await getUserSavedPlaceIds(userId);
  const locallyMerged = union(userIds, anonIds);

  await setUserSavedPlaceIds(userId, locallyMerged);

  if (anonIds.length > 0) {
    await setAnonSavedPlaceIds([]);
  }

  try {
    const serverFavourites = await getFavourites();
    const serverIds = serverFavourites.map((favourite) => favourite.placeId);
    const fullyMerged = union(locallyMerged, serverIds);

    await setUserSavedPlaceIds(userId, fullyMerged);

    const localOnlyIds = fullyMerged.filter((id) => !serverIds.includes(id));

    await Promise.all(
      localOnlyIds.map((placeId) =>
        addFavourite(placeId).catch((error) => {
          console.warn('[Saved] failed to push favourite to server:', placeId, error);
        })
      )
    );

    return fullyMerged;
  } catch (error) {
    console.warn('[Saved] server reconciliation failed, keeping local merge:', error);
    return locallyMerged;
  }
}
