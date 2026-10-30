// The Shared Trips data layer: one observable store for My Trips, Shared With Me, Shared Trip details
// and the user's membership and note actions. It holds no UI and imports no React; a screen reads
// `getState()` (or the hook in use-shared-trips.ts) and calls the actions.
//
// Rules the store enforces:
//  - one request per resource at a time (duplicates share it); a forced refresh supersedes an older one;
//  - an answer that arrives after a newer one, or after sign-out / a change of user, is discarded;
//  - a failed refresh never discards data already shown: it is kept and flagged (`error`), so being
//    offline does not blank a Trip; a Trip the user can no longer reach (not joined / deleted) is removed;
//  - actions never throw: they return { ok } so a screen can show the result;
//  - what the viewer may do comes from the server's permissions and each note's canEdit/canDelete; a
//    forbidden action is refused locally without a request, and the server enforces it again;
//  - Join and Leave are reconciled with the server's truth when the answer is lost or ambiguous.
import type { ApiCapabilityStatus } from '@/lib/api-compatibility';
import type { CachedSnapshot, SharedTripsCache } from '@/shared-trips/cache';
import { classifyError, SharedTripsFailure, type SharedTripsError } from '@/shared-trips/errors';
import type {
  JoinResult,
  OwnedTripSummary,
  ShareTripResult,
  SharedTripDetail,
  SharedTripNote,
  SharedTripSummary,
} from '@/shared-trips/types';

export type Resource<T> = {
  data: T | null;
  error: SharedTripsError | null;
  loadedAt: number | null;
  /** A request is running while `data` (possibly empty) is shown. */
  refreshing: boolean;
  /**
   * Where `data` came from: the server in this session, or the on-device copy of the last answer
   * the server gave (readable offline, not necessarily current).
   */
  source: 'cache' | 'server' | null;
  status: 'error' | 'idle' | 'loading' | 'ready';
};

/** What the server last said about the user's access to one Shared Trip. */
export type DetailAccess = 'gone' | 'granted' | 'not-joined' | 'unknown';
export type DetailEntry = Resource<SharedTripDetail> & { access: DetailAccess };
export type Activity = { error: SharedTripsError | null; pending: boolean };

export type SharedTripsState = {
  details: Record<string, DetailEntry>;
  /** Join / Leave in progress or last failure, by collection id. */
  membership: Record<string, Activity & { action: 'joining' | 'leaving' | null }>;
  /** Note actions, by `<collectionId>:collection` or `<collectionId>:<itemId>`. */
  noteActions: Record<string, Activity>;
  myTrips: Resource<OwnedTripSummary[]>;
  sharedWithMe: Resource<SharedTripSummary[]>;
  /** Share actions, by Trip id. */
  sharing: Record<string, Activity>;
  userId: string | null;
};

export type ActionResult<T = void> =
  | { ok: true; value: T }
  | { error: SharedTripsError; ok: false };

export type SharedTripsDeps = {
  /** Optional read-only on-device copy; without it nothing is persisted. */
  cache?: SharedTripsCache;
  checkCapability: () => Promise<ApiCapabilityStatus>;
  deleteCollectionNote: (noteId: string) => Promise<void>;
  deletePlaceNote: (noteId: string) => Promise<void>;
  getSharedTrip: (collectionId: string) => Promise<SharedTripDetail>;
  joinSharedTrip: (collectionId: string) => Promise<JoinResult>;
  leaveSharedTrip: (collectionId: string) => Promise<void>;
  listOwnedTrips: () => Promise<OwnedTripSummary[]>;
  listSharedTrips: () => Promise<SharedTripSummary[]>;
  now: () => number;
  saveCollectionNote: (collectionId: string, text: string) => Promise<{ id: string }>;
  savePlaceNote: (itemId: string, text: string) => Promise<{ id: string }>;
  shareTrip: (itineraryId: string) => Promise<ShareTripResult>;
  updateCollectionNote: (noteId: string, text: string) => Promise<void>;
  updatePlaceNote: (noteId: string, text: string) => Promise<void>;
};

const emptyResource = <T,>(): Resource<T> => ({
  data: null,
  error: null,
  loadedAt: null,
  refreshing: false,
  source: null,
  status: 'idle',
});
const emptyDetail = (): DetailEntry => ({ ...emptyResource<SharedTripDetail>(), access: 'unknown' });

const initialState = (userId: string | null): SharedTripsState => ({
  details: {},
  membership: {},
  myTrips: emptyResource(),
  noteActions: {},
  sharedWithMe: emptyResource(),
  sharing: {},
  userId,
});

const fail = <T,>(error: SharedTripsError): ActionResult<T> => ({ error, ok: false });
const ok = <T,>(value: T): ActionResult<T> => ({ ok: true, value });

export function createSharedTripsStore(deps: SharedTripsDeps) {
  let state = initialState(null);
  let epoch = 0;
  let supported = false;
  const listeners = new Set<() => void>();
  const inflight = new Map<string, Promise<void>>();
  const sequence = new Map<string, number>();

  const emit = () => listeners.forEach((listener) => listener());

  // ---- on-device copy (read-only) ---------------------------------------------------------
  // What is written is exactly what the server last confirmed for this user: the Shared With Me
  // list and the Trips opened and still accessible. It is rewritten whenever that data changes,
  // so a Trip the user left or that was deleted also leaves the copy.
  const snapshotOf = (): CachedSnapshot => ({
    details: Object.fromEntries(
      Object.entries(state.details)
        .filter(([, entry]) => entry.data && entry.loadedAt !== null && entry.access !== 'not-joined' && entry.access !== 'gone')
        .map(([id, entry]) => [id, { data: entry.data!, loadedAt: entry.loadedAt! }])
    ),
    sharedWithMe:
      state.sharedWithMe.data && state.sharedWithMe.loadedAt !== null
        ? { data: state.sharedWithMe.data, loadedAt: state.sharedWithMe.loadedAt }
        : null,
  });
  const signatureOf = (value: SharedTripsState) =>
    [value.sharedWithMe.data, ...Object.entries(value.details).flatMap(([id, d]) => [id, d.data])];
  let persisted = signatureOf(state);
  const sameSignature = (a: unknown[], b: unknown[]) =>
    a.length === b.length && a.every((item, index) => Object.is(item, b[index]));

  const set = (next: SharedTripsState) => {
    state = next;
    if (deps.cache && state.userId) {
      const signature = signatureOf(state);
      if (!sameSignature(signature, persisted)) {
        persisted = signature;
        void deps.cache.save(state.userId, snapshotOf()).catch(() => {
          // The copy is a convenience; failing to write it never affects the live data.
        });
      }
    }
    emit();
  };

  /** Fills empty resources from the on-device copy; anything already loaded from the server wins. */
  async function hydrate(userId: string) {
    if (!deps.cache) return;
    const startedIn = epoch;
    let snapshot: CachedSnapshot | null = null;
    try {
      snapshot = await deps.cache.load(userId);
    } catch {
      snapshot = null;
    }
    if (!snapshot || startedIn !== epoch || state.userId !== userId) return;
    let next = state;
    if (snapshot.sharedWithMe && !state.sharedWithMe.data) {
      next = {
        ...next,
        sharedWithMe: {
          ...state.sharedWithMe,
          data: snapshot.sharedWithMe.data,
          loadedAt: snapshot.sharedWithMe.loadedAt,
          source: 'cache',
          status: 'ready',
        },
      };
    }
    const details = { ...next.details };
    for (const [id, cached] of Object.entries(snapshot.details)) {
      const current = details[id] ?? emptyDetail();
      // `access` stays "unknown" until the server confirms it: a cached Trip is readable, but
      // note actions need a confirmed membership.
      if (!current.data) {
        details[id] = { ...current, data: cached.data, loadedAt: cached.loadedAt, source: 'cache', status: 'ready' };
      }
    }
    // Hydrated data is already on the device: do not write it straight back.
    persisted = signatureOf({ ...next, details });
    state = { ...next, details };
    emit();
  }

  // ---- gate -------------------------------------------------------------------------------
  /** The Shared Trips routes exist on this API build. Only a positive answer is remembered. */
  async function ensureSupported(): Promise<SharedTripsError | null> {
    if (supported) return null;
    const status = await deps.checkCapability();
    if (status === 'supported') {
      supported = true;
      return null;
    }
    return { kind: status === 'unsupported' ? 'unsupported' : 'offline' };
  }

  // ---- one resource at a time -------------------------------------------------------------
  /**
   * Runs `fetcher` for `key`. `apply` receives the outcome only if this is still the newest request
   * for the key and the session has not changed. A non-forced call joins the running request.
   */
  function load<T>(
    key: string,
    force: boolean,
    begin: () => void,
    fetcher: () => Promise<T>,
    done: (outcome: { error: SharedTripsError } | { value: T }) => void
  ): Promise<void> {
    const running = inflight.get(key);
    if (running && !force) return running;
    const mine = (sequence.get(key) ?? 0) + 1;
    sequence.set(key, mine);
    const startedIn = epoch;
    begin();
    const run = (async () => {
      let outcome: { error: SharedTripsError } | { value: T };
      try {
        outcome = { value: await fetcher() };
      } catch (error) {
        outcome =
          error instanceof SharedTripsFailure
            ? { error: error.failure }
            : { error: classifyError(error) };
      }
      if (startedIn === epoch && sequence.get(key) === mine) done(outcome);
    })().finally(() => {
      if (inflight.get(key) === run) inflight.delete(key);
    });
    inflight.set(key, run);
    return run;
  }

  const gated = <T,>(fetcher: () => Promise<T>) => async () => {
    const blocked = await ensureSupported();
    if (blocked) throw new SharedTripsFailure(blocked);
    return fetcher();
  };

  const beginResource = <T,>(current: Resource<T>): Resource<T> => ({
    ...current,
    error: null,
    refreshing: true,
    status: current.data ? 'ready' : 'loading',
  });
  const settle = <T,>(
    current: Resource<T>,
    outcome: { error: SharedTripsError } | { value: T }
  ): Resource<T> =>
    'value' in outcome
      ? {
          data: outcome.value,
          error: null,
          loadedAt: deps.now(),
          refreshing: false,
          source: 'server',
          status: 'ready',
        }
      : {
          ...current,
          error: outcome.error,
          refreshing: false,
          // Data already shown stays; with nothing to show, the failure is the state.
          status: current.data ? 'ready' : 'error',
        };

  // ---- loading ----------------------------------------------------------------------------
  const loadMyTrips = (options: { force?: boolean } = {}) =>
    load<OwnedTripSummary[]>(
      'myTrips',
      Boolean(options.force),
      () => set({ ...state, myTrips: beginResource(state.myTrips) }),
      deps.listOwnedTrips,
      (outcome) => set({ ...state, myTrips: settle(state.myTrips, outcome) })
    );

  const loadSharedWithMe = (options: { force?: boolean } = {}) =>
    load<SharedTripSummary[]>(
      'sharedWithMe',
      Boolean(options.force),
      () => set({ ...state, sharedWithMe: beginResource(state.sharedWithMe) }),
      gated(deps.listSharedTrips),
      (outcome) => set({ ...state, sharedWithMe: settle(state.sharedWithMe, outcome) })
    );

  const withDetail = (collectionId: string, entry: DetailEntry): SharedTripsState => ({
    ...state,
    details: { ...state.details, [collectionId]: entry },
  });
  const currentDetail = (collectionId: string) => state.details[collectionId] ?? emptyDetail();

  const dropFromSharedList = (collectionId: string): SharedTripsState['sharedWithMe'] => {
    const list = state.sharedWithMe;
    return list.data
      ? { ...list, data: list.data.filter((trip) => trip.id !== collectionId) }
      : list;
  };

  const loadDetail = (collectionId: string, options: { force?: boolean } = {}) =>
    load<SharedTripDetail>(
      `detail:${collectionId}`,
      Boolean(options.force),
      () => set(withDetail(collectionId, { ...beginResource(currentDetail(collectionId)), access: currentDetail(collectionId).access })),
      gated(() => deps.getSharedTrip(collectionId)),
      (outcome) => {
        const current = currentDetail(collectionId);
        if ('value' in outcome) {
          set(withDetail(collectionId, { ...settle(current, outcome), access: 'granted' }));
          return;
        }
        const kind = outcome.error.kind;
        if (kind === 'not-joined' || kind === 'not-found') {
          // Member-only data must not outlive the access to it.
          set({
            ...withDetail(collectionId, {
              ...emptyDetail(),
              access: kind === 'not-joined' ? 'not-joined' : 'gone',
              error: outcome.error,
              status: 'error',
            }),
            sharedWithMe: dropFromSharedList(collectionId),
          });
          return;
        }
        set(withDetail(collectionId, { ...settle(current, outcome), access: current.access }));
      }
    );

  /** Refreshes the lists and every Shared Trip already opened, so creator changes show up. */
  async function refreshAll(): Promise<void> {
    const open = Object.entries(state.details)
      .filter(([, entry]) => entry.access === 'granted')
      .map(([id]) => id);
    await Promise.all([
      loadMyTrips({ force: true }),
      loadSharedWithMe({ force: true }),
      ...open.map((id) => loadDetail(id, { force: true })),
    ]);
  }

  // ---- membership -------------------------------------------------------------------------
  const setMembership = (
    collectionId: string,
    value: SharedTripsState['membership'][string]
  ) => set({ ...state, membership: { ...state.membership, [collectionId]: value } });

  async function join(collectionId: string): Promise<ActionResult<{ alreadyJoined: boolean }>> {
    setMembership(collectionId, { action: 'joining', error: null, pending: true });
    const startedIn = epoch;
    let result: ActionResult<{ alreadyJoined: boolean }>;
    try {
      result = ok(await deps.joinSharedTrip(collectionId));
    } catch (error) {
      const failure = classifyError(error);
      if (failure.kind === 'session-expired') {
        result = fail(failure);
      } else {
        // The answer may have been lost after the server joined us: the server's view decides.
        await loadDetail(collectionId, { force: true });
        result = currentDetail(collectionId).access === 'granted'
          ? ok({ alreadyJoined: true })
          : fail(failure);
      }
    }
    if (startedIn !== epoch) return result;
    if (result.ok) {
      await Promise.all([loadDetail(collectionId, { force: true }), loadSharedWithMe({ force: true })]);
    }
    setMembership(collectionId, {
      action: null,
      error: result.ok ? null : result.error,
      pending: false,
    });
    return result;
  }

  async function leave(collectionId: string): Promise<ActionResult> {
    setMembership(collectionId, { action: 'leaving', error: null, pending: true });
    const startedIn = epoch;
    let result: ActionResult;
    try {
      await deps.leaveSharedTrip(collectionId);
      result = ok(undefined);
    } catch (error) {
      const failure = classifyError(error);
      if (failure.kind === 'session-expired') {
        result = fail(failure);
      } else {
        // If the server no longer lists us, we did leave (the answer was lost).
        await loadDetail(collectionId, { force: true });
        result = currentDetail(collectionId).access === 'not-joined' ? ok(undefined) : fail(failure);
      }
    }
    if (startedIn !== epoch) return result;
    if (result.ok) {
      // Immediately forget everything member-only; a later read would be refused anyway.
      set({
        ...withDetail(collectionId, { ...emptyDetail(), access: 'not-joined' }),
        sharedWithMe: dropFromSharedList(collectionId),
      });
      sequence.set(`detail:${collectionId}`, (sequence.get(`detail:${collectionId}`) ?? 0) + 1);
      void loadSharedWithMe({ force: true });
    }
    setMembership(collectionId, {
      action: null,
      error: result.ok ? null : result.error,
      pending: false,
    });
    return result;
  }

  // ---- sharing (owner) --------------------------------------------------------------------
  async function share(itineraryId: string): Promise<ActionResult<ShareTripResult>> {
    set({ ...state, sharing: { ...state.sharing, [itineraryId]: { error: null, pending: true } } });
    const startedIn = epoch;
    let result: ActionResult<ShareTripResult>;
    try {
      const blocked = await ensureSupported();
      if (blocked) throw new SharedTripsFailure(blocked);
      result = ok(await deps.shareTrip(itineraryId));
    } catch (error) {
      result = fail(error instanceof SharedTripsFailure ? error.failure : classifyError(error));
    }
    if (startedIn !== epoch) return result;
    const trips = state.myTrips.data;
    set({
      ...state,
      myTrips:
        result.ok && trips
          ? {
              ...state.myTrips,
              data: trips.map((trip) =>
                trip.id === itineraryId ? { ...trip, sharedCollectionId: result.value.collectionId } : trip
              ),
            }
          : state.myTrips,
      sharing: {
        ...state.sharing,
        [itineraryId]: { error: result.ok ? null : result.error, pending: false },
      },
    });
    return result;
  }

  // ---- notes (the viewer's own only) ------------------------------------------------------
  async function runNoteAction(
    collectionId: string,
    key: string,
    allowed: (detail: SharedTripDetail) => boolean,
    perform: (detail: SharedTripDetail) => Promise<unknown>
  ): Promise<ActionResult> {
    const detail = currentDetail(collectionId);
    const noteKey = `${collectionId}:${key}`;
    const record = (activity: Activity) =>
      set({ ...state, noteActions: { ...state.noteActions, [noteKey]: activity } });
    if (!detail.data || detail.access !== 'granted' || !allowed(detail.data)) {
      const error: SharedTripsError = { kind: 'forbidden' };
      record({ error, pending: false });
      return fail(error);
    }
    record({ error: null, pending: true });
    const startedIn = epoch;
    try {
      await perform(detail.data);
    } catch (error) {
      const failure = classifyError(error);
      if (startedIn === epoch) {
        record({ error: failure, pending: false });
        // A refused write usually means the Trip changed under us: show the truth.
        if (failure.kind === 'rejected' || failure.kind === 'not-joined' || failure.kind === 'not-found') {
          void loadDetail(collectionId, { force: true });
        }
      }
      return fail(failure);
    }
    if (startedIn !== epoch) return ok(undefined);
    record({ error: null, pending: false });
    // The server's copy is the truth (ids, authors, ordering); a failed reload only flags staleness.
    await loadDetail(collectionId, { force: true });
    return ok(undefined);
  }

  const ownNote = (notes: SharedTripNote[]) => notes.find((note) => note.mine);

  /** Creates the viewer's Trip-level note, or edits it if they already have one. */
  const saveCollectionNote = (collectionId: string, text: string) =>
    runNoteAction(
      collectionId,
      'collection',
      (detail) => {
        const existing = ownNote(detail.notes);
        return existing ? existing.canEdit : detail.permissions.canAddCollectionNote;
      },
      async (detail) => {
        const existing = ownNote(detail.notes);
        if (existing) await deps.updateCollectionNote(existing.id, text);
        else await deps.saveCollectionNote(collectionId, text);
      }
    );

  const deleteCollectionNote = (collectionId: string) =>
    runNoteAction(
      collectionId,
      'collection',
      (detail) => Boolean(ownNote(detail.notes)?.canDelete),
      (detail) => deps.deleteCollectionNote(ownNote(detail.notes)!.id)
    );

  /** Creates the viewer's note on one Place (by its stable item id), or edits it. */
  const savePlaceNote = (collectionId: string, itemId: string, text: string) =>
    runNoteAction(
      collectionId,
      itemId,
      (detail) => {
        const place = detail.places.find((p) => p.itemId === itemId);
        if (!place) return false;
        const existing = ownNote(place.notes);
        return existing ? existing.canEdit : detail.permissions.canAddPlaceNote;
      },
      async (detail) => {
        const existing = ownNote(detail.places.find((p) => p.itemId === itemId)!.notes);
        if (existing) await deps.updatePlaceNote(existing.id, text);
        else await deps.savePlaceNote(itemId, text);
      }
    );

  const deletePlaceNote = (collectionId: string, itemId: string) =>
    runNoteAction(
      collectionId,
      itemId,
      (detail) => {
        const place = detail.places.find((p) => p.itemId === itemId);
        return Boolean(place && ownNote(place.notes)?.canDelete);
      },
      (detail) => deps.deletePlaceNote(ownNote(detail.places.find((p) => p.itemId === itemId)!.notes)!.id)
    );

  // ---- session ----------------------------------------------------------------------------
  /** Forgets everything (sign-out, or a different account): cached Trips belong to one user. */
  function reset(userId: string | null = null) {
    epoch += 1;
    inflight.clear();
    sequence.clear();
    state = initialState(userId);
    persisted = signatureOf(state);
    emit();
  }

  /** Call when the signed-in user changes; the same user keeps their cache. */
  function setSession(userId: string | null) {
    if (userId === state.userId) return;
    reset(userId);
    if (userId) void hydrate(userId);
  }

  return {
    deleteCollectionNote,
    deletePlaceNote,
    getState: () => state,
    join,
    leave,
    loadDetail,
    loadMyTrips,
    loadSharedWithMe,
    refreshAll,
    reset,
    saveCollectionNote,
    savePlaceNote,
    setSession,
    share,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type SharedTripsStore = ReturnType<typeof createSharedTripsStore>;
