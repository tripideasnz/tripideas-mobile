import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  markerPixelPosition,
  revealMarkerCamera,
  selectedMarkerNeedsMove,
} from './marker-visibility.ts';
import {
  createNavigationGuard,
  openPlaceFromMap,
  returnToMapFromPlace,
} from './place-navigation.ts';
import { reuseIfSame } from './map-filters.ts';

const read = (relativePath) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

const tests = [];
const test = (name, run) => tests.push({ name, run });

// A fake router that records every navigation action.
const fakeRouter = ({ canGoBack = true } = {}) => {
  const actions = [];
  return {
    actions,
    back: () => actions.push(['back']),
    canGoBack: () => canGoBack,
    navigate: (href) => actions.push(['navigate', href]),
    push: (href) => actions.push(['push', href]),
  };
};
const clock = () => {
  let now = 1_000;
  return { advance: (ms) => { now += ms; }, now: () => now };
};

// ── N05: thumbnails open on the first tap ───────────────────────────────────

test('a thumbnail opens its editorial Place on the first tap, selecting it first', async () => {
  const map = await read('app/(tabs)/map.tsx');
  const peek = await read('components/map/map-peek-sheet.tsx');
  const handler = map.match(/const handleThumbnailPress = useCallback\(\(place: MapPlace\) => \{[\s\S]*?\}, \[openMapPlace, setSelectedPlaceId\]\);/)?.[0] ?? '';
  assert.ok(handler, 'thumbnail handler found');
  assert.match(handler, /setSelectedPlaceId\(mapPlaceId\(place\)\)/);
  assert.match(handler, /openMapPlace\(place\)/);
  assert.doesNotMatch(handler, /activatePlace/, 'no select-then-activate step');
  assert.match(peek, /accessibilityHint="Opens the place\."/);
  assert.doesNotMatch(peek, /Activate again/);
});

test('opening from the Map pushes the editorial Place route once with the Map origin', () => {
  const router = fakeRouter();
  assert.equal(openPlaceFromMap(router, 'milford-sound', createNavigationGuard()), true);
  assert.deepEqual(router.actions, [['push', { params: { origin: 'map', slug: 'milford-sound' }, pathname: '/place/[slug]' }]]);
  assert.equal(openPlaceFromMap(router, undefined, createNavigationGuard()), false, 'a place without a slug cannot open');
  assert.equal(router.actions.length, 1);
});

// ── N05/F09: duplicate navigation prevention ────────────────────────────────

test('rapid repeat taps on the same Place open it only once', () => {
  const time = clock();
  const guard = createNavigationGuard({ now: time.now, windowMs: 800 });
  const router = fakeRouter();
  assert.equal(openPlaceFromMap(router, 'a', guard), true);
  time.advance(100);
  assert.equal(openPlaceFromMap(router, 'a', guard), false);
  time.advance(100);
  assert.equal(openPlaceFromMap(router, 'a', guard), false);
  assert.equal(router.actions.length, 1);
  assert.equal(openPlaceFromMap(router, 'b', guard), true, 'a different Place is allowed');
  time.advance(1_000);
  assert.equal(openPlaceFromMap(router, 'a', guard), true, 'the same Place can be opened again later');
  assert.equal(router.actions.length, 3);
});

test('thumbnail, marker label and Place list all use the same guarded opener', async () => {
  const [map, tile] = await Promise.all([
    read('app/(tabs)/map.tsx'),
    read('components/map/map-place-tile.tsx'),
  ]);
  assert.match(map, /openPlaceFromMap\(router, place\.slug\?\.current\)/);
  assert.match(tile, /openPlaceFromMap\(router, place\.slug\?\.current\)/);
  assert.match(map, /openMapPlace\(selectedMapPlace\)/, 'marker label');
  assert.match(map, /useMapSelection\(openMapPlace\)/, 'marker second tap');
  assert.doesNotMatch(map, /router\.push\(\{ pathname: '\/place\/\[slug\]'/);
  assert.doesNotMatch(tile, /router\.push/);
});

// ── N05: marker selection remains a separate interaction ────────────────────

test('markers keep select-first behaviour, the highlight and the preview', async () => {
  const map = await read('app/(tabs)/map.tsx');
  assert.match(map, /activatePlace\(id, place\) === 'select'\) revealSelectedMarker\(place\)/);
  assert.match(map, /isSelected: featureId === selectedPlaceId/);
  assert.match(map, /MapPinColors\.selected/);
  assert.match(map, /selectedMapPlace \? <Marker/);
  assert.match(map, /onPress=\{clearSelectedPlace\}/);
});

// ── N06: keep the selected marker visible ───────────────────────────────────

const viewport = { height: 800, width: 400 };
const bounds = [170, -46, 174, -42]; // a viewport-sized window
const obscured = { bottom: 300, left: 24, right: 24, top: 190 };
const markerAt = (xFraction, yFraction) => {
  // Invert the Mercator mapping used by the module for the test.
  const west = bounds[0];
  const lng = west + xFraction * (bounds[2] - bounds[0]);
  const y = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const yy = y(bounds[3]) - yFraction * (y(bounds[3]) - y(bounds[1]));
  const lat = (2 * Math.atan(Math.exp(yy)) - Math.PI / 2) * (180 / Math.PI);
  return { lat, lng };
};

test('pixel positions follow the visible bounds', () => {
  const centre = markerPixelPosition(markerAt(0.5, 0.5), bounds, viewport);
  assert.ok(Math.abs(centre.x - 200) < 0.5);
  assert.ok(Math.abs(centre.y - 400) < 0.5);
  assert.equal(markerPixelPosition({ lat: -44, lng: 172 }, [172, -44, 172, -44], viewport), null);
});

test('a marker that is already clearly visible does not move the camera', () => {
  for (const [x, y] of [[0.5, 0.35], [0.3, 0.4], [0.7, 0.45]]) {
    assert.equal(selectedMarkerNeedsMove({ bounds, marker: markerAt(x, y), obscured, viewport }), false, `${x},${y}`);
  }
});

test('a marker under the peek sheet, under the label allowance, or at the edge is brought into view', () => {
  assert.equal(selectedMarkerNeedsMove({ bounds, marker: markerAt(0.5, 0.8), obscured, viewport }), true, 'under the sheet');
  assert.equal(selectedMarkerNeedsMove({ bounds, marker: markerAt(0.5, 0.1), obscured, viewport }), true, 'no room for the label above');
  assert.equal(selectedMarkerNeedsMove({ bounds, marker: markerAt(0.02, 0.4), obscured, viewport }), true, 'left edge');
  assert.equal(selectedMarkerNeedsMove({ bounds, marker: markerAt(0.99, 0.4), obscured, viewport }), true, 'right edge');
});

test('a taller sheet makes more of the map count as hidden', () => {
  const marker = markerAt(0.5, 0.6);
  assert.equal(selectedMarkerNeedsMove({ bounds, marker, obscured: { ...obscured, bottom: 150 }, viewport }), false);
  assert.equal(selectedMarkerNeedsMove({ bounds, marker, obscured: { ...obscured, bottom: 380 }, viewport }), true);
});

test('unknown viewport state never moves the camera', () => {
  assert.equal(selectedMarkerNeedsMove({ bounds: null, marker: { lat: -44, lng: 172 }, obscured, viewport }), false);
  assert.equal(selectedMarkerNeedsMove({ bounds, marker: { lat: -44, lng: 172 }, obscured, viewport: { height: 0, width: 0 } }), false);
});

test('the reveal move keeps the zoom and centres within the unobscured area', () => {
  const options = revealMarkerCamera({ lat: -44, lng: 172 }, obscured);
  assert.deepEqual(options.center, [172, -44]);
  assert.deepEqual(options.padding, obscured);
  assert.equal('zoom' in options, false, 'zoom is preserved');
  assert.ok(options.duration > 0);
});

test('revealing a marker never touches filters, clustering or the initial camera', async () => {
  const map = await read('app/(tabs)/map.tsx');
  const reveal = map.match(/const revealSelectedMarker = \(place: MappablePlace\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
  assert.ok(reveal, 'reveal helper found');
  assert.doesNotMatch(reveal, /setSelection|setSelectedActivityTagIds|setQuery|clearPlaceContext|setPlaceContext|zoom/);
  assert.match(reveal, /selectedMarkerNeedsMove\(/);
  assert.match(reveal, /cancelPendingFit\(\)/);
  assert.match(map, /getClusterExpansionZoom/);
  assert.match(map, /resolveInitialCamera\(/);
  assert.match(map, /visibleBoundsRef\.current = event\.nativeEvent\.bounds/);
});

// ── N07/F09: back navigation by origin ──────────────────────────────────────

test('back from a Place opened on the Map pops it and shows the Map tab', () => {
  const router = fakeRouter();
  assert.equal(returnToMapFromPlace(router, createNavigationGuard()), true);
  assert.deepEqual(router.actions, [['back'], ['navigate', '/map']]);
});

test('back still lands on the Map when the Place has nothing beneath it, and is not doubled by repeat taps', () => {
  const router = fakeRouter({ canGoBack: false });
  const time = clock();
  const guard = createNavigationGuard({ now: time.now });
  returnToMapFromPlace(router, guard);
  time.advance(50);
  assert.equal(returnToMapFromPlace(router, guard), false);
  assert.deepEqual(router.actions, [['navigate', '/map']]);
});

test('the Place screen sends map-origin back to the Map before the generic back, and leaves other origins unchanged', async () => {
  const place = await read('app/(tabs)/(discover)/place/[slug].tsx');
  const handler = place.slice(place.indexOf('onPress={() => {', place.indexOf('headerLeft: () =>')), place.indexOf('title,\n        }}'));
  const mapIndex = handler.indexOf("selectedOrigin === 'map'");
  const backIndex = handler.indexOf('router.canGoBack()');
  assert.ok(mapIndex > -1 && backIndex > -1);
  assert.ok(mapIndex < backIndex, 'the Map origin is checked before the generic back');
  assert.match(handler, /returnToMapFromPlace\(router\)/);
  // Other origins keep their existing handling and ordering.
  const order = ["selectedOrigin === 'favourites'", "selectedOrigin === 'trip-map'", "selectedOrigin === 'notebook'", "selectedOrigin === 'diary'"].map((needle) => handler.indexOf(needle));
  assert.ok(order.every((index) => index > backIndex), 'other origins still follow the generic back');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'their relative order is unchanged');
  assert.match(handler, /router\.replace\('\/discover'\)/);
});

test('the Place screen needs no Map-specific duplicate routes', async () => {
  const [layout, place] = await Promise.all([
    read('app/(tabs)/(discover)/_layout.tsx'),
    read('app/(tabs)/(discover)/place/[slug].tsx'),
  ]);
  assert.equal(layout.match(/name="place\/\[slug\]"/g)?.length, 1);
  assert.doesNotMatch(place, /router\.push\('\/map'\)|router\.replace\('\/map'\)/);
});

test('the Map place bar back button never silently does nothing', async () => {
  const map = await read('app/(tabs)/map.tsx');
  const back = map.match(/const handlePlaceContextBack = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[clearPlaceContext, placeContext, router\]\);/)?.[0] ?? '';
  assert.ok(back);
  assert.match(back, /else clearPlaceContext\(\)/);
});

// ── Preserved Map behaviour ─────────────────────────────────────────────────

test('list, peek-sheet virtualisation, camera restore and recentring are unchanged', async () => {
  const [map, peek, tileView] = await Promise.all([
    read('app/(tabs)/map.tsx'),
    read('components/map/map-peek-sheet.tsx'),
    read('components/map/map-tile-view.tsx'),
  ]);
  assert.match(peek, /<FlatList/);
  assert.match(peek, /windowSize=\{5\}/);
  assert.match(map, /initialViewState=\{resolveInitialCamera\(/);
  assert.match(map, /useMapUserLocation\(cameraRef, \{/);
  assert.match(tileView, /<MapPlaceTile place=\{item\} \/>/);
  const same = [1, 2];
  assert.equal(reuseIfSame(same, [1, 2]), same);
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
