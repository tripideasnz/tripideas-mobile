// C5C: Regions and Activities follow one flow, Open → Select or Clear → Apply or Cancel, with their own
// selection rules (one region, many activities). Choices are pending inside the sheet and reach the Map
// only on Apply; Cancel discards them.
//
// The sheets' real transitions (filter-pending.ts) and the Map's real equality rule are driven through a
// small model of one filter "visit"; the Map screen's wiring is guarded by reading its source. The look of
// the sheets and the taps themselves are verified in the Simulator.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { chooseRegion, clearPendingActivities, clearPendingRegions, toggleActivity } from './filter-pending.ts';
import { isSameActivitySelection, isSameSelection } from './map-selection.ts';

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

const NORTH = { label: 'Northland', regionId: 'r1', type: 'region' };
const WEST = { label: 'West Coast', regionId: 'r2', type: 'region' };
const BAY = { label: 'Bay', subRegionId: 's1', type: 'subregion' };
const ALL = { type: 'all' };

/**
 * One filter and its Map. `applied` is what the Map is showing; `pending` exists only while the sheet is open.
 * open/choose/clear/apply/cancel use the sheets' real transitions and the Map's real "changed?" rule.
 */
function regionsFilter(initial = ALL) {
  const f = {
    applied: initial,
    mapUpdates: 0,
    open: false,
    pending: null,
    openSheet() { f.open = true; f.pending = f.applied; },
    choose(next) { f.pending = chooseRegion(f.pending, next); },
    clear() { f.pending = clearPendingRegions(f.pending); },
    apply() {
      f.open = false;
      if (!isSameSelection(f.applied, f.pending)) { f.applied = f.pending; f.mapUpdates += 1; }
      f.pending = null;
    },
    cancel() { f.open = false; f.pending = null; },
  };
  return f;
}
function activitiesFilter(initial = []) {
  const f = {
    applied: initial,
    mapUpdates: 0,
    open: false,
    pending: null,
    openSheet() { f.open = true; f.pending = [...f.applied]; },
    toggle(id) { f.pending = toggleActivity(f.pending, id); },
    clear() { f.pending = clearPendingActivities(); },
    apply() {
      f.open = false;
      if (!isSameActivitySelection(f.applied, f.pending)) { f.applied = f.pending; f.mapUpdates += 1; }
      f.pending = null;
    },
    cancel() { f.open = false; f.pending = null; },
  };
  return f;
}

// 1. Opening initialises the pending state from the applied state.
test('opening each filter stages the applied selection', () => {
  const r = regionsFilter(NORTH);
  r.openSheet();
  assert.deepEqual(r.pending, NORTH);
  const a = activitiesFilter(['x', 'y']);
  a.openSheet();
  assert.deepEqual(a.pending, ['x', 'y']);
  a.pending.push('z'); // the staged copy is not the applied array
  assert.deepEqual(a.applied, ['x', 'y']);
});

// 2. Changing selections does not update the map.
test('choosing, switching and clearing change nothing on the Map until Apply', () => {
  const r = regionsFilter();
  r.openSheet(); r.choose(NORTH); r.choose(WEST); r.choose(BAY); r.clear(); r.choose(NORTH);
  assert.deepEqual(r.applied, ALL);
  assert.equal(r.mapUpdates, 0);
  const a = activitiesFilter();
  a.openSheet(); a.toggle('a'); a.toggle('b'); a.toggle('a'); a.clear(); a.toggle('c');
  assert.deepEqual(a.applied, []);
  assert.equal(a.mapUpdates, 0);
  assert.equal(r.open && a.open, true, 'both sheets are still open after every change');
});

// 3. Apply commits and closes.
test('Apply commits everything pending together and closes', () => {
  const r = regionsFilter();
  r.openSheet(); r.choose(NORTH); r.choose(WEST);
  r.apply();
  assert.deepEqual(r.applied, WEST);
  assert.equal(r.open, false);
  assert.equal(r.mapUpdates, 1);
  const a = activitiesFilter();
  a.openSheet(); a.toggle('a'); a.toggle('b'); a.toggle('c'); a.toggle('b');
  a.apply();
  assert.deepEqual(a.applied, ['a', 'c'], 'all pending activities arrive together');
  assert.equal(a.open, false);
  assert.equal(a.mapUpdates, 1);
});

// 4. Cancel discards and closes.
test('Cancel discards the pending changes and closes, leaving the applied filter as it was', () => {
  const r = regionsFilter(NORTH);
  r.openSheet(); r.choose(WEST);
  r.cancel();
  assert.deepEqual(r.applied, NORTH);
  assert.equal(r.open, false);
  assert.equal(r.mapUpdates, 0);
  const a = activitiesFilter(['a']);
  a.openSheet(); a.toggle('b'); a.toggle('a');
  a.cancel();
  assert.deepEqual(a.applied, ['a']);
  assert.equal(a.mapUpdates, 0);
  // Reopening starts from the applied state again, not from the discarded one.
  a.openSheet();
  assert.deepEqual(a.pending, ['a']);
});

// 5. Clear then Apply removes the filter.
test('Clear followed by Apply removes the filter', () => {
  const r = regionsFilter(NORTH);
  r.openSheet(); r.clear();
  assert.deepEqual(r.applied, NORTH, 'Clear alone does not touch the Map');
  assert.equal(r.open, true, 'and does not close the sheet');
  r.apply();
  assert.deepEqual(r.applied, ALL);
  const a = activitiesFilter(['a', 'b']);
  a.openSheet(); a.clear();
  assert.deepEqual(a.applied, ['a', 'b']);
  assert.equal(a.open, true);
  a.apply();
  assert.deepEqual(a.applied, []);
});

// 6. Clear then Cancel preserves the filter.
test('Clear followed by Cancel keeps the previously applied filter', () => {
  const r = regionsFilter(BAY);
  r.openSheet(); r.clear(); r.cancel();
  assert.deepEqual(r.applied, BAY);
  const a = activitiesFilter(['a', 'b']);
  a.openSheet(); a.clear(); a.cancel();
  assert.deepEqual(a.applied, ['a', 'b']);
  assert.equal(r.mapUpdates + a.mapUpdates, 0);
});

// 7. Regions stays single-select.
test('Regions is one region or sub-region at a time: another replaces it, the same one again clears it', () => {
  const r = regionsFilter();
  r.openSheet();
  r.choose(NORTH);
  assert.deepEqual(r.pending, NORTH);
  r.choose(WEST);
  assert.deepEqual(r.pending, WEST, 'replaced, not added');
  r.choose(BAY);
  assert.deepEqual(r.pending, BAY, 'a sub-region replaces a region');
  r.choose(BAY);
  assert.deepEqual(r.pending, ALL, 'choosing it again deselects');
  // A saved scope is replaced by a chosen region, as before; Clear leaves a saved scope alone.
  const saved = { type: 'favourites' };
  assert.deepEqual(chooseRegion(saved, NORTH), NORTH);
  assert.equal(clearPendingRegions(saved), saved);
});

// 8. Activities stays multi-select.
test('Activities is any number at once, each toggling independently', () => {
  assert.deepEqual(toggleActivity([], 'a'), ['a']);
  assert.deepEqual(toggleActivity(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggleActivity(['a', 'b'], 'a'), ['b']);
  assert.deepEqual(toggleActivity(['a', 'b', 'c'], 'b'), ['a', 'c']);
  const input = ['a'];
  toggleActivity(input, 'b');
  assert.deepEqual(input, ['a'], 'the staged array is never mutated');
});

test('Apply with nothing changed just closes: no Map update, no refit', () => {
  const r = regionsFilter(NORTH);
  r.openSheet(); r.choose(WEST); r.choose(WEST); r.choose(NORTH);
  r.apply();
  assert.equal(r.mapUpdates, 0);
  const a = activitiesFilter(['a', 'b']);
  a.openSheet(); a.toggle('b'); a.toggle('b');
  a.apply();
  assert.equal(a.mapUpdates, 0);
  assert.ok(isSameActivitySelection(['a', 'b'], ['b', 'a']), 'order does not matter');
  assert.ok(!isSameActivitySelection(['a'], ['a', 'b']));
});

// The Map screen's side of it.
test('the Map applies on Apply only, closes on Apply and Cancel, and never changes filters live from either sheet', async () => {
  const map = await read('app/(tabs)/map.tsx');
  const regions = map.match(/<MapRegionsSheet[\s\S]*?\/>/)?.[0] ?? '';
  const activities = map.match(/<MapActivitiesSheet[\s\S]*?\/>/)?.[0] ?? '';
  assert.match(regions, /onApply=\{applyRegionSelection\}/);
  assert.match(regions, /onCancel=\{\(\) => setIsRegionsSheetOpen\(false\)\}/);
  assert.doesNotMatch(regions, /\bonSelect=|\bonClear=|\bonClose=/, 'no live path from the Regions sheet');
  assert.match(activities, /onApply=\{applyActivityTags\}/);
  assert.match(activities, /onCancel=\{\(\) => setIsActivitiesSheetOpen\(false\)\}/);
  assert.doesNotMatch(activities, /\bonClearAll=|\bonClose=|\bonSelect=|\bonClear=/, 'no live path from the Activities sheet');
  const applyRegion = map.match(/const applyRegionSelection = [\s\S]*?\n  \};/)?.[0] ?? '';
  assert.match(applyRegion, /setIsRegionsSheetOpen\(false\);\s*if \(isSameSelection\(selection, nextSelection\)\) return;/);
  assert.match(applyRegion, /setSelection\(nextSelection\)/, 'commits the pending result as it is (no second toggle)');
  assert.doesNotMatch(applyRegion, /resolveSelection/);
  assert.match(applyRegion, /setIsFitPending\(true\)/);
  const applyTags = map.match(/const applyActivityTags = [\s\S]*?\n  \};/)?.[0] ?? '';
  assert.match(applyTags, /setIsActivitiesSheetOpen\(false\);\s*if \(isSameActivitySelection\(selectedActivityTagIds, tagIds\)\) return;/);
  assert.match(applyTags, /setSelectedActivityTagIds\(tagIds\)/);
  assert.match(applyTags, /setIsFitPending\(true\)/);
});

test('the Saved sheet is outside this change and keeps applying as soon as a row is chosen', async () => {
  const map = await read('app/(tabs)/map.tsx');
  assert.match(map, /<MapSavedSheet[\s\S]*?onSelect=\{applySelection\}/);
  const apply = map.match(/const applySelection = \(nextSelection: MapContentSelection\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
  assert.match(apply, /setSelection\(resolveSelection\(selection, nextSelection\)\)/);
  assert.match(apply, /setIsRegionsSheetOpen\(false\)/);
});

// 9. Expand/collapse is intact and independent of the pending selection.
test('expanding and collapsing groups is its own state: kept across choices, Cancel and Apply', async () => {
  const regions = await read('components/map/map-regions-sheet.tsx');
  const activities = await read('components/map/map-activities-sheet.tsx');
  for (const [name, source, state] of [['Regions', regions, 'expandedRegionIds'], ['Activities', activities, 'expandedSuperTagIds']]) {
    assert.match(source, new RegExp(`const \\[${state}, set\\w+\\] = useState<string\\[\\]>\\(\\[\\]\\)`), `${name}: its own state`);
    const reset = source.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[visible\]\);/)?.[0] ?? '';
    assert.ok(reset, `${name}: staging reset found`);
    assert.doesNotMatch(reset, /expanded/i, `${name}: opening a sheet does not collapse its groups`);
  }
  assert.match(regions, /<FilterExpandToggle[\s\S]*?onToggleRegion\(regionId\)/);
  assert.match(regions, /\{isExpanded \? \(\s*<FilterPanel>/);
  assert.match(activities, /<FilterGroupRow[\s\S]*?setExpandedSuperTagIds/);
  assert.match(activities, /\{isExpanded \? \(\s*<FilterPanel>/);
  // Hierarchies are kept: Island > Region > Sub-region, and Category > Activity.
  assert.ok(regions.indexOf('function IslandSection') < regions.indexOf('function RegionRow') && regions.indexOf('function RegionRow') < regions.indexOf('function SubRegionRow'));
  assert.match(regions, /<SubRegionRow/);
  assert.match(activities, /superTag\.tags/);
});

// 10. Selection, tray and two-stage navigation are unaffected.
test('map marker selection, the Places tray and two-stage navigation are untouched by the filter change', async () => {
  const map = await read('app/(tabs)/map.tsx');
  assert.match(map, /planPlaceTap\(selectedPlaceId, id, source\)/);
  assert.match(map, /tapPlace\(place, 'marker'\);/);
  assert.match(map, /tapPlace\(place, 'thumbnail'\)/);
  assert.match(map, /onPress=\{clearSelectedPlace\}/);
  assert.match(map, /selectedPlaceId=\{selectedPlaceId\}/);
  assert.match(map, /nearestPointFeature\(event\.nativeEvent\.features, event\.nativeEvent\.lngLat\)/);
  assert.match(map, /offset=\{\[0, -SELECTED_MARKER_LABEL_GAP\]\}/);
  // The two-stage interaction block still never touches filters or the sheets.
  const start = map.indexOf('const selectedMarkerObscuredEdges');
  const end = map.indexOf('const isLoading =');
  assert.doesNotMatch(map.slice(start, end), /applyRegionSelection|applyActivityTags|setIsRegionsSheetOpen|setIsActivitiesSheetOpen|setSelection\(|setSelectedActivityTagIds/);
  for (const file of ['components/map/map-peek-sheet.tsx', 'components/map/use-map-selection.ts', 'components/map/marker-hit.ts', 'components/map/place-navigation.ts']) {
    assert.doesNotMatch(await read(file), /filter-sheet|filter-pending|map-regions-sheet|map-activities-sheet/, file);
  }
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
