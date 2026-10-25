import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [map, search, trips, personal, profile, sheet, queries, picker, card] = await Promise.all([
  read('app/(tabs)/map.tsx'), read('components/place-search.tsx'), read('app/trips/index.tsx'),
  read('app/personal-place-cards/index.tsx'), read('app/(tabs)/profile.tsx'),
  read('components/map/map-saved-sheet.tsx'), read('sanity/queries.ts'),
  read('components/trip-place-picker.tsx'), read('components/place-card.tsx'),
]);
// The map uses the shared location hook; it only moves the camera and marker.
const locate = map.slice(map.indexOf('  // Shared location behaviour'), map.indexOf('// Activate place context'));
const locationHook = await read('location/use-map-user-location.ts');
const locateFlow = await read('location/map-locate.ts');
assert.match(locate, /useMapUserLocation\(cameraRef/);
assert.match(locationHook, /center: \[point.longitude, point.latitude\]/);
assert.match(locateFlow, /acquire\(\{/);
assert.doesNotMatch(locate, /setSelection|setSelectedActivityTagIds|setQuery/);
assert.doesNotMatch(locationHook + locateFlow, /setSelection|setSelectedActivityTagIds|setQuery/);
assert.match(map, /onRecenterPress=\{\(\) => \{ void locateUser\(\); \}\}/);
assert.match(map, /userPosition.latitude\]\} anchor="center">\s*<MapPin emphasis="focused"/);
assert.match(map, /setVisibleBounds\(event.nativeEvent.bounds\)/);
// Viewport filtering moved to a pure helper (behaviour covered in map-performance.test.js).
assert.match(map, /placesInBounds\(displayedPlaces, visibleBounds\)/);
assert.doesNotMatch(map, /prevPeekSheetHeightRef/);
assert.match(search, /keyboardDismissMode="on-drag"/);
assert.match(search, /onScrollBeginDrag=\{Keyboard.dismiss\}/);
assert.doesNotMatch(search, /stickyHeaderIndices|inputRef|onPressIn/);
assert.match(search, /showSaveButton=\{!onPlacePress\}/);
assert.match(card, /disabled=\{disabled \|\| \(!onPress && !canOpenPlace\)\}/);
assert.match(trips, /await createTrip\(newTripName\)[\s\S]*router.push\(\{ pathname: '\/trips\/\[tripId\]', params: \{ tripId: trip.id \}/);
assert.match(personal, /headerAddAction\([\s\S]*onPress: \(\) => void createPlace\(\)/);
assert.match(personal, /await create\(\)[\s\S]*pathname: '\/personal-place-cards\/\[cardId\]'[\s\S]*mode: 'edit'/);
assert.match(picker, /fetchPlaceCardsByIds\(savedPlaceIds\)/);
assert.match(picker, /await addPlaceToTrip\(tripId, placeId\)/);
assert.doesNotMatch(picker, /AddToTripModal|createTripRequest/);
assert.doesNotMatch(profile, /Notebook/i);
assert.doesNotMatch(sheet, /Apply|without applying/);
const islandsQuery = queries.slice(queries.indexOf('export const ISLANDS_QUERY'), queries.indexOf('export const ISLAND_QUERY'));
assert.equal((islandsQuery.match(/article->mainImage.asset->url/g) || []).length, 2);
console.log('✓ September beta wiring preserves filters, viewport refresh, search semantics, and existing creation flows');

const [regions, activities, configText] = await Promise.all([
  read('components/map/map-regions-sheet.tsx'), read('components/map/map-activities-sheet.tsx'), read('app.json'),
]);
assert.doesNotMatch(regions, /Apply|without applying/);
assert.match(regions, /onSelect\(\{[\s\S]*type: 'region'/);
assert.match(regions, /accessibilityLabel="Close Region filters"/);
assert.match(activities, /onApply\(pendingTagIds\)/);
assert.match(activities, />Apply<\/Text>/);
assert.match(trips, /isCreatingTrip \? <View accessibilityLabel="Creating Trip"/);
assert.match(trips, /<ActivityIndicator color=\{Palette.trip\}/);
assert.doesNotMatch(trips, /<StatusText>Creating trip/);
assert.match(picker, /<AppButton style=\{\{ flex: 1 \}\} label="Favourites"/);
assert.match(picker, /<AppButton style=\{\{ flex: 1 \}\} label="Search TripIdeas"/);
assert.doesNotMatch(picker, /added to Trip\./);
const config = JSON.parse(configText).expo;
assert.ok(config.ios.infoPlist.NSLocationWhenInUseUsageDescription);
assert.ok(config.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-location')[1].locationWhenInUsePermission);
console.log('✓ Region is immediate, Activity retains Apply, creation uses inline progress, and foreground permission remains configured');

const discover = await read('app/(tabs)/(discover)/discover.tsx');
const baselineDiscover = execFileSync('git', ['show', '3961aad6fe425d3c40ef521623f9303c9510f068:app/(tabs)/(discover)/discover.tsx'], { encoding: 'utf8' });
assert.equal(discover
  .replace(/  const handleIslandPress = \(\) => \{[\s\S]*?\n  \};\n/, '')
  .replace(/      \{\/\* Image tap target:[\s\S]*?      \/> : null\}\n\n/, '')
  .replace('        onPress={handleIslandPress}', `        onPress={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) onOpen?.();
        }}`), baselineDiscover,
  'Discover presentation and accordion source exactly match pre-pass-2 HEAD');
const [tabs, tripDetail] = await Promise.all([read('app/(tabs)/_layout.tsx'), read('app/trips/[tripId].tsx')]);
assert.equal(tabs, execFileSync('git', ['show', '3961aad6fe425d3c40ef521623f9303c9510f068:app/(tabs)/_layout.tsx'], { encoding: 'utf8' }));
const baselineCard = execFileSync('git', ['show', '3961aad6fe425d3c40ef521623f9303c9510f068:components/place-card.tsx'], { encoding: 'utf8' });
const routeBlock = /router.push\(\{\s*pathname: '\/place\/\[slug\]',\s*params: \{ slug: place.slug.current, origin: navigationOrigin \},\s*\}\)/;
assert.match(card, routeBlock);
assert.match(baselineCard, routeBlock);
assert.match(tripDetail, /pathname: '\/trips\/\[tripId\]\/map'/);
for (const path of ['app/(tabs)/map.tsx', 'app/(tabs)/(discover)/place/[slug].tsx', 'app/trips/[tripId]/map.tsx']) {
  assert.match(await read(path), /export default function/);
}
console.log('✓ Discover baseline presentation, established place route, and Map tab registration are preserved');

assert.equal(await read('components/ui/media-frame.tsx'), execFileSync('git', ['show', '3961aad6fe425d3c40ef521623f9303c9510f068:components/ui/media-frame.tsx'], { encoding: 'utf8' }));
