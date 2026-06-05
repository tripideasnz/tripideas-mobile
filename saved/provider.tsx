import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getSavedPlaceIds, setSavedPlaceIds } from '@/saved/storage';

type SavedPlacesContextValue = {
  isLoading: boolean;
  isSaved: (placeId?: string | null) => boolean;
  savedPlaceIds: string[];
  toggleSavedPlace: (placeId?: string | null) => Promise<void>;
};

const SavedPlacesContext = createContext<SavedPlacesContextValue | null>(null);

export function SavedPlacesProvider({ children }: PropsWithChildren) {
  const [savedPlaceIds, setSavedPlaceIdsState] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getSavedPlaceIds()
      .then((ids) => {
        if (isMounted) {
          setSavedPlaceIdsState(ids);
        }
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const isSaved = useCallback(
    (placeId?: string | null) => {
      return Boolean(placeId && savedPlaceIds.includes(placeId));
    },
    [savedPlaceIds]
  );

  const toggleSavedPlace = useCallback(async (placeId?: string | null) => {
    if (!placeId) {
      return;
    }

    let nextIds: string[] = [];

    setSavedPlaceIdsState((currentIds) => {
      nextIds = currentIds.includes(placeId)
        ? currentIds.filter((id) => id !== placeId)
        : [placeId, ...currentIds];
      return nextIds;
    });

    try {
      const storedIds = await setSavedPlaceIds(nextIds);
      setSavedPlaceIdsState(storedIds);
    } catch (error) {
      console.error(error);
      const storedIds = await getSavedPlaceIds();
      setSavedPlaceIdsState(storedIds);
    }
  }, []);

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
