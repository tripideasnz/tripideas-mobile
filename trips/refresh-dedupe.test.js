// Batch 2E.2: single-flight Trips refresh, and what it must never break.
//
// Controlled deferred promises make the concurrency deterministic. `calls.listTrips`
// counts full refresh sequences (each is one /itinerary plus one entries request per
// Trip), so it is the request count that matters.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { deferred, flags, mountProvider, settle, signedOut, trip, userA, userB, valueOf, world } from './hooks-harness.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const names = (mounted) => valueOf(mounted).trips.map((t) => t.name);

// A listTrips whose calls are answered, in order, by the supplied handlers; later calls read the server.
function scripted(handlers, server) {
  let n = 0;
  return () => { const handler = handlers[n++]; return handler ? handler() : Promise.resolve((server.trips[globalThis.__session.session.userId] ?? []).map((t) => ({ ...t }))); };
}

// ── Deduplication ───────────────────────────────────────────────────────────

test('two simultaneous ordinary refreshes join the one in flight: one full sequence, one shared outcome', async () => {
  const running = deferred();
  const { calls } = world({ caches: { 'user-a': [trip('t1', 'One')] }, listTrips: () => running.promise });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  assert.equal(calls.listTrips, 1, 'the startup refresh');
  const first = valueOf(mounted).refresh();
  const second = valueOf(mounted).refresh();
  assert.equal(first, second, 'both callers get the same promise, so the same completion or failure');
  await settle();
  assert.equal(calls.listTrips, 1, 'no duplicate request sequence');
  running.resolve([trip('t1', 'One')]);
  await Promise.all([first, second]);
  await settle();
  assert.equal(calls.listTrips, 1);
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: ['One'] });
});

test('repeated focus events during an active refresh do not add requests', async () => {
  const running = deferred();
  const { calls } = world({ caches: { 'user-a': [trip('t1', 'One')] }, listTrips: () => running.promise });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  for (let i = 0; i < 6; i += 1) void valueOf(mounted).refresh();
  await settle();
  assert.equal(calls.listTrips, 1);
  running.resolve([trip('t1', 'One')]);
  await settle();
  assert.equal(calls.listTrips, 1);
});

test('a refresh after the previous one has completed starts a new one normally', async () => {
  const { calls, server } = world({ caches: { 'user-a': [trip('t1', 'One')] } , listTrips: async () => [trip('t1', 'One')] });
  server.trips['user-a'] = [trip('t1', 'One')];
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  assert.equal(calls.listTrips, 1);
  await valueOf(mounted).refresh();
  assert.equal(calls.listTrips, 2);
  await valueOf(mounted).refresh();
  assert.equal(calls.listTrips, 3);
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: ['One'] });
});

test('a failed refresh releases the guard: callers share the failure, and the next refresh runs', async () => {
  const failing = deferred();
  let n = 0;
  const { calls } = world({ caches: { 'user-a': [trip('t1', 'Cached')] }, listTrips: () => (n++ === 0 ? failing.promise : Promise.resolve([trip('t1', 'Fresh')])) });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  const a = valueOf(mounted).refresh(); const b = valueOf(mounted).refresh();
  assert.equal(a, b);
  failing.reject(new Error('offline'));
  await Promise.all([a, b]);
  await settle();
  assert.equal(valueOf(mounted).loadError, 'Showing saved Trips. Connect to refresh them.');
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: ['Cached'] }, 'cached content stays, not stuck refreshing');
  await valueOf(mounted).refresh();
  assert.equal(calls.listTrips, 2, 'the guard was released');
  assert.equal(valueOf(mounted).loadError, null);
  assert.deepEqual(names(mounted), ['Fresh']);
});

test('loading and refreshing flags stay correct through a joined refresh', async () => {
  const running = deferred();
  world({ caches: { 'user-a': [trip('t1', 'One')] }, listTrips: () => running.promise });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  void valueOf(mounted).refresh(); void valueOf(mounted).refresh();
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: true, trips: ['One'] }, 'content stays visible while it runs');
  running.resolve([trip('t1', 'One')]);
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: ['One'] });
});

// ── Mutation correctness ────────────────────────────────────────────────────

test('a mutation that finishes while an older refresh is in flight is not overwritten by that refresh', async () => {
  const stale = deferred();
  const serverRef = {};
  const ctx = world({ caches: { 'user-a': [trip('t1', 'Old')] }, listTrips: scripted([() => stale.promise], serverRef) });
  Object.assign(serverRef, ctx.server);
  ctx.server.trips['user-a'] = [trip('t1', 'Old')];
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  assert.equal(ctx.calls.listTrips, 1, 'the refresh is in flight and will answer with the old name');
  await valueOf(mounted).renameTrip('t1', 'New');
  await settle();
  assert.deepEqual(names(mounted), ['New'], 'the mutation is visible at once');
  stale.resolve([trip('t1', 'Old')]);
  await settle();
  assert.deepEqual(names(mounted), ['New'], 'the older response did not overwrite it');
  assert.equal(ctx.calls.listTrips, 2, 'the stale response was discarded and the refresh re-fetched');
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: ['New'] });
});

test('a mutation still in progress when the older refresh responds also ends authoritative', async () => {
  const stale = deferred(); const serverWrite = deferred();
  const serverRef = {};
  const ctx = world({
    caches: { 'user-a': [trip('t1', 'Old')] },
    listTrips: scripted([() => stale.promise], serverRef),
    overrides: { updateTripRequest: async (id, input) => { await serverWrite.promise; for (const t of ctx.server.trips['user-a']) if (t.id === id) t.name = input.name; } },
  });
  Object.assign(serverRef, ctx.server);
  ctx.server.trips['user-a'] = [trip('t1', 'Old')];
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  const renaming = valueOf(mounted).renameTrip('t1', 'New');
  await settle();
  stale.resolve([trip('t1', 'Old')]);
  await settle();
  serverWrite.resolve();
  await renaming; await settle();
  assert.deepEqual(names(mounted), ['New'], 'whichever order they finish in, the mutation result wins');
});

test('a delete is not undone by a refresh that read the Trip before it was deleted', async () => {
  const stale = deferred();
  const serverRef = {};
  const ctx = world({ caches: { 'user-a': [trip('t1', 'Keep'), trip('t2', 'Delete me')] }, listTrips: scripted([() => stale.promise], serverRef) });
  Object.assign(serverRef, ctx.server);
  ctx.server.trips['user-a'] = [trip('t1', 'Keep'), trip('t2', 'Delete me')];
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  await valueOf(mounted).deleteTrip('t2');
  await settle();
  assert.deepEqual(names(mounted), ['Keep']);
  stale.resolve([trip('t1', 'Keep'), trip('t2', 'Delete me')]);
  await settle();
  assert.deepEqual(names(mounted), ['Keep'], 'the deleted Trip does not come back');
});

test('a refresh that keeps being overtaken by edits gives up after a few attempts instead of looping', async () => {
  let mounted;
  const serverRef = {};
  let fetches = 0;
  const ctx = world({
    caches: { 'user-a': [trip('t1', 'v0')] },
    listTrips: async () => { fetches += 1; if (fetches < 50) await valueOf(mounted).renameTrip('t1', `edit-${fetches}`); return [trip('t1', 'stale')]; },
  });
  Object.assign(serverRef, ctx.server);
  ctx.server.trips['user-a'] = [trip('t1', 'v0')];
  globalThis.__session = userA;
  mounted = mountProvider();
  await settle();
  assert.equal(fetches, 3, 'three attempts, then it stops');
  assert.equal(valueOf(mounted).isRefreshing, false, 'and is released, not stuck');
  assert.notDeepEqual(names(mounted), ['stale'], 'a stale response is never applied');
});

// ── Account isolation ───────────────────────────────────────────────────────

test('sign-out during an active refresh: previous Trips vanish, the late response is ignored, and the next sign-in starts fresh', async () => {
  const late = deferred();
  const { calls } = world({ caches: { 'user-a': [trip('t1', "A's trip")] }, listTrips: () => (calls.listTrips === 1 ? late.promise : Promise.resolve([trip('t1', "A's trip (fresh)")])) });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  globalThis.__session = signedOut;
  mounted.rerender(); await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: [] });
  late.resolve([trip('t1', "A's trip (late)")]);
  await settle();
  assert.deepEqual(names(mounted), []);
  globalThis.__session = userA;
  mounted.rerender(); await settle();
  assert.equal(calls.listTrips, 2, 'the signed-out-then-in session did not join the dead refresh');
  assert.deepEqual(names(mounted), ["A's trip (fresh)"]);
});

test('account switch during an active refresh: B never joins A\'s refresh, and A\'s result never reaches B', async () => {
  const forA = deferred(); const forB = deferred();
  const { calls } = world({ caches: { 'user-a': [trip('ta', "A's trip")] }, listTrips: () => (globalThis.__session.session.userId === 'user-a' ? forA.promise : forB.promise) });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  const aRefresh = valueOf(mounted).refresh();
  globalThis.__session = userB;
  mounted.rerender(); await settle();
  assert.equal(calls.listTrips, 2, 'B started its own refresh instead of reusing A\'s promise');
  assert.notEqual(valueOf(mounted).refresh(), aRefresh);
  assert.deepEqual(flags(mounted), { isLoading: true, isRefreshing: false, trips: [] });
  forA.resolve([trip('ta', "A's trip (late)")]);
  await aRefresh; await settle();
  assert.deepEqual(flags(mounted), { isLoading: true, isRefreshing: false, trips: [] }, 'A finishing does not clear B\'s loading state or leak A\'s Trips');
  forB.resolve([trip('tb', "B's trip")]);
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: ["B's trip"] });
});

// ── Wiring ──────────────────────────────────────────────────────────────────

test('the provider: single-flight refresh, a write-version guard, and an import follow-up; no timers', async () => {
  const provider = await readFile(new URL('./provider.tsx', import.meta.url), 'utf8');
  assert.match(provider, /const running = refreshInFlightRef\.current;\s*if \(running && running\.ownerId === ownerId\) return running\.promise;/);
  assert.match(provider, /if \(refreshInFlightRef\.current === entry\) refreshInFlightRef\.current = null;/, 'released on success and failure');
  assert.match(provider, /refreshInFlightRef\.current = null;\s*followUpRef\.current = null;/, 'cleared when the user changes');
  assert.match(provider, /if \(writeVersionRef\.current !== startedAtVersion\) continue;/);
  assert.match(provider, /options\?\.skipIfSuperseded && writeVersionRef\.current !== version/);
  assert.match(provider, /await refreshAfterServerChange\(\);/, 'the import queues a follow-up rather than joining an older refresh');
  assert.doesNotMatch(provider, /setTimeout|setInterval|freshness|staleTime/i, 'no polling and no freshness window');
  assert.match(provider, /const enqueue = useRef\(createQueue\(\)\)\.current/, 'the mutation queue is untouched');
});

let failed = false;
for (const { name, run } of tests) {
  try { await run(); console.log(`✓ ${name}`); } catch (error) { failed = true; console.error(`✗ ${name}`); console.error(error); }
}
if (failed) process.exitCode = 1;
process.exit(process.exitCode ?? 0);
