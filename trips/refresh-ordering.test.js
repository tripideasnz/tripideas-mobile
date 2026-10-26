// Batch 2E.2: ordering guarantees around refreshes.
//
// 1. Import: the follow-up refresh runs after an older in-flight refresh, whatever its
//    outcome, and the final state is the imported data.
// 2. Persistence: cache writes for a user are ordered and a stale refresh write cannot
//    be the last one on disk, even when storage deliberately completes writes out of order.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { deferred, flags, mountProvider, settle, signedOut, trip, userA, userB, valueOf, world } from './hooks-harness.js';

const tests = [];
const waitFor = async (condition, label) => {
  for (let i = 0; i < 400; i += 1) { if (condition()) return; await new Promise((resolve) => setTimeout(resolve, 5)); }
  throw new Error(`timed out waiting for: ${label}`);
};
const test = (name, run) => tests.push({ name, run });
const ids = (mounted) => valueOf(mounted).trips.map((t) => t.id);
const names = (mounted) => valueOf(mounted).trips.map((t) => t.name);

// ── Import ordering ─────────────────────────────────────────────────────────

const legacyTrip = { ...trip('local-1', 'Device trip'), places: [] };

// A signed-in user with one server Trip and one device Trip waiting to be imported.
// listTrips #1 is held; every later one reads the server, which the migration changes.
function importWorld() {
  const log = [];
  const first = deferred();
  let count = 0;
  const ctx = world({
    caches: { 'user-a': [trip('srv-1', 'Server trip')] },
    listTrips: () => {
      const n = (count += 1);
      log.push(`start ${n}`);
      const result = n === 1 ? first.promise : Promise.resolve(ctx.server.trips['user-a'].map((t) => ({ ...t })));
      return result.then((value) => { log.push(`end ${n}`); return value; }, (error) => { log.push(`fail ${n}`); throw error; });
    },
  });
  ctx.server.trips['user-a'] = [trip('srv-1', 'Server trip')];
  globalThis.__store.getMyTrips = async () => [legacyTrip];
  let migrations = 0;
  globalThis.__runTripMigration = async () => {
    migrations += 1;
    log.push('import wrote to the server');
    ctx.server.trips['user-a'].push(trip('itn_imported', 'Device trip'));
    return {
      journal: { createdAt: '', entries: [{ localTripId: 'local-1', state: 'COMPLETED' }], sourceFingerprint: 'x', userId: 'user-a' },
      progress: { completed: 1, permanentErrors: 0, retryableErrors: 0, total: 1 },
    };
  };
  globalThis.__session = userA;
  return { ctx, first, log, migrations: () => migrations };
}

test('import while a refresh is running: the follow-up starts only after the older refresh, and the imported data wins', async () => {
  const { first, log } = importWorld();
  const mounted = mountProvider();
  await waitFor(() => log.includes('start 1'), 'startup refresh');
  assert.deepEqual(log, ['start 1'], 'an ordinary refresh is in flight');
  const importing = valueOf(mounted).confirmImport();
  await settle();
  assert.deepEqual(log, ['start 1', 'import wrote to the server'], 'the follow-up is queued, not started and not joined');
  first.resolve([trip('srv-1', 'Server trip')]); // read before the import: knows nothing of it
  await importing; await settle();
  assert.deepEqual(log, ['start 1', 'import wrote to the server', 'end 1', 'start 2', 'end 2'], 'follow-up strictly after the older refresh');
  assert.deepEqual(ids(mounted), ['srv-1', 'itn_imported'], 'the final state is the imported data; the device copy is replaced');
  assert.deepEqual(flags(mounted).isLoading, false);
  assert.equal(valueOf(mounted).isRefreshing, false);
  assert.equal(valueOf(mounted).isImporting, false);
});

test('the older refresh\'s stale result is never the final state', async () => {
  const { first } = importWorld();
  const mounted = mountProvider();
  await waitFor(() => valueOf(mounted).isRefreshing, 'startup refresh');
  const importing = valueOf(mounted).confirmImport();
  await settle();
  first.resolve([trip('srv-1', 'Server trip')]);
  await importing; await settle();
  assert.ok(ids(mounted).includes('itn_imported'));
  assert.ok(!ids(mounted).includes('local-1'), 'no leftover device-only copy once imported');
});

test('if the older refresh fails, the queued follow-up still runs and completes', async () => {
  const { first, log } = importWorld();
  const mounted = mountProvider();
  await waitFor(() => log.includes('start 1'), 'startup refresh');
  const importing = valueOf(mounted).confirmImport();
  await settle();
  first.reject(new Error('offline'));
  await importing; await settle();
  assert.deepEqual(log, ['start 1', 'import wrote to the server', 'fail 1', 'start 2', 'end 2']);
  assert.deepEqual(ids(mounted), ['srv-1', 'itn_imported']);
  assert.equal(valueOf(mounted).loadError, null, 'the follow-up succeeded, so the error from the failed refresh is cleared');
  assert.equal(valueOf(mounted).isImporting, false);
  assert.equal(valueOf(mounted).isRefreshing, false);
});

test('two imports queued behind one refresh share a single follow-up', async () => {
  const { first, log } = importWorld();
  const mounted = mountProvider();
  await waitFor(() => log.includes('start 1'), 'startup refresh');
  const a = valueOf(mounted).confirmImport();
  const b = valueOf(mounted).retryImport();
  await settle();
  first.resolve([trip('srv-1', 'Server trip')]);
  await Promise.all([a, b]); await settle();
  assert.equal(log.filter((entry) => entry.startsWith('start')).length, 2, 'one older refresh plus exactly one follow-up');
  assert.ok(ids(mounted).includes('itn_imported'));
});

test('with no refresh running, the import refreshes straight away', async () => {
  const { first, log } = importWorld();
  const mounted = mountProvider();
  await waitFor(() => log.includes('start 1'), 'startup refresh');
  first.resolve([trip('srv-1', 'Server trip')]);
  await waitFor(() => log.includes('end 1') && !valueOf(mounted).isRefreshing, 'startup refresh to finish');
  assert.deepEqual(log, ['start 1', 'end 1']);
  await valueOf(mounted).confirmImport();
  await settle();
  assert.deepEqual(log, ['start 1', 'end 1', 'import wrote to the server', 'start 2', 'end 2']);
  assert.deepEqual(ids(mounted), ['srv-1', 'itn_imported']);
});

// ── Persistent cache ordering ───────────────────────────────────────────────

// Storage whose writes land only when the test says so, to force the worst ordering.
function slowStorage() {
  const writes = [];
  let attempted = 0; let maxInFlight = 0;
  globalThis.__setCacheHook = (user, next, disk) => new Promise((resolve, reject) => {
    attempted += 1;
    const write = { fail: (error) => { writes.splice(writes.indexOf(write), 1); reject(error); }, land: () => { writes.splice(writes.indexOf(write), 1); disk[user] = next; resolve(next); }, next, user };
    writes.push(write);
    maxInFlight = Math.max(maxInFlight, writes.length);
  });
  return {
    attempted: () => attempted,
    maxInFlight: () => maxInFlight,
    pending: () => writes.map((w) => `${w.user}:${w.next.map((t) => t.name).join(',')}`),
    // Always release the most recently started write first: the order that would corrupt an unprotected cache.
    async drain() { for (let i = 0; i < 40 && writes.length; i += 1) { writes[writes.length - 1].land(); await settle(); } },
    writes,
  };
}

test('a stale refresh write cannot end up as the last write on disk behind a newer mutation, even if storage reorders writes', async () => {
  const stale = deferred();
  let n = 0;
  const ctx = world({ caches: { 'user-a': [trip('t1', 'Old')] }, listTrips: () => (n++ === 0 ? stale.promise : Promise.resolve(ctx.server.trips['user-a'].map((t) => ({ ...t })))) });
  ctx.server.trips['user-a'] = [trip('t1', 'Old')];
  const storage = slowStorage();
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  stale.resolve([trip('t1', 'Old')]); // passes the refresh's own check: no write has happened yet
  await settle();
  assert.deepEqual(storage.pending(), ['user-a:Old'], 'the refresh\'s write is in flight');
  const renaming = valueOf(mounted).renameTrip('t1', 'New');
  await settle();
  assert.deepEqual(storage.pending(), ['user-a:Old'], 'the newer write has not been started: it waits its turn');
  await storage.drain();
  await renaming; await settle();
  assert.equal(storage.maxInFlight(), 1, 'never two writes for the same user at once');
  assert.deepEqual(ctx.cache['user-a'].map((t) => t.name), ['New'], 'the last write on disk is the newest accepted state');
  assert.deepEqual(names(mounted), ['New'], 'and so is the state on screen');
});

test('a refresh write queued behind a slow write is dropped before it reaches storage if a newer write follows', async () => {
  const first = deferred();
  let n = 0;
  const ctx = world({ caches: { 'user-a': [trip('t1', 'Old'), trip('t2', 'Other')] }, listTrips: () => (n++ === 0 ? first.promise : Promise.resolve(ctx.server.trips['user-a'].map((t) => ({ ...t })))) });
  ctx.server.trips['user-a'] = [trip('t1', 'Old'), trip('t2', 'Other')];
  const storage = slowStorage();
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  const slowMutation = valueOf(mounted).renameTrip('t1', 'New'); // its write is the slow one
  await settle();
  assert.deepEqual(storage.pending(), ['user-a:Old,Other'].map(() => storage.pending()[0]), 'one write in flight');
  assert.equal(storage.attempted(), 1);
  first.resolve([trip('t1', 'Old'), trip('t2', 'Other')]); // older response: discarded, refetched, and its write queued behind the slow one
  await settle();
  assert.equal(storage.attempted(), 1, 'the refresh write is waiting its turn, not started');
  // A different Trip, so the per-Trip mutation queue does not hold this edit behind the first one.
  const newerMutation = valueOf(mounted).renameTrip('t2', 'Newer');
  await settle();
  assert.equal(storage.attempted(), 1, 'still waiting behind the slow write');
  await storage.drain();
  await Promise.all([slowMutation, newerMutation]); await settle();
  assert.equal(storage.attempted(), 2, 'only the two mutation writes reached storage; the superseded refresh write was dropped');
  assert.deepEqual(ctx.cache['user-a'].map((t) => t.name), names(mounted), 'what is on disk is exactly what is on screen');
  assert.ok(names(mounted).includes('Newer'), 'the newest accepted write is the last one');
});

test('account change: another user\'s cache is never written by, or held up behind, this user\'s slow write', async () => {
  const forA = deferred();
  const ctx = world({
    caches: { 'user-a': [trip('ta', "A's trip")], 'user-b': [trip('tb', "B's cached")] },
    listTrips: () => (globalThis.__session.session.userId === 'user-a' ? forA.promise : Promise.resolve([trip('tb', "B's fresh")])),
  });
  const storage = slowStorage();
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  forA.resolve([trip('ta', "A's fresh")]);
  await settle();
  assert.deepEqual(storage.pending(), ["user-a:A's fresh"], "A's write is stuck in storage");
  globalThis.__session = userB;
  mounted.rerender(); await settle();
  assert.ok(storage.pending().includes("user-b:B's fresh"), "B's write was issued without waiting behind A's");
  storage.writes.find((w) => w.user === 'user-b').land();
  await settle();
  assert.deepEqual(names(mounted), ["B's fresh"]);
  storage.writes.find((w) => w.user === 'user-a').land(); // A's write finally lands, after the switch
  await settle();
  assert.deepEqual(names(mounted), ["B's fresh"], "A's completion does not touch what B sees");
  assert.deepEqual(ctx.cache['user-a'].map((t) => t.name), ["A's fresh"], "A's data went to A's own key");
  assert.deepEqual(ctx.cache['user-b'].map((t) => t.name), ["B's fresh"], "B's key was never overwritten by A");
});

test('a failed storage write does not jam later writes, and cached content and the offline message are unchanged', async () => {
  let n = 0;
  const ctx = world({ caches: { 'user-a': [trip('t1', 'Cached')] }, listTrips: async () => [trip('t1', `Fresh ${(n += 1)}`)] });
  const storage = slowStorage();
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  storage.writes[0].fail(new Error('disk full'));
  await settle();
  assert.deepEqual(names(mounted), ['Cached'], 'the cached Trips stay on screen');
  assert.equal(valueOf(mounted).loadError, 'Showing saved Trips. Connect to refresh them.');
  assert.equal(valueOf(mounted).isRefreshing, false, 'and nothing is left spinning');
  const retry = valueOf(mounted).refresh();
  await settle();
  await storage.drain();
  await retry; await settle();
  assert.deepEqual(names(mounted), ['Fresh 2'], 'the next write went through: the chain was not poisoned');
  assert.deepEqual(ctx.cache['user-a'].map((t) => t.name), ['Fresh 2']);
});

test('signed out: nothing is written, and a later sign-in reads its own cache', async () => {
  const ctx = world({ caches: { 'user-a': [trip('ta', 'Persisted')] }, listTrips: async () => [trip('ta', 'Persisted')] });
  const storage = slowStorage();
  globalThis.__session = signedOut;
  const mounted = mountProvider();
  await settle();
  assert.equal(storage.attempted(), 0);
  globalThis.__session = userA;
  mounted.rerender(); await settle();
  assert.deepEqual(names(mounted), ['Persisted']);
  await storage.drain();
  assert.deepEqual(ctx.cache['user-a'].map((t) => t.name), ['Persisted']);
});

test('the provider orders cache writes per user and keeps the write-version guards', async () => {
  const provider = await readFile(new URL('./provider.tsx', import.meta.url), 'utf8');
  assert.match(provider, /const cacheWritesRef = useRef\(new Map<string, Promise<unknown>>\(\)\)/);
  assert.match(provider, /cacheWritesRef\.current\.get\(ownerId\)/, 'keyed by owner, so users never queue behind each other');
  assert.match(provider, /\.catch\(\(\) => undefined\)\s*\.then\(/, 'a failed write does not block the next');
  assert.match(provider, /options\?\.skipIfSuperseded && writeVersionRef\.current !== version\) return null;/, 'a superseded refresh write is dropped before storage');
  assert.match(provider, /tripStorage\.setCache\(ownerId, next\)/);
  assert.doesNotMatch(provider, /setTimeout|setInterval/);
});

let failed = false;
for (const { name, run } of tests) {
  try { await run(); console.log(`✓ ${name}`); } catch (error) { failed = true; console.error(`✗ ${name}`); console.error(error); }
}
if (failed) process.exitCode = 1;
process.exit(process.exitCode ?? 0);
