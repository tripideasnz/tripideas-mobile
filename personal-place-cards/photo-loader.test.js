import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { ApiError, setActiveToken, setAuthenticatedSessionHandlers } from '../lib/api-client.ts';
import { authorizePhotoRead } from '../notebooks/api.ts';
import { createPhotoAuthorizer } from './photo-authorizer.ts';
import {
  createPersonalPhotoLoader,
  createPhotoFailureTracker,
  PERSONAL_PHOTO_MAX_AUTO_RETRIES,
  personalPhotoCacheKey,
} from './photo-loader.ts';

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const tests = [];
const test = (name, run) => tests.push({ name, run });
const flush = () => new Promise((resolve) => setImmediate(resolve));

// Deterministic scheduler: nothing runs until the test says so.
const manualScheduler = () => {
  const queue = [];
  return {
    delays: () => queue.filter((item) => !item.cancelled && !item.done).map((item) => item.delayMs),
    pending: () => queue.filter((item) => !item.cancelled && !item.done).length,
    runNext: () => {
      const item = queue.find((candidate) => !candidate.cancelled && !candidate.done);
      assert.ok(item, 'expected a scheduled retry');
      item.done = true;
      item.callback();
    },
    schedule: (callback, delayMs) => {
      const item = { callback, cancelled: false, delayMs, done: false };
      queue.push(item);
      return () => { item.cancelled = true; };
    },
  };
};

const makeLoader = (overrides = {}) => {
  const scheduler = overrides.scheduler ?? manualScheduler();
  const calls = [];
  const invalidated = [];
  let counter = 0;
  const failures = overrides.failures ?? createPhotoFailureTracker();
  const loader = createPersonalPhotoLoader({
    authorize: overrides.authorize ?? (async (id) => {
      calls.push(id);
      counter += 1;
      return `https://signed.example/${id}?sig=${counter}`;
    }),
    failures,
    invalidate: (id) => invalidated.push(id),
    maxAutoRetries: overrides.maxAutoRetries,
    onChange: () => {},
    schedule: scheduler.schedule,
    userId: overrides.userId ?? 'user-a',
  });
  return { calls, failures, invalidated, loader, scheduler };
};

// ── F02a: stable cache identity ──────────────────────────────────────────────

test('cache identity is asset-based and survives signed-URL refreshes', async () => {
  const { loader, scheduler } = makeLoader();
  loader.setAssets(['asset-1']);
  await flush();
  const first = loader.get('asset-1');
  assert.equal(first.status, 'ready');
  assert.equal(first.cacheKey, personalPhotoCacheKey('user-a', 'asset-1'));
  // A URL refresh (after an image error) yields a different signed URL but the same cache key.
  loader.reportError('asset-1', first.url);
  scheduler.runNext();
  await flush();
  const refreshed = loader.get('asset-1');
  assert.equal(refreshed.status, 'ready');
  assert.notEqual(refreshed.url, first.url);
  assert.equal(refreshed.cacheKey, first.cacheKey);
  assert.doesNotMatch(first.cacheKey, /signed|sig=|https?:/);
});

test('the cache key is scoped to the user and the asset', () => {
  assert.notEqual(personalPhotoCacheKey('user-a', 'asset-1'), personalPhotoCacheKey('user-b', 'asset-1'));
  assert.notEqual(personalPhotoCacheKey('user-a', 'asset-1'), personalPhotoCacheKey('user-a', 'asset-2'));
});

// ── Account isolation ────────────────────────────────────────────────────────

test('loaders for different users never share state or cache identity', async () => {
  const a = makeLoader({ userId: 'user-a' });
  const b = makeLoader({ userId: 'user-b' });
  a.loader.setAssets(['asset-1']);
  await flush();
  assert.equal(b.loader.get('asset-1'), null);
  b.loader.setAssets(['asset-1']);
  await flush();
  assert.notEqual(a.loader.get('asset-1').cacheKey, b.loader.get('asset-1').cacheKey);
});

test('a disposed loader ignores authorisations that arrive late', async () => {
  let resolveAuthorization;
  const pending = new Promise((resolve) => { resolveAuthorization = resolve; });
  const { loader } = makeLoader({ authorize: () => pending });
  loader.setAssets(['asset-1']);
  loader.dispose();
  resolveAuthorization('https://signed.example/late');
  await flush();
  assert.equal(loader.get('asset-1'), null);
});

test('clearing the authoriser discards signed URLs and in-flight responses from the previous identity', async () => {
  let resolveFirst;
  let calls = 0;
  const authorizer = createPhotoAuthorizer({
    fetchAuthorization: (id) => {
      calls += 1;
      if (calls === 1) {
        return new Promise((resolve) => {
          resolveFirst = () => resolve({ expiresAt: '2099-01-01T00:00:00Z', url: `https://signed.example/${id}/old-user` });
        });
      }
      return Promise.resolve({ expiresAt: '2099-01-01T00:00:00Z', url: `https://signed.example/${id}/new-user` });
    },
  });
  const old = authorizer.authorize('asset-1');
  authorizer.clear(); // account switch
  resolveFirst();
  await assert.rejects(old, /discarded/);
  assert.equal(await authorizer.authorize('asset-1'), 'https://signed.example/asset-1/new-user');
});

test('exhausted-photo memory is per user session and cleared on switch', () => {
  const failures = createPhotoFailureTracker();
  failures.markExhausted('asset-1');
  assert.equal(failures.isExhausted('asset-1'), true);
  failures.clearAll();
  assert.equal(failures.isExhausted('asset-1'), false);
});

test('signed URLs and loader state are never persisted', async () => {
  for (const file of ['personal-place-cards/photo-loader.ts', 'personal-place-cards/photo-authorizer.ts', 'personal-place-cards/use-personal-photos.ts']) {
    const source = await read(file);
    assert.doesNotMatch(source, /AsyncStorage|SecureStore|setItem|writeAsStringAsync/, file);
  }
});

// ── Provider authorisation reuse ─────────────────────────────────────────────

test('the shared authoriser de-duplicates, caches until expiry and honours invalidation', async () => {
  let now = Date.parse('2026-10-25T00:00:00Z');
  let fetches = 0;
  const authorizer = createPhotoAuthorizer({
    fetchAuthorization: async (id) => {
      fetches += 1;
      return { expiresAt: new Date(now + 300_000).toISOString(), url: `https://signed.example/${id}/${fetches}` };
    },
    now: () => now,
  });
  const [one, two] = await Promise.all([authorizer.authorize('a'), authorizer.authorize('a')]);
  assert.equal(one, two);
  assert.equal(fetches, 1, 'concurrent requests share one API call');
  assert.equal(await authorizer.authorize('a'), one);
  assert.equal(fetches, 1, 'a fresh authorisation is reused');
  now += 280_000; // inside the 30 s safety margin
  assert.notEqual(await authorizer.authorize('a'), one);
  assert.equal(fetches, 2);
  authorizer.invalidate('a');
  await authorizer.authorize('a');
  assert.equal(fetches, 3);
});

test('Trip detail and cards use the provider-backed hook, not direct authorisation', async () => {
  const [tripDetail, card, editor, hook, provider] = await Promise.all([
    read('app/trips/[tripId].tsx'),
    read('components/personal-place-card-view.tsx'),
    read('app/personal-place-cards/[cardId].tsx'),
    read('personal-place-cards/use-personal-photos.ts'),
    read('personal-place-cards/provider.tsx'),
  ]);
  for (const source of [tripDetail, card, editor]) {
    assert.doesNotMatch(source, /authorizePhotoRead/);
    assert.match(source, /usePersonalPhotos\(/);
  }
  assert.match(hook, /authorizePhoto/);
  assert.match(provider, /createPhotoAuthorizer\(/);
});

// ── F02c: bounded recovery ───────────────────────────────────────────────────

test('image errors retry at most twice with delays, then fail terminally', async () => {
  const { calls, invalidated, loader, scheduler } = makeLoader();
  loader.setAssets(['asset-1']);
  await flush();
  assert.equal(PERSONAL_PHOTO_MAX_AUTO_RETRIES, 2);

  loader.reportError('asset-1');
  assert.deepEqual(scheduler.delays(), [1_000]);
  scheduler.runNext(); await flush();
  assert.equal(loader.get('asset-1').status, 'ready');

  loader.reportError('asset-1');
  assert.deepEqual(scheduler.delays(), [3_000]);
  scheduler.runNext(); await flush();
  assert.equal(loader.get('asset-1').status, 'ready');

  loader.reportError('asset-1');
  assert.equal(loader.get('asset-1').status, 'failed');
  assert.equal(scheduler.pending(), 0, 'nothing further scheduled');
  assert.equal(calls.length, 3, 'one initial request plus two retries');
  assert.deepEqual(invalidated, ['asset-1', 'asset-1'], 'each retry fetches a fresh URL');

  loader.reportError('asset-1'); // repeated errors for a failed image are ignored
  await flush();
  assert.equal(calls.length, 3);
});

test('authorisation failures use the same bounded recovery', async () => {
  let attempts = 0;
  const { loader, scheduler } = makeLoader({
    authorize: async () => { attempts += 1; throw new ApiError(404, 'not_found'); },
  });
  loader.setAssets(['asset-1']);
  await flush();
  scheduler.runNext(); await flush();
  scheduler.runNext(); await flush();
  assert.equal(loader.get('asset-1').status, 'failed');
  assert.equal(attempts, 3);
  assert.equal(scheduler.pending(), 0, 'nothing further scheduled');
});

test('errors from a stale URL and overlapping errors do not start extra retries', async () => {
  const { loader, scheduler } = makeLoader();
  loader.setAssets(['asset-1']);
  await flush();
  const { url } = loader.get('asset-1');
  loader.reportError('asset-1', 'https://signed.example/old-url');
  assert.equal(scheduler.pending(), 0, 'stale URL error ignored');
  loader.reportError('asset-1', url);
  loader.reportError('asset-1', url);
  assert.equal(scheduler.pending(), 1, 'a second error while a retry is pending is ignored');
});

test('a remount does not restart recovery for a photo that already failed', async () => {
  const failures = createPhotoFailureTracker();
  const first = makeLoader({ failures, maxAutoRetries: 0 });
  first.loader.setAssets(['asset-1']);
  await flush();
  first.loader.reportError('asset-1');
  assert.equal(first.loader.get('asset-1').status, 'failed');

  const remounted = makeLoader({ failures });
  remounted.loader.setAssets(['asset-1']);
  assert.equal(remounted.loader.get('asset-1').status, 'failed');
  assert.equal(remounted.calls.length, 0, 'no request for an exhausted photo');
});

test('explicit retry starts a fresh bounded cycle', async () => {
  const failures = createPhotoFailureTracker();
  const { calls, invalidated, loader } = makeLoader({ failures, maxAutoRetries: 0 });
  loader.setAssets(['asset-1']);
  await flush();
  loader.reportError('asset-1');
  assert.equal(loader.get('asset-1').status, 'failed');
  loader.retry('asset-1');
  await flush();
  assert.equal(loader.get('asset-1').status, 'ready');
  assert.equal(failures.isExhausted('asset-1'), false);
  assert.equal(calls.length, 2);
  assert.deepEqual(invalidated, ['asset-1']);
});

// ── F02d: editor recovery ────────────────────────────────────────────────────

test('the editor retries once automatically and then shows a retry state', async () => {
  const { calls, loader, scheduler } = makeLoader({ maxAutoRetries: 1 });
  loader.setAssets(['asset-1']);
  await flush();
  loader.reportError('asset-1');
  scheduler.runNext(); await flush();
  loader.reportError('asset-1');
  assert.equal(loader.get('asset-1').status, 'failed');
  assert.equal(calls.length, 2);
});

test('editor tiles are never left on "Loading photo…" and expose a retry control', async () => {
  const editor = await read('app/personal-place-cards/[cardId].tsx');
  assert.match(editor, /maxAutoRetries: 1/);
  assert.match(editor, /photo\?\.status === 'failed'/);
  assert.match(editor, /label="Try again"/);
  assert.match(editor, /photos\.retry\(media\.photoAssetId\)/);
  assert.match(editor, /<PhotoFailedTile/);
  assert.match(editor, /onError=\{\(\) => photos\.reportError\(media\.photoAssetId, photo\.url\)\}/);
  assert.match(editor, /cacheKey: photo\.cacheKey/);
  assert.doesNotMatch(editor, /photoUrls|setPhotoUrls/);
});

// ── F02e: expired access token ───────────────────────────────────────────────

test('photo read authorisation refreshes an expired token and replays exactly once', async () => {
  const realFetch = globalThis.fetch;
  const seen = [];
  let refreshes = 0;
  let invalidations = 0;
  globalThis.fetch = async (url, options) => {
    seen.push({ authorization: options.headers.Authorization, url: String(url) });
    return seen.length === 1
      ? new Response('', { status: 401 })
      : new Response(JSON.stringify({ expiresAt: '2099-01-01T00:00:00Z', method: 'GET', url: 'https://signed.example/photo' }), { status: 200 });
  };
  setActiveToken('expired');
  setAuthenticatedSessionHandlers({
    invalidate: async () => { invalidations += 1; },
    refresh: async () => { refreshes += 1; setActiveToken('fresh'); return true; },
  });
  try {
    const result = await authorizePhotoRead('asset-1');
    assert.equal(result.url, 'https://signed.example/photo');
    assert.equal(seen.length, 2, 'one original request and exactly one replay');
    assert.equal(seen[0].authorization, 'Bearer expired');
    assert.equal(seen[1].authorization, 'Bearer fresh');
    assert.equal(refreshes, 1);
    assert.equal(invalidations, 0);
  } finally {
    globalThis.fetch = realFetch;
    setActiveToken(null);
    setAuthenticatedSessionHandlers(null);
  }
});

test('a second 401 after refresh signs out once and does not loop', async () => {
  const realFetch = globalThis.fetch;
  let requests = 0;
  let invalidations = 0;
  globalThis.fetch = async () => { requests += 1; return new Response('', { status: 401 }); };
  setActiveToken('expired');
  setAuthenticatedSessionHandlers({
    invalidate: async () => { invalidations += 1; },
    refresh: async () => true,
  });
  try {
    await assert.rejects(authorizePhotoRead('asset-1'), (error) => error instanceof ApiError && error.status === 401);
    assert.equal(requests, 2);
    assert.equal(invalidations, 1);
  } finally {
    globalThis.fetch = realFetch;
    setActiveToken(null);
    setAuthenticatedSessionHandlers(null);
  }
});

// ── F02i: fewer off-screen requests ──────────────────────────────────────────

test('only the assets a component lists are authorised, and removed ones are dropped', async () => {
  const { calls, loader, scheduler } = makeLoader();
  loader.setAssets(['visible-1', 'visible-2']);
  await flush();
  assert.deepEqual(calls.sort(), ['visible-1', 'visible-2']);
  loader.setAssets(['visible-2', 'visible-3']);
  await flush();
  assert.deepEqual(calls.sort(), ['visible-1', 'visible-2', 'visible-3'], 'only the new asset is requested');
  assert.equal(loader.get('visible-1'), null);
  loader.reportError('visible-3');
  loader.setAssets(['visible-2']);
  assert.equal(scheduler.pending(), 0, 'a dropped asset cancels its pending retry');
});

test('the Personal Places list is virtualised and each card authorises at most four photos', async () => {
  const [list, card] = await Promise.all([
    read('app/personal-place-cards/index.tsx'),
    read('components/personal-place-card-view.tsx'),
  ]);
  assert.match(list, /<FlatList/);
  assert.match(list, /windowSize=\{3\}/);
  assert.match(list, /initialNumToRender=\{5\}/);
  assert.doesNotMatch(list, /cards\.map\(/);
  assert.doesNotMatch(list, /<ScrollView/);
  assert.match(card, /\.slice\(0, 4\)/);
});

// ── Revisits: a photo that is already authorised starts ready ────────────────

const cachedPair = () => {
  let now = Date.parse('2026-10-25T00:00:00Z');
  let fetches = 0;
  const authorizer = createPhotoAuthorizer({
    fetchAuthorization: async (id) => {
      fetches += 1;
      return { expiresAt: new Date(now + 300_000).toISOString(), url: `https://signed.example/${id}/${fetches}` };
    },
    now: () => now,
  });
  const loaderFor = (userId, changes = []) => createPersonalPhotoLoader({
    authorize: authorizer.authorize,
    failures: createPhotoFailureTracker(),
    invalidate: authorizer.invalidate,
    onChange: () => changes.push('change'),
    peek: authorizer.peek,
    schedule: manualScheduler().schedule,
    userId,
  });
  return { advance: (ms) => { now += ms; }, authorizer, fetches: () => fetches, loaderFor };
};

test('peek returns a fresh URL without fetching, and nothing once it is expired, invalidated or cleared', async () => {
  const { advance, authorizer, fetches } = cachedPair();
  assert.equal(authorizer.peek('a'), null, 'nothing authorised yet');
  assert.equal(fetches(), 0, 'peek never fetches');
  const url = await authorizer.authorize('a');
  assert.equal(authorizer.peek('a'), url);
  advance(280_000); // inside the 30 s safety margin, the same rule authorize() applies
  assert.equal(authorizer.peek('a'), null, 'an expiring URL is not offered');
  const renewed = await authorizer.authorize('a');
  assert.equal(authorizer.peek('a'), renewed);
  authorizer.invalidate('a');
  assert.equal(authorizer.peek('a'), null, 'invalidation is honoured');
  await authorizer.authorize('a');
  authorizer.clear();
  assert.equal(authorizer.peek('a'), null, 'sign-out or account switch drops every URL');
  assert.equal(fetches(), 3, 'only authorize() ever fetched');
});

test('a remount within the authorisation lifetime is ready at once: no loading state, no request', async () => {
  const { authorizer, fetches, loaderFor } = cachedPair();
  const first = loaderFor('user-a');
  first.setAssets(['photo-1']);
  assert.equal(first.get('photo-1').status, 'loading');
  await flush();
  const ready = first.get('photo-1');
  assert.equal(ready.status, 'ready');
  first.dispose();

  const states = [];
  const second = loaderFor('user-a', states);
  second.setAssets(['photo-1']);
  const now = second.get('photo-1');
  assert.deepEqual([now.status, now.url, now.cacheKey], ['ready', ready.url, ready.cacheKey]);
  assert.equal(states.length, 1, 'ready is published once; no loading state first');
  await flush();
  assert.equal(second.get('photo-1').status, 'ready');
  assert.equal(fetches(), 1, 'no further authorisation request');
  assert.equal(authorizer.peek('photo-1'), ready.url);
});

test('an expired authorisation still goes loading, then one refresh, then ready with the same cache key', async () => {
  const { advance, fetches, loaderFor } = cachedPair();
  const first = loaderFor('user-a');
  first.setAssets(['photo-1']);
  await flush();
  const before = first.get('photo-1');
  first.dispose();
  advance(280_000);

  const second = loaderFor('user-a');
  second.setAssets(['photo-1']);
  assert.equal(second.get('photo-1').status, 'loading');
  await flush();
  const after = second.get('photo-1');
  assert.equal(after.status, 'ready');
  assert.notEqual(after.url, before.url);
  assert.equal(after.cacheKey, before.cacheKey);
  assert.equal(fetches(), 2);
});

test('new and replaced photos (new asset ids) still load; a cached one beside them starts ready', async () => {
  const { fetches, loaderFor } = cachedPair();
  const first = loaderFor('user-a');
  first.setAssets(['old']);
  await flush();
  first.dispose();

  const next = loaderFor('user-a');
  next.setAssets(['old', 'replacement']);
  assert.equal(next.get('old').status, 'ready');
  assert.equal(next.get('replacement').status, 'loading');
  await flush();
  assert.equal(next.get('replacement').status, 'ready');
  assert.equal(fetches(), 2, 'only the new asset was requested');
});

test('retry, image error and exhausted-photo memory are unaffected by a cached URL', async () => {
  const { authorizer, loaderFor } = cachedPair();
  const loader = loaderFor('user-a');
  loader.setAssets(['photo-1']);
  await flush();
  const ready = loader.get('photo-1');
  loader.reportError('photo-1', ready.url);
  assert.equal(loader.get('photo-1').status, 'loading', 'an image error still enters recovery');
  assert.equal(loader.get('photo-1').url, null);
  loader.retry('photo-1');
  assert.equal(loader.get('photo-1').status, 'loading', 'explicit retry invalidates first, so it reloads');
  await flush();
  assert.equal(loader.get('photo-1').status, 'ready');
  assert.notEqual(loader.get('photo-1').url, ready.url);
  assert.equal(authorizer.peek('photo-1'), loader.get('photo-1').url);

  const failures = createPhotoFailureTracker();
  failures.markExhausted('bad');
  const exhausted = createPersonalPhotoLoader({
    authorize: authorizer.authorize,
    failures,
    invalidate: authorizer.invalidate,
    onChange() {},
    peek: () => 'https://signed.example/stale',
    schedule: manualScheduler().schedule,
    userId: 'user-a',
  });
  exhausted.setAssets(['bad']);
  assert.equal(exhausted.get('bad').status, 'failed', 'cooldown wins over any cached URL');
});

test('accounts stay isolated: a cache cleared by an account switch seeds nothing for the next user', async () => {
  const { authorizer, loaderFor } = cachedPair();
  const a = loaderFor('user-a');
  a.setAssets(['photo-1']);
  await flush();
  a.dispose();
  authorizer.clear();
  const b = loaderFor('user-b');
  b.setAssets(['photo-1']);
  assert.equal(b.get('photo-1').status, 'loading');
  assert.match(b.get('photo-1').cacheKey, /user-b/);
});

test('the hook reports a cached photo as ready on its first render, without side effects', async () => {
  const hook = await read('personal-place-cards/use-personal-photos.ts');
  const provider = await read('personal-place-cards/provider.tsx');
  // get() falls back to the cache while the loader has published nothing yet.
  assert.match(hook, /const state = loader\?\.get\(photoAssetId\);\s*if \(state\) return state;/);
  assert.match(hook, /peekPhotoAuthorization\(photoAssetId\)/);
  assert.match(hook, /status: 'ready', url \}/);
  assert.match(hook, /peek: peekPhotoAuthorization,/);
  // The fallback is a plain read: no authorise, setState or loader creation outside the effects.
  const getBody = hook.match(/const get = useCallback\([\s\S]*?\n  \);/)[0];
  assert.doesNotMatch(getBody, /authorizePhoto|setLoader|rerender\(|createPersonalPhotoLoader|setAssets/);
  // The provider exposes one stable function that is empty when nobody is signed in.
  assert.match(provider, /const peekPhotoAuthorization = useCallback\(\(photoAssetId: string\) => \{\s*if \(!activeUser\.current\) return null;\s*return photoAuthorizerRef\.current\.peek\(photoAssetId\);\s*\}, \[\]\);/);
});

let failed = false;
for (const { name, run } of tests) {
  try {
    await run();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed = true;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}
if (failed) process.exitCode = 1;
