// C5B: the Map's Places are chosen in two stages. The first tap on a marker or a tray thumbnail
// selects that Place and stays on the Map; a tap on the already-selected Place (marker, name pop-up
// or thumbnail) opens it. Markers and thumbnails share one selection. Clusters, filters and the
// camera controls keep their existing behaviour.
//
// The decisions are the real functions the Map screen calls (planPlaceTap, selectedPlaceCamera,
// peekCenteredOffset, openPlaceFromMap); the wiring is guarded by reading the screen source. How it
// looks and feels is verified in the Simulator, not here.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PEEK_ITEM_WIDTH, peekCenteredOffset } from './peek-list.ts';
import { createNavigationGuard, openPlaceFromMap } from './place-navigation.ts';
import { SELECTED_PLACE_MIN_ZOOM, selectedPlaceCamera } from './marker-visibility.ts';
import { nearestPointFeature } from './marker-hit.ts';
import { planPlaceTap } from './use-map-selection.ts';

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

/** A Map with the screen's state machine: one selected id, the real plan, and the effects it asks for. */
function mapWith(places) {
  const state = { camera: [], filters: { activities: [], query: '', scope: 'all' }, pushes: [], selectedId: null };
  const router = { push: (href) => state.pushes.push(href.params.slug) };
  let clock = 0;
  const guard = createNavigationGuard({ now: () => (clock += 1_000) });
  const frozenFilters = JSON.stringify(state.filters);
  const tap = (id, source) => {
    const place = places.find((p) => p.id === id);
    const plan = planPlaceTap(state.selectedId, id, source);
    if (plan.action === 'open') {
      openPlaceFromMap(router, place.slug, guard);
      return plan;
    }
    state.selectedId = id;
    if (plan.then === 'focus') state.camera.push(selectedPlaceCamera(place.at, { bottom: 300, left: 24, right: 24, top: 190 }, 7));
    return plan;
  };
  return {
    state,
    filtersUnchanged: () => JSON.stringify(state.filters) === frozenFilters,
    mapTap: () => { state.selectedId = null; }, // MapLibreMap onPress={clearSelectedPlace}
    marker: (id) => tap(id, 'marker'),
    popup: (id) => { openPlaceFromMap(router, places.find((p) => p.id === id).slug, guard); }, // the pop-up always opens
    thumbnail: (id) => tap(id, 'thumbnail'),
  };
}
const PLACES = [
  { at: { lat: -41.2, lng: 174.7 }, id: 'a', slug: 'alpha' },
  { at: { lat: -44.6, lng: 167.9 }, id: 'b', slug: 'bravo' },
];

test('the first marker tap selects the Place and stays on the Map', () => {
  const map = mapWith(PLACES);
  const plan = map.marker('a');
  assert.deepEqual([plan.action, plan.then], ['select', 'reveal']);
  assert.equal(map.state.selectedId, 'a');
  assert.deepEqual(map.state.pushes, [], 'no navigation');
});

test('a second tap on the selected marker opens the Place page', () => {
  const map = mapWith(PLACES);
  map.marker('a');
  const plan = map.marker('a');
  assert.equal(plan.action, 'open');
  assert.deepEqual(map.state.pushes, ['alpha']);
});

test('the selected Place\'s name pop-up opens the Place page', async () => {
  const map = mapWith(PLACES);
  map.marker('a');
  map.popup('a');
  assert.deepEqual(map.state.pushes, ['alpha']);
  const screen = await read('app/(tabs)/map.tsx');
  const popup = screen.match(/selectedMapPlace \? <Marker[\s\S]*?<\/Marker> : null/)?.[0] ?? '';
  assert.ok(popup, 'pop-up found: it exists only for the selected Place');
  assert.match(popup, /selected\. Open place\./);
  assert.match(popup, /event\.stopPropagation\(\); openMapPlace\(selectedMapPlace\);/);
});

test('the first thumbnail tap selects the Place, stays on the Map and centres and zooms the map on its marker', () => {
  const map = mapWith(PLACES);
  const plan = map.thumbnail('b');
  assert.deepEqual([plan.action, plan.then], ['select', 'focus']);
  assert.equal(map.state.selectedId, 'b');
  assert.deepEqual(map.state.pushes, [], 'no navigation');
  const [camera] = map.state.camera;
  assert.deepEqual(camera.center, [167.9, -44.6], 'centred on the Place');
  assert.deepEqual(camera.padding, { bottom: 300, left: 24, right: 24, top: 190 }, 'centred in the clear area, not under the tray or filter bar');
  assert.equal(camera.zoom, SELECTED_PLACE_MIN_ZOOM, 'close enough for its own pin to show');
});

test('a closer zoom is never undone when a thumbnail focuses a Place', () => {
  const obscured = { bottom: 300, left: 24, right: 24, top: 190 };
  assert.equal(selectedPlaceCamera({ lat: -41, lng: 174 }, obscured, 15.5).zoom, 15.5);
  assert.equal(selectedPlaceCamera({ lat: -41, lng: 174 }, obscured, 5).zoom, SELECTED_PLACE_MIN_ZOOM);
});

test('a second tap on the selected thumbnail opens the Place page', () => {
  const map = mapWith(PLACES);
  map.thumbnail('a');
  map.thumbnail('a');
  assert.deepEqual(map.state.pushes, ['alpha']);
  assert.equal(map.state.camera.length, 1, 'the second tap does not move the map again');
});

test('selecting another Place, from a marker or a thumbnail, replaces the previous selection without navigating', () => {
  const map = mapWith(PLACES);
  map.marker('a');
  map.thumbnail('b');
  assert.equal(map.state.selectedId, 'b');
  map.marker('a');
  assert.equal(map.state.selectedId, 'a');
  assert.deepEqual(map.state.pushes, []);
  // A marker and its thumbnail are one selection: selected from either, the other opens it.
  map.thumbnail('a');
  assert.deepEqual(map.state.pushes, ['alpha']);
});

test('tapping empty map clears the selection and only the selection', async () => {
  const map = mapWith(PLACES);
  map.thumbnail('a');
  map.mapTap();
  assert.equal(map.state.selectedId, null);
  assert.ok(map.filtersUnchanged());
  const screen = await read('app/(tabs)/map.tsx');
  assert.match(screen, /onPress=\{clearSelectedPlace\}/, 'the Map\'s own press clears the selection');
  assert.match(await read('components/map/use-map-selection.ts'), /clear: useCallback\(\(\) => setSelectedId\(null\), \[\]\)/);
  // After clearing, the next tap on the same Place is a first tap again.
  assert.equal(map.marker('a').action, 'select');
});

test('markers and tray thumbnails highlight from one selected id, and the tray centres the selected thumbnail', async () => {
  const screen = await read('app/(tabs)/map.tsx');
  assert.match(screen, /isSelected: featureId === selectedPlaceId/);
  assert.match(screen, /selectedPlaceId=\{selectedPlaceId\}/);
  const peek = await read('components/map/map-peek-sheet.tsx');
  assert.match(peek, /selected=\{\(item\._id \?\? item\.slug\?\.current \?\? null\) === selectedPlaceId\}/);
  assert.match(peek, /borderColor: selected \? Palette\.trip/);
  assert.match(peek, /peekCenteredOffset\(index, Space\.md, viewportWidth, places\.length\)/);
});

test('tray centring: the selected thumbnail sits in the middle, clamped at both ends of the list', () => {
  const gap = 12;
  const step = PEEK_ITEM_WIDTH + gap;
  const viewport = 366;
  const count = 20;
  const middle = peekCenteredOffset(8, gap, viewport, count);
  assert.equal(middle, 8 * step - (viewport - PEEK_ITEM_WIDTH) / 2);
  assert.equal(8 * step - middle + PEEK_ITEM_WIDTH / 2, viewport / 2, 'item centre is the viewport centre');
  assert.equal(peekCenteredOffset(0, gap, viewport, count), 0, 'first item does not scroll past the start');
  assert.equal(peekCenteredOffset(1, gap, viewport, count), step - (viewport - PEEK_ITEM_WIDTH) / 2, 'item 1 is far enough in to centre');
  assert.equal(peekCenteredOffset(count - 1, gap, viewport, count), count * step - gap - viewport, 'last item stops at the end');
  assert.equal(peekCenteredOffset(0, gap, viewport, 2), 0, 'a short list never scrolls');
});

test('clusters keep their behaviour: they expand or zoom, never select or open a Place', async () => {
  const screen = await read('app/(tabs)/map.tsx');
  const cluster = screen.match(/if \(properties\?\.cluster_id !== undefined\) \{[\s\S]*?\n      return;\n    \}/)?.[0] ?? '';
  assert.ok(cluster, 'cluster branch found');
  assert.match(cluster, /getClusterExpansionZoom\(/);
  assert.match(cluster, /Math\.min\(expansionZoom, lastCameraRef\.current\.zoom \+ 3\)/);
  assert.match(cluster, /cameraRef\.current\?\.easeTo\(\{ center: coords, zoom: targetZoom, duration: 400 \}\)/);
  assert.doesNotMatch(cluster, /tapPlace|openMapPlace|setSelectedPlaceId|clearSelectedPlace/);
  assert.match(screen, /cluster\s*\n\s*clusterRadius=\{50\}/);
});

test('selecting never touches filters, search, the tray state or the Regions sheet', async () => {
  const screen = await read('app/(tabs)/map.tsx');
  const start = screen.indexOf('const selectedMarkerObscuredEdges');
  const end = screen.indexOf('const isLoading =');
  const interaction = screen.slice(start, end);
  assert.ok(interaction.includes('const tapPlace') && interaction.includes('const handleThumbnailPress'), 'whole interaction block found');
  assert.doesNotMatch(
    interaction,
    /setSelection\(|setSelectedActivityTagIds|setQuery|applySelection|clearPlaceContext|setTrayState|setIsRegionsSheetOpen|setIsFitPending|fitBounds|fitCameraToPlaces/
  );
  const map = mapWith(PLACES);
  map.marker('a'); map.thumbnail('b'); map.mapTap();
  assert.ok(map.filtersUnchanged());
});

test('a selection removed by a filter or search is dropped; panning the map never clears or moves it', async () => {
  const screen = await read('app/(tabs)/map.tsx');
  const effect = screen.match(/useEffect\(\(\) => \{\s*if \(selectedPlaceId !== null && !selectedMapPlace\) clearSelectedPlace\(\);\s*\}, \[[^\]]*\]\);/)?.[0] ?? '';
  assert.ok(effect, 'stale-selection effect found');
  assert.doesNotMatch(effect, /visibleBounds|visiblePlaces|easeTo/, 'only filters (displayed places) can drop it');
  assert.match(screen, /const selectedMapPlace = useMemo\(\(\) => displayedPlaces\.find/);
  const regionHandler = screen.match(/onRegionDidChange=\{[\s\S]*?\}\}/)?.[0] ?? '';
  assert.doesNotMatch(regionHandler, /Selected|clearSelected/, 'region changes only record the camera and bounds');
});

test('with neighbouring pins in the touch area, the pin nearest the finger is the one tapped', async () => {
  const at = (id, lng, lat) => ({ geometry: { coordinates: [lng, lat], type: 'Point' }, properties: { id } });
  // Two pins a few metres apart, as on a real Milford Sound: the finger is on the selected one,
  // but the map lists its neighbour first.
  const neighbour = at('walking-track', 167.9274, -44.6710);
  const selected = at('milford', 167.9276, -44.6713);
  assert.equal(nearestPointFeature([neighbour, selected], [167.9276, -44.6713]).properties.id, 'milford');
  assert.equal(nearestPointFeature([selected, neighbour], [167.9274, -44.6710]).properties.id, 'walking-track');
  assert.equal(nearestPointFeature([], [0, 0]), undefined);
  assert.equal(nearestPointFeature([{ geometry: { coordinates: [[0, 0]], type: 'LineString' } }], [0, 0]), undefined, 'only pins count');
  // Chosen from a tap on the selected pin, it is the second tap and so opens the Place.
  assert.equal(planPlaceTap('milford', nearestPointFeature([neighbour, selected], [167.9276, -44.6713]).properties.id, 'marker').action, 'open');
  const screen = await read('app/(tabs)/map.tsx');
  assert.match(screen, /nearestPointFeature\(event\.nativeEvent\.features, event\.nativeEvent\.lngLat\)/);
  assert.doesNotMatch(screen, /event\.nativeEvent\.features\[0\]/);
});

test('the name pop-up sits above the pin by marker offset, so its touch area never covers the pin', async () => {
  const screen = await read('app/(tabs)/map.tsx');
  const popup = screen.match(/selectedMapPlace \? <Marker[\s\S]*?<\/Marker> : null/)?.[0] ?? '';
  assert.match(popup, /anchor="bottom"/);
  assert.match(popup, /offset=\{\[0, -SELECTED_MARKER_LABEL_GAP\]\}/);
  assert.doesNotMatch(popup, /marginBottom/, 'a margin would enlarge the pop-up\'s box down over the pin');
});

test('the Diary and Trip maps keep using the same shared selection hook (no second implementation)', async () => {
  for (const file of ['app/diaries/[diaryId]/map.tsx', 'app/trips/[tripId]/map.tsx']) {
    const source = await read(file);
    assert.match(source, /useMapSelection\(/, file);
    assert.doesNotMatch(source, /planPlaceTap/, `${file} needs no change`);
  }
  assert.match(await read('app/(tabs)/map.tsx'), /useMapSelection<MapPlace>\(openMapPlace\)|useMapSelection\(openMapPlace\)/);
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
