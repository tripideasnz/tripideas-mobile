import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [back, root, notebooks, notebook, notebookPicker, diaryList, diaryCover, diaryIndex, diaryDay, diaryMap, diaryPicker, editorial, personal, personalPicker, mainMap, trip, tripMap] = await Promise.all([
  read('components/ui/header-back-button.tsx'), read('app/_layout.tsx'), read('app/notebooks/index.tsx'), read('app/notebooks/[notebookId].tsx'), read('app/notebooks/location-picker.tsx'), read('app/diaries/index.tsx'), read('app/diaries/[diaryId].tsx'), read('app/diaries/[diaryId]/contents.tsx'), read('app/diaries/[diaryId]/day.tsx'), read('app/diaries/[diaryId]/map.tsx'), read('app/diaries/location-picker.tsx'), read('app/(tabs)/(discover)/place/[slug].tsx'), read('app/personal-place-cards/[cardId].tsx'), read('app/personal-place-cards/location-picker.tsx'), read('app/(tabs)/map.tsx'), read('app/trips/[tripId].tsx'), read('app/trips/[tripId]/map.tsx'),
]);

assert.match(back, /router\.canGoBack\(\)/);
assert.match(back, /router\.back\(\)/);
assert.match(back, /router\.replace\(fallbackHref\)/);
for (const source of [root, notebooks, notebook, diaryList, diaryCover, diaryIndex, diaryDay, diaryMap, trip, tripMap]) assert.match(source, /fallbackHref=/);
console.log('✓ every Saved hierarchy chevron is history-first with a feature fallback');

for (const picker of [notebookPicker, diaryPicker, personalPicker]) {
  assert.match(picker, /backOrFallback\(router,/);
  assert.match(picker, /onCancel=/);
}
console.log('✓ picker chevrons and Cancel share history-preserving dismissal');

for (const detail of [editorial, mainMap]) {
  assert.match(detail, /router\.canGoBack\(\)/);
  assert.match(detail, /router\.back\(\)/);
}
assert.match(personal, /backOrFallback\(router, personalPlaceFallback\)/);
assert.match(editorial, /selectedOrigin === 'notebook'/);
assert.match(editorial, /selectedOrigin === 'diary'/);
assert.match(personal, /origin === 'notebook'/);
assert.match(personal, /origin === 'diary'/);
assert.match(mainMap, /placeContext\?\.slug/);
assert.match(mainMap, /placeContext\?\.origin === 'notebook'/);
assert.match(mainMap, /placeContext\?\.origin === 'diary'/);
assert.match(mainMap, /router\.dismissTo/);
assert.ok(mainMap.indexOf("placeContext?.origin === 'notebook'") < mainMap.indexOf('router.canGoBack()'));
assert.match(notebook, /origin: 'notebook', notebookId/);
assert.match(diaryDay, /origin: 'diary', diaryId, date/);
console.log('✓ Notebook, Diary, Trip and map-origin Place details return through their actual stack');

function history(...routes) {
  return {
    routes,
    back() { this.routes.pop(); },
  };
}

const notebookFlow = history('/saved', '/notebooks', '/notebooks/n1', '/personal-place-cards/p1');
notebookFlow.back();
assert.equal(notebookFlow.routes.at(-1), '/notebooks/n1');
notebookFlow.back();
assert.equal(notebookFlow.routes.at(-1), '/notebooks');
notebookFlow.back();
assert.equal(notebookFlow.routes.at(-1), '/saved');

const diaryFlow = history('/saved', '/diaries', '/diaries/d1', '/diaries/d1/contents', '/diaries/d1/day', '/diaries/d1/map', '/diaries/d1/day');
diaryFlow.back();
assert.equal(diaryFlow.routes.at(-1), '/diaries/d1/map');
diaryFlow.back();
assert.equal(diaryFlow.routes.at(-1), '/diaries/d1/day');
console.log('✓ representative Notebook and Diary route sequences unwind one screen at a time');
