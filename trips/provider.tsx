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
  addPersonalCardEntryRequest,
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
import { CreateTripWithPlaceError } from '@/trips/workflow-errors';

type ImportDecision = {
  accountLabel: string;
  count: number;
} | null;

type MyTripsContextValue = {
  addPersonalCardToTrip: (tripId: string, cardId: string) => Promise<void>;
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
  /** True only while there is no usable Trips data yet for the current user. */
  isLoading: boolean;
  /** True while a refresh runs and the current user's Trips are already available. */
  isRefreshing: boolean;
  loadError: string | null;
  refresh: () => Promise<void>;
  removePlaceFromTrip: (tripId: string, placeId: string) => Promise<void>;
  removeTripEntry: (tripId: string, entryId: string) => Promise<void>;
  renameTrip: (tripId: string, name: string) => Promise<void>;
  retryImport: () => Promise<void>;
  trips: MyTrip[];
  updatePlaceNote: (tripId: string, placeId: string, note: string) => Promise<void>;
  updateTripEntryNote: (
    tripId: string,
    entryId: string,
    note: string
  ) => Promise<void>;
  updateTripNote: (tripId: string, note: string) => Promise<void>;
};

const MyTripsContext = createContext<MyTripsContextValue | null>(null);

// A refresh that keeps being overtaken by edits gives up after this many fetches.
const MAX_REFRESH_ATTEMPTS = 3;

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
    void next.then(
      () => {
        if (pending.get(key) === next) pending.delete(key);
      },
      () => {
        if (pending.get(key) === next) pending.delete(key);
      }
    );
    return next;
  };
}

export function MyTripsProvider({ children }: PropsWithChildren) {
  const { session, user } = useSession();
  const userId = session?.userId ?? null;
  const activeUserRef = useRef<string | null>(null);
  const apiTripsRef = useRef<MyTrip[]>([]);
  const deletedTripIdsRef = useRef<string[]>([]);
  const legacyTripsRef = useRef<MyTrip[]>([]);
  const journalRef = useRef<TripMigrationJournal | null>(null);
  const showLegacyRef = useRef(false);
  const localMutationsAllowedRef = useRef(true);
  const deferredForSessionRef = useRef(new Set<string>());
  const enqueue = useRef(createQueue()).current;
  const [trips, setTripsState] = useState<MyTrip[]>([]);
  // Whether any request is in flight (the initial load or a refresh).
  const [isFetching, setIsFetching] = useState(true);
  // Whether the current user already has usable Trips to show: cached or device
  // Trips found at load, or a completed refresh. Reset for every user.
  const [hasData, setHasData] = useState(false);
  const isLoading = isFetching && !hasData;
  const isRefreshing = isFetching && hasData;
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

  // Bumped every time Trips are written. A refresh remembers the value it started
  // at: if it has moved by the time the response arrives, a write (a mutation) landed
  // while the request was in flight, and that response may predate it.
  const writeVersionRef = useRef(0);
  // The one full refresh that may run at a time for the active user, and, for callers
  // that need data newer than a refresh already running, one follow-up queued behind it.
  const refreshInFlightRef = useRef<{ ownerId: string; promise: Promise<void> } | null>(null);
  const followUpRef = useRef<{ ownerId: string; promise: Promise<void> } | null>(null);

  // Cache writes for one user run one at a time, in the order they were requested, so a
  // slow older write can never finish after, and so overwrite on disk, a newer one.
  // Writes for different users are independent: each only touches its own user's key.
  const cacheWritesRef = useRef(new Map<string, Promise<unknown>>());

  const storeAuthoritative = useCallback(
    async (ownerId: string, next: MyTrip[], options?: { skipIfSuperseded?: boolean }) => {
      if (activeUserRef.current !== ownerId) return;
      const version = ++writeVersionRef.current;
      const previous = cacheWritesRef.current.get(ownerId) ?? Promise.resolve();
      const write = previous
        .catch(() => undefined)
        .then(async (): Promise<MyTrip[] | null> => {
          // A refresh's write that has been overtaken by a newer write is dropped before it
          // reaches storage, so stale Trips are never persisted behind a newer result.
          if (options?.skipIfSuperseded && writeVersionRef.current !== version) return null;
          return tripStorage.setCache(ownerId, next);
        });
      cacheWritesRef.current.set(ownerId, write.catch(() => undefined));
      const stored = await write;
      if (stored === null || activeUserRef.current !== ownerId) return;
      // Writes complete in request order, so a later one still to come will apply after this.
      if (options?.skipIfSuperseded && writeVersionRef.current !== version) return;
      apiTripsRef.current = stored;
      setTripsState(visibleTrips(stored));
    },
    [visibleTrips]
  );

  // Fetch the Trips and store them. Returns whether they were applied. A response that
  // may predate a mutation made while it was in flight is discarded and fetched again
  // (a few attempts at most, so a steady stream of edits cannot loop forever).
  const fetchAndStore = useCallback(async (ownerId: string): Promise<boolean> => {
    for (let attempt = 0; attempt < MAX_REFRESH_ATTEMPTS; attempt += 1) {
      const startedAtVersion = writeVersionRef.current;
      const latest = await listTrips(
        await tripStorage.getCache(ownerId),
        deletedTripIdsRef.current
      );
      if (activeUserRef.current !== ownerId) return false;
      if (writeVersionRef.current !== startedAtVersion) continue;
      await storeAuthoritative(ownerId, latest, { skipIfSuperseded: true });
      return activeUserRef.current === ownerId;
    }
    return false;
  }, [storeAuthoritative]);

  const startRefresh = useCallback((ownerId: string): Promise<void> => {
    setIsFetching(true);
    setLoadError(null);
    const entry: { ownerId: string; promise: Promise<void> } = {
      ownerId,
      promise: Promise.resolve(),
    };
    entry.promise = (async () => {
      try {
        if ((await fetchAndStore(ownerId)) && activeUserRef.current === ownerId) {
          setHasData(true);
        }
      } catch {
        if (activeUserRef.current === ownerId) {
          setLoadError('Showing saved Trips. Connect to refresh them.');
        }
      } finally {
        // Release the guard on success and on failure alike.
        if (refreshInFlightRef.current === entry) refreshInFlightRef.current = null;
        if (activeUserRef.current === ownerId) setIsFetching(false);
      }
    })();
    refreshInFlightRef.current = entry;
    return entry.promise;
  }, [fetchAndStore]);

  // Ordinary refresh (focus, pull, startup): joins the refresh already running for this
  // user, so overlapping requests share one full request sequence and one outcome.
  const refresh = useCallback((): Promise<void> => {
    const ownerId = activeUserRef.current;
    if (!ownerId) return Promise.resolve();
    const running = refreshInFlightRef.current;
    if (running && running.ownerId === ownerId) return running.promise;
    return startRefresh(ownerId);
  }, [startRefresh]);

  // For callers that have just changed Trips on the server by some route that does not go
  // through storeAuthoritative (the import): a refresh already running may have read
  // before that change, so joining it is not enough. Queue one refresh behind it instead.
  const refreshAfterServerChange = useCallback((): Promise<void> => {
    const ownerId = activeUserRef.current;
    if (!ownerId) return Promise.resolve();
    const running = refreshInFlightRef.current;
    if (!running || running.ownerId !== ownerId) return startRefresh(ownerId);
    const queued = followUpRef.current;
    if (queued && queued.ownerId === ownerId) return queued.promise;
    const followUp: { ownerId: string; promise: Promise<void> } = {
      ownerId,
      promise: Promise.resolve(),
    };
    followUp.promise = running.promise.then(() => {
      if (followUpRef.current === followUp) followUpRef.current = null;
      return activeUserRef.current === ownerId ? startRefresh(ownerId) : undefined;
    });
    followUpRef.current = followUp;
    return followUp.promise;
  }, [startRefresh]);

  useEffect(() => {
    let mounted = true;
    activeUserRef.current = userId;
    // Another account never joins or waits on this one's refresh.
    refreshInFlightRef.current = null;
    followUpRef.current = null;
    apiTripsRef.current = [];
    deletedTripIdsRef.current = [];
    setTripsState([]);
    setImportDecision(null);
    setJournal(null);
    journalRef.current = null;
    showLegacyRef.current = false;
    setLoadError(null);
    // Previous-account data is gone before anything else, including its availability flag.
    setHasData(false);
    setIsFetching(true);

    void (async () => {
      const legacy = await getMyTrips();
      legacyTripsRef.current = legacy;
      if (!mounted) return;

      if (!userId) {
        const claim = await tripStorage.getClaim();
        localMutationsAllowedRef.current = !claim;
        setTripsState(claim ? [] : legacy);
        setIsFetching(false);
        return;
      }
      localMutationsAllowedRef.current = false;

      const [cached, deletedTripIds, existingJournal, claim] = await Promise.all([
        tripStorage.getCache(userId),
        tripStorage.getDeletedTripIds(userId),
        tripStorage.getJournal(userId),
        tripStorage.getClaim(),
      ]);
      if (!mounted || activeUserRef.current !== userId) return;
      setTripsState(cached);
      apiTripsRef.current = cached;
      deletedTripIdsRef.current = deletedTripIds;
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
      const visible = visibleTrips(cached);
      setTripsState(visible);
      setHasData(visible.length > 0);
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
        setIsFetching(false);
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
      await refreshAfterServerChange();
    } finally {
      if (activeUserRef.current === ownerId) setIsImporting(false);
    }
  }, [refreshAfterServerChange]);

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
    const timestamp = new Date().toISOString();
    const trip: MyTrip = {
      createdAt: timestamp,
      entries: [],
      id,
      name: trimmedName,
      note: '',
      places: [],
      updatedAt: timestamp,
    };
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

  const addPersonalCardToTrip = useCallback(
    async (tripId: string, cardId: string) => {
      await mutateAndRefresh(tripId, async (trip) => {
        if (
          trip.entries?.some(
            (entry) =>
              entry.type === 'personalPlaceCard' &&
              'personalPlaceCard' in entry &&
              entry.personalPlaceCard.id === cardId
          )
        ) return;
        await addPersonalCardEntryRequest(tripId, {
          id: createEntryId(),
          note: '',
          personalPlaceCardId: cardId,
        });
      });
    },
    [mutateAndRefresh]
  );

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
    let id: string;
    try {
      id = await createTripRequest({ entryOrder: [], name: trimmedName });
    } catch (error) {
      throw new CreateTripWithPlaceError('create', null, error);
    }
    let entryId: string;
    try {
      entryId = await addEditorialEntryRequest(id, {
        id: createEntryId(),
        note: '',
        placeId: trimmedPlaceId,
      });
    } catch (error) {
      const timestamp = new Date().toISOString();
      await storeAuthoritative(ownerId, [{
        createdAt: timestamp,
        entries: [],
        id,
        name: trimmedName,
        note: '',
        places: [],
        updatedAt: timestamp,
      }, ...apiTripsRef.current]);
      throw new CreateTripWithPlaceError('attach', id, error);
    }
    const timestamp = new Date().toISOString();
    const trip: MyTrip = {
      createdAt: timestamp,
      entries: [{
        editorialPlace: { id: trimmedPlaceId },
        id: entryId,
        itineraryId: id,
        note: '',
        order: 0,
        type: 'editorialPlace',
      }],
      id,
      name: trimmedName,
      note: '',
      places: [{
        addedAt: timestamp,
        entryId,
        note: '',
        placeId: trimmedPlaceId,
      }],
      updatedAt: timestamp,
    };
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
        entryOrder:
          trip.entries?.map((entry) => entry.id) ??
          trip.places.flatMap((place) => place.entryId ?? []),
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
        entryOrder:
          trip.entries?.map((entry) => entry.id) ??
          trip.places.flatMap((place) => place.entryId ?? []),
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

  const removeTripEntry = useCallback(async (tripId: string, entryId: string) => {
    await mutateAndRefresh(tripId, () => deleteEntryRequest(tripId, entryId));
  }, [mutateAndRefresh]);

  const updateTripEntryNote = useCallback(
    async (tripId: string, entryId: string, note: string) => {
      await mutateAndRefresh(
        tripId,
        () => updateEntryNoteRequest(tripId, entryId, note)
      );
    },
    [mutateAndRefresh]
  );

  const deleteTrip = useCallback(async (tripId: string) => {
    if (!activeUserRef.current) {
      if (!localMutationsAllowedRef.current) return;
      await persistLocal((current) => current.filter((trip) => trip.id !== tripId));
      return;
    }
    const ownerId = activeUserRef.current;
    await deleteTripRequest(tripId);
    deletedTripIdsRef.current = await tripStorage.addDeletedTripId(ownerId, tripId);
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
    addPersonalCardToTrip,
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
    isRefreshing,
    loadError,
    refresh,
    removePlaceFromTrip,
    removeTripEntry,
    renameTrip,
    retryImport: runImport,
    trips,
    updatePlaceNote,
    updateTripEntryNote,
    updateTripNote,
  }), [
    addPersonalCardToTrip, addPlaceToTrip, createTrip, createTripWithPlace, deferImport, deleteTrip,
    getTrip, importDecision, isImporting, isLoading, isRefreshing, journal, loadError,
    refresh, removePlaceFromTrip, removeTripEntry, renameTrip, runImport, trips,
    updatePlaceNote, updateTripEntryNote, updateTripNote,
  ]);

  return <MyTripsContext.Provider value={value}>{children}</MyTripsContext.Provider>;
}

export function useMyTrips() {
  const context = useContext(MyTripsContext);
  if (!context) throw new Error('useMyTrips must be used inside MyTripsProvider.');
  return context;
}
