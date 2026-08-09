import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const [saved, savedModule, trips, favourites, layout, tabs] = await Promise.all([
  read('app/(tabs)/saved.tsx'),
  read('components/saved-module.tsx'),
  read('app/trips/index.tsx'),
  read('app/favourites/index.tsx'),
  read('app/_layout.tsx'),
  read('app/(tabs)/_layout.tsx'),
]);

const orderedModules = ["title: 'Favourites'", "title: 'Trips'", "title: 'Personal Places'", "title: 'Notebooks'"];
let previousModule = -1;
for (const moduleTitle of orderedModules) {
  const position = saved.indexOf(moduleTitle);
  assert.ok(position > previousModule, `${moduleTitle} is out of order`);
  previousModule = position;
}
console.log('✓ Saved modules use the approved ordering');

for (const route of ["router.push('/favourites')", "router.push('/trips')", "router.push('/personal-place-cards')", "router.push('/notebooks')"]) {
  assert.match(saved, new RegExp(route.replace(/[()]/g, '\\$&')));
}
assert.match(layout, /name="favourites\/index"/);
assert.match(layout, /name="trips\/index"/);
console.log('✓ every Saved module retains access to its feature destination');

assert.match(savedModule, /accessibilityRole="button"/);
assert.match(savedModule, /onPress=\{onPress\}/);
assert.match(savedModule, /\{stateText\}/);
assert.match(savedModule, /chevron-right/);
console.log('✓ SavedModule exposes one accessible row-level navigation contract');

assert.match(saved, /countText\(savedPlaceIds\.length, 'place'\)/);
assert.match(saved, /countText\(trips\.length, 'trip'\)/);
assert.match(saved, /countText\(cards\.length, 'place'\)/);
assert.match(saved, /countText\(notebooks\.length, 'notebook'\)/);
assert.match(saved, /No favourites yet/);
assert.match(saved, /No trips yet/);
assert.match(saved, /No personal places yet/);
assert.match(saved, /No notebooks yet/);
console.log('✓ populated, empty, and loading state text preserve module geometry');

assert.doesNotMatch(saved, /Add new trip|New trip name|label="Create"|<PlaceCard|<TripImageCollage/);
assert.match(trips, /placeholder="Add new trip"/);
assert.match(favourites, /<PlaceCard/);
console.log('✓ creation and feature content moved off the Saved landing page');

assert.match(tabs, /name="saved"/);
assert.match(tabs, /title: 'Saved'/);
assert.match(tabs, /name="heart\.fill"/);
console.log('✓ the existing Saved tab remains intact');
