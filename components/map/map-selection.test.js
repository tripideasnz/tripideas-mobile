import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nextMapSelectionAction } from './use-map-selection.ts';

assert.equal(nextMapSelectionAction(null, 'a'), 'select');
assert.equal(nextMapSelectionAction('a', 'a'), 'open');
assert.equal(nextMapSelectionAction('a', 'b'), 'select');

const [mainMap, peek, diaryMap, selection] = await Promise.all([
  readFile(new URL('../../app/(tabs)/map.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./map-peek-sheet.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../app/diaries/[diaryId]/map.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./use-map-selection.ts', import.meta.url), 'utf8'),
]);

assert.match(selection, /selectedId === nextId \? 'open' : 'select'/);
assert.match(mainMap, /tapPlace\(place, 'marker'\);/);
assert.match(mainMap, /tapPlace\(place, 'thumbnail'\)/);
assert.doesNotMatch(mainMap, /activatePlace/);
assert.match(mainMap, /onPress=\{clearSelectedPlace\}/);
assert.match(mainMap, /isSelected: featureId === selectedPlaceId/);
assert.match(mainMap, /MapPinColors\.selected/);
assert.match(mainMap, /selectedMapPlace \? <Marker/);
assert.match(mainMap, /selected\. Open place/);
assert.match(mainMap, /openMapPlace\(selectedMapPlace\)/);
assert.doesNotMatch(mainMap, /const targetZoom = Math\.max\(lastCameraRef\.current\.zoom, 12\)/);
assert.match(mainMap, /getClusterExpansionZoom/);
assert.match(mainMap, /properties\?\.cluster_id !== undefined/);

assert.match(peek, /selectedPlaceId/);
assert.match(peek, /borderColor: selected \? Palette\.trip/);
assert.match(peek, /placesRef\.current\?\.scrollToOffset/);
assert.match(peek, /peekCenteredOffset\(index, Space\.md, viewportWidth, places\.length\)/);
assert.match(peek, /onPress=\{\(\) => onPress\(place\)\}/);
assert.match(peek, /onPress=\{onPlacePress\}/);
assert.doesNotMatch(peek, /router\.push/);
assert.match(mainMap, /handleThumbnailPress/);
assert.match(mainMap, /onPlacePress=\{handleThumbnailPress\}/);
// Thumbnails follow the same two-stage rule as markers (select first, open on the selected one).
const thumbnail = mainMap.match(/const handleThumbnailPress = [\s\S]*?\n  \};/)?.[0] ?? '';
assert.ok(thumbnail);
assert.match(thumbnail, /tapPlace\(place, 'thumbnail'\)/);
assert.doesNotMatch(thumbnail, /openMapPlace|activatePlace/);
assert.doesNotMatch(peek, /Activate again to open/);

assert.match(diaryMap, /useMapSelection\(openFeature\)/);
assert.match(diaryMap, /activateFeature\(feature\.itemId, feature\)/);
assert.match(diaryMap, /onPress=\{clearSelectedFeature\}/);
assert.match(diaryMap, /selected\. Activate again to open/);
assert.match(diaryMap, /openFeature\(selectedFeature\)/);
for (const identity of ['diaryId: feature.diaryId', 'topicId: feature.topicId', 'itemId: feature.itemId']) assert.match(diaryMap, new RegExp(identity));

console.log('✓ main-map markers and thumbnails, and the Diary map, all use select-first semantics');
