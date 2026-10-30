// Save a Copy of a live Shared Trip: independent of the source, owner content only, through the
// existing Save workflow (trips/shared-trip-save.ts), which this stage does not change.
import assert from 'node:assert/strict';

import { ApiError } from '../lib/api-client.ts';
import { liveCopyKey, saveCopyOfSharedTrip, toSharedTripSnapshot } from './copy.ts';
import { buildImportRequest } from '../trips/shared-trip.ts';
import { createSharedTripsStore } from './store.ts';
import { detail, memberNote } from './fixtures.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });

function saveDeps(overrides = {}) {
  const saved = new Map();
  const sent = [];
  let ids = 0;
  return {
    checkCapability: async () => 'supported',
    importTrip: async (body) => { sent.push(body); return { created: true, id: body.id }; },
    listOwnTripIds: async () => [],
    newId: () => `00000000-0000-4000-8000-00000000000${(ids += 1)}`,
    now: () => 1_000,
    refreshTrips: async () => {},
    sent,
    sleep: async () => {},
    store: {
      clear: async (key) => { saved.delete(key); },
      load: async (key) => saved.get(key) ?? null,
      save: async (attempt) => { saved.set(attempt.shareId, attempt); },
    },
    stored: saved,
    ...overrides,
  };
}

test('the snapshot has the title, the owner\'s notes and the Places in order; nobody else\'s notes', () => {
  const snapshot = toSharedTripSnapshot(detail());
  assert.deepEqual(snapshot, {
    note: 'Pack warm',
    places: [
      { note: 'Book early', placeId: 'place-a', title: '' },
      { note: '', placeId: 'place-b', title: '' },
      { note: 'Sunrise', placeId: 'place-c', title: '' },
    ],
    title: 'South Island',
  });
  const text = JSON.stringify(snapshot);
  for (const secret of ['Bring a hat', 'Booked', 'user_member', 'Ben']) assert.equal(text.includes(secret), false);
});

test('a Trip with no owner notes copies empty notes (never a participant\'s)', () => {
  const d = detail();
  d.notes = [memberNote({ id: 'x', text: 'only member' })];
  d.places = d.places.map((p) => ({ ...p, notes: [memberNote({ id: `m${p.itemId}`, text: 'member' })] }));
  const snapshot = toSharedTripSnapshot(d);
  assert.equal(snapshot.note, '');
  assert.deepEqual(snapshot.places.map((p) => p.note), ['', '', '']);
});

test('the copy is sent through the existing import with only the fields it accepts', async () => {
  const deps = saveDeps();
  const outcome = await saveCopyOfSharedTrip(deps, { detail: detail(), mode: 'tap', userId: 'user_member' });
  assert.equal(outcome.kind, 'saved');
  assert.equal(deps.sent.length, 1);
  const body = deps.sent[0];
  assert.deepEqual(Object.keys(body).sort(), ['description', 'entries', 'id', 'name']);
  assert.deepEqual(body, buildImportRequest(body.id, toSharedTripSnapshot(detail())));
  assert.deepEqual(body.entries.map((e) => Object.keys(e).sort()), [['note', 'placeId'], ['note', 'placeId'], ['note', 'placeId']]);
  // Nothing that could keep the copy connected to its source is sent.
  const sent = JSON.stringify(body);
  for (const forbidden of ['fc_1', 'fci_', 'user_', 'collection', 'Booked', 'Bring a hat']) assert.equal(sent.includes(forbidden), false, forbidden);
  assert.match(body.id, /^[0-9a-f-]{36}$/);
});

test('the attempt is keyed to the live Trip; a finished Save is history and a new tap makes another copy', async () => {
  const deps = saveDeps();
  const request = { detail: detail(), mode: 'tap', userId: 'user_member' };
  const first = await saveCopyOfSharedTrip(deps, request);
  assert.equal(deps.stored.get(liveCopyKey('fc_1')).phase, 'saved');
  const second = await saveCopyOfSharedTrip(deps, request);
  assert.notEqual(first.tripId, second.tripId); // an explicit second tap is a second, independent copy
  assert.equal(deps.sent.length, 2);
});

test('a retry after a network failure reuses the same attempt id (the server can tell it is the same Save)', async () => {
  let fail = 3;
  const deps = saveDeps({
    importTrip: async (body) => {
      deps.sent.push(body);
      if (fail > 0) { fail -= 1; throw new TypeError('Network request failed'); }
      return { created: true, id: body.id };
    },
  });
  const request = { detail: detail(), mode: 'tap', userId: 'user_member' };
  assert.equal((await saveCopyOfSharedTrip(deps, request)).kind, 'offline');
  const again = await saveCopyOfSharedTrip(deps, request);
  assert.equal(again.kind, 'saved');
  assert.equal(new Set(deps.sent.map((b) => b.id)).size, 1);
});

test('signed out, unsupported or offline: nothing is sent', async () => {
  const signedOut = saveDeps();
  assert.equal((await saveCopyOfSharedTrip(signedOut, { detail: detail(), mode: 'tap', userId: null })).kind, 'needs-sign-in');
  assert.equal(signedOut.sent.length, 0);
  const unsupported = saveDeps({ checkCapability: async () => 'unsupported' });
  assert.equal((await saveCopyOfSharedTrip(unsupported, { detail: detail(), mode: 'tap', userId: 'u' })).kind, 'unsupported');
  const unreachable = saveDeps({ checkCapability: async () => 'unreachable' });
  assert.equal((await saveCopyOfSharedTrip(unreachable, { detail: detail(), mode: 'tap', userId: 'u' })).kind, 'offline');
  assert.equal(unsupported.sent.length + unreachable.sent.length, 0);
});

test('the server refusing the content is final (rejected), and a conflict is reported, not overwritten', async () => {
  const refused = saveDeps({ importTrip: async () => { throw new ApiError(400, 'invalid_body'); } });
  assert.equal((await saveCopyOfSharedTrip(refused, { detail: detail(), mode: 'tap', userId: 'u' })).kind, 'rejected');
  const conflict = saveDeps({ importTrip: async () => { throw new ApiError(409, 'itinerary_id_in_use'); } });
  const outcome = await saveCopyOfSharedTrip(conflict, { detail: detail(), mode: 'tap', userId: 'u' });
  assert.deepEqual([outcome.kind, outcome.code], ['conflict', 'itinerary_id_in_use']);
});

test('Save a Copy never joins, leaves, shares or writes notes, and leaves the live Trip untouched', async () => {
  const calls = [];
  const names = ['deleteCollectionNote', 'deletePlaceNote', 'joinSharedTrip', 'leaveSharedTrip', 'saveCollectionNote', 'savePlaceNote', 'shareTrip', 'updateCollectionNote', 'updatePlaceNote'];
  const world = detail();
  const deps = {
    checkCapability: async () => 'supported',
    getSharedTrip: async () => JSON.parse(JSON.stringify(world)),
    listOwnedTrips: async () => [],
    listSharedTrips: async () => [],
    now: () => 1,
  };
  for (const name of names) deps[name] = async (...args) => { calls.push([name, ...args]); return { alreadyJoined: false, id: 'x' }; };
  const s = createSharedTripsStore(deps);
  await s.loadDetail('fc_1');
  const before = JSON.stringify(s.getState());
  await saveCopyOfSharedTrip(saveDeps(), { detail: s.getState().details.fc_1.data, mode: 'tap', userId: 'user_member' });
  assert.deepEqual(calls, []);
  assert.equal(JSON.stringify(s.getState()), before);
  assert.equal(s.getState().details.fc_1.access, 'granted'); // still a member of the live Trip
});

let failed = 0;
for (const { name, run } of tests) {
  try {
    await run();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}
if (failed) process.exitCode = 1;
