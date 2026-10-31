// C5B: choosing a region in the Regions filter updates the selection but leaves the panel open, so
// several choices can be made in one visit. Only the X closes it. The filtering itself is unchanged:
// still one region or sub-region at a time, choosing the current one again deselects it.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { clearRegionScope, resolveSelection } from './map-selection.ts';

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

const north = { label: 'Northland', regionId: 'r1', type: 'region' };
const west = { label: 'West Coast', regionId: 'r2', type: 'region' };
const bay = { label: 'Bay', subRegionId: 's1', type: 'subregion' };

test('choosing a region selects it, choosing another replaces it, choosing the current one deselects it', () => {
  let selection = { type: 'all' };
  selection = resolveSelection(selection, north);
  assert.deepEqual(selection, north);
  selection = resolveSelection(selection, west);
  assert.deepEqual(selection, west, 'replaced, no reopening needed');
  selection = resolveSelection(selection, bay);
  assert.deepEqual(selection, bay, 'a sub-region replaces a region');
  selection = resolveSelection(selection, bay);
  assert.deepEqual(selection, { type: 'all' }, 'deselected');
  assert.deepEqual(resolveSelection({ label: 'A trip', tripId: 't', type: 'trip' }, { label: 'A trip', tripId: 't', type: 'trip' }), { type: 'all' });
  assert.deepEqual(resolveSelection({ type: 'favourites' }, { type: 'favourites' }), { type: 'all' });
});

test('Clear still only clears a geographical scope (existing behaviour)', () => {
  assert.deepEqual(clearRegionScope(north), { type: 'all' });
  assert.deepEqual(clearRegionScope(bay), { type: 'all' });
  const favourites = { type: 'favourites' };
  assert.equal(clearRegionScope(favourites), favourites);
});

test('the Regions sheet keeps itself open when a region is chosen; only X (onClose) closes it', async () => {
  const screen = await read('app/(tabs)/map.tsx');
  assert.match(screen, /const applySelection = \(nextSelection: MapContentSelection, \{ keepRegionsOpen = false \} = \{\}\) => \{/);
  assert.match(screen, /if \(!keepRegionsOpen\) setIsRegionsSheetOpen\(false\);/);
  assert.match(screen, /const selectRegion = \(nextSelection: MapContentSelection\) => applySelection\(nextSelection, \{ keepRegionsOpen: true \}\);/);
  const sheet = screen.match(/<MapRegionsSheet[\s\S]*?\/>/)?.[0] ?? '';
  assert.match(sheet, /onSelect=\{selectRegion\}/);
  assert.match(sheet, /onClose=\{\(\) => setIsRegionsSheetOpen\(false\)\}/);
  assert.match(sheet, /onClear=\{clearRegionSelection\}/);
  const clear = screen.match(/const clearRegionSelection = \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
  assert.doesNotMatch(clear, /setIsRegionsSheetOpen/, 'Clear never closed the sheet and still does not');
});

test('the sheet itself has no hidden dismissal: selecting a row calls onSelect only, and X is the one close control', async () => {
  const sheet = await read('components/map/map-regions-sheet.tsx');
  const rows = sheet.slice(sheet.indexOf('function RegionRow'));
  assert.doesNotMatch(rows.slice(0, rows.indexOf('function SheetHeader')), /onClose|onDismiss|router\.|navigate/);
  assert.match(sheet, /accessibilityLabel="Close Region filters"/);
  assert.match(sheet, /onPress=\{onDismiss\}/);
  assert.match(sheet, /onDismiss=\{onClose\}|onDismiss=\{onClose\}/);
});

test('the other filter sheets keep their existing close-on-choice behaviour', async () => {
  const screen = await read('app/(tabs)/map.tsx');
  assert.match(screen, /<MapSavedSheet[\s\S]*?onSelect=\{applySelection\}/);
  assert.match(screen, /const applyActivityTags = [\s\S]*?setIsActivitiesSheetOpen\(false\)/);
});

let failed = 0;
for (const { name, run } of tests) {
  try {
    await run();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}
if (failed) process.exitCode = 1;
