// Batch 2E.1: Trips loading vs refreshing, and place-card stability.
//
// The real MyTripsProvider and useTripPlaceCards hook are executed through the shared
// hooks harness. Visual behaviour (no spinner flash, no thumbnail reload) is for the
// Simulator.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { deferred, flags, mount, mountProvider, settle, signedOut, trip, tripDetailView, useTripPlaceCards, userA, userB, valueOf, world } from './hooks-harness.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });

// ── Provider: loading vs refreshing ─────────────────────────────────────────

test('initial load with no cached data is "loading", not "refreshing", until the first refresh lands', async () => {
  const pending = deferred();
  world({ listTrips: () => pending.promise });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: true, isRefreshing: false, trips: [] });
  pending.resolve([trip('t1', 'Weekend')]);
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: ['Weekend'] });
});

test('with cached Trips the screen has data immediately: the load is a background refresh', async () => {
  const pending = deferred();
  world({ caches: { 'user-a': [trip('t1', 'Cached trip')] }, listTrips: () => pending.promise });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: true, trips: ['Cached trip'] });
  pending.resolve([trip('t1', 'Fresh trip')]);
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: ['Fresh trip'] });
});

test('a later refresh() keeps isLoading false and the Trips visible, and still calls the API', async () => {
  const first = deferred(); const second = deferred();
  const { calls } = world({ caches: { 'user-a': [trip('t1', 'One')] }, listTrips: () => (calls.listTrips === 1 ? first.promise : second.promise) });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  first.resolve([trip('t1', 'One')]);
  await settle();
  assert.equal(calls.listTrips, 1);
  const refreshing = valueOf(mounted).refresh();
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: true, trips: ['One'] }, 'content stays while refreshing');
  assert.equal(calls.listTrips, 2, 'the refresh request is still made: API frequency unchanged');
  second.resolve([trip('t1', 'One (edited elsewhere)')]);
  await refreshing; await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: ['One (edited elsewhere)'] }, 'successful refresh updates the content');
});

test('a failed refresh keeps the cached Trips and shows the existing offline message', async () => {
  world({ caches: { 'user-a': [trip('t1', 'Cached trip')] }, listTrips: () => Promise.reject(new Error('offline')) });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: ['Cached trip'] });
  assert.equal(valueOf(mounted).loadError, 'Showing saved Trips. Connect to refresh them.');
});

test('a failed first load with nothing cached stops loading and shows the error, not a spinner forever', async () => {
  world({ listTrips: () => Promise.reject(new Error('offline')) });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: [] });
  assert.ok(valueOf(mounted).loadError);
});

// ── Provider: account isolation ─────────────────────────────────────────────

test('sign-out clears the previous account immediately and an in-flight refresh cannot bring it back', async () => {
  const pending = deferred();
  world({ caches: { 'user-a': [trip('t1', "A's private trip")] }, listTrips: () => pending.promise });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  assert.deepEqual(flags(mounted).trips, ["A's private trip"]);
  globalThis.__session = signedOut;
  mounted.rerender();
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: [] }, 'gone at once');
  pending.resolve([trip('t1', "A's private trip (late)")]);
  await settle();
  assert.deepEqual(flags(mounted).trips, [], 'the late response is ignored');
});

test('account switch: B never sees A\'s Trips, even while B loads or after A\'s late response', async () => {
  const forA = deferred(); const forB = deferred();
  world({ caches: { 'user-a': [trip('ta', "A's trip")] }, listTrips: () => (globalThis.__session.session.userId === 'user-a' ? forA.promise : forB.promise) });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  globalThis.__session = userB;
  mounted.rerender();
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: true, isRefreshing: false, trips: [] }, "B has no data yet: loading, and none of A's");
  forA.resolve([trip('ta', "A's trip (late)")]);
  await settle();
  assert.deepEqual(flags(mounted).trips, [], "A's late response cannot populate B");
  forB.resolve([trip('tb', "B's trip")]);
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: ["B's trip"] });
});

test('account switch to a user with cached Trips shows that user\'s cache at once, as a refresh', async () => {
  const forB = deferred();
  world({ caches: { 'user-a': [trip('ta', "A's trip")], 'user-b': [trip('tb', "B's cached trip")] }, listTrips: () => forB.promise });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  globalThis.__session = userB;
  mounted.rerender();
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: true, trips: ["B's cached trip"] });
  forB.resolve([trip('tb', "B's trip")]);
  await settle();
  assert.deepEqual(flags(mounted).trips, ["B's trip"]);
});

// ── Provider: mutations ─────────────────────────────────────────────────────

test('renaming and deleting update the visible Trips and never raise isLoading', async () => {
  const { server } = world({ caches: { 'user-a': [trip('t1', 'Old name'), trip('t2', 'Other')] }, listTrips: async () => [trip('t1', 'Old name'), trip('t2', 'Other')] });
  server.trips['user-a'] = [trip('t1', 'Old name'), trip('t2', 'Other')];
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: ['Old name', 'Other'] });
  await valueOf(mounted).renameTrip('t1', 'New name');
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: ['New name', 'Other'] });
  await valueOf(mounted).deleteTrip('t2');
  await settle();
  assert.deepEqual(flags(mounted), { isLoading: false, isRefreshing: false, trips: ['New name'] });
});

// ── Trips list: place cards ─────────────────────────────────────────────────

const card = (id) => ({ _id: id, title: `Place ${id}` });
function cardsWorld() {
  const requests = [];
  globalThis.__fetchPlaceCards = (ids) => { const d = deferred(); requests.push({ d, ids: [...ids] }); return d.promise; };
  return requests;
}
const cardsOf = (mounted) => mounted.output.cards.map((c) => c._id);

test('place cards are fetched once for a set of IDs', async () => {
  const requests = cardsWorld();
  const mounted = mount(useTripPlaceCardsHost, { ids: ['a', 'b'] });
  await settle();
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].ids, ['a', 'b']);
  assert.equal(mounted.output.isLoadingCards, true);
  requests[0].d.resolve([card('a'), card('b')]);
  await settle();
  assert.deepEqual(cardsOf(mounted), ['a', 'b']);
  assert.equal(mounted.output.isLoadingCards, false);
});
function useTripPlaceCardsHost({ ids }) { return useTripPlaceCards(ids); }

test('re-rendering with the same IDs (a background refresh) neither clears the cards nor asks Sanity again', async () => {
  const requests = cardsWorld();
  const mounted = mount(useTripPlaceCardsHost, { ids: ['a', 'b'] });
  await settle();
  requests[0].d.resolve([card('a'), card('b')]);
  await settle();
  for (let i = 0; i < 3; i += 1) { mounted.setProps({ ids: ['a', 'b'] }); await settle(); }
  assert.equal(requests.length, 1, 'no redundant Sanity fetch for unchanged IDs');
  assert.deepEqual(cardsOf(mounted), ['a', 'b'], 'thumbnails stay on screen');
  assert.equal(mounted.output.isLoadingCards, false);
});

test('changed IDs fetch the new set and keep the old cards visible until it lands', async () => {
  const requests = cardsWorld();
  const mounted = mount(useTripPlaceCardsHost, { ids: ['a'] });
  await settle();
  requests[0].d.resolve([card('a')]);
  await settle();
  mounted.setProps({ ids: ['a', 'c'] });
  await settle();
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1].ids, ['a', 'c']);
  assert.deepEqual(cardsOf(mounted), ['a'], 'the unchanged Place stays while the new one loads');
  requests[1].d.resolve([card('a'), card('c')]);
  await settle();
  assert.deepEqual(cardsOf(mounted), ['a', 'c']);
});

test('a Place removed from the Trips is never shown, even before the refetch returns', async () => {
  const requests = cardsWorld();
  const mounted = mount(useTripPlaceCardsHost, { ids: ['a', 'b'] });
  await settle();
  requests[0].d.resolve([card('a'), card('b')]);
  await settle();
  mounted.setProps({ ids: ['a'] });
  await settle();
  assert.deepEqual(cardsOf(mounted), ['a'], "b's card is hidden immediately");
  requests[1].d.resolve([card('a')]);
  await settle();
  assert.deepEqual(cardsOf(mounted), ['a']);
});

test('a response for an outdated set of IDs cannot restore old cards', async () => {
  const requests = cardsWorld();
  const mounted = mount(useTripPlaceCardsHost, { ids: ['a'] });
  await settle();
  mounted.setProps({ ids: ['b'] });
  await settle();
  requests[1].d.resolve([card('b')]);
  await settle();
  requests[0].d.resolve([card('a')]);
  await settle();
  assert.deepEqual(cardsOf(mounted), ['b'], 'the late first response is ignored');
});

test('no IDs means no fetch and no cards; a fetch failure leaves an empty, not stuck, list', async () => {
  const requests = cardsWorld();
  const empty = mount(useTripPlaceCardsHost, { ids: [] });
  await settle();
  assert.equal(requests.length, 0);
  assert.deepEqual(cardsOf(empty), []);
  const failing = mount(useTripPlaceCardsHost, { ids: ['a'] });
  await settle();
  const quiet = console.error; console.error = () => {};
  requests[0].d.reject(new Error('sanity down'));
  await settle();
  console.error = quiet;
  assert.deepEqual(cardsOf(failing), []);
  assert.equal(failing.output.isLoadingCards, false);
});

// ── Trip detail: what is shown while Sanity is pending, failed or done ────

test('pending is true from the first render, so there is no false → true flip', async () => {
  const requests = cardsWorld();
  const seen = [];
  const mounted = mount(function Probe({ ids }) { const r = useTripPlaceCards(ids); seen.push(r.isPending); return r; }, { ids: ['a', 'b'] });
  assert.equal(seen[0], true, 'the very first render already knows cards are pending');
  assert.equal(mounted.output.isPending, true);
  await settle();
  assert.ok(seen.every(Boolean), 'pending never dipped to false before the data arrived');
  requests[0].d.resolve([card('a'), card('b')]);
  await settle();
  assert.equal(mounted.output.isPending, false);
  assert.equal(mounted.output.didFail, false);
});

test('a Sanity failure settles as failed (not pending forever) and leaves no cards', async () => {
  const requests = cardsWorld();
  const mounted = mount(useTripPlaceCardsHost, { ids: ['a'] });
  await settle();
  const quiet = console.error; console.error = () => {};
  requests[0].d.reject(new Error('sanity down'));
  await settle();
  console.error = quiet;
  assert.equal(mounted.output.isPending, false);
  assert.equal(mounted.output.didFail, true);
  assert.deepEqual(cardsOf(mounted), []);
});

test('new Place IDs are pending again; the earlier cards stay while only the new ones load', async () => {
  const requests = cardsWorld();
  const mounted = mount(useTripPlaceCardsHost, { ids: ['a'] });
  await settle();
  requests[0].d.resolve([card('a')]);
  await settle();
  mounted.setProps({ ids: ['a', 'b'] });
  await settle();
  assert.equal(mounted.output.isPending, true);
  assert.deepEqual(cardsOf(mounted), ['a']);
  requests[1].d.resolve([card('a'), card('b')]);
  await settle();
  assert.equal(mounted.output.isPending, false);
  assert.deepEqual(cardsOf(mounted), ['a', 'b']);
});

test('an empty Trip has nothing pending and nothing to fetch', async () => {
  const requests = cardsWorld();
  const mounted = mount(useTripPlaceCardsHost, { ids: [] });
  await settle();
  assert.equal(requests.length, 0);
  assert.equal(mounted.output.isPending, false);
  assert.equal(mounted.output.didFail, false);
});

const view = (mounted, tripId) => {
  const v = valueOf(mounted);
  return tripDetailView({ hasTrip: Boolean(v.getTrip(tripId)), isLoading: v.isLoading, isRefreshing: v.isRefreshing });
};

test('Trip detail view: unknown Trip during the initial load is "loading"; once loaded and still unknown it is "notFound"', async () => {
  const pending = deferred();
  world({ listTrips: () => pending.promise });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  assert.equal(view(mounted, 'missing'), 'loading');
  pending.resolve([trip('t1', 'Weekend')]);
  await settle();
  assert.equal(view(mounted, 'missing'), 'notFound');
  assert.equal(view(mounted, 't1'), 'trip');
});

test('Trip detail view: a known Trip is shown immediately, through every refresh, with no spinner', async () => {
  const refreshing = deferred();
  world({ caches: { 'user-a': [trip('t1', 'Weekend', ['p1'])] }, listTrips: () => refreshing.promise });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  assert.equal(valueOf(mounted).isRefreshing, true);
  assert.equal(view(mounted, 't1'), 'trip', 'cached Trip, refresh in flight (e.g. returning from a Place)');
  refreshing.resolve([trip('t1', 'Weekend', ['p1'])]);
  await settle();
  assert.equal(view(mounted, 't1'), 'trip');
});

test('Trip detail view: a known Trip stays shown when the refresh fails', async () => {
  world({ caches: { 'user-a': [trip('t1', 'Weekend')] }, listTrips: () => Promise.reject(new Error('offline')) });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  assert.equal(view(mounted, 't1'), 'trip');
  assert.ok(valueOf(mounted).loadError);
});

test('Trip detail view: after an account switch the other account\'s Trip is never shown', async () => {
  const forB = deferred();
  world({ caches: { 'user-a': [trip('ta', "A's trip")] }, listTrips: () => forB.promise });
  globalThis.__session = userA;
  const mounted = mountProvider();
  await settle();
  assert.equal(view(mounted, 'ta'), 'trip');
  globalThis.__session = userB;
  mounted.rerender();
  await settle();
  assert.equal(view(mounted, 'ta'), 'loading', "B is still loading and A's Trip is not available to B");
  forB.resolve([trip('tb', "B's trip")]);
  await settle();
  assert.equal(view(mounted, 'ta'), 'notFound');
  assert.equal(view(mounted, 'tb'), 'trip');
});

test('mixed editorial and Personal Place entries: only editorial entries wait for cards', async () => {
  const card = await read('components/trip-entry-card.tsx');
  assert.match(card, /entry\.type === 'editorialPlace' \? \(\s*editorialPlace \? <PlaceCard embedded place=\{editorialPlace\} \/> : editorialPending \?/);
  // The Personal Place branch does not consult the pending flag at all.
  const personalBranch = card.slice(card.indexOf('<PersonalPlaceCardView'));
  assert.doesNotMatch(personalBranch.slice(0, 400), /editorialPending/);
});

// ── Screens (wiring) ────────────────────────────────────────────────────────

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('Trip detail: no Sanity gate remains; the focus refresh still runs; one spinner for the unknown-Trip case only', async () => {
  const detail = await read('app/trips/[tripId].tsx');
  assert.match(detail, /useFocusEffect\(\s*useCallback\(\(\) => \{\s*void refresh\(\);\s*\}, \[refresh\]\)\s*\)/, 'the refresh on focus is unchanged');
  assert.doesNotMatch(detail, /isLoadingPlaces/, 'the Sanity-driven loading gate is gone');
  assert.doesNotMatch(detail, /fetchPlaceCardsByIds/, 'cards come from the shared hook, not an inline blocking fetch');
  assert.match(detail, /useTripPlaceCards\(placeIds\)/);
  assert.match(detail, /\{view === 'loading' \? \(\s*<LoadingView \/>/);
  assert.equal(detail.match(/<LoadingView \/>/g)?.length, 2, 'only the session gate and the unknown-Trip gate remain');
  assert.match(detail, /editorialPending=\{\s*placesPending &&\s*entry\.type === 'editorialPlace' &&\s*!placesById\.has\(entry\.editorialPlace\.id\)\s*\}/);
  assert.match(detail, /No places yet\. Tap \+ to add from Favourites or search TripIdeas\./, 'the empty state is retained');
  assert.match(detail, /placesFailed && orderedEntries\.some/, 'a Sanity failure shows a notice above the entries, never instead of them');
});

test('Trips list uses the stable place-card hook and shows its spinner only without anything to show', async () => {
  const list = await read('app/trips/index.tsx');
  assert.match(list, /useTripPlaceCards\(tripPlaceIds\)/);
  assert.doesNotMatch(list, /fetchPlaceCardsByIds/, 'no inline Sanity fetching left in the screen');
  assert.match(list, /isLoading \|\| \(isLoadingPlaces && tripPlaces\.length === 0\)/);
  assert.doesNotMatch(list, /isLoading \|\| isLoadingPlaces \?/);
});

test('Saved landing: the Trips card shows "Loading…" only for isLoading, never for a refresh', async () => {
  const saved = await read('app/(tabs)/saved.tsx');
  assert.match(saved, /const \{ isLoading: isLoadingTrips, trips \} = useMyTrips\(\);/);
  assert.doesNotMatch(saved, /isRefreshing/);
  const tripsCard = saved.match(/accessibilityLabel: 'Open Trips'[\s\S]*?title: 'Trips'/)?.[0] ?? '';
  assert.match(tripsCard, /isLoadingTrips\s*\? 'Loading…'[\s\S]*?trips\.length\s*\? countText\(trips\.length, 'trip'\)/);
});

test('the provider exposes both flags and keeps its guards, queue and per-user storage', async () => {
  const provider = await read('trips/provider.tsx');
  assert.match(provider, /isLoading: boolean;[\s\S]*?isRefreshing: boolean;/);
  assert.match(provider, /const isLoading = isFetching && !hasData;/);
  assert.match(provider, /const isRefreshing = isFetching && hasData;/);
  assert.match(provider, /\(await fetchAndStore\(ownerId\)\) && activeUserRef\.current === ownerId\)? \{\s*setHasData\(true\)/);
  assert.match(provider, /setHasData\(false\);\s*setIsFetching\(true\);/, 'availability resets with the user');
  for (const kept of [/activeUserRef\.current !== ownerId/, /const enqueue = useRef\(createQueue\(\)\)\.current/, /tripStorage\.getCache\(userId\)/, /tripStorage\.setCache\(ownerId, next\)/, /mutateAndRefresh/]) assert.match(provider, kept);
});

let failed = false;
for (const { name, run } of tests) {
  try { await run(); console.log(`✓ ${name}`); } catch (error) { failed = true; console.error(`✗ ${name}`); console.error(error); }
}
if (failed) process.exitCode = 1;
process.exit(process.exitCode ?? 0);
