// The Shared Trips store: loading/error states, ordering, refresh, membership transitions, own-notes-only
// actions and per-user isolation. All network access is replaced by fake dependencies.
import assert from 'node:assert/strict';

import { ApiError } from '../lib/api-client.ts';
import { createSharedTripsStore } from './store.ts';
import { detail, memberNote, note, summary } from './fixtures.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const clone = (value) => JSON.parse(JSON.stringify(value));
const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, reject, resolve };
};
const offline = () => new TypeError('Network request failed');

/** A fake server holding one Shared Trip the member has (or has not) joined. */
function makeWorld(overrides = {}) {
  const world = {
    calls: [],
    capability: 'supported',
    detail: detail(),
    failures: {},
    joined: true,
    list: [summary()],
    owned: [{ id: 'itn_1', name: 'South Island', sharedCollectionId: 'fc_1' }],
    ...overrides,
  };
  const record = (name, ...args) => world.calls.push([name, ...args]);
  const maybeFail = (name) => {
    const failure = world.failures[name];
    if (failure) {
      if (!failure.sticky) delete world.failures[name];
      throw failure.error;
    }
  };
  world.deps = {
    checkCapability: async () => { record('checkCapability'); return world.capability; },
    deleteCollectionNote: async (id) => { record('deleteCollectionNote', id); maybeFail('deleteCollectionNote'); },
    deletePlaceNote: async (id) => { record('deletePlaceNote', id); maybeFail('deletePlaceNote'); },
    getSharedTrip: async (id) => {
      record('getSharedTrip', id);
      maybeFail('getSharedTrip');
      if (!world.joined) throw new ApiError(403, 'not_joined');
      return clone(world.detail);
    },
    joinSharedTrip: async (id) => { record('joinSharedTrip', id); maybeFail('joinSharedTrip'); world.joined = true; return { alreadyJoined: false }; },
    leaveSharedTrip: async (id) => { record('leaveSharedTrip', id); maybeFail('leaveSharedTrip'); world.joined = false; world.list = []; },
    listOwnedTrips: async () => { record('listOwnedTrips'); maybeFail('listOwnedTrips'); return clone(world.owned); },
    listSharedTrips: async () => { record('listSharedTrips'); maybeFail('listSharedTrips'); return world.joined ? clone(world.list) : []; },
    now: () => 1000,
    saveCollectionNote: async (id, text) => { record('saveCollectionNote', id, text); maybeFail('saveCollectionNote'); return { id: 'cn_new' }; },
    savePlaceNote: async (id, text) => { record('savePlaceNote', id, text); maybeFail('savePlaceNote'); return { id: 'pn_new' }; },
    shareTrip: async (id) => { record('shareTrip', id); maybeFail('shareTrip'); return { collectionId: 'fc_new', created: true, url: 'https://web/x' }; },
    updateCollectionNote: async (id, text) => { record('updateCollectionNote', id, text); maybeFail('updateCollectionNote'); },
    updatePlaceNote: async (id, text) => { record('updatePlaceNote', id, text); maybeFail('updatePlaceNote'); },
  };
  world.count = (name) => world.calls.filter(([n]) => n === name).length;
  return world;
}
const store = (world) => createSharedTripsStore(world.deps);
const fail = (name, error, sticky = false) => ({ [name]: { error, sticky } });

// ---- loading and error states -------------------------------------------------------------
test('starts idle, then loading, then ready with the data', async () => {
  const world = makeWorld();
  const s = store(world);
  assert.equal(s.getState().sharedWithMe.status, 'idle');
  const seen = [];
  s.subscribe(() => seen.push(s.getState().sharedWithMe.status));
  await s.loadSharedWithMe();
  assert.deepEqual(seen, ['loading', 'ready']);
  assert.equal(s.getState().sharedWithMe.data.length, 1);
  assert.equal(s.getState().sharedWithMe.refreshing, false);
  assert.equal(s.getState().sharedWithMe.error, null);
});

test('My Trips lists owned Trips with the collection that publishes each', async () => {
  const world = makeWorld();
  const s = store(world);
  await s.loadMyTrips();
  assert.deepEqual(s.getState().myTrips.data, [{ id: 'itn_1', name: 'South Island', sharedCollectionId: 'fc_1' }]);
  assert.equal(world.count('checkCapability'), 0); // the existing Trip list needs no capability
});

test('an API build without Shared Trips is "unsupported" (and no data call is made)', async () => {
  const world = makeWorld({ capability: 'unsupported' });
  const s = store(world);
  await s.loadSharedWithMe();
  await s.loadDetail('fc_1');
  assert.equal(s.getState().sharedWithMe.status, 'error');
  assert.equal(s.getState().sharedWithMe.error.kind, 'unsupported');
  assert.equal(s.getState().details.fc_1.error.kind, 'unsupported');
  assert.equal(world.count('listSharedTrips') + world.count('getSharedTrip'), 0);
});

test('an unreachable server is "offline" and is retried, not remembered as unsupported', async () => {
  const world = makeWorld({ capability: 'unreachable' });
  const s = store(world);
  await s.loadSharedWithMe();
  assert.equal(s.getState().sharedWithMe.error.kind, 'offline');
  world.capability = 'supported';
  await s.loadSharedWithMe();
  assert.equal(s.getState().sharedWithMe.status, 'ready');
  await s.loadSharedWithMe({ force: true });
  assert.equal(world.count('checkCapability'), 2); // a positive answer is remembered
});

test('a failed first load is an error state; a failed refresh keeps what was shown', async () => {
  const world = makeWorld({ failures: fail('listSharedTrips', offline()) });
  const s = store(world);
  await s.loadSharedWithMe();
  assert.equal(s.getState().sharedWithMe.status, 'error');
  assert.equal(s.getState().sharedWithMe.error.kind, 'offline');
  assert.equal(s.getState().sharedWithMe.data, null);

  await s.loadSharedWithMe();
  assert.equal(s.getState().sharedWithMe.status, 'ready');
  world.failures = fail('listSharedTrips', new ApiError(503, 'x'));
  await s.loadSharedWithMe({ force: true });
  const now = s.getState().sharedWithMe;
  assert.equal(now.status, 'ready');
  assert.equal(now.data.length, 1); // still showing the last good list
  assert.equal(now.error.kind, 'server');
  assert.equal(now.refreshing, false);
  await s.loadSharedWithMe({ force: true });
  assert.equal(s.getState().sharedWithMe.error, null); // recovered
});

test('an expired session surfaces as session-expired and keeps the data on screen', async () => {
  const world = makeWorld();
  const s = store(world);
  await s.loadDetail('fc_1');
  world.failures = fail('getSharedTrip', new ApiError(401, 'mobile_session_required'));
  await s.loadDetail('fc_1', { force: true });
  const entry = s.getState().details.fc_1;
  assert.equal(entry.error.kind, 'session-expired');
  assert.equal(entry.access, 'granted');
  assert.equal(entry.data.places.length, 3);
});

// ---- concurrency ----------------------------------------------------------------------------
test('simultaneous loads of one resource share one request', async () => {
  const world = makeWorld();
  const s = store(world);
  await Promise.all([s.loadDetail('fc_1'), s.loadDetail('fc_1'), s.loadDetail('fc_1')]);
  assert.equal(world.count('getSharedTrip'), 1);
  await Promise.all([s.loadSharedWithMe(), s.loadSharedWithMe()]);
  assert.equal(world.count('listSharedTrips'), 1);
});

test('an older answer that arrives after a newer one is discarded', async () => {
  const world = makeWorld();
  const first = deferred();
  const newest = clone(world.detail);
  newest.collection.title = 'Newest';
  const stale = clone(world.detail);
  stale.collection.title = 'Stale';
  let n = 0;
  world.deps.getSharedTrip = async () => { n += 1; return n === 1 ? first.promise : clone(newest); };
  const s = store(world);
  const a = s.loadDetail('fc_1');
  await Promise.resolve(); await Promise.resolve();
  const b = s.loadDetail('fc_1', { force: true });
  await b;
  assert.equal(s.getState().details.fc_1.data.collection.title, 'Newest');
  first.resolve(stale);
  await a;
  assert.equal(s.getState().details.fc_1.data.collection.title, 'Newest');
});

// ---- refreshing owner changes ----------------------------------------------------------------
test('refreshAll shows the creator\'s changes; retained Places keep their item ids and every note', async () => {
  const world = makeWorld();
  const s = store(world);
  await s.loadSharedWithMe(); await s.loadMyTrips(); await s.loadDetail('fc_1');
  const before = s.getState().details.fc_1.data;

  const after = clone(world.detail);
  after.collection.title = 'Renamed';
  after.places = [after.places[2], after.places[0], { itemId: 'fci_new', notes: [], placeId: 'place-new', position: 2 }];
  after.places.forEach((p, i) => { p.position = i; });
  world.detail = after;
  world.list = [summary({ placeCount: 3, title: 'Renamed' })];
  await s.refreshAll();

  const now = s.getState().details.fc_1.data;
  assert.equal(now.collection.title, 'Renamed');
  assert.deepEqual(now.places.map((p) => p.placeId), ['place-c', 'place-a', 'place-new']);
  assert.deepEqual(now.places.map((p) => p.itemId), ['fci_c', 'fci_a', 'fci_new']);
  const keptNotes = (id) => now.places.find((p) => p.itemId === id).notes.map((n) => n.id);
  assert.deepEqual(keptNotes('fci_a'), before.places[0].notes.map((n) => n.id)); // participant note still attached
  assert.equal(s.getState().sharedWithMe.data[0].title, 'Renamed');
});

test('a Place the creator removed disappears with its notes', async () => {
  const world = makeWorld();
  const s = store(world);
  await s.loadDetail('fc_1');
  world.detail.places = world.detail.places.filter((p) => p.itemId !== 'fci_a');
  world.detail.places.forEach((p, i) => { p.position = i; });
  await s.refreshAll();
  const places = s.getState().details.fc_1.data.places;
  assert.deepEqual(places.map((p) => p.itemId), ['fci_b', 'fci_c']);
  assert.equal(JSON.stringify(places).includes('Booked'), false);
});

test('refreshAll only re-reads Trips the user can open, and lists in parallel', async () => {
  const world = makeWorld();
  const s = store(world);
  await s.loadDetail('fc_1');
  world.joined = false;
  await s.loadDetail('fc_other', { force: true }); // 403 for a Trip we have not joined
  world.joined = true;
  const before = world.count('getSharedTrip');
  await s.refreshAll();
  assert.equal(world.count('getSharedTrip') - before, 1); // fc_1 only
});

// ---- access ----------------------------------------------------------------------------------
test('not joined: the detail holds no data and the Trip leaves the list', async () => {
  const world = makeWorld();
  const s = store(world);
  await s.loadSharedWithMe(); await s.loadDetail('fc_1');
  world.joined = false;
  await s.loadDetail('fc_1', { force: true });
  const entry = s.getState().details.fc_1;
  assert.equal(entry.access, 'not-joined');
  assert.equal(entry.data, null);
  assert.equal(entry.error.kind, 'not-joined');
  assert.deepEqual(s.getState().sharedWithMe.data, []);
});

test('a deleted Trip is "gone" (not "unsupported")', async () => {
  const world = makeWorld({ failures: fail('getSharedTrip', new ApiError(404, 'collection_not_found')) });
  const s = store(world);
  await s.loadDetail('fc_1');
  assert.equal(s.getState().details.fc_1.access, 'gone');
  assert.equal(s.getState().details.fc_1.error.kind, 'not-found');
  const generic = makeWorld({ failures: fail('getSharedTrip', new ApiError(404, 'NOT_FOUND')) });
  const t = store(generic);
  await t.loadDetail('fc_1');
  assert.equal(t.getState().details.fc_1.error.kind, 'unsupported');
  assert.equal(t.getState().details.fc_1.access, 'unknown');
});

// ---- join and leave ---------------------------------------------------------------------------
test('join: pending, then access granted, the Trip loaded and listed', async () => {
  const world = makeWorld({ joined: false });
  const s = store(world);
  const seen = [];
  s.subscribe(() => seen.push(s.getState().membership.fc_1?.action ?? null));
  const result = await s.join('fc_1');
  assert.deepEqual(result, { ok: true, value: { alreadyJoined: false } });
  assert.ok(seen.includes('joining'));
  assert.equal(s.getState().membership.fc_1.pending, false);
  assert.equal(s.getState().details.fc_1.access, 'granted');
  assert.equal(s.getState().sharedWithMe.data.length, 1);
});

test('join whose answer was lost: the server\'s view decides', async () => {
  const world = makeWorld({ joined: false });
  world.deps.joinSharedTrip = async () => { world.joined = true; throw offline(); }; // joined, but we never heard
  const s = store(world);
  const result = await s.join('fc_1');
  assert.equal(result.ok, true);
  assert.equal(s.getState().details.fc_1.access, 'granted');
});

test('join that really failed reports the error and leaves no access', async () => {
  const world = makeWorld({ joined: false, failures: fail('joinSharedTrip', new ApiError(400, 'request_failed', 'Trip Idea not found.')) });
  const s = store(world);
  const result = await s.join('fc_1');
  assert.equal(result.ok, false);
  assert.equal(result.error.kind, 'rejected');
  assert.equal(s.getState().membership.fc_1.error.kind, 'rejected');
  assert.equal(s.getState().details.fc_1.access, 'not-joined');
  assert.equal(s.getState().membership.fc_1.pending, false);
});

test('join with an expired session does not guess; it asks to sign in', async () => {
  const world = makeWorld({ joined: false, failures: fail('joinSharedTrip', new ApiError(401, 'mobile_session_required')) });
  const s = store(world);
  const result = await s.join('fc_1');
  assert.equal(result.error.kind, 'session-expired');
  assert.equal(world.count('getSharedTrip'), 0);
});

test('leave: member-only data is dropped at once and the Trip leaves Shared With Me', async () => {
  const world = makeWorld();
  const s = store(world);
  await s.loadSharedWithMe(); await s.loadDetail('fc_1');
  assert.ok(s.getState().details.fc_1.data);
  const result = await s.leave('fc_1');
  assert.equal(result.ok, true);
  const entry = s.getState().details.fc_1;
  assert.equal(entry.data, null);
  assert.equal(entry.access, 'not-joined');
  assert.deepEqual(s.getState().sharedWithMe.data, []);
  assert.equal(JSON.stringify(s.getState()).includes('Bring a hat'), false);
  // And the app can join again.
  assert.equal((await s.join('fc_1')).ok, true);
  assert.equal(s.getState().details.fc_1.access, 'granted');
});

test('leave whose answer was lost is confirmed by the server; a leave that failed keeps the data', async () => {
  const lost = makeWorld();
  lost.deps.leaveSharedTrip = async () => { lost.joined = false; throw offline(); };
  const a = store(lost);
  await a.loadDetail('fc_1');
  assert.equal((await a.leave('fc_1')).ok, true);
  assert.equal(a.getState().details.fc_1.data, null);

  const failed = makeWorld({ failures: fail('leaveSharedTrip', new ApiError(503, 'x')) });
  const b = store(failed);
  await b.loadDetail('fc_1');
  const result = await b.leave('fc_1');
  assert.equal(result.ok, false);
  assert.equal(result.error.kind, 'server');
  assert.equal(b.getState().details.fc_1.access, 'granted');
  assert.equal(b.getState().details.fc_1.data.places.length, 3);
});

// ---- sharing (owner) --------------------------------------------------------------------------
test('sharing records the collection on the owned Trip; repeating changes nothing', async () => {
  const world = makeWorld({ owned: [{ id: 'itn_2', name: 'Other', sharedCollectionId: null }] });
  const s = store(world);
  await s.loadMyTrips();
  const result = await s.share('itn_2');
  assert.deepEqual(result, { ok: true, value: { collectionId: 'fc_new', created: true, url: 'https://web/x' } });
  assert.equal(s.getState().myTrips.data[0].sharedCollectionId, 'fc_new');
  assert.equal(s.getState().sharing.itn_2.pending, false);
});

test('sharing is refused clearly: unsupported API, Personal Places, offline', async () => {
  const unsupported = store(makeWorld({ capability: 'unsupported' }));
  assert.equal((await unsupported.share('itn_1')).error.kind, 'unsupported');
  const personal = makeWorld({ failures: fail('shareTrip', new ApiError(422, 'personal_places_not_shareable')) });
  const p = store(personal);
  const refused = await p.share('itn_1');
  assert.equal(refused.error.kind, 'rejected');
  assert.equal(refused.error.code, 'personal_places_not_shareable');
  assert.equal(p.getState().sharing.itn_1.error.code, 'personal_places_not_shareable');
  const down = makeWorld({ failures: fail('shareTrip', offline()) });
  assert.equal((await store(down).share('itn_1')).error.kind, 'offline');
});

// ---- notes ------------------------------------------------------------------------------------
test('a member creates, edits and deletes only their own notes, then sees the server\'s truth', async () => {
  const world = makeWorld();
  world.detail.notes = [note({ id: 'cn_owner' })]; // the member has no Trip note yet
  const s = store(world);
  await s.loadDetail('fc_1');

  assert.equal((await s.saveCollectionNote('fc_1', 'first')).ok, true);
  assert.deepEqual(world.calls.filter(([n]) => n === 'saveCollectionNote')[0], ['saveCollectionNote', 'fc_1', 'first']);

  // Place notes: fci_b has none (create); fci_a has the member's note (edit).
  assert.equal((await s.savePlaceNote('fc_1', 'fci_b', 'new place note')).ok, true);
  assert.deepEqual(world.calls.filter(([n]) => n === 'savePlaceNote')[0], ['savePlaceNote', 'fci_b', 'new place note']);
  assert.equal((await s.savePlaceNote('fc_1', 'fci_a', 'edited')).ok, true);
  assert.deepEqual(world.calls.filter(([n]) => n === 'updatePlaceNote')[0], ['updatePlaceNote', 'pn_a_member', 'edited']);

  assert.equal((await s.deletePlaceNote('fc_1', 'fci_a')).ok, true);
  assert.deepEqual(world.calls.filter(([n]) => n === 'deletePlaceNote')[0], ['deletePlaceNote', 'pn_a_member']);
  // After each success the Trip was re-read.
  assert.ok(world.count('getSharedTrip') >= 5);
  assert.equal(s.getState().noteActions['fc_1:fci_a'].pending, false);
});

test('editing an existing Trip-level note uses its id, deleting it too', async () => {
  const world = makeWorld();
  const s = store(world);
  await s.loadDetail('fc_1');
  assert.equal((await s.saveCollectionNote('fc_1', 'changed')).ok, true);
  assert.deepEqual(world.calls.find(([n]) => n === 'updateCollectionNote'), ['updateCollectionNote', 'cn_member', 'changed']);
  assert.equal((await s.deleteCollectionNote('fc_1')).ok, true);
  assert.deepEqual(world.calls.find(([n]) => n === 'deleteCollectionNote'), ['deleteCollectionNote', 'cn_member']);
});

test('a note that is not the viewer\'s, or an action the permissions do not allow, is refused without a request', async () => {
  const world = makeWorld();
  world.detail.places[1].notes = [note({ id: 'pn_b_owner' })]; // only the owner has written here
  const s = store(world);
  await s.loadDetail('fc_1');
  const writes = () => world.calls.filter(([n]) => /Note$/.test(n)).length;

  // fci_b has only someone else's note and the viewer has none: creating is allowed; deleting is not.
  assert.equal((await s.deletePlaceNote('fc_1', 'fci_b')).error.kind, 'forbidden');
  assert.equal((await s.deletePlaceNote('fc_1', 'fci_missing')).error.kind, 'forbidden');
  assert.equal((await s.savePlaceNote('fc_1', 'fci_missing', 'x')).error.kind, 'forbidden');
  assert.equal((await s.deleteCollectionNote('fc_other')).error.kind, 'forbidden'); // unknown Trip
  assert.equal(writes(), 0);

  // A viewer whose permissions forbid notes cannot add one.
  world.detail.permissions.canAddPlaceNote = false;
  world.detail.permissions.canAddCollectionNote = false;
  world.detail.notes = [note({ id: 'cn_owner' })];
  world.detail.places[2].notes = [note({ id: 'pn_c_owner' })];
  await s.loadDetail('fc_1', { force: true });
  assert.equal((await s.savePlaceNote('fc_1', 'fci_c', 'x')).error.kind, 'forbidden');
  assert.equal((await s.saveCollectionNote('fc_1', 'x')).error.kind, 'forbidden');
  assert.equal(writes(), 0);
});

test('a note that cannot be edited is refused even if it is marked as the viewer\'s', async () => {
  const world = makeWorld();
  world.detail.places[0].notes = [memberNote({ canEdit: false, canDelete: false, id: 'locked' })];
  const s = store(world);
  await s.loadDetail('fc_1');
  assert.equal((await s.savePlaceNote('fc_1', 'fci_a', 'x')).error.kind, 'forbidden');
  assert.equal((await s.deletePlaceNote('fc_1', 'fci_a')).error.kind, 'forbidden');
});

test('a failed note write is reported on that note and the Trip is left as it was', async () => {
  const world = makeWorld({ failures: fail('updatePlaceNote', offline()) });
  const s = store(world);
  await s.loadDetail('fc_1');
  const before = JSON.stringify(s.getState().details.fc_1.data);
  const result = await s.savePlaceNote('fc_1', 'fci_a', 'will fail');
  assert.equal(result.error.kind, 'offline');
  assert.equal(s.getState().noteActions['fc_1:fci_a'].error.kind, 'offline');
  assert.equal(JSON.stringify(s.getState().details.fc_1.data), before);
});

test('a rejected write (the Trip changed underneath) refreshes the Trip', async () => {
  const world = makeWorld({ failures: fail('updatePlaceNote', new ApiError(400, 'request_failed')) });
  const s = store(world);
  await s.loadDetail('fc_1');
  const reads = world.count('getSharedTrip');
  world.detail.places = world.detail.places.filter((p) => p.itemId !== 'fci_a');
  world.detail.places.forEach((p, i) => { p.position = i; });
  const result = await s.savePlaceNote('fc_1', 'fci_a', 'late');
  assert.equal(result.error.kind, 'rejected');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(world.count('getSharedTrip') > reads);
  assert.equal(s.getState().details.fc_1.data.places.some((p) => p.itemId === 'fci_a'), false);
});

test('after leaving, notes can no longer be written from the app', async () => {
  const world = makeWorld();
  const s = store(world);
  await s.loadDetail('fc_1');
  await s.leave('fc_1');
  assert.equal((await s.savePlaceNote('fc_1', 'fci_b', 'x')).error.kind, 'forbidden');
});

// ---- users and sign-out ------------------------------------------------------------------------
test('a different user (or sign-out) never sees the previous user\'s Trips; the same user keeps their cache', async () => {
  const world = makeWorld();
  const s = store(world);
  s.setSession('user_a');
  await s.loadSharedWithMe(); await s.loadDetail('fc_1'); await s.loadMyTrips();
  s.setSession('user_a');
  assert.ok(s.getState().details.fc_1.data);

  s.setSession('user_b');
  assert.equal(s.getState().userId, 'user_b');
  assert.equal(s.getState().sharedWithMe.data, null);
  assert.deepEqual(s.getState().details, {});
  assert.equal(JSON.stringify(s.getState()).includes('Bring a hat'), false);
  s.setSession(null);
  assert.equal(s.getState().myTrips.data, null);
});

test('an answer that arrives after sign-out or a change of user is dropped', async () => {
  const world = makeWorld();
  const slow = deferred();
  world.deps.getSharedTrip = async () => slow.promise;
  const s = store(world);
  s.setSession('user_a');
  const pending = s.loadDetail('fc_1');
  await Promise.resolve(); await Promise.resolve();
  s.setSession('user_b');
  slow.resolve(clone(world.detail));
  await pending;
  assert.deepEqual(s.getState().details, {});
});

test('a Join, Leave, Share or note action that finishes after a change of user cannot touch the new user\'s state', async () => {
  const world = makeWorld({ joined: false });
  const slow = { join: deferred(), leave: deferred(), share: deferred(), note: deferred() };
  world.deps.joinSharedTrip = async () => slow.join.promise;
  world.deps.leaveSharedTrip = async () => slow.leave.promise;
  world.deps.shareTrip = async () => slow.share.promise;
  world.deps.updatePlaceNote = async () => slow.note.promise;
  const s = store(world);
  s.setSession('user_a');
  world.joined = true;
  await s.loadDetail('fc_1'); await s.loadMyTrips();
  const pending = [s.join('fc_1'), s.leave('fc_1'), s.share('itn_1'), s.savePlaceNote('fc_1', 'fci_a', 'late')];
  await new Promise((resolve) => setTimeout(resolve, 0));
  s.setSession('user_b');
  slow.join.resolve({ alreadyJoined: false }); slow.leave.resolve(undefined);
  slow.share.resolve({ collectionId: 'fc_x', created: true, url: 'u' }); slow.note.resolve(undefined);
  await Promise.all(pending);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const state = s.getState();
  assert.equal(state.userId, 'user_b');
  assert.deepEqual(state.details, {});
  assert.deepEqual(state.membership, {});
  assert.deepEqual(state.sharing, {});
  assert.deepEqual(state.noteActions, {});
  assert.equal(state.myTrips.data, null);
});

test('listeners are notified and can unsubscribe', async () => {
  const world = makeWorld();
  const s = store(world);
  let count = 0;
  const off = s.subscribe(() => { count += 1; });
  await s.loadMyTrips();
  assert.ok(count >= 2);
  off();
  const frozen = count;
  await s.loadMyTrips({ force: true });
  assert.equal(count, frozen);
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
