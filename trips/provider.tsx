import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getMyTrips, setMyTrips } from '@/trips/storage';
import type { MyTrip } from '@/trips/types';

type MyTripsContextValue = {
  addPlaceToTrip: (tripId: string, placeId: string) => Promise<void>;
  createTrip: (name: string) => Promise<MyTrip | null>;
  deleteTrip: (tripId: string) => Promise<void>;
  getTrip: (tripId?: string | null) => MyTrip | undefined;
  isLoading: boolean;
  removePlaceFromTrip: (tripId: string, placeId: string) => Promise<void>;
  renameTrip: (tripId: string, name: string) => Promise<void>;
  trips: MyTrip[];
  updatePlaceNote: (
    tripId: string,
    placeId: string,
    note: string
  ) => Promise<void>;
  updateTripNote: (tripId: string, note: string) => Promise<void>;
};

const MyTripsContext = createContext<MyTripsContextValue | null>(null);

function createTripId() {
  return `trip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function MyTripsProvider({ children }: PropsWithChildren) {
  const [trips, setTripsState] = useState<MyTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getMyTrips()
      .then((storedTrips) => {
        if (isMounted) {
          setTripsState(storedTrips);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const persistUpdate = useCallback(
    async (update: (currentTrips: MyTrip[]) => MyTrip[]) => {
      let nextTrips: MyTrip[] = [];

      setTripsState((currentTrips) => {
        nextTrips = update(currentTrips);
        return nextTrips;
      });

      try {
        const storedTrips = await setMyTrips(nextTrips);
        setTripsState(storedTrips);
      } catch (error) {
        console.error(error);
        setTripsState(await getMyTrips());
      }
    },
    []
  );

  const createTrip = useCallback(
    async (name: string) => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return null;
      }

      const timestamp = new Date().toISOString();
      const trip: MyTrip = {
        createdAt: timestamp,
        id: createTripId(),
        name: trimmedName,
        note: '',
        places: [],
        updatedAt: timestamp,
      };

      await persistUpdate((currentTrips) => [trip, ...currentTrips]);
      return trip;
    },
    [persistUpdate]
  );

  const renameTrip = useCallback(
    async (tripId: string, name: string) => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return;
      }

      await persistUpdate((currentTrips) =>
        currentTrips.map((trip) =>
          trip.id === tripId
            ? {
                ...trip,
                name: trimmedName,
                updatedAt: new Date().toISOString(),
              }
            : trip
        )
      );
    },
    [persistUpdate]
  );

  const deleteTrip = useCallback(
    async (tripId: string) => {
      await persistUpdate((currentTrips) =>
        currentTrips.filter((trip) => trip.id !== tripId)
      );
    },
    [persistUpdate]
  );

  const addPlaceToTrip = useCallback(
    async (tripId: string, placeId: string) => {
      const trimmedPlaceId = placeId.trim();

      if (!trimmedPlaceId) {
        return;
      }

      await persistUpdate((currentTrips) =>
        currentTrips.map((trip) => {
          if (
            trip.id !== tripId ||
            trip.places.some((place) => place.placeId === trimmedPlaceId)
          ) {
            return trip;
          }

          const timestamp = new Date().toISOString();
          return {
            ...trip,
            places: [
              ...trip.places,
              { addedAt: timestamp, note: '', placeId: trimmedPlaceId },
            ],
            updatedAt: timestamp,
          };
        })
      );
    },
    [persistUpdate]
  );

  const updateTripNote = useCallback(
    async (tripId: string, note: string) => {
      await persistUpdate((currentTrips) =>
        currentTrips.map((trip) =>
          trip.id === tripId
            ? { ...trip, note, updatedAt: new Date().toISOString() }
            : trip
        )
      );
    },
    [persistUpdate]
  );

  const removePlaceFromTrip = useCallback(
    async (tripId: string, placeId: string) => {
      await persistUpdate((currentTrips) =>
        currentTrips.map((trip) =>
          trip.id === tripId
            ? {
                ...trip,
                places: trip.places.filter(
                  (place) => place.placeId !== placeId
                ),
                updatedAt: new Date().toISOString(),
              }
            : trip
        )
      );
    },
    [persistUpdate]
  );

  const updatePlaceNote = useCallback(
    async (tripId: string, placeId: string, note: string) => {
      await persistUpdate((currentTrips) =>
        currentTrips.map((trip) =>
          trip.id === tripId
            ? {
                ...trip,
                places: trip.places.map((place) =>
                  place.placeId === placeId ? { ...place, note } : place
                ),
                updatedAt: new Date().toISOString(),
              }
            : trip
        )
      );
    },
    [persistUpdate]
  );

  const getTrip = useCallback(
    (tripId?: string | null) => trips.find((trip) => trip.id === tripId),
    [trips]
  );

  const value = useMemo(
    () => ({
      addPlaceToTrip,
      createTrip,
      deleteTrip,
      getTrip,
      isLoading,
      removePlaceFromTrip,
      renameTrip,
      trips,
      updatePlaceNote,
      updateTripNote,
    }),
    [
      addPlaceToTrip,
      createTrip,
      deleteTrip,
      getTrip,
      isLoading,
      removePlaceFromTrip,
      renameTrip,
      trips,
      updatePlaceNote,
      updateTripNote,
    ]
  );

  return (
    <MyTripsContext.Provider value={value}>{children}</MyTripsContext.Provider>
  );
}

export function useMyTrips() {
  const context = useContext(MyTripsContext);

  if (!context) {
    throw new Error('useMyTrips must be used inside MyTripsProvider.');
  }

  return context;
}
