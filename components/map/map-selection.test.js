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
assert.match(mainMap, /activatePlace\(id, place\)/);
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
assert.match(peek, /placesRef\.current\?\.scrollTo/);
assert.match(peek, /onPress=\{\(\) => onPlacePress\(place\)\}/);
assert.doesNotMatch(peek, /router\.push/);
assert.match(mainMap, /handleThumbnailPress/);
assert.match(mainMap, /onPlacePress=\{handleThumbnailPress\}/);

assert.match(diaryMap, /useMapSelection\(openFeature\)/);
assert.match(diaryMap, /activateFeature\(feature\.itemId, feature\)/);
assert.match(diaryMap, /onPress=\{clearSelectedFeature\}/);
assert.match(diaryMap, /selected\. Activate again to open/);
assert.match(diaryMap, /openFeature\(selectedFeature\)/);
for (const identity of ['diaryId: feature.diaryId', 'topicId: feature.topicId', 'itemId: feature.itemId']) assert.match(diaryMap, new RegExp(identity));

console.log('✓ main and Diary maps share select-first, activate-again interaction semantics');
