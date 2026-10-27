// Saving a shared Trip (B2): one persistent attempt ID per Save, sent to the B1 import endpoint.
//
// The attempt ID is the new Trip's ID and the server's idempotency key. It is created on the
// first Save tap, persisted, and reused for sign-in continuation, duplicate taps, network
// retries and recovery after an interrupted request. A new ID is only ever created by a new
// explicit tap, after the previous attempt has finished (saved, rejected or abandoned).
import { ApiError } from '@/lib/api-client';
import type { ApiCapabilityStatus } from '@/lib/api-compatibility';
import { buildImportRequest, type ImportTripRequest, type SharedTrip } from '@/trips/shared-trip';

export const IMPORT_CAPABILITY = 'itinerary-import-v1';

/** A pending sign-in or interrupted request is only resumed automatically within this window. */
export const RESUME_WINDOW_MS = 10 * 60 * 1000;

const MAX_SUBMIT_ATTEMPTS = 3;

export type SaveAttempt = {
  attemptId: string;
  createdAt: number;
  ownerUserId: string | null;
  phase: 'awaiting-auth' | 'submitting' | 'saved';
  shareId: string;
  tripId?: string;
};

export type AttemptStore = {
  clear: (shareId: string) => Promise<void>;
  load: (shareId: string) => Promise<SaveAttempt | null>;
  save: (attempt: SaveAttempt) => Promise<void>;
};

export type ConflictCode =
  | 'itinerary_deleted'
  | 'itinerary_id_in_use'
  | 'itinerary_import_content_mismatch'
  | 'unknown';

export type SaveOutcome =
  | { created: boolean; kind: 'saved'; tripId: string }
  /** Signed out: the attempt is kept; sign in, then call again. */
  | { kind: 'needs-sign-in' }
  /** The API does not advertise itinerary-import-v1: nothing was sent. */
  | { kind: 'unsupported' }
  /** The API (or network) could not be reached: nothing is known to be saved. */
  | { kind: 'offline' }
  | { code: ConflictCode; existingTripId?: string; kind: 'conflict' }
  /** The server refused the content (4xx other than 409): retrying cannot help. */
  | { kind: 'rejected' }
  /** The server failed repeatedly; the attempt is kept, so another tap is safe. */
  | { kind: 'failed' }
  /** Resume found nothing pending. */
  | { kind: 'nothing-pending' };

export type SaveDependencies = {
  checkCapability: () => Promise<ApiCapabilityStatus>;
  importTrip: (body: ImportTripRequest) => Promise<{ created: boolean; id: string }>;
  listOwnTripIds: () => Promise<string[]>;
  newId: () => string;
  now: () => number;
  refreshTrips: () => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  store: AttemptStore;
};

export type SaveRequest = {
  /** 'tap' is an explicit Save press; 'resume' only continues an unfinished attempt. */
  mode: 'resume' | 'tap';
  shareId: string;
  trip: SharedTrip;
  /** The signed-in user, or null when signed out. */
  userId: string | null;
};

const inFlight = new Map<string, Promise<SaveOutcome>>();

/** Duplicate taps and a remount while a Save is running share one run. */
export function saveSharedTrip(
  dependencies: SaveDependencies,
  request: SaveRequest
): Promise<SaveOutcome> {
  const running = inFlight.get(request.shareId);
  if (running) return running;
  const run = performSave(dependencies, request).finally(() => {
    if (inFlight.get(request.shareId) === run) inFlight.delete(request.shareId);
  });
  inFlight.set(request.shareId, run);
  return run;
}

function conflictCode(error: ApiError): ConflictCode {
  return error.code === 'itinerary_deleted' ||
    error.code === 'itinerary_id_in_use' ||
    error.code === 'itinerary_import_content_mismatch'
    ? error.code
    : 'unknown';
}

const retryable = (error: unknown) =>
  !(error instanceof ApiError) ||
  error.status >= 500 ||
  error.status === 408 ||
  error.status === 429;

async function performSave(
  dependencies: SaveDependencies,
  { mode, shareId, trip, userId }: SaveRequest
): Promise<SaveOutcome> {
  const { store } = dependencies;
  let attempt = await store.load(shareId);

  // An attempt that another account already submitted is never reused.
  if (attempt?.ownerUserId && userId && attempt.ownerUserId !== userId) {
    await store.clear(shareId);
    attempt = null;
  }
  // A finished Save is history: only a new explicit tap starts another copy.
  if (attempt?.phase === 'saved') attempt = null;

  if (mode === 'resume') {
    const fresh =
      attempt && dependencies.now() - attempt.createdAt <= RESUME_WINDOW_MS;
    if (!attempt || !fresh) return { kind: 'nothing-pending' };
  }

  if (!attempt) {
    attempt = {
      attemptId: dependencies.newId(),
      createdAt: dependencies.now(),
      ownerUserId: null,
      phase: 'awaiting-auth',
      shareId,
    };
    await store.save(attempt);
  }

  // Before asking anyone to sign in, or sending anything, make sure the API can import.
  const capability = await dependencies.checkCapability();
  if (capability === 'unsupported') return { kind: 'unsupported' };
  if (capability === 'unreachable') return { kind: 'offline' };

  if (!userId) {
    await store.save({ ...attempt, phase: 'awaiting-auth' });
    return { kind: 'needs-sign-in' };
  }

  attempt = { ...attempt, ownerUserId: userId, phase: 'submitting' };
  await store.save(attempt);
  const body = buildImportRequest(attempt.attemptId, trip);

  let lastError: unknown;
  for (let tries = 1; tries <= MAX_SUBMIT_ATTEMPTS; tries += 1) {
    try {
      const result = await dependencies.importTrip(body);
      await store.save({ ...attempt, phase: 'saved', tripId: result.id });
      try {
        await dependencies.refreshTrips();
      } catch {
        // The Trip is saved; the next refresh will list it.
      }
      return { created: result.created, kind: 'saved', tripId: result.id };
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError && error.status === 401) {
        await store.save({ ...attempt, ownerUserId: null, phase: 'awaiting-auth' });
        return { kind: 'needs-sign-in' };
      }
      if (error instanceof ApiError && error.status === 409) {
        return resolveConflict(dependencies, attempt, error);
      }
      if (!retryable(error)) {
        await store.clear(shareId);
        return { kind: 'rejected' };
      }
      if (tries < MAX_SUBMIT_ATTEMPTS) await dependencies.sleep(600 * tries);
    }
  }

  // Same attempt ID is kept: a later tap re-sends the identical request.
  return lastError instanceof ApiError ? { kind: 'failed' } : { kind: 'offline' };
}

async function resolveConflict(
  dependencies: SaveDependencies,
  attempt: SaveAttempt,
  error: ApiError
): Promise<SaveOutcome> {
  const code = conflictCode(error);
  const { store } = dependencies;

  if (code === 'itinerary_import_content_mismatch') {
    // The Trip with this ID exists for this account but no longer matches the snapshot,
    // typically because it was saved and then edited. Never overwrite it or auto-copy.
    let owned = false;
    try {
      owned = (await dependencies.listOwnTripIds()).includes(attempt.attemptId);
    } catch {
      owned = false;
    }
    if (owned) {
      await store.save({ ...attempt, phase: 'saved', tripId: attempt.attemptId });
      return { code, existingTripId: attempt.attemptId, kind: 'conflict' };
    }
  }

  // Deleted, another account's ID, or unverifiable: the attempt is over. A new explicit
  // tap starts a fresh one.
  await store.clear(attempt.shareId);
  return { code, kind: 'conflict' };
}
