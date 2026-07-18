import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { addFavourite, removeFavourite } from '@/saved/api';
import {
  getAnonSavedPlaceIds,
  getUserSavedPlaceIds,
  setAnonSavedPlaceIds,
  setUserSavedPlaceIds,
} from '@/saved/storage';
import { reconcileFavouritesForUser } from '@/saved/sync';
import { useSession } from '@/auth/provider';

type SavedPlacesContextValue = {
  isLoading: boolean;
  isSaved: (placeId?: string | null) => boolean;
  savedPlaceIds: string[];
  toggleSavedPlace: (placeId?: string | null) => Promise<void>;
};

const SavedPlacesContext = createContext<SavedPlacesContextValue | null>(null);

export function SavedPlacesProvider({ children }: PropsWithChildren) {
  const { user, session } = useSession();
  // user?.id drives the load effect so the cached user's IDs render immediately
  // on cold start without waiting for the async token refresh.
  const userId = user?.id ?? null;
  // session?.userId gates reconciliation — it's only set once auth is confirmed,
  // preventing reconcileFavouritesForUser (which clears the anon key) from
  // running against a stale cached user whose refresh token has since expired.
  const confirmedUserId = session?.userId ?? null;

  const [savedPlaceIds, setSavedPlaceIdsState] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tracks which key is "active" right now, so async loads/toggles that
  // resolve after the user has signed in/out/switched don't clobber state
  // that belongs to a different identity.
  const activeUserIdRef = useRef<string | null>(null);
  // Tracks which userId has already had reconciliation run this session, so
  // it fires once per sign-in transition rather than on every re-render.
  const reconciledUserIdRef = useRef<string | null>(null);

  // Load whichever store is active (anon, or this user's) whenever the
  // identified user changes.
  useEffect(() => {
    let isMounted = true;
    activeUserIdRef.current = userId;
    setIsLoading(true);

    const load = userId ? getUserSavedPlaceIds(userId) : getAnonSavedPlaceIds();

    load
      .then((ids) => {
        if (isMounted && activeUserIdRef.current === userId) {
          setSavedPlaceIdsState(ids);
        }
      })
      .catch((error) => {
        console.error('[Saved] failed to load saved places:', error);
      })
      .finally(() => {
        if (isMounted && activeUserIdRef.current === userId) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Sign-in reconciliation: merge anon + user-scoped + server favourites.
  // Runs once per "becoming signed in as this user" transition (covers both
  // an interactive sign-in and a restored session on cold start).
  // Gated on confirmedUserId (session?.userId) rather than userId (user?.id)
  // so it never fires while auth is still restoring from a cached user object.
  // This prevents the anon key from being cleared before we know the session
  // is actually valid.
  useEffect(() => {
    if (!confirmedUserId) {
      reconciledUserIdRef.current = null;
      return;
    }

    if (reconciledUserIdRef.current === confirmedUserId) {
      return;
    }
    reconciledUserIdRef.current = confirmedUserId;

    let isMounted = true;

    reconcileFavouritesForUser(confirmedUserId)
      .then((mergedIds) => {
        if (isMounted && activeUserIdRef.current === confirmedUserId) {
          setSavedPlaceIdsState(mergedIds);
        }
      })
      .catch((error) => {
        console.error('[Saved] reconciliation failed:', error);
      });

    return () => {
      isMounted = false;
    };
  }, [confirmedUserId]);

  const isSaved = useCallback(
    (placeId?: string | null) => {
      return Boolean(placeId && savedPlaceIds.includes(placeId));
    },
    [savedPlaceIds]
  );

  const toggleSavedPlace = useCallback(
    async (placeId?: string | null) => {
      if (!placeId) {
        return;
      }

      const toggledForUserId = userId;
      let nextIds: string[] = [];
      let wasSaved = false;

      setSavedPlaceIdsState((currentIds) => {
        wasSaved = currentIds.includes(placeId);
        nextIds = wasSaved
          ? currentIds.filter((id) => id !== placeId)
          : [placeId, ...currentIds];
        return nextIds;
      });

      try {
        const storedIds = toggledForUserId
          ? await setUserSavedPlaceIds(toggledForUserId, nextIds)
          : await setAnonSavedPlaceIds(nextIds);

        if (activeUserIdRef.current === toggledForUserId) {
          setSavedPlaceIdsState(storedIds);
        }
      } catch (error) {
        console.error('[Saved] failed to persist local toggle:', error);
        const storedIds = toggledForUserId
          ? await getUserSavedPlaceIds(toggledForUserId)
          : await getAnonSavedPlaceIds();
        if (activeUserIdRef.current === toggledForUserId) {
          setSavedPlaceIdsState(storedIds);
        }
        return;
      }

      if (!toggledForUserId) {
        // Signed out: local only, nothing to push.
        return;
      }

      try {
        if (wasSaved) {
          await removeFavourite(placeId);
        } else {
          await addFavourite(placeId);
        }
      } catch (error) {
        // Local state already reflects the toggle and stays as-is. No
        // disruptive UI — the next sign-in reconciliation will retry any
        // favourite that never made it to the server.
        console.warn('[Saved] backend push failed for', placeId, error);
      }
    },
    [userId]
  );

  const value = useMemo(
    () => ({
      isLoading,
      isSaved,
      savedPlaceIds,
      toggleSavedPlace,
    }),
    [isLoading, isSaved, savedPlaceIds, toggleSavedPlace]
  );

  return (
    <SavedPlacesContext.Provider value={value}>
      {children}
    </SavedPlacesContext.Provider>
  );
}

export function useSavedPlaces() {
  const context = useContext(SavedPlacesContext);

  if (!context) {
    throw new Error('useSavedPlaces must be used inside SavedPlacesProvider.');
  }

  return context;
}
