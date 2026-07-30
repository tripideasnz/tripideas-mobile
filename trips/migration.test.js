import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { ApiError } from '../lib/api-client.ts';
import {
  createMigrationJournal,
  fingerprintLegacyTrips,
  projectVisibleTrips,
  runTripMigration,
  shouldOfferTripImport,
} from './migration.ts';

const sourceTrips = [
  {
    id: 'trip-one',
    name: 'North Island',
    note: 'Trip note',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    places: [
      { addedAt: 'a', placeId: 'place-a', note: 'First note' },
      { addedAt: 'b', placeId: 'place-b', note: 'Second note' },
    ],
  },
  {
    id: 'trip-two',
    name: 'South Island',
    note: '',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-02T00:00:00.000Z',
    places: [],
  },
];

const digest = async (value) =>
  createHash('sha256').update(value).digest('hex');

function harness({
  loseCreateResponse = false,
  failEntryOnce = false,
  permanentEntryFailure = false,
} = {}) {
  let journal = null;
  let cache = [];
  const summaries = [];
  const entries = new Map();
  const calls = { create: 0, entries: 0 };
  let didFailEntry = false;

  const dependencies = {
    digest,
    now: () => '2026-07-30T00:00:00.000Z',
    getJournal: async () => structuredClone(journal),
    setJournal: async (_userId, value) => {
      journal = structuredClone(value);
    },
    setClaim: async () => {},
    setCache: async (_userId, value) => {
      cache = structuredClone(value);
    },
    listSummaries: async () => structuredClone(summaries),
    createTrip: async (input) => {
      calls.create += 1;
      summaries.push({
        id: input.id,
        name: input.name,
        description: input.description ?? null,
        entryOrder: [],
      });
      entries.set(input.id, []);
      if (loseCreateResponse && calls.create === 1) {
        throw new ApiError(503, 'response_lost');
      }
      return input.id;
    },
    getEntries: async (id) => structuredClone(entries.get(id) ?? []),
    addEntry: async (itineraryId, input) => {
      calls.entries += 1;
      if (permanentEntryFailure) {
        throw new ApiError(422, 'invalid_editorial_place');
      }
      if (failEntryOnce && !didFailEntry) {
        didFailEntry = true;
        throw new ApiError(503, 'offline');
      }
      const list = entries.get(itineraryId) ?? [];
      if (!list.some((item) => item.id === input.id)) {
        list.push({
          id: input.id,
          itineraryId,
          note: input.note || null,
          order: list.length,
          type: 'editorialPlace',
          editorialPlace: { id: input.placeId },
        });
      }
      entries.set(itineraryId, list);
      return input.id;
    },
    updateTrip: async (id, input) => {
      const summary = summaries.find((item) => item.id === id);
      Object.assign(summary, {
        description: input.description ?? null,
        entryOrder: input.entryOrder,
        name: input.name,
      });
    },
    loadTrip: async (summary) => ({
      id: summary.id,
      name: summary.name,
      note: summary.description ?? '',
      createdAt: 'server',
      updatedAt: 'server',
      places: (entries.get(summary.id) ?? []).map((entry) => ({
        addedAt: 'server',
        entryId: entry.id,
        note: entry.note ?? '',
        placeId: entry.editorialPlace.id,
      })),
    }),
  };
  return {
    calls,
    dependencies,
    get cache() { return cache; },
    get journal() { return journal; },
    summaries,
  };
}

async function run() {
  const fingerprint = await fingerprintLegacyTrips(sourceTrips, digest);
  assert.equal(fingerprint.length, 64);
  assert.equal(shouldOfferTripImport({
    claimedUserId: null,
    deferred: false,
    journal: null,
    sourceCount: 2,
    sourceFingerprint: fingerprint,
    userId: 'user-one',
  }), true);
  assert.equal(shouldOfferTripImport({
    claimedUserId: 'user-one',
    deferred: true,
    journal: null,
    sourceCount: 2,
    sourceFingerprint: fingerprint,
    userId: 'user-one',
  }), false);
  assert.deepEqual(
    projectVisibleTrips(
      [{ ...sourceTrips[1], id: 'itn_two' }],
      sourceTrips,
      {
        acceptedAt: 'now',
        entries: [{
          attempts: 1,
          completedAt: 'now',
          entryIds: [],
          fingerprint: 'one',
          lastErrorCategory: null,
          localTripId: 'trip-one',
          state: 'COMPLETED',
          targetItineraryId: 'itn_one',
          verified: true,
        }],
        sourceFingerprint: fingerprint,
        userId: 'user-one',
        version: 1,
      },
      true
    ).map((trip) => trip.id),
    ['itn_two', 'trip-two']
  );
  assert.equal(shouldOfferTripImport({
    claimedUserId: 'user-one',
    deferred: false,
    journal: null,
    sourceCount: 2,
    sourceFingerprint: fingerprint,
    userId: 'user-two',
  }), false);

  {
    const state = harness();
    const result = await runTripMigration('user-one', sourceTrips, state.dependencies);
    assert.deepEqual(result.progress, {
      completed: 2,
      permanentErrors: 0,
      retryableErrors: 0,
      total: 2,
    });
    assert.equal(state.cache[0].name, 'North Island');
    assert.equal(state.cache[0].note, 'Trip note');
    assert.deepEqual(
      state.cache[0].places.map(({ placeId, note }) => ({ placeId, note })),
      [
        { placeId: 'place-a', note: 'First note' },
        { placeId: 'place-b', note: 'Second note' },
      ]
    );
    assert.equal(state.journal.entries.every((entry) => entry.verified), true);
    const firstIds = state.journal.entries.map((entry) => entry.targetItineraryId);
    await runTripMigration('user-one', sourceTrips, state.dependencies);
    assert.equal(state.calls.create, 2);
    assert.deepEqual(
      state.journal.entries.map((entry) => entry.targetItineraryId),
      firstIds
    );
  }

  {
    const state = harness({ loseCreateResponse: true });
    const result = await runTripMigration('user-one', [sourceTrips[0]], state.dependencies);
    assert.equal(result.progress.completed, 1);
    assert.equal(state.calls.create, 1);
  }

  {
    const state = harness({ failEntryOnce: true });
    const first = await runTripMigration(
      'user-one',
      [sourceTrips[0]],
      state.dependencies
    );
    assert.equal(first.progress.retryableErrors, 1);
    const targetId = state.journal.entries[0].targetItineraryId;
    const second = await runTripMigration(
      'user-one',
      [sourceTrips[0]],
      state.dependencies
    );
    assert.equal(second.progress.completed, 1);
    assert.equal(state.summaries.filter((item) => item.id === targetId).length, 1);
  }

  {
    const state = harness({ permanentEntryFailure: true });
    const result = await runTripMigration(
      'user-one',
      [sourceTrips[0]],
      state.dependencies
    );
    assert.equal(result.progress.permanentErrors, 1);
    assert.equal(state.cache.length, 0);
    assert.equal(state.journal.entries[0].lastErrorCategory, 'invalid_editorial_place');
  }

  {
    const state = harness();
    const journal = await createMigrationJournal(
      'user-one',
      [sourceTrips[0]],
      state.dependencies
    );
    assert.equal(journal.userId, 'user-one');
    assert.equal(journal.entries[0].targetItineraryId.startsWith('itn_mob_'), true);
    assert.equal(journal.entries[0].entryIds.every((id) => id.startsWith('ite_mob_')), true);
    assert.equal(JSON.stringify(journal).includes('token'), false);
  }

  console.log('✓ resumable, user-scoped, idempotent Trip migration state machine');
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
