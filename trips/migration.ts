import { ApiError } from '@/lib/api-client';
import {
  addEditorialEntryRequest,
  createTripRequest,
  listEditorialTripEntries,
  listTripSummaries,
  loadTrip,
  updateTripRequest,
} from '@/trips/api';
import { tripStorage } from '@/trips/storage';
import type {
  MyTrip,
  TripMigrationJournal,
  TripMigrationJournalEntry,
} from '@/trips/types';

export type TripMigrationProgress = {
  completed: number;
  permanentErrors: number;
  retryableErrors: number;
  total: number;
};

export function shouldOfferTripImport(input: {
  claimedUserId?: string | null;
  deferred: boolean;
  journal: TripMigrationJournal | null;
  sourceCount: number;
  sourceFingerprint: string | null;
  userId: string;
}) {
  if (
    input.sourceCount === 0 ||
    !input.sourceFingerprint ||
    input.deferred
  ) {
    return false;
  }
  if (
    input.claimedUserId &&
    input.claimedUserId !== input.userId
  ) {
    return false;
  }
  return !(
    input.journal?.sourceFingerprint === input.sourceFingerprint &&
    input.journal.entries.every((entry) =>
      entry.state === 'COMPLETED' || entry.state === 'PERMANENT_ERROR'
    )
  );
}

export function projectVisibleTrips(
  apiTrips: MyTrip[],
  legacyTrips: MyTrip[],
  journal: TripMigrationJournal | null,
  showLegacy: boolean
) {
  if (!showLegacy) return apiTrips;
  const completedLocalIds = new Set(
    (journal?.entries ?? [])
      .filter((entry) => entry.state === 'COMPLETED')
      .map((entry) => entry.localTripId)
  );
  return [
    ...apiTrips,
    ...legacyTrips.filter(
      (trip) =>
        !completedLocalIds.has(trip.id) &&
        !apiTrips.some((apiTrip) => apiTrip.id === trip.id)
    ),
  ];
}

type MigrationDependencies = {
  addEntry: typeof addEditorialEntryRequest;
  createTrip: typeof createTripRequest;
  digest: (value: string) => Promise<string>;
  getEntries: typeof listEditorialTripEntries;
  getJournal: typeof tripStorage.getJournal;
  listSummaries: typeof listTripSummaries;
  loadTrip: typeof loadTrip;
  now: () => string;
  setCache: typeof tripStorage.setCache;
  setClaim: typeof tripStorage.setClaim;
  setJournal: typeof tripStorage.setJournal;
  updateTrip: typeof updateTripRequest;
};

const defaultDependencies: MigrationDependencies = {
  addEntry: addEditorialEntryRequest,
  createTrip: createTripRequest,
  digest: async (value) => {
    const Crypto = await import('expo-crypto');
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
  },
  getEntries: listEditorialTripEntries,
  getJournal: tripStorage.getJournal,
  listSummaries: listTripSummaries,
  loadTrip,
  now: () => new Date().toISOString(),
  setCache: tripStorage.setCache,
  setClaim: tripStorage.setClaim,
  setJournal: tripStorage.setJournal,
  updateTrip: updateTripRequest,
};

function sourceValue(trips: MyTrip[]) {
  return trips.map((trip) => ({
    id: trip.id,
    name: trip.name,
    note: trip.note,
    places: trip.places.map(({ note, placeId }) => ({ note, placeId })),
  }));
}

async function stableId(
  prefix: 'itn_mob_' | 'ite_mob_',
  value: string,
  digest: MigrationDependencies['digest']
) {
  return `${prefix}${(await digest(value)).slice(0, 48)}`;
}

export async function fingerprintLegacyTrips(
  trips: MyTrip[],
  digest = defaultDependencies.digest
) {
  return digest(JSON.stringify(sourceValue(trips)));
}

function progress(journal: TripMigrationJournal): TripMigrationProgress {
  return {
    completed: journal.entries.filter((entry) => entry.state === 'COMPLETED')
      .length,
    permanentErrors: journal.entries.filter(
      (entry) => entry.state === 'PERMANENT_ERROR'
    ).length,
    retryableErrors: journal.entries.filter(
      (entry) => entry.state === 'RETRYABLE_ERROR'
    ).length,
    total: journal.entries.length,
  };
}

function isPermanent(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.code === 'unsupported_trip_entry' ||
      error.code === 'malformed_response' ||
      error.status === 400 ||
      error.status === 422)
  );
}

async function persistEntry(
  deps: MigrationDependencies,
  journal: TripMigrationJournal,
  entry: TripMigrationJournalEntry
) {
  journal.entries = journal.entries.map((item) =>
    item.localTripId === entry.localTripId ? entry : item
  );
  await deps.setJournal(journal.userId, journal);
}

async function locateCreatedTrip(
  targetItineraryId: string,
  deps: MigrationDependencies
) {
  return (await deps.listSummaries()).find(
    (summary) => summary.id === targetItineraryId
  );
}

async function migrateOne(
  source: MyTrip,
  entry: TripMigrationJournalEntry,
  journal: TripMigrationJournal,
  deps: MigrationDependencies
): Promise<MyTrip | null> {
  if (entry.state === 'COMPLETED') {
    const summary = await locateCreatedTrip(entry.targetItineraryId, deps);
    if (summary) return deps.loadTrip(summary);
    entry.state = 'RETRYABLE_ERROR';
    entry.verified = false;
    entry.lastErrorCategory = 'verified_trip_missing';
    await persistEntry(deps, journal, entry);
    return null;
  }

  entry.attempts += 1;
  entry.lastErrorCategory = null;
  try {
    let summary = await locateCreatedTrip(entry.targetItineraryId, deps);
    if (!summary) {
      entry.state = 'CREATING';
      await persistEntry(deps, journal, entry);
      try {
        await deps.createTrip({
          description: source.note,
          entryOrder: [],
          id: entry.targetItineraryId,
          name: source.name,
        });
      } catch (error) {
        summary = await locateCreatedTrip(entry.targetItineraryId, deps);
        if (!summary) throw error;
      }
    }

    entry.state = 'CREATED';
    await persistEntry(deps, journal, entry);
    let existing = await deps.getEntries(entry.targetItineraryId);
    const existingIds = new Set(existing.map((item) => item.id));
    entry.state = 'IMPORTING_ENTRIES';
    await persistEntry(deps, journal, entry);

    for (let index = 0; index < source.places.length; index += 1) {
      const sourcePlace = source.places[index];
      const entryId = entry.entryIds[index];
      if (existingIds.has(entryId)) continue;
      try {
        await deps.addEntry(entry.targetItineraryId, {
          id: entryId,
          note: sourcePlace.note,
          placeId: sourcePlace.placeId,
        });
      } catch (error) {
        existing = await deps.getEntries(entry.targetItineraryId);
        if (!existing.some((item) => item.id === entryId)) throw error;
      }
    }

    await deps.updateTrip(entry.targetItineraryId, {
      description: source.note,
      entryOrder: entry.entryIds,
      name: source.name,
    });
    entry.state = 'VERIFYING';
    await persistEntry(deps, journal, entry);
    const finalSummary = await locateCreatedTrip(entry.targetItineraryId, deps);
    if (!finalSummary) throw new ApiError(503, 'verification_failed');
    const result = await deps.loadTrip(finalSummary);
    const verified =
      result.name === source.name &&
      result.note === source.note &&
      result.places.length === source.places.length &&
      result.places.every(
        (place, index) =>
          place.entryId === entry.entryIds[index] &&
          place.placeId === source.places[index].placeId &&
          place.note === source.places[index].note
      );
    if (!verified) throw new ApiError(503, 'verification_failed');

    entry.completedAt = deps.now();
    entry.state = 'COMPLETED';
    entry.verified = true;
    await persistEntry(deps, journal, entry);
    return result;
  } catch (error) {
    entry.lastErrorCategory =
      error instanceof ApiError ? error.code : 'network_or_unknown';
    entry.state = isPermanent(error) ? 'PERMANENT_ERROR' : 'RETRYABLE_ERROR';
    await persistEntry(deps, journal, entry);
    return null;
  }
}

export async function createMigrationJournal(
  userId: string,
  trips: MyTrip[],
  overrides: Partial<MigrationDependencies> = {}
): Promise<TripMigrationJournal> {
  const deps = { ...defaultDependencies, ...overrides };
  const sourceFingerprint = await fingerprintLegacyTrips(trips, deps.digest);
  const acceptedAt = deps.now();
  const entries = await Promise.all(
    trips.map(async (trip) => {
      const fingerprint = await deps.digest(JSON.stringify(sourceValue([trip])));
      const targetItineraryId = await stableId(
        'itn_mob_',
        `${userId}:${trip.id}:${fingerprint}`,
        deps.digest
      );
      const entryIds = await Promise.all(
        trip.places.map((place, index) =>
          stableId(
            'ite_mob_',
            `${targetItineraryId}:${index}:${place.placeId}`,
            deps.digest
          )
        )
      );
      return {
        attempts: 0,
        completedAt: null,
        entryIds,
        fingerprint,
        lastErrorCategory: null,
        localTripId: trip.id,
        state: 'PENDING' as const,
        targetItineraryId,
        verified: false,
      };
    })
  );
  const journal: TripMigrationJournal = {
    acceptedAt,
    entries,
    sourceFingerprint,
    userId,
    version: 1,
  };
  await deps.setJournal(userId, journal);
  await deps.setClaim({ sourceFingerprint, userId });
  return journal;
}

export async function runTripMigration(
  userId: string,
  sourceTrips: MyTrip[],
  overrides: Partial<MigrationDependencies> = {}
): Promise<{ journal: TripMigrationJournal; progress: TripMigrationProgress }> {
  const deps = { ...defaultDependencies, ...overrides };
  let journal =
    (await deps.getJournal(userId)) ??
    (await createMigrationJournal(userId, sourceTrips, deps));
  const byId = new Map(sourceTrips.map((trip) => [trip.id, trip]));
  const migrated: MyTrip[] = [];

  for (const current of journal.entries) {
    const source = byId.get(current.localTripId);
    if (!source) {
      current.state = 'PERMANENT_ERROR';
      current.lastErrorCategory = 'legacy_trip_missing';
      await persistEntry(deps, journal, current);
      continue;
    }
    const result = await migrateOne(source, current, journal, deps);
    if (result) migrated.push(result);
  }

  journal = (await deps.getJournal(userId)) ?? journal;
  if (journal.entries.every((entry) => entry.state === 'COMPLETED')) {
    await deps.setCache(userId, migrated);
  }
  return { journal, progress: progress(journal) };
}

export function migrationProgress(journal: TripMigrationJournal | null) {
  return journal
    ? progress(journal)
    : { completed: 0, permanentErrors: 0, retryableErrors: 0, total: 0 };
}
