// Regions: the panel stays open while regions are chosen, switched, cleared or deselected, because
// those choices are pending (C5C): they reach the Map only on Apply, and Cancel discards them. The
// selection rule is unchanged, one region or sub-region at a time. (Written in C5B as "stays open";
// C5B's live-apply path is replaced by pending selection.)
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { chooseRegion } from './filter-pending.ts';
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
  assert.deepEqual(chooseRegion(north, west), west, 'the sheet uses the same rule for its pending choice');
});

test('Clear still only clears a geographical scope', () => {
  assert.deepEqual(clearRegionScope(north), { type: 'all' });
  assert.deepEqual(clearRegionScope(bay), { type: 'all' });
  const favourites = { type: 'favourites' };
  assert.equal(clearRegionScope(favourites), favourites);
});

test('the Regions sheet stays open on every row tap: rows only change its pending choice', async () => {
  const sheet = await read('components/map/map-regions-sheet.tsx');
  const rows = sheet.slice(sheet.indexOf('function IslandSection'));
  assert.doesNotMatch(rows, /onApply|onCancel|onClose|router\.|navigate/, 'a row cannot apply, cancel or navigate');
  assert.match(sheet, /const choose = \(next: MapContentSelection\) => setPending\(\(current\) => chooseRegion\(current, next\)\);/);
  assert.match(sheet, /onApply=\{\(\) => onApply\(pending\)\}/);
  assert.match(sheet, /onCancel=\{onCancel\}/);
  // The only ways out are the frame's Cancel and Apply (and a swipe down, which is Cancel).
  const frame = await read('components/map/filter-sheet.tsx');
  assert.match(frame, /onRequestClose=\{onCancel\}/);
  assert.match(frame, /<HeaderAction label="Cancel" onPress=\{onCancel\} \/>/);
  assert.match(frame, /<HeaderAction label="Apply" onPress=\{onApply\} \/>/);
});

test('the Map tells the Regions sheet nothing until Apply, and the other sheets keep their own behaviour', async () => {
  const screen = await read('app/(tabs)/map.tsx');
  assert.doesNotMatch(screen, /keepRegionsOpen|selectRegion\b/, 'the C5B live path is gone');
  assert.match(screen, /<MapSavedSheet[\s\S]*?onSelect=\{applySelection\}/);
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
