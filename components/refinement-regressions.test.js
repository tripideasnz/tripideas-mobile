import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [map, mapPeek, mapTile, notebook, place, privacy, profile, saved, tripEntry] = await Promise.all([
  read('app/(tabs)/map.tsx'),
  read('components/map/map-peek-sheet.tsx'),
  read('components/map/map-place-tile.tsx'),
  read('app/notebooks/[notebookId].tsx'),
  read('app/(tabs)/(discover)/place/[slug].tsx'),
  read('app/privacy-policy.tsx'),
  read('app/(tabs)/profile.tsx'),
  read('app/(tabs)/saved.tsx'),
  read('components/trip-entry-card.tsx'),
]);

assert.match(saved, /router\.navigate\(destination\)/);
assert.doesNotMatch(saved, /router\.push\(destination\)/);
assert.match(map, /if \(lat !== null && lng !== null\)/);
assert.match(map, /slug: rawSlug \|\| undefined/);
assert.match(mapPeek, /paddingTop: Space\.md/);
// Every Map entry point opens the Place through one guarded helper (origin 'map').
const placeNavigation = await read('components/map/place-navigation.ts');
assert.match(map, /openPlaceFromMap\(router, place\.slug\?\.current\)/);
assert.match(placeNavigation, /params: \{ origin: 'map', slug \}/);
assert.match(mapPeek, /onPress\(place\)/);
assert.match(mapPeek, /onPress=\{onPlacePress\}/);
assert.match(mapTile, /openPlaceFromMap\(router, place\.slug\?\.current\)/);
assert.match(place, /selectedOrigin === 'map'/);
assert.match(place, /returnToMapFromPlace\(router\)/);
assert.match(placeNavigation, /router\.navigate\('\/map'\)/);
assert.match(tripEntry, /icon="delete-outline"[\s\S]*size="compact"/);
assert.match(notebook, /accessibilityLabel=\{`Delete Page/);
assert.match(notebook, /icon="delete-outline"/);
assert.match(profile, /Creating and saving private content requires sign-in\./);
assert.match(profile, /Linking\.canOpenURL/);
assert.match(profile, /Clipboard\.setStringAsync/);
assert.match(profile, /<HelpSection \/>/);
assert.match(privacy, /PRIVACY_POLICY_QUERY/);

console.log('✓ navigation, map focus, Profile links, spacing, and delete controls retain the refined contracts');
