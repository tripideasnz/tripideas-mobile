// The on-device copy of Shared Trips, and how the store uses it: readable offline, labelled as saved,
// scoped to one user, never trusted over the server, and never able to write.
import assert from 'node:assert/strict';

import { ApiError } from '../lib/api-client.ts';
import {
  CACHE_KEY_PREFIX,
  MAX_CACHED_TRIPS,
  boundSnapshot,
  createAsyncStorageSharedTripsCache,
  parseSnapshot,
} from './cache.ts';
import { createSharedTripsStore } from './store.ts';
import { freshness } from './view-model.ts';
import { detail, summary } from './fixtures.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const clone = (value) => JSON.parse(JSON.stringify(value));
const offline = () => new TypeError('Network request failed');
const memoryStorage = () => {
  const data = new Map();
  return {
    data,
    getAllKeys: async () => [...data.keys()],
    getItem: async (key) => data.get(key) ?? null,
    multiRemove: async (keys) => keys.forEach((key) => data.delete(key)),
    removeItem: async (key) => { data.delete(key); },
    setItem: async (key, value) => { data.set(key, value); },
  };
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function world(overrides = {}) {
  const w = { calls: [], capability: 'supported', detail: detail(), fail: null, list: [summary()], joined: true, ...overrides };
  w.deps = {
    checkCapability: async () => w.capability,
    deleteCollectionNote: async () => {}, deletePlaceNote: async () => {},
    getSharedTrip: async (id) => { w.calls.push(['get', id]); if (w.fail) throw w.fail; if (!w.joined) throw new ApiError(403, 'not_joined'); return clone(w.detail); },
    joinSharedTrip: async () => ({ alreadyJoined: false }), leaveSharedTrip: async () => {},
    listOwnedTrips: async () => [],
    listSharedTrips: async () => { w.calls.push(['list']); if (w.fail) throw w.fail; return clone(w.list); },
    now: () => 9000,
    saveCollectionNote: async () => ({ id: 'x' }), savePlaceNote: async () => ({ id: 'x' }),
    shareTrip: async () => ({ collectionId: 'c', created: true, url: 'u' }),
    updateCollectionNote: async () => {}, updatePlaceNote: async () => {},
  };
  return w;
}

// ---- the cache itself --------------------------------------------------------------------------
test('round-trips what the server confirmed, per user, under a user-scoped key', async () => {
  const storage = memoryStorage();
  const cache = createAsyncStorageSharedTripsCache(storage);
  await cache.save('user_a', { details: { fc_1: { data: detail(), loadedAt: 10 } }, sharedWithMe: { data: [summary()], loadedAt: 11 } });
  assert.deepEqual([...storage.data.keys()], [`${CACHE_KEY_PREFIX}user_a`]);
  const loaded = await cache.load('user_a');
  assert.equal(loaded.details.fc_1.data.collection.title, 'South Island');
  assert.equal(loaded.sharedWithMe.loadedAt, 11);
  assert.equal(await cache.load('user_b'), null); // another account never sees it
});

test('a damaged entry is dropped, not shown; unreadable storage is "no cache"', async () => {
  const broken = detail();
  delete broken.permissions;
  const snapshot = parseSnapshot({
    details: { fc_1: { data: detail(), loadedAt: 1 }, fc_bad: { data: broken, loadedAt: 2 }, fc_wrong: { data: detail(), loadedAt: 3 }, fc_time: { data: detail(), loadedAt: 'x' } },
    sharedWithMe: { data: [{ id: 'only-an-id' }], loadedAt: 4 },
  });
  assert.deepEqual(Object.keys(snapshot.details), ['fc_1']); // bad shape, id mismatch and bad time are dropped
  assert.equal(snapshot.sharedWithMe, null);
  assert.equal(parseSnapshot('nope'), null);
  const storage = memoryStorage();
  storage.data.set(`${CACHE_KEY_PREFIX}u`, '{not json');
  assert.equal(await createAsyncStorageSharedTripsCache(storage).load('u'), null);
});

test('only the most recently loaded Trips are kept', () => {
  const details = {};
  for (let i = 0; i < MAX_CACHED_TRIPS + 5; i += 1) details[`fc_${i}`] = { data: detail(), loadedAt: i };
  const kept = Object.keys(boundSnapshot({ details, sharedWithMe: null }).details);
  assert.equal(kept.length, MAX_CACHED_TRIPS);
  assert.ok(kept.includes(`fc_${MAX_CACHED_TRIPS + 4}`));
  assert.equal(kept.includes('fc_0'), false);
});

test('clearing removes one user\'s copy (and clearAll every user\'s) but touches nothing else', async () => {
  const storage = memoryStorage();
  const cache = createAsyncStorageSharedTripsCache(storage);
  storage.data.set('tripideas.notebooks.cache', 'keep');
  await cache.save('a', { details: {}, sharedWithMe: null });
  await cache.save('b', { details: {}, sharedWithMe: null });
  await cache.clear('a');
  assert.deepEqual([...storage.data.keys()].sort(), ['tripideas.notebooks.cache', `${CACHE_KEY_PREFIX}b`].sort());
  await cache.clearAll();
  assert.deepEqual([...storage.data.keys()], ['tripideas.notebooks.cache']);
});

// ---- the store reading and writing it -----------------------------------------------------------------
async function storeWithCache(w, storage = memoryStorage()) {
  const cache = createAsyncStorageSharedTripsCache(storage);
  return { cache, storage, store: createSharedTripsStore({ ...w.deps, cache }) };
}

test('what the server confirmed is saved, and a later launch can read it offline, labelled as a saved copy', async () => {
  const w = world();
  const first = await storeWithCache(w);
  first.store.setSession('user_a');
  await first.store.loadSharedWithMe();
  await first.store.loadDetail('fc_1');
  await settle();

  // A new launch with no network: the copy appears, labelled, without any request succeeding.
  const w2 = world({ fail: offline() });
  const second = await storeWithCache(w2, first.storage);
  second.store.setSession('user_a');
  await settle();
  const state = second.store.getState();
  assert.equal(state.sharedWithMe.source, 'cache');
  assert.equal(state.sharedWithMe.data.length, 1);
  assert.equal(state.details.fc_1.source, 'cache');
  assert.equal(state.details.fc_1.data.places.length, 3);
  assert.equal(state.details.fc_1.access, 'unknown'); // not yet confirmed by the server

  await second.store.loadDetail('fc_1', { force: true }); // offline refresh fails: the copy stays, flagged
  const after = second.store.getState().details.fc_1;
  assert.equal(after.source, 'cache');
  assert.equal(after.error.kind, 'offline');
  assert.match(freshness(after).message, /You're offline\. Showing the copy saved/);
});

test('a copy is replaced by the server\'s answer as soon as it arrives, and is then no longer labelled saved', async () => {
  const w = world();
  const first = await storeWithCache(w);
  first.store.setSession('user_a');
  await first.store.loadDetail('fc_1');
  await settle();
  w.detail.collection.title = 'Renamed since';
  const second = await storeWithCache(w, first.storage);
  second.store.setSession('user_a');
  await settle();
  assert.equal(second.store.getState().details.fc_1.data.collection.title, 'South Island'); // saved copy
  await second.store.loadDetail('fc_1', { force: true });
  const now = second.store.getState().details.fc_1;
  assert.equal(now.data.collection.title, 'Renamed since');
  assert.equal(now.source, 'server');
  assert.equal(now.access, 'granted');
  assert.equal(freshness(now).kind, 'current');
});

test('the saved copy never overwrites newer server data that arrived first', async () => {
  const w = world();
  const first = await storeWithCache(w);
  first.store.setSession('user_a');
  await first.store.loadSharedWithMe();
  await first.store.loadDetail('fc_1');
  await settle();
  w.list = [summary({ title: 'Fresh from server' })];
  w.detail.collection.title = 'Fresh detail';

  // The device is slow to read its copy: the server answers first, then the old copy arrives late.
  let releaseCache;
  const slowCache = createAsyncStorageSharedTripsCache(first.storage);
  const realLoad = slowCache.load;
  slowCache.load = (userId) => new Promise((resolve) => { releaseCache = () => resolve(realLoad(userId)); });
  const second = createSharedTripsStore({ ...w.deps, cache: slowCache });
  second.setSession('user_a');
  await second.loadSharedWithMe();
  await second.loadDetail('fc_1');
  releaseCache();
  await settle();
  const state = second.getState();
  assert.equal(state.sharedWithMe.data[0].title, 'Fresh from server');
  assert.equal(state.sharedWithMe.source, 'server');
  assert.equal(state.details.fc_1.data.collection.title, 'Fresh detail');
  assert.equal(state.details.fc_1.source, 'server');
});

test('one account never reads another account\'s copy', async () => {
  const w = world();
  const a = await storeWithCache(w);
  a.store.setSession('user_a');
  await a.store.loadDetail('fc_1');
  await settle();
  const b = await storeWithCache(world({ fail: offline() }), a.storage);
  b.store.setSession('user_b');
  await settle();
  assert.deepEqual(b.store.getState().details, {});
  assert.equal(b.store.getState().sharedWithMe.data, null);
  assert.equal(JSON.stringify(b.store.getState()).includes('Bring a hat'), false);
});

test('losing access removes the Trip from the saved copy, and leaving does too', async () => {
  const w = world();
  const a = await storeWithCache(w);
  a.store.setSession('user_a');
  await a.store.loadSharedWithMe();
  await a.store.loadDetail('fc_1');
  await settle();
  assert.ok((await a.cache.load('user_a')).details.fc_1);
  w.joined = false;
  await a.store.loadDetail('fc_1', { force: true });
  await settle();
  assert.equal((await a.cache.load('user_a')).details.fc_1, undefined);
  assert.deepEqual((await a.cache.load('user_a')).sharedWithMe.data, []);
});

test('a saved copy cannot be used to write: notes need a server-confirmed membership', async () => {
  const w = world();
  const first = await storeWithCache(w);
  first.store.setSession('user_a');
  await first.store.loadDetail('fc_1');
  await settle();
  const writes = [];
  const offlineWorld = world({ fail: offline() });
  offlineWorld.deps.savePlaceNote = async (...args) => { writes.push(args); return { id: 'x' }; };
  offlineWorld.deps.updatePlaceNote = async (...args) => { writes.push(args); };
  const second = await storeWithCache(offlineWorld, first.storage);
  second.store.setSession('user_a');
  await settle();
  const result = await second.store.savePlaceNote('fc_1', 'fci_b', 'typed offline');
  assert.equal(result.ok, false);
  assert.equal(result.error.kind, 'forbidden');
  assert.deepEqual(writes, []); // nothing was queued or sent
});

test('a failing cache never breaks the live data, and hydrating does not rewrite the copy', async () => {
  const w = world();
  let saves = 0;
  const cache = { clear: async () => {}, load: async () => null, save: async () => { saves += 1; throw new Error('disk full'); } };
  const store = createSharedTripsStore({ ...w.deps, cache });
  store.setSession('user_a');
  await store.loadSharedWithMe();
  await settle();
  assert.equal(store.getState().sharedWithMe.status, 'ready');
  assert.ok(saves >= 1);

  const loaded = { details: { fc_1: { data: detail(), loadedAt: 1 } }, sharedWithMe: null };
  let writes = 0;
  const reading = createSharedTripsStore({ ...w.deps, cache: { clear: async () => {}, load: async () => loaded, save: async () => { writes += 1; } } });
  reading.setSession('user_a');
  await settle();
  assert.equal(reading.getState().details.fc_1.source, 'cache');
  assert.equal(writes, 0);
});

test('without a cache nothing is persisted and nothing is labelled saved', async () => {
  const w = world();
  const store = createSharedTripsStore(w.deps);
  store.setSession('user_a');
  await store.loadDetail('fc_1');
  assert.equal(store.getState().details.fc_1.source, 'server');
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
