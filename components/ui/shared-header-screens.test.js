// Batch 2B: the former native-header screens render through the shared JavaScript
// header, which draws one circular back control with deterministic geometry (the
// native bar-button capsule was sized by iOS inconsistently). Diaries, Privacy
// Policy and the dev screen are intentionally untouched.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

const block = (source, routeName) => {
  const start = source.indexOf(`name="${routeName}"`);
  assert.ok(start >= 0, `${routeName} registered`);
  return source.slice(start, start + 420);
};

test('root-stack screens use the shared header', async () => {
  const root = await read('app/_layout.tsx');
  assert.match(root, /import \{ savedActionHeader \} from '@\/components\/ui\/saved-header'/);
  for (const route of ['favourites/index', 'personal-place-cards/[cardId]', 'personal-place-cards/location-picker', 'notebooks/[notebookId]', 'notebooks/location-picker', 'trips/[tripId]/map']) {
    assert.match(block(root, route).split('<Stack.Screen')[0], /\.\.\.savedActionHeader/, route);
  }
});

test('the Discover hierarchy (Island, Regions, Region, Sub-region, Place) uses it through the stack layout', async () => {
  const layout = await read('app/(tabs)/(discover)/_layout.tsx');
  assert.match(layout, /screenOptions=\{\{\s*\.\.\.savedActionHeader,/);
  assert.match(layout, /headerLeft: \(\) => <HeaderBackButton fallbackHref="\/discover" \/>/);
  // The Discover root keeps no header, and no screen opts back out.
  assert.match(layout, /name="discover"\s*options=\{\{\s*headerShown: false/);
  for (const file of ['subregion/[slug]', 'region/[slug]', 'island/[slug]', 'island/[slug]/regions', 'place/[slug]']) {
    assert.doesNotMatch(await read(`app/(tabs)/(discover)/${file}.tsx`), /headerShown/, file);
  }
});

test('the native variant is gone: no caller passes a variant', async () => {
  for (const file of ['app/_layout.tsx', 'app/(tabs)/(discover)/_layout.tsx', 'app/(tabs)/(discover)/place/[slug].tsx', 'app/personal-place-cards/[cardId].tsx', 'app/personal-place-cards/location-picker.tsx', 'app/notebooks/[notebookId].tsx', 'app/notebooks/location-picker.tsx', 'app/trips/[tripId]/map.tsx']) {
    assert.doesNotMatch(await read(file), /variant="(native|surface)"/, file);
  }
  const button = await read('components/ui/header-back-button.tsx');
  assert.doesNotMatch(button, /variant|NATIVE_HOST|Platform|translateX/);
});

test('excluded screens are unchanged: Diaries, Privacy Policy, the dev screen and the Map banner', async () => {
  const root = await read('app/_layout.tsx');
  for (const route of ['privacy-policy', 'photo-upload-dev', 'diaries/index', 'diaries/[diaryId]', 'diaries/[diaryId]/contents', 'diaries/[diaryId]/day', 'diaries/[diaryId]/map', 'diaries/location-picker']) {
    assert.doesNotMatch(block(root, route).split('<Stack.Screen')[0], /savedActionHeader/, route);
  }
  assert.match(root, /name="photo-upload-dev"\s*options=\{\{\s*headerLeft: \(\) => <HeaderBackButton fallbackHref="\/" \/>/);
  for (const file of ['app/(tabs)/map.tsx', 'app/diaries/[diaryId].tsx', 'app/diaries/[diaryId]/map.tsx']) {
    assert.doesNotMatch(await read(file), /savedActionHeader|saved-header/, file);
  }
});

test('Place, personal-place and Trip Map return handlers are intact and in order', async () => {
  const place = await read('app/(tabs)/(discover)/place/[slug].tsx');
  const at = (needle) => place.indexOf(needle);
  assert.match(place, /if \(selectedOrigin === 'map'\) \{\s*returnToMapFromPlace\(router\);\s*return;/);
  assert.match(place, /if \(selectedOrigin === 'search'\) \{\s*returnToSearchFromPlace\(router\);\s*return;/);
  assert.match(place, /router\.dismissTo\('\/favourites'\)/);
  assert.match(place, /pathname: '\/trips\/\[tripId\]\/map'/);
  assert.match(place, /pathname: '\/notebooks\/\[notebookId\]'/);
  assert.match(place, /pathname: '\/diaries\/\[diaryId\]\/day'/);
  assert.match(place, /else router\.replace\('\/discover'\)/);
  assert.ok(at("selectedOrigin === 'map'") < at("selectedOrigin === 'search'") && at("selectedOrigin === 'search'") < at('if (router.canGoBack()) {'));
  const personal = await read('app/personal-place-cards/[cardId].tsx');
  assert.match(personal, /onPress=\{backFromPersonalPlace\} \/>/);
  assert.match(personal, /onPress=\{\(\) => void finishEditing\(\)\} \/>/);
  const tripMap = await read('app/trips/[tripId]/map.tsx');
  assert.match(tripMap, /fallbackHref=\{selectedTripId\s*\? \{ pathname: '\/trips\/\[tripId\]', params: \{ tripId: selectedTripId \} \}\s*: '\/trips'\} \/>/);
});

let failed = false;
for (const { name, run } of tests) {
  try { await run(); console.log(`✓ ${name}`); } catch (error) { failed = true; console.error(`✗ ${name}`); console.error(error); }
}
if (failed) process.exitCode = 1;
