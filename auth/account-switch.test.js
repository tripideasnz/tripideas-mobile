// Switching accounts on one device: sign-out ends the app session and removes only that account's
// credentials and private caches; the next sign-in can establish a different identity; nothing
// account-specific, and none of the person's saved content, crosses between accounts. The hosted
// WorkOS/Google session cannot be ended from the app, so sign-in must open a private browser session.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { AUTH_BROWSER_OPTIONS } from './browser.ts';
import {
  clearMobileSession,
  persistMobileSession,
  restoreMobileSession,
  selectRefreshUser,
} from './mobile-session.ts';
import {
  CODE_VERIFIER_KEY,
  EXPECTED_STATE_KEY,
  REFRESH_TOKEN_KEY,
  USER_SECURE_KEY,
} from './session.ts';
import { CACHE_KEY_PREFIX, createAsyncStorageSharedTripsCache } from '../shared-trips/cache.ts';
import { detail, summary } from '../shared-trips/fixtures.js';

const accountA = { id: 'user-a', email: 'a@example.com', name: 'Account A' };
const accountB = { id: 'user-b', email: 'b@example.com', name: 'Account B' };
const AUTH_KEYS = [USER_SECURE_KEY, REFRESH_TOKEN_KEY, CODE_VERIFIER_KEY, EXPECTED_STATE_KEY];

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

// One device: a secure store for credentials, a local store for the person's content, and the
// same dependency wiring the provider uses.
function device() {
  const secure = new Map();
  const local = memoryStorage();
  const cache = createAsyncStorageSharedTripsCache(local);
  const calls = { activeTokens: [], notebooksCleared: [] };
  const deps = {
    cacheUser: async (user) => {
      if (user) secure.set(USER_SECURE_KEY, JSON.stringify(user));
      else secure.delete(USER_SECURE_KEY);
    },
    clearAuthStorage: async () => { AUTH_KEYS.forEach((key) => secure.delete(key)); },
    clearNotebookCache: async (userId) => { calls.notebooksCleared.push(userId); },
    clearSharedTripsCache: (userId) => cache.clear(userId),
    loadRefreshToken: async () => secure.get(REFRESH_TOKEN_KEY) ?? null,
    setActiveToken: (token) => calls.activeTokens.push(token),
    storeRefreshToken: async (token) => { secure.set(REFRESH_TOKEN_KEY, token); },
  };
  const cachedUser = () => {
    const raw = secure.get(USER_SECURE_KEY);
    return raw ? JSON.parse(raw) : null;
  };
  return { cache, cachedUser, calls, deps, local, secure };
}

const snapshot = (loadedAt) => {
  const trip = detail();
  return { details: { [trip.collection.id]: { data: trip, loadedAt } }, sharedWithMe: { data: [summary()], loadedAt } };
};

const tokensFor = (user, n = 1) => ({
  accessToken: `access-${user.id}-${n}`,
  refreshToken: `refresh-${user.id}-${n}`,
  user,
});

async function run() {
  const d = device();

  // The person's own content, which sign-out must never touch.
  d.local.data.set('tripideas.savedPlaceIds.user.user-a.v1', JSON.stringify(['place-1', 'place-2']));
  d.local.data.set('tripideas.savedPlaceIds.anon.v1', JSON.stringify(['place-3']));
  d.local.data.set('tripideas.savedPlaceIds.user.user-b.v1', JSON.stringify(['place-9']));

  // Account A signs in, with a saved Shared Trips copy and Notebook cache of its own.
  let state = await persistMobileSession(tokensFor(accountA), d.deps);
  assert.equal(state.user.id, 'user-a');
  assert.equal(state.session.accessToken, 'access-user-a-1');
  assert.equal(d.secure.get(REFRESH_TOKEN_KEY), 'refresh-user-a-1');
  await d.cache.save('user-a', snapshot(1));
  assert.ok(await d.cache.load('user-a'), 'A has a saved copy before signing out');

  // Sign out: the app session and credentials are gone.
  d.secure.set(CODE_VERIFIER_KEY, 'verifier');
  d.secure.set(EXPECTED_STATE_KEY, 'state');
  state = await clearMobileSession('user-a', d.deps, 'sign-out');
  assert.equal(state.session, null);
  assert.equal(state.user, null);
  assert.equal(d.calls.activeTokens.at(-1), null, 'the in-memory bearer is dropped');
  for (const key of AUTH_KEYS) assert.equal(d.secure.has(key), false, `${key} removed by sign-out`);
  assert.equal(d.cachedUser(), null);
  assert.deepEqual(d.calls.notebooksCleared, ['user-a']);
  assert.equal(await d.cache.load('user-a'), null, 'the signed-out account\'s private cache is removed');

  // Sign-out does not delete local favourites or anything else the person saved.
  assert.deepEqual(
    JSON.parse(d.local.data.get('tripideas.savedPlaceIds.user.user-a.v1')),
    ['place-1', 'place-2']
  );
  assert.deepEqual(JSON.parse(d.local.data.get('tripideas.savedPlaceIds.anon.v1')), ['place-3']);

  // With nothing stored, a restore finds no identity: it does not resurrect Account A.
  let refreshCalls = 0;
  const neverCalled = async () => { refreshCalls += 1; throw new Error('must not refresh'); };
  state = await restoreMobileSession({ ...d.deps, refresh: neverCalled });
  assert.equal(state.session, null);
  assert.equal(refreshCalls, 0);

  // Sign-in as a different identity.
  state = await persistMobileSession(tokensFor(accountB), d.deps);
  assert.equal(state.user.id, 'user-b');
  assert.equal(state.user.email, 'b@example.com');
  assert.equal(state.session.userId, 'user-b');
  assert.equal(d.cachedUser().id, 'user-b');
  assert.equal(d.secure.get(REFRESH_TOKEN_KEY), 'refresh-user-b-1');
  assert.equal(await d.cache.load('user-b'), null, 'B never reads A\'s saved Shared Trips');
  assert.equal(d.local.data.has(`${CACHE_KEY_PREFIX}user-a`), false);

  // Restoration after a relaunch uses Account B's token, rotates it, and keeps B's identity.
  state = await restoreMobileSession({
    ...d.deps,
    refresh: async (token) => {
      assert.equal(token, 'refresh-user-b-1', 'restoration presents the current account\'s token');
      return {
        accessToken: 'access-user-b-2',
        refreshToken: 'refresh-user-b-2',
        user: selectRefreshUser(null, d.cachedUser()),
      };
    },
  });
  assert.equal(state.user.id, 'user-b');
  assert.equal(state.session.accessToken, 'access-user-b-2');
  assert.equal(d.secure.get(REFRESH_TOKEN_KEY), 'refresh-user-b-2');
  assert.equal(d.cachedUser().id, 'user-b');

  // Switching back is symmetrical: B signs out, A's content is intact for A's next sign-in.
  await d.cache.save('user-b', snapshot(2));
  assert.ok(await d.cache.load('user-b'));
  await clearMobileSession('user-b', d.deps, 'sign-out');
  assert.equal(await d.cache.load('user-b'), null);
  assert.deepEqual(JSON.parse(d.local.data.get('tripideas.savedPlaceIds.user.user-b.v1')), ['place-9']);
  assert.deepEqual(JSON.parse(d.local.data.get('tripideas.savedPlaceIds.user.user-a.v1')), ['place-1', 'place-2']);

  // Error handling is unchanged: a rejected token ends the session and clears credentials; an
  // unusable token set never signs anyone in.
  await persistMobileSession(tokensFor(accountA), d.deps);
  state = await restoreMobileSession({
    ...d.deps,
    refresh: async () => { throw Object.assign(new Error('rejected'), { status: 401 }); },
  });
  assert.equal(state.session, null);
  assert.equal(d.secure.has(REFRESH_TOKEN_KEY), false);
  state = await persistMobileSession({ accessToken: 'x', refreshToken: 'y', user: null }, d.deps);
  assert.equal(state.session, null);
  assert.equal(d.secure.has(USER_SECURE_KEY), false);

  // The hosted session cannot be ended from the app: sign-in must use a private browser session,
  // and the provider must hand that option to the system authentication browser.
  assert.deepEqual(AUTH_BROWSER_OPTIONS, { preferEphemeralSession: true });
  const provider = await readFile(new URL('./provider.tsx', import.meta.url), 'utf8');
  assert.match(
    provider,
    /WebBrowser\.openAuthSessionAsync\(authorizationUrl, MOBILE_REDIRECT_URI, AUTH_BROWSER_OPTIONS\)/
  );

  // Sign-out only ever removes authentication keys: no saved-content storage key is listed.
  const storage = await readFile(new URL('./storage.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(storage, /savedPlaceIds|sharedTrips|favourite|trip/i);

  console.log('✓ account switching: sign-out ends the session, a different identity can sign in, saved content and per-account caches stay separate');
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
