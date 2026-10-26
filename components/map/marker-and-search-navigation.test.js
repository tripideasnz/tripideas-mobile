// Acceptance Corrections Batch 1: marker first-tap navigation and Search return.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createNavigationGuard,
  openPlaceFromMap,
  backFromPlace,
} from './place-navigation.ts';
import { nextMapSelectionAction } from './use-map-selection.ts';

const read = (relativePath) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

const tests = [];
const test = (name, run) => tests.push({ name, run });

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

// Extract the body of the marker GeoJSONSource press handler.
const markerHandler = (map) => {
  const start = map.indexOf('const id = properties?.id as string | null;');
  assert.ok(start > 0, 'marker handler found');
  return map.slice(start, start + 600);
};

// ── Map: marker first tap ───────────────────────────────────────────────────

test('a direct marker tap selects and opens the Place in one step, with no select-first stage', async () => {
  const map = await read('app/(tabs)/map.tsx');
  const body = markerHandler(map);
  assert.match(body, /setSelectedPlaceId\(id\);\s*if \(place\.slug\?\.current\) openMapPlace\(place\);\s*else revealSelectedMarker\(place\);/);
  assert.doesNotMatch(map, /activatePlace|const \{ activate/);
  // The cluster branch is unchanged: it zooms, and never opens a Place.
  const cluster = map.match(/properties\?\.cluster_id !== undefined[\s\S]*?return;/)?.[0] ?? '';
  assert.ok(cluster, 'cluster branch found');
  assert.match(cluster, /getClusterExpansionZoom/);
  assert.doesNotMatch(cluster, /openMapPlace|setSelectedPlaceId/);
  assert.ok(map.indexOf('properties?.cluster_id !== undefined') < map.indexOf('openMapPlace(place)'), 'clusters are handled before places');
});

test('one tap fires exactly one Place push through the guarded opener', () => {
  const router = fakeRouter();
  const guard = createNavigationGuard();
  // marker tap, then the bubbling pop-up/map handlers fire in the same gesture
  assert.equal(openPlaceFromMap(router, 'milford', guard), true);
  assert.equal(openPlaceFromMap(router, 'milford', guard), false);
  assert.equal(router.actions.length, 1);
  assert.deepEqual(router.actions[0], ['push', { params: { origin: 'map', slug: 'milford' }, pathname: '/place/[slug]' }]);
});

test('selecting another Place replaces the previous selection and navigates to the new one', () => {
  const time = clock();
  const guard = createNavigationGuard({ now: time.now });
  const router = fakeRouter();
  let selected = null;
  const tap = (slug) => { selected = slug; openPlaceFromMap(router, slug, guard); };
  tap('a');
  time.advance(50);
  tap('b');
  assert.equal(selected, 'b');
  assert.deepEqual(router.actions.map(([, href]) => href.params.slug), ['a', 'b']);
});

test('the pop-up title and the thumbnail both open the Place through the same opener', async () => {
  const map = await read('app/(tabs)/map.tsx');
  assert.match(map, /openMapPlace\(selectedMapPlace\)/, 'pop-up');
  assert.match(map, /const openMapPlace = useCallback\(\(place: Pick<MapPlace, 'slug'>\) => \{ openPlaceFromMap\(router, place\.slug\?\.current\); \}/, 'shared opener');
  assert.match(map, /onPlacePress=\{handleThumbnailPress\}/, 'thumbnail');
  const thumbnail = map.match(/const handleThumbnailPress = useCallback[\s\S]*?\]\);/)?.[0] ?? '';
  assert.match(thumbnail, /openMapPlace\(place\)/);
});

// ── Map: selection dismissal and returning ──────────────────────────────────

test('tapping empty map clears the selection; leaving the Map clears it too', async () => {
  const map = await read('app/(tabs)/map.tsx');
  assert.match(map, /onPress=\{clearSelectedPlace\}/);
  assert.match(map, /useFocusEffect\(useCallback\(\(\) => \(\) => setSelectedPlaceId\(null\), \[setSelectedPlaceId\]\)\)/);
  assert.match(map, /useFocusEffect/);
  assert.match(map, /from 'expo-router'/);
});

test('returning from a Map-opened Place is a plain pop, with camera state untouched', async () => {
  const actions = [];
  const router = { back: () => actions.push('back'), canGoBack: () => true, dismissTo() {}, replace() {} };
  assert.equal(backFromPlace(router, { origin: 'map' }, createNavigationGuard()), 'back');
  assert.deepEqual(actions, ['back'], 'no tab switch: the Map tab is still mounted beneath the Place');
  const map = await read('app/(tabs)/map.tsx');
  // State is preserved because nothing resets it on return.
  assert.doesNotMatch(map, /useFocusEffect\([\s\S]{0,200}(setSelection|setQuery|setIsFitPending|lastCameraRef\.current = null)/);
});

test('the selection helper still distinguishes repeat taps for the Diary map', () => {
  assert.equal(nextMapSelectionAction('a', 'a'), 'open');
  assert.equal(nextMapSelectionAction('a', 'b'), 'select');
});

// ── Search: return to results ───────────────────────────────────────────────

test('Search results open the Place with the search origin', async () => {
  const [search, placeSearch, card] = await Promise.all([
    read('app/(tabs)/search.tsx'),
    read('components/place-search.tsx'),
    read('components/place-card.tsx'),
  ]);
  assert.match(search, /<PlaceSearch navigationOrigin="search"/);
  assert.match(placeSearch, /navigationOrigin\?: 'search'/);
  assert.match(placeSearch, /navigationOrigin=\{navigationOrigin\}/);
  assert.match(card, /navigationOrigin\?: 'favourites' \| 'search'/);
  assert.match(card, /origin: navigationOrigin/);
});

test('Back from a Search-opened Place is a plain pop, so the same Search screen is revealed', () => {
  const actions = [];
  const router = { back: () => actions.push(['back']), canGoBack: () => true, dismissTo: (h) => actions.push(['dismissTo', h]), replace: (h) => actions.push(['replace', h]) };
  assert.equal(backFromPlace(router, { origin: 'search' }, createNavigationGuard()), 'back');
  // No replacement Search screen, no duplicate Place and no tab navigation are created.
  assert.deepEqual(actions, [['back']]);
});

test('Search query and results stay mounted: the Search screen holds its own state and is not reset on focus', async () => {
  const [search, placeSearch] = await Promise.all([read('app/(tabs)/search.tsx'), read('components/place-search.tsx')]);
  assert.match(placeSearch, /useState/);
  assert.doesNotMatch(search, /useFocusEffect|useIsFocused/);
  assert.doesNotMatch(placeSearch, /useFocusEffect[\s\S]{0,200}set(Query|Results)/);
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
