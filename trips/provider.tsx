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

import { useSession } from '@/auth/provider';
import { ApiError } from '@/lib/api-client';
import {
  addEditorialEntryRequest,
  createTripRequest,
  deleteEntryRequest,
  deleteTripRequest,
  listTripSummaries,
  listTrips,
  loadTrip,
  updateEntryNoteRequest,
  updateTripRequest,
} from '@/trips/api';
import {
  fingerprintLegacyTrips,
  migrationProgress,
  projectVisibleTrips,
  runTripMigration,
  shouldOfferTripImport,
  type TripMigrationProgress,
} from '@/trips/migration';
import { getMyTrips, setMyTrips, tripStorage } from '@/trips/storage';
import type { MyTrip, TripMigrationJournal } from '@/trips/types';

type ImportDecision = {
  accountLabel: string;
  count: number;
} | null;

type MyTripsContextValue = {
  addPlaceToTrip: (tripId: string, placeId: string) => Promise<void>;
  confirmImport: () => Promise<void>;
  createTrip: (name: string) => Promise<MyTrip | null>;
  createTripWithPlace: (name: string, placeId: string) => Promise<MyTrip | null>;
  deferImport: () => void;
  deleteTrip: (tripId: string) => Promise<void>;
  getTrip: (tripId?: string | null) => MyTrip | undefined;
  importDecision: ImportDecision;
  importProgress: TripMigrationProgress;
  isImporting: boolean;
  isLoading: boolean;
  loadError: string | null;
  refresh: () => Promise<void>;
  removePlaceFromTrip: (tripId: string, placeId: string) => Promise<void>;
  renameTrip: (tripId: string, name: string) => Promise<void>;
  retryImport: () => Promise<void>;
  trips: MyTrip[];
  updatePlaceNote: (tripId: string, placeId: string, note: string) => Promise<void>;
  updateTripNote: (tripId: string, note: string) => Promise<void>;
};

const MyTripsContext = createContext<MyTripsContextValue | null>(null);

function createLocalTripId() {
  return `trip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEntryId() {
  return `ite_mob_${Date.now()}${Math.random().toString(36).slice(2, 14)}`;
}

function createQueue() {
  const pending = new Map<string, Promise<unknown>>();
  return <T,>(key: string, task: () => Promise<T>) => {
    const previous = pending.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    pending.set(key, next);
    void next.finally(() => {
      if (pending.get(key) === next) pending.delete(key);
    });
    return next;
  };
}

export function MyTripsProvider({ children }: PropsWithChildren) {
  const { session, user } = useSession();
  const userId = session?.userId ?? null;
  const activeUserRef = useRef<string | null>(null);
  const apiTripsRef = useRef<MyTrip[]>([]);
  const legacyTripsRef = useRef<MyTrip[]>([]);
  const journalRef = useRef<TripMigrationJournal | null>(null);
  const showLegacyRef = useRef(false);
  const localMutationsAllowedRef = useRef(true);
  const deferredForSessionRef = useRef(new Set<string>());
  const enqueue = useRef(createQueue()).current;
  const [trips, setTripsState] = useState<MyTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importDecision, setImportDecision] = useState<ImportDecision>(null);
  const [journal, setJournal] = useState<TripMigrationJournal | null>(null);

  const visibleTrips = useCallback((apiTrips: MyTrip[]) => {
    return projectVisibleTrips(
      apiTrips,
      legacyTripsRef.current,
      journalRef.current,
      showLegacyRef.current
    );
  }, []);

  const storeAuthoritative = useCallback(async (ownerId: string, next: MyTrip[]) => {
    if (activeUserRef.current !== ownerId) return;
    const stored = await tripStorage.setCache(ownerId, next);
    if (activeUserRef.current === ownerId) {
      apiTripsRef.current = stored;
      setTripsState(visibleTrips(stored));
    }
  }, [visibleTrips]);

  const refresh = useCallback(async () => {
    const ownerId = activeUserRef.current;
    if (!ownerId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const latest = await listTrips(await tripStorage.getCache(ownerId));
      await storeAuthoritative(ownerId, latest);
    } catch {
      if (activeUserRef.current === ownerId) {
        setLoadError('Showing saved Trips. Connect to refresh them.');
      }
    } finally {
      if (activeUserRef.current === ownerId) setIsLoading(false);
    }
  }, [storeAuthoritative]);

  useEffect(() => {
    let mounted = true;
    activeUserRef.current = userId;
    apiTripsRef.current = [];
    setTripsState([]);
    setImportDecision(null);
    setJournal(null);
    journalRef.current = null;
    showLegacyRef.current = false;
    setLoadError(null);
    setIsLoading(true);

    void (async () => {
      const legacy = await getMyTrips();
      legacyTripsRef.current = legacy;
      if (!mounted) return;

      if (!userId) {
        const claim = await tripStorage.getClaim();
        localMutationsAllowedRef.current = !claim;
        setTripsState(claim ? [] : legacy);
        setIsLoading(false);
        return;
      }
      localMutationsAllowedRef.current = false;

      const [cached, existingJournal, claim] = await Promise.all([
        tripStorage.getCache(userId),
        tripStorage.getJournal(userId),
        tripStorage.getClaim(),
      ]);
      if (!mounted || activeUserRef.current !== userId) return;
      setTripsState(cached);
      apiTripsRef.current = cached;
      setJournal(existingJournal);
      journalRef.current = existingJournal;

      const sourceFingerprint =
        legacy.length > 0 ? await fingerprintLegacyTrips(legacy) : null;
      const shouldOffer = shouldOfferTripImport({
        claimedUserId: claim?.userId ?? null,
        deferred: deferredForSessionRef.current.has(userId),
        journal: existingJournal,
        sourceCount: legacy.length,
        sourceFingerprint,
        userId,
      });
      showLegacyRef.current =
        legacy.length > 0 &&
        (!claim || claim.userId === userId) &&
        !existingJournal?.entries.every((entry) => entry.state === 'COMPLETED');
      setTripsState(visibleTrips(cached));
      if (shouldOffer) {
        setImportDecision({
          accountLabel: user?.email ?? user?.name ?? 'this account',
          count: legacy.length,
        });
      }
      await refresh();
    })().catch(() => {
      if (mounted) {
        setLoadError('Showing saved Trips. Connect to refresh them.');
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      if (activeUserRef.current === userId) activeUserRef.current = null;
    };
  }, [refresh, user?.email, user?.name, userId]);

  const runImport = useCallback(async () => {
    const ownerId = activeUserRef.current;
    if (!ownerId || legacyTripsRef.current.length === 0) return;
    setIsImporting(true);
    setImportDecision(null);
    try {
      const result = await runTripMigration(ownerId, legacyTripsRef.current);
      setJournal(result.journal);
      journalRef.current = result.journal;
      showLegacyRef.current = !result.journal.entries.every(
        (entry) => entry.state === 'COMPLETED'
      );
      await refresh();
    } finally {
      if (activeUserRef.current === ownerId) setIsImporting(false);
    }
  }, [refresh]);

  const deferImport = useCallback(() => {
    const ownerId = activeUserRef.current;
    if (ownerId) deferredForSessionRef.current.add(ownerId);
    setImportDecision(null);
    setLoadError(
      'Device Trips remain readable. Import them before editing from this account.'
    );
  }, []);

  const mutateAndRefresh = useCallback(
    async (tripId: string, task: (trip: MyTrip) => Promise<void>) => {
      const ownerId = activeUserRef.current;
      if (!ownerId) throw new ApiError(401, 'mobile_session_required');
      await enqueue(tripId, async () => {
        const current = apiTripsRef.current.find((trip) => trip.id === tripId);
        if (!current) throw new ApiError(404, 'trip_not_found');
        await task(current);
        const summary = (await listTripSummaries()).find((item) => item.id === tripId);
        if (!summary) {
          await storeAuthoritative(
            ownerId,
            apiTripsRef.current.filter((trip) => trip.id !== tripId)
          );
          return;
        }
        const latest = await loadTrip(summary, current);
        await storeAuthoritative(
          ownerId,
          apiTripsRef.current.map((trip) => (trip.id === tripId ? latest : trip))
        );
      });
    },
    [enqueue, storeAuthoritative]
  );

  const persistLocal = useCallback(
    async (update: (current: MyTrip[]) => MyTrip[]) => {
      if (!localMutationsAllowedRef.current) {
        throw new ApiError(401, 'mobile_session_required');
      }
      const stored = await setMyTrips(update(trips));
      legacyTripsRef.current = stored;
      setTripsState(stored);
      return stored;
    },
    [trips]
  );

  const createTrip = useCallback(async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    if (!activeUserRef.current) {
      if (!localMutationsAllowedRef.current) return null;
      const timestamp = new Date().toISOString();
      const trip: MyTrip = {
        createdAt: timestamp,
        id: createLocalTripId(),
        name: trimmedName,
        note: '',
        places: [],
        updatedAt: timestamp,
      };
      await persistLocal((current) => [trip, ...current]);
      return trip;
    }
    const ownerId = activeUserRef.current;
    const id = await createTripRequest({ entryOrder: [], name: trimmedName });
    const summary = (await listTripSummaries()).find((item) => item.id === id);
    if (!summary) throw new ApiError(503, 'verification_failed');
    const trip = await loadTrip(summary);
    await storeAuthoritative(ownerId, [trip, ...apiTripsRef.current]);
    return trip;
  }, [persistLocal, storeAuthoritative]);

  const addPlaceToTrip = useCallback(async (tripId: string, placeId: string) => {
    const trimmed = placeId.trim();
    if (!trimmed) return;
    if (!activeUserRef.current) {
      if (!localMutationsAllowedRef.current) return;
      await persistLocal((current) =>
        current.map((trip) =>
          trip.id !== tripId || trip.places.some((place) => place.placeId === trimmed)
            ? trip
            : {
                ...trip,
                places: [...trip.places, {
                  addedAt: new Date().toISOString(),
                  note: '',
                  placeId: trimmed,
                }],
                updatedAt: new Date().toISOString(),
              }
        )
      );
      return;
    }
    await mutateAndRefresh(tripId, async (trip) => {
      if (trip.places.some((place) => place.placeId === trimmed)) return;
      await addEditorialEntryRequest(tripId, {
        id: createEntryId(),
        note: '',
        placeId: trimmed,
      });
    });
  }, [mutateAndRefresh, persistLocal]);

  const createTripWithPlace = useCallback(async (name: string, placeId: string) => {
    const trimmedName = name.trim();
    const trimmedPlaceId = placeId.trim();
    if (!trimmedName || !trimmedPlaceId) return null;
    if (!activeUserRef.current) {
      if (!localMutationsAllowedRef.current) return null;
      const timestamp = new Date().toISOString();
      const trip: MyTrip = {
        createdAt: timestamp,
        id: createLocalTripId(),
        name: trimmedName,
        note: '',
        places: [{
          addedAt: timestamp,
          note: '',
          placeId: trimmedPlaceId,
        }],
        updatedAt: timestamp,
      };
      await persistLocal((current) => [trip, ...current]);
      return trip;
    }
    const ownerId = activeUserRef.current;
    const id = await createTripRequest({ entryOrder: [], name: trimmedName });
    await addEditorialEntryRequest(id, {
      id: createEntryId(),
      note: '',
      placeId: trimmedPlaceId,
    });
    const summary = (await listTripSummaries()).find((item) => item.id === id);
    if (!summary) throw new ApiError(503, 'verification_failed');
    const trip = await loadTrip(summary);
    await storeAuthoritative(ownerId, [trip, ...apiTripsRef.current]);
    return trip;
  }, [persistLocal, storeAuthoritative]);

  const renameTrip = useCallback(async (tripId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!activeUserRef.current) {
      if (!localMutationsAllowedRef.current) return;
      await persistLocal((current) =>
        current.map((trip) => trip.id === tripId ? { ...trip, name: trimmed } : trip)
      );
      return;
    }
    await mutateAndRefresh(tripId, (trip) =>
      updateTripRequest(tripId, {
        entryOrder: trip.places.flatMap((place) => place.entryId ?? []),
        name: trimmed,
      })
    );
  }, [mutateAndRefresh, persistLocal]);

  const updateTripNote = useCallback(async (tripId: string, note: string) => {
    if (!activeUserRef.current) {
      if (!localMutationsAllowedRef.current) return;
      await persistLocal((current) =>
        current.map((trip) => trip.id === tripId ? { ...trip, note } : trip)
      );
      return;
    }
    await mutateAndRefresh(tripId, (trip) =>
      updateTripRequest(tripId, {
        description: note,
        entryOrder: trip.places.flatMap((place) => place.entryId ?? []),
      })
    );
  }, [mutateAndRefresh, persistLocal]);

  const updatePlaceNote = useCallback(
    async (tripId: string, placeId: string, note: string) => {
      if (!activeUserRef.current) {
        if (!localMutationsAllowedRef.current) return;
        await persistLocal((current) =>
          current.map((trip) => trip.id === tripId
            ? {
                ...trip,
                places: trip.places.map((place) =>
                  place.placeId === placeId ? { ...place, note } : place
                ),
              }
            : trip)
        );
        return;
      }
      await mutateAndRefresh(tripId, async (trip) => {
        const entryId = trip.places.find((place) => place.placeId === placeId)?.entryId;
        if (!entryId) throw new ApiError(409, 'trip_entry_missing');
        await updateEntryNoteRequest(tripId, entryId, note);
      });
    },
    [mutateAndRefresh, persistLocal]
  );

  const removePlaceFromTrip = useCallback(async (tripId: string, placeId: string) => {
    if (!activeUserRef.current) {
      if (!localMutationsAllowedRef.current) return;
      await persistLocal((current) =>
        current.map((trip) => trip.id === tripId
          ? { ...trip, places: trip.places.filter((place) => place.placeId !== placeId) }
          : trip)
      );
      return;
    }
    await mutateAndRefresh(tripId, async (trip) => {
      const entryId = trip.places.find((place) => place.placeId === placeId)?.entryId;
      if (!entryId) throw new ApiError(409, 'trip_entry_missing');
      await deleteEntryRequest(tripId, entryId);
    });
  }, [mutateAndRefresh, persistLocal]);

  const deleteTrip = useCallback(async (tripId: string) => {
    if (!activeUserRef.current) {
      if (!localMutationsAllowedRef.current) return;
      await persistLocal((current) => current.filter((trip) => trip.id !== tripId));
      return;
    }
    const ownerId = activeUserRef.current;
    await deleteTripRequest(tripId);
    await storeAuthoritative(
      ownerId,
      apiTripsRef.current.filter((trip) => trip.id !== tripId)
    );
  }, [persistLocal, storeAuthoritative]);

  const getTrip = useCallback(
    (tripId?: string | null) => trips.find((trip) => trip.id === tripId),
    [trips]
  );

  const value = useMemo<MyTripsContextValue>(() => ({
    addPlaceToTrip,
    confirmImport: runImport,
    createTrip,
    createTripWithPlace,
    deferImport,
    deleteTrip,
    getTrip,
    importDecision,
    importProgress: migrationProgress(journal),
    isImporting,
    isLoading,
    loadError,
    refresh,
    removePlaceFromTrip,
    renameTrip,
    retryImport: runImport,
    trips,
    updatePlaceNote,
    updateTripNote,
  }), [
    addPlaceToTrip, createTrip, createTripWithPlace, deferImport, deleteTrip,
    getTrip, importDecision, isImporting, isLoading, journal, loadError,
    refresh, removePlaceFromTrip, renameTrip, runImport, trips,
    updatePlaceNote, updateTripNote,
  ]);

  return <MyTripsContext.Provider value={value}>{children}</MyTripsContext.Provider>;
}

export function useMyTrips() {
  const context = useContext(MyTripsContext);
  if (!context) throw new Error('useMyTrips must be used inside MyTripsProvider.');
  return context;
}
