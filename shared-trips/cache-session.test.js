// What happens to the saved Shared Trips when the authentication session changes. Only the person
// choosing to sign out removes them. An expired session, a failed token refresh or a rejected token ends
// the session but keeps the copy, so the same account reads it again once signed back in. Another
// account never reads it, and the server's answer always replaces it.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { clearMobileSession } from '../auth/mobile-session.ts';
import { ApiError } from '../lib/api-client.ts';
import { CACHE_KEY_PREFIX, createAsyncStorageSharedTripsCache } from './cache.ts';
import { createSharedTripsStore } from './store.ts';
import { detail, summary } from './fixtures.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const clone = (value) => JSON.parse(JSON.stringify(value));
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
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
const keyOf = (userId) => `${CACHE_KEY_PREFIX}${userId}`;

function world(overrides = {}) {
  const w = { detail: detail(), fail: null, list: [summary()], ...overrides };
  w.deps = {
    checkCapability: async () => 'supported',
    deleteCollectionNote: async () => {}, deletePlaceNote: async () => {},
    getSharedTrip: async () => { if (w.fail) throw w.fail; return clone(w.detail); },
    joinSharedTrip: async () => ({ alreadyJoined: false }), leaveSharedTrip: async () => {},
    listOwnedTrips: async () => [],
    listSharedTrips: async () => { if (w.fail) throw w.fail; return clone(w.list); },
    now: () => 9000,
    saveCollectionNote: async () => ({ id: 'x' }), savePlaceNote: async () => ({ id: 'x' }),
    shareTrip: async () => ({ collectionId: 'c', created: true, url: 'u' }),
    updateCollectionNote: async () => {}, updatePlaceNote: async () => {},
  };
  return w;
}
const launch = (w, storage, cacheOverrides = {}) => {
  const cache = { ...createAsyncStorageSharedTripsCache(storage) };
  Object.assign(cache, cacheOverrides);
  return { cache, store: createSharedTripsStore({ ...w.deps, cache }) };
};
/** A user with a saved copy on the device. */
async function withSavedCopy(userId, storage = memoryStorage(), title = null) {
  const saved = detail();
  if (title) saved.collection.title = title;
  const app = launch(world({ detail: saved }), storage);
  app.store.setSession(userId);
  await app.store.loadSharedWithMe();
  await app.store.loadDetail('fc_1');
  await settle();
  assert.ok(storage.data.has(keyOf(userId)), 'precondition: a copy was saved');
  return storage;
}
const sessionDeps = (calls, storage) => ({
  clearAuthStorage: async () => { calls.push('auth storage'); },
  clearNotebookCache: async () => { calls.push('notebooks'); },
  clearSharedTripsCache: async (userId) => { calls.push('shared trips'); await createAsyncStorageSharedTripsCache(storage).clear(userId); },
  setActiveToken: () => {},
});

// ---- explicit sign-out vs everything else ---------------------------------------------------------
test('explicit sign-out removes that account\'s saved Trips (and only that account\'s)', async () => {
  const storage = await withSavedCopy('user_a');
  await withSavedCopy('user_b', storage);
  const calls = [];
  const state = await clearMobileSession('user_a', sessionDeps(calls, storage), 'sign-out');
  assert.equal(state.session, null);
  assert.equal(storage.data.has(keyOf('user_a')), false);
  assert.equal(storage.data.has(keyOf('user_b')), true);
  assert.deepEqual(calls.sort(), ['auth storage', 'notebooks', 'shared trips']);
});

test('a failed token refresh or rejected token ends the session but keeps the saved Trips', async () => {
  const storage = await withSavedCopy('user_a');
  for (const reason of [undefined, 'auth-failure']) {
    const calls = [];
    const state = await (reason ? clearMobileSession('user_a', sessionDeps(calls, storage), reason) : clearMobileSession('user_a', sessionDeps(calls, storage)));
    assert.equal(state.session, null);
    assert.equal(storage.data.has(keyOf('user_a')), true, `reason ${reason}`);
    assert.ok(!calls.includes('shared trips'));
    assert.ok(calls.includes('notebooks')); // the existing notebook behaviour is unchanged
  }
});

test('the provider uses "sign-out" only for the sign-out the person chose', async () => {
  const strip = (source) => source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  const provider = strip(await readFile(new URL('../auth/provider.tsx', import.meta.url), 'utf8'));
  assert.match(provider, /const signOut = useCallback\(\(\) => endSession\('sign-out'\)/);
  assert.match(provider, /const invalidateSession = useCallback\(\(\) => endSession\('auth-failure'\)/);
  assert.match(provider, /invalidate: invalidateSession/);
  assert.doesNotMatch(provider, /invalidate: signOut/);
  // Nothing else wipes the saved Trips: the notebook clearer no longer touches them, and the
  // refresh-failure path uses the default reason.
  const clearer = provider.slice(provider.indexOf('async function clearUserCaches'), provider.indexOf('const MOBILE_REDIRECT_URI'));
  assert.doesNotMatch(clearer, /clearSharedTripsCache/);
  const refresh = provider.slice(provider.indexOf('const refreshBearer'), provider.indexOf('setAuthenticatedSessionHandlers'));
  assert.doesNotMatch(refresh, /sign-out|clearSharedTripsCache/);
  assert.equal(provider.match(/clearSharedTripsCache,/g).length, 1);
});

// ---- the store through each kind of session change ----------------------------------------------------
test('an expired session (401 after a refresh) keeps the data on screen and on the device', async () => {
  const storage = await withSavedCopy('user_a');
  const w = world({ fail: new ApiError(401, 'unauthorized') });
  const app = launch(w, storage);
  app.store.setSession('user_a');
  await settle();
  await app.store.loadDetail('fc_1', { force: true });
  const entry = app.store.getState().details.fc_1;
  assert.equal(entry.error.kind, 'session-expired');
  assert.equal(entry.data.places.length, 3); // still readable, labelled as a saved copy
  assert.equal(entry.source, 'cache');
  assert.equal(storage.data.has(keyOf('user_a')), true);
});

test('when the session ends nothing is shown or persisted-away; the same account gets its copy back after signing in', async () => {
  const storage = await withSavedCopy('user_a');
  const before = storage.data.get(keyOf('user_a'));
  const app = launch(world({ fail: new TypeError('Network request failed') }), storage);
  app.store.setSession('user_a');
  await settle();
  assert.equal(app.store.getState().details.fc_1.source, 'cache');

  app.store.setSession(null); // refresh failed: signed out in memory only
  await settle();
  assert.deepEqual(app.store.getState().details, {});
  assert.equal(app.store.getState().sharedWithMe.data, null);
  assert.equal(storage.data.get(keyOf('user_a')), before, 'the stored copy is untouched');

  app.store.setSession('user_a'); // authentication restored
  await settle();
  const state = app.store.getState();
  assert.equal(state.details.fc_1.source, 'cache');
  assert.equal(state.sharedWithMe.data.length, 1);
  assert.equal(state.details.fc_1.access, 'unknown'); // still not trusted for writes
});

test('after restoring, the server\'s answer replaces the saved copy', async () => {
  const storage = await withSavedCopy('user_a');
  const changed = detail();
  changed.collection.title = 'South Island, revised';
  const w = world({ detail: changed });
  const app = launch(w, storage);
  app.store.setSession('user_a');
  await settle();
  assert.equal(app.store.getState().details.fc_1.data.collection.title, 'South Island');
  assert.equal(app.store.getState().details.fc_1.source, 'cache');
  await app.store.loadDetail('fc_1');
  const entry = app.store.getState().details.fc_1;
  assert.equal(entry.data.collection.title, 'South Island, revised');
  assert.equal(entry.source, 'server');
  assert.equal(entry.access, 'granted');
});

test('switching accounts never exposes the previous account\'s copy', async () => {
  const storage = await withSavedCopy('user_a');
  const app = launch(world({ fail: new TypeError('Network request failed') }), storage);
  app.store.setSession('user_a');
  await settle();
  assert.equal(app.store.getState().details.fc_1.source, 'cache');

  app.store.setSession('user_b'); // directly, with no signed-out moment in between
  assert.deepEqual(app.store.getState().details, {}); // gone from memory immediately
  await settle();
  assert.deepEqual(app.store.getState().details, {});
  assert.equal(app.store.getState().sharedWithMe.data, null);
  assert.equal(JSON.stringify(app.store.getState()).includes('South Island'), false);
  assert.equal(storage.data.has(keyOf('user_a')), true); // A's copy waits for A
});

test('a copy still loading for the previous account cannot appear after switching accounts', async () => {
  const storage = await withSavedCopy('user_a');
  const real = createAsyncStorageSharedTripsCache(storage);
  let releaseA;
  const app = launch(world({ fail: new TypeError('Network request failed') }), storage, {
    load: async (userId) => {
      if (userId === 'user_a') await new Promise((resolve) => { releaseA = resolve; });
      return real.load(userId);
    },
  });
  app.store.setSession('user_a'); // A's copy is slow to read
  await settle();
  app.store.setSession('user_b'); // B has no copy at all
  await settle();
  assert.equal(app.store.getState().userId, 'user_b');
  releaseA(); // A's copy arrives late
  await settle();
  const state = app.store.getState();
  assert.equal(state.userId, 'user_b');
  assert.deepEqual(state.details, {});
  assert.equal(state.sharedWithMe.data, null);
});

test('signing in as another account after a failed refresh shows only that account\'s copy', async () => {
  const storage = await withSavedCopy('user_a'); // A's session ended by a failed refresh: copy kept
  const app = launch(world({ fail: new TypeError('Network request failed') }), storage);
  app.store.setSession(null);
  app.store.setSession('user_b');
  await settle();
  assert.deepEqual(app.store.getState().details, {});
  assert.equal(app.store.getState().sharedWithMe.data, null);
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
