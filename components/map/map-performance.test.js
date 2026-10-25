import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  getPlacesForSelection,
  matchesActivityTags,
  matchesSearch,
  placesInBounds,
  reuseIfSame,
} from './map-filters.ts';
import { cameraStateFromRegion, resolveInitialCamera } from './map-camera-state.ts';
import {
  indexOfSelectedPlace,
  PEEK_ITEM_WIDTH,
  peekItemLayout,
  peekScrollOffset,
} from './peek-list.ts';

const read = (relativePath) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

const tests = [];
const test = (name, run) => tests.push({ name, run });

const place = (id, lng, lat, extra = {}) => ({
  _id: id,
  coordinates: { lat, lng },
  slug: { current: `slug-${id}` },
  title: `Place ${id}`,
  ...extra,
});
const sample = [
  place('a', 170, -45, { activityTags: [{ _id: 'hike' }], subRegion: { _id: 's1', name: 'Fiordland', region: { _id: 'r1' } } }),
  place('b', 172, -43, { activityTags: [{ _id: 'swim' }], subRegion: { _id: 's2', name: 'Canterbury', region: { _id: 'r2' } } }),
  place('c', 174, -41, { activityTags: [{ _id: 'hike' }, { _id: 'swim' }], subRegion: { _id: 's2', name: 'Canterbury', region: { _id: 'r2' } } }),
  place('d', 176, -39, { subRegion: { _id: 's3', name: 'Bay of Plenty', region: { _id: 'r3' } } }),
];

// ── Peek-sheet virtualisation ────────────────────────────────────────────────

test('the peek sheet is a virtualised horizontal list, not one view per place', async () => {
  const source = await read('components/map/map-peek-sheet.tsx');
  assert.match(source, /<FlatList/);
  assert.match(source, /horizontal/);
  assert.match(source, /initialNumToRender=\{6\}/);
  assert.match(source, /windowSize=\{5\}/);
  assert.match(source, /getItemLayout=/);
  assert.match(source, /memo\(function PeekPlaceItem/);
  assert.doesNotMatch(source, /places\.map\(/);
  assert.doesNotMatch(source, /ScrollView/);
  // No truncation: every place is still in the data.
  assert.match(source, /data=\{places\}/);
  assert.doesNotMatch(source, /places\.slice\(/);
});

test('list layout maths keep the previous scroll alignment', () => {
  assert.equal(PEEK_ITEM_WIDTH, 142);
  assert.deepEqual(peekItemLayout(3, 12), { index: 3, length: 142, offset: 3 * (142 + 12) });
  assert.equal(peekScrollOffset(0, 12), 0);
  assert.equal(peekScrollOffset(5, 12), 5 * (142 + 12) - 12);
});

test('the selected place is found by id, falling back to slug, in list order', () => {
  assert.equal(indexOfSelectedPlace(sample, 'c'), 2);
  assert.equal(indexOfSelectedPlace([{ slug: { current: 'only-slug' } }], 'only-slug'), 0);
  assert.equal(indexOfSelectedPlace(sample, 'missing'), -1);
  assert.equal(indexOfSelectedPlace(sample, null), -1);
});

// ── Ordering and filters preserved ───────────────────────────────────────────

test('filters compose in the same way and preserve source ordering', () => {
  const allPlaces = sample;
  const regional = getPlacesForSelection({ places: allPlaces, savedPlaceIds: [], selection: { label: 'Canterbury', regionId: 'r2', type: 'region' }, trips: [] });
  assert.deepEqual(regional.map((p) => p._id), ['b', 'c']);
  const hikers = regional.filter((p) => matchesActivityTags(p, ['hike']));
  assert.deepEqual(hikers.map((p) => p._id), ['c']);
  const either = allPlaces.filter((p) => matchesActivityTags(p, ['hike', 'swim']));
  assert.deepEqual(either.map((p) => p._id), ['a', 'b', 'c'], 'activity tags match any selected tag');
  assert.deepEqual(allPlaces.filter((p) => matchesSearch(p, 'plenty')).map((p) => p._id), ['d']);
  assert.deepEqual(allPlaces.filter((p) => matchesSearch(p, '')).map((p) => p._id), ['a', 'b', 'c', 'd']);
  const saved = getPlacesForSelection({ places: allPlaces, savedPlaceIds: ['d', 'a'], selection: { type: 'favourites' }, trips: [] });
  assert.deepEqual(saved.map((p) => p._id), ['a', 'd'], 'order follows the dataset, not the saved list');
  const trip = getPlacesForSelection({ places: allPlaces, savedPlaceIds: [], selection: { label: 'T', tripId: 't1', type: 'trip' }, trips: [{ id: 't1', places: [{ placeId: 'c' }, { placeId: 'a' }] }] });
  assert.deepEqual(trip.map((p) => p._id), ['a', 'c']);
});

test('viewport filtering keeps order and is a subset of the filtered places', () => {
  const inView = placesInBounds(sample, [171, -44, 175, -40]);
  assert.deepEqual(inView.map((p) => p._id), ['b', 'c']);
  assert.equal(placesInBounds(sample, null), sample);
});

test('an unchanged visible set keeps the same array; any change produces a new one', () => {
  const first = placesInBounds(sample, [171, -44, 175, -40]);
  const again = placesInBounds(sample, [171.2, -43.9, 174.9, -40.1]);
  assert.equal(reuseIfSame(first, again), first, 'same items in the same order reuse the previous array');
  assert.notEqual(reuseIfSame(first, [first[1], first[0]]), first, 'reordering is a change');
  assert.notEqual(reuseIfSame(first, first.slice(0, 1)), first, 'removal is a change');
  assert.notEqual(reuseIfSame(first, [...first, sample[3]]), first, 'addition is a change');
});

// ── Camera restoration across list transitions ───────────────────────────────

const nz = { nzBounds: [165.5, -47.5, 179, -34], nzPadding: { bottom: 289, left: 56, right: 56, top: 100 } };
const last = cameraStateFromRegion({ bearing: 12, center: [172.5, -43.2], pitch: 5, zoom: 9.4 });

test('a positioned map restarts at exactly the camera the user left', () => {
  const view = resolveInitialCamera({ ...nz, hasPositioned: true, last, placeContext: null });
  assert.deepEqual(view, { bearing: 12, center: [172.5, -43.2], pitch: 5, zoom: 9.4 });
  assert.equal('bounds' in view, false, 'no refit to all places');
});

test('before any positioning the New Zealand overview is used; a Place context still wins', () => {
  const overview = resolveInitialCamera({ ...nz, hasPositioned: false, last, placeContext: null });
  assert.deepEqual(overview, { bounds: nz.nzBounds, padding: nz.nzPadding });
  const focused = resolveInitialCamera({ ...nz, hasPositioned: true, last, placeContext: { lat: -41.3, lng: 174.8 } });
  assert.deepEqual(focused, { center: [174.8, -41.3], zoom: 13 });
});

test('region events are recorded with bearing and pitch', () => {
  assert.deepEqual(
    cameraStateFromRegion({ bearing: 3, center: [1, 2], pitch: 4, zoom: 5 }),
    { bearing: 3, center: [1, 2], pitch: 4, zoom: 5 }
  );
  assert.deepEqual(cameraStateFromRegion({ center: [1, 2], zoom: 5 }), { bearing: 0, center: [1, 2], pitch: 0, zoom: 5 });
});

test('closing the list restores the camera: no refit, no filter changes', async () => {
  const source = await read('app/(tabs)/map.tsx');
  const collapse = source.match(/onCollapse=\{\(\) => \{[\s\S]*?\n          \}\}/)?.[0] ?? '';
  assert.ok(collapse, 'collapse handler found');
  assert.doesNotMatch(collapse, /setIsFitPending/);
  assert.doesNotMatch(collapse, /setSelection|setSelectedActivityTagIds|setQuery|clearPlaceContext/);
  assert.match(collapse, /setTrayState\('peek'\)/);
  assert.match(source, /lastCameraRef\.current = cameraStateFromRegion\(event\.nativeEvent\)/);
  assert.match(source, /initialViewState=\{resolveInitialCamera\(/);
  // Opening the list does not alter filters either.
  const open = source.match(/onHandlePress=\{\(\) =>\n[\s\S]*?\n          \}\}/)?.[0] ?? '';
  assert.doesNotMatch(open, /setSelection|setSelectedActivityTagIds|setQuery|setIsFitPending/);
});

// ── Personal-location control ────────────────────────────────────────────────

test('recentring on the user keeps every active filter', async () => {
  const source = await read('app/(tabs)/map.tsx');
  // The map now uses the shared location hook (see location-reliability.test.js).
  const hook = await read('location/use-map-user-location.ts');
  const cancelFit = source.match(/const cancelPendingFit = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\);/)?.[0] ?? '';
  assert.ok(cancelFit, 'the only map-side callback is the fit cancellation');
  assert.doesNotMatch(cancelFit, /setSelection|setSelectedActivityTagIds|setQuery|clearPlaceContext|setPlaceContext|setSelectedPlaceId/);
  assert.match(hook, /easeTo\(/);
  assert.match(hook, /Math\.max\(getZoom\?\.\(\) \?\? minimumZoom, minimumZoom\)/);
  assert.match(source, /getZoom: getCurrentZoom/);
});

// ── No Sanity refetch on list transitions ────────────────────────────────────

test('map data is fetched once on mount and only re-fetched when stored place ids change', async () => {
  const source = await read('app/(tabs)/map.tsx');
  assert.equal(source.match(/fetchMapPlaces\(\)/g)?.length, 1);
  assert.equal(source.match(/fetchMapNavigation\(\)/g)?.length, 1);
  assert.equal(source.match(/fetchMapActivities\(\)/g)?.length, 1);
  const mountEffect = source.match(/useEffect\(\(\) => \{\n    let isMounted = true;\n\n    setIsLoadingPlaces\(true\);[\s\S]*?\n  \}, \[\]\);/)?.[0] ?? '';
  assert.ok(mountEffect.includes('fetchMapPlaces()'), 'the three fetches share one mount-only effect');
  assert.ok(mountEffect.includes('fetchMapActivities()'));
  assert.match(source, /\}, \[isLoadingSaved, isLoadingTrips, storedPlaceIdsKey\]\);/);
  for (const file of ['components/map/map-peek-sheet.tsx', 'components/map/map-tile-view.tsx', 'components/map/map-place-tile.tsx']) {
    assert.doesNotMatch(await read(file), /sanityClient|@\/sanity\/(client|place-cards|queries)|fetch\(/, file);
  }
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
