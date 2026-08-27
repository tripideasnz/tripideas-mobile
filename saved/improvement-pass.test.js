import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [search, standardSearch, favourites, trip, tripMap, notebookPicker, diaryPicker, personal, personalPicker, savedPicker, map, root] = await Promise.all([
  read('components/place-search.tsx'), read('app/(tabs)/search.tsx'), read('app/favourites/index.tsx'),
  read('app/trips/[tripId].tsx'), read('app/trips/[tripId]/map.tsx'), read('app/notebooks/location-picker.tsx'),
  read('app/diaries/location-picker.tsx'), read('app/personal-place-cards/[cardId].tsx'),
  read('app/personal-place-cards/location-picker.tsx'), read('components/map/saved-location-picker.tsx'), read('app/(tabs)/map.tsx'), read('app/_layout.tsx'),
]);

for (const screen of [standardSearch, favourites, trip]) assert.match(screen, /PlaceSearch/);
assert.match(search, /SEARCH_QUERY/); assert.match(trip, /addPlaceToTrip/);
assert.match(tripMap, /MapRecenterControl/); assert.match(tripMap, /userPosition/);
assert.match(diaryPicker, /SavedLocationPicker/);
assert.match(notebookPicker, /SavedLocationPicker/);
assert.match(personalPicker, /SavedLocationPicker/); assert.match(savedPicker, /MapRecenterControl/);
assert.match(savedPicker, /<UserLocation animated/); assert.doesNotMatch(savedPicker, /userPosition[\s\S]{0,120}MapPin emphasis="selected"/);
assert.match(personal, /Locate now/); assert.match(personal, /Locate on map/);
assert.match(personal, /Finish editing Personal Place/); assert.doesNotMatch(personal, /label="Done"/);
assert.match(personal, /cardId: card\.id/); assert.match(map, /placeContext\?\.cardId/);
assert.match(personal, /card\.location \? \([\s\S]*<PlaceMapPreview/);
assert.match(root, /personal-place-cards\/location-picker/);
assert.match(personalPicker, /params\.latitude\?\.trim\(\) && params\.longitude\?\.trim\(\)/);
console.log('✓ Saved search, location, Personal Place editing, and map-origin contracts are wired through shared primitives');
