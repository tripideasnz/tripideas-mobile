// Batch 2A: Activities "Clear All", Regions "Clear" and the shared back button.
//
// The two sheets are rendered to static markup (react-dom/server) with the React
// Native modules replaced by thin host stand-ins, so visibility rules are checked
// on the rendered output, not just the source.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';

const stubSource = `
const base = BASE_URL;
const stubs = ['react-native', '@expo/vector-icons/MaterialIcons', '@expo/vector-icons/Ionicons', 'expo-router', 'react-native-safe-area-context'];
export async function resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith('stub:')) return next(specifier, { ...context, parentURL: base });
  if (stubs.includes(specifier)) return { shortCircuit: true, url: 'stub:' + specifier };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (!url.startsWith('stub:')) return next(url, context);
  const name = url.slice(5);
  const host = \`import { createElement } from 'react';
    const flatten = (s) => (typeof s === 'function' ? s({ pressed: false }) : s);
    const h = (type) => ({ style, children, accessibilityLabel, onPress, ...rest }) => { if (onPress && accessibilityLabel) (globalThis.__presses ??= {})[accessibilityLabel] = onPress; return createElement('div', { 'data-type': type, 'data-label': accessibilityLabel, 'data-style': JSON.stringify(flatten(style) ?? {}) }, children); };\`;
  const sources = {
    'react-native': host + \`export const View = h('View'); export const Text = h('Text'); export const Pressable = h('Pressable'); export const ScrollView = h('ScrollView'); export const Modal = ({ children, visible }) => createElement('div', { 'data-type': 'Modal' }, children); export const StyleSheet = { hairlineWidth: 1 }; export const Platform = { get OS() { return globalThis.__platformOS ?? 'ios'; }, get Version() { return globalThis.__platformVersion ?? '26.5'; } };\`,
    '@expo/vector-icons/MaterialIcons': \`import { createElement } from 'react'; export default ({ name }) => createElement('i', { 'data-icon': name });\`,
    '@expo/vector-icons/Ionicons': \`import { createElement } from 'react'; export default ({ name, size, style }) => createElement('i', { 'data-icon': name, 'data-size': size, 'data-style': JSON.stringify(style ?? {}) });\`,
    'expo-router': \`export const useRouter = () => ({ back() {}, canGoBack: () => true, replace() {} });\`,
    'react-native-safe-area-context': \`import { createElement } from 'react'; export const SafeAreaView = ({ children }) => createElement('div', null, children); export const useSafeAreaInsets = () => ({ bottom: 0, left: 0, right: 0, top: 0 });\`,
  };
  return { format: 'module', shortCircuit: true, source: sources[name] };
}
`;
register(`data:text/javascript,${encodeURIComponent(stubSource.replace('BASE_URL', JSON.stringify(import.meta.url)))}`, import.meta.url);

const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { MapActivitiesSheet } = await import('./map-activities-sheet.tsx');
const { MapRegionsSheet } = await import('./map-regions-sheet.tsx');
const { HeaderBackButton } = await import('../ui/header-back-button.tsx');
const { clearRegionScope } = await import('./map-selection.ts');

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

const activities = [{ _id: 's1', name: 'Walks', tags: [{ _id: 'a', name: 'Hike' }, { _id: 'b', name: 'Swim' }] }];
const press = (label) => globalThis.__presses[label]();
const activitiesHtml = (selectedTagIds, handlers = {}) => {
  globalThis.__presses = {};
  return renderToStaticMarkup(createElement(MapActivitiesSheet, { activities, isLoading: false, onApply() {}, onClearAll() {}, onClose() {}, selectedTagIds, visible: true, ...handlers }));
};
const nav = { north: { _id: 'n', name: 'North Island', regions: [] } };
const regionsHtml = (selection, onClear = () => {}) => {
  globalThis.__presses = {};
  return renderToStaticMarkup(createElement(MapRegionsSheet, { isLoading: false, navigation: nav, onClear, onClose() {}, onSelect() {}, selection, visible: true }));
};

// ── Activities ──────────────────────────────────────────────────────────────

test('Activities shows Clear All when Activity filters are applied', () => {
  assert.doesNotMatch(activitiesHtml([]), /Clear All/);
  assert.match(activitiesHtml(['a']), /Clear All/);
  assert.match(activitiesHtml(['a', 'b']), /data-label="Clear all selected activities"/);
});

test('Clear All acts immediately: it clears the applied filters once, without Apply and without closing', () => {
  const calls = [];
  activitiesHtml(['a', 'b'], { onApply: (ids) => calls.push(['apply', ids]), onClearAll: () => calls.push(['clearAll']), onClose: () => calls.push(['close']) });
  press('Clear all selected activities');
  assert.deepEqual(calls, [['clearAll']], 'one immediate action; the sheet is not closed');
});

test('Apply still commits the current selection through onApply', () => {
  const calls = [];
  activitiesHtml(['a'], { onApply: (ids) => calls.push(['apply', ids]), onClearAll: () => calls.push(['clearAll']) });
  press('Apply filters');
  assert.deepEqual(calls, [['apply', ['a']]]);
});

test('after Clear All, X closes without reversing it; a later pick needs Apply and X discards it', async () => {
  const source = await read('components/map/map-activities-sheet.tsx');
  const map = await read('app/(tabs)/map.tsx');
  // Clear All commits through the owner; the staged copy is emptied, never restored.
  assert.match(source, /setPendingTagIds\(\[\]\);\s*onClearAll\(\);/);
  // X only closes: it has no path to onApply or to the applied filters.
  const closeButton = source.match(/accessibilityLabel="Close without applying"[\s\S]*?onPress=\{onClose\}/)?.[0] ?? '';
  assert.ok(closeButton);
  // The Map's close handler only hides the sheet; it does not restore filters.
  assert.match(map, /onClose=\{\(\) => setIsActivitiesSheetOpen\(false\)\}\s*selectedTagIds=\{selectedActivityTagIds\}/);
  // Reopening stages from the applied filters, which are now empty.
  assert.match(source, /if \(visible\) setPendingTagIds\(selectedTagIds\)/);
});

test('X closes without applying or clearing', () => {
  const calls = [];
  activitiesHtml(['a'], { onApply: () => calls.push('apply'), onClearAll: () => calls.push('clearAll'), onClose: () => calls.push('close') });
  press('Close without applying');
  assert.deepEqual(calls, ['close']);
});

test('individual selection stays staged, and reopening reflects the applied filters', async () => {
  const source = await read('components/map/map-activities-sheet.tsx');
  // Toggling a tag only touches pendingTagIds.
  assert.match(source, /setPendingTagIds\(\(current\) =>\s*current\.includes\(tagId\)/);
  assert.equal(source.match(/onApply\(/g)?.length, 1, 'only Apply commits staged picks');
  assert.match(source, /if \(visible\) setPendingTagIds\(selectedTagIds\)/, 'opening resets staging to the applied filters');
  // Clear All drops the staged picks too, so they cannot be restored.
  assert.match(source, /setPendingTagIds\(\[\]\);\s*onClearAll\(\);/);
  assert.doesNotMatch(source, /onSelect|onClear\b|setQuery|selection\b/);
});

test('the Map handler clears only Activities, keeps the sheet open, with no camera or tray change', async () => {
  const map = await read('app/(tabs)/map.tsx');
  const handler = map.match(/const clearActivityFilters = \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
  assert.ok(handler, 'handler found');
  assert.match(handler, /setSelectedActivityTagIds\(\[\]\)/);
  assert.doesNotMatch(handler, /setIsActivitiesSheetOpen/, 'the sheet stays open');
  assert.match(handler, /clearPlaceContext\(\)/);
  assert.doesNotMatch(handler, /setSelection|setQuery|setIsFitPending|cameraRef|fitBounds|setTrayState|setIsMapReady|setIsRegionsSheetOpen/);
  assert.match(map, /onClearAll=\{clearActivityFilters\}/);
  // Apply is unchanged: it still sets tags, fits and closes.
  assert.match(map, /const applyActivityTags = [\s\S]*?setSelectedActivityTagIds\(tagIds\);[\s\S]*?setIsActivitiesSheetOpen\(false\)/);
});

// ── Regions ─────────────────────────────────────────────────────────────────

const REGION = { label: 'Fiordland', regionId: 'r', type: 'region' };

test('Regions Clear shows only for a region or sub-region selection', () => {
  const visible = (selection) => /data-label="Clear region selection"/.test(regionsHtml(selection));
  assert.equal(visible({ type: 'all' }), false);
  assert.equal(visible({ type: 'favourites' }), false);
  assert.equal(visible({ label: 'Trip', tripId: 't', type: 'trip' }), false);
  assert.equal(visible(REGION), true);
  assert.equal(visible({ label: 'Te Anau', subRegionId: 's', type: 'subregion' }), true);
});

test('Regions Clear sits in the header row, top-left, before the title and close control', () => {
  const html = regionsHtml(REGION);
  const clear = html.indexOf('Clear region selection');
  const title = html.indexOf('>Regions<');
  const close = html.indexOf('Close Region filters');
  assert.ok(clear > 0 && clear < title && title < close, 'order: Clear, title, close');
  assert.equal(html.match(/Clear region selection/g).length, 1, 'no standalone Clear row remains');
  assert.doesNotMatch(html, /paddingTop&quot;:10/, 'old standalone row styling is gone');
});

test('Regions Clear fires the dedicated handler immediately and does not close the panel', async () => {
  const calls = [];
  regionsHtml(REGION, () => calls.push('clear'));
  press('Clear region selection');
  assert.deepEqual(calls, ['clear']);
  const source = await read('components/map/map-regions-sheet.tsx');
  assert.doesNotMatch(source.match(/function SheetHeader[\s\S]*$/)?.[0] ?? '', /onClose|Alert/, 'no confirmation and no close inside the header Clear');
});

test('clearRegionScope clears geography only and keeps saved scopes', () => {
  assert.deepEqual(clearRegionScope(REGION), { type: 'all' });
  assert.deepEqual(clearRegionScope({ label: 'T', subRegionId: 's', type: 'subregion' }), { type: 'all' });
  for (const kept of [{ type: 'all' }, { type: 'favourites' }, { label: 'T', tripId: 't', type: 'trip' }]) {
    assert.equal(clearRegionScope(kept), kept, `${kept.type} returned unchanged`);
  }
});

test('the Regions handler is dedicated and leaves Activities, search, camera and sheets alone', async () => {
  const map = await read('app/(tabs)/map.tsx');
  const handler = map.match(/const clearRegionSelection = \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
  assert.ok(handler, 'handler found');
  assert.match(handler, /setSelection\(clearRegionScope\(selection\)\)/);
  assert.match(handler, /clearPlaceContext\(\)/);
  assert.doesNotMatch(handler, /setQuery|setSelectedActivityTagIds|setIsFitPending|cameraRef|fitBounds|setTrayState|setIsRegionsSheetOpen|setIsMapReady|applySelection/);
  assert.match(map, /onClear=\{clearRegionSelection\}/);
  assert.match(map, /const applySelection = [\s\S]*?setQuery\(''\)/, 'applySelection unchanged');
});

// ── Back control ────────────────────────────────────────────────────────────

const back = (props) => renderToStaticMarkup(createElement(HeaderBackButton, props));
const styleOf = (html) => JSON.parse(html.match(/data-style="([^"]*)"/)[1].replaceAll('&quot;', '"'));

test('HeaderBackButton keeps its circle, border and size for every caller', () => {
  const style = styleOf(back({ color: '#1473e6' }));
  assert.equal(style.width, 44);
  assert.equal(style.height, 44);
  assert.equal(style.borderRadius, 22);
  assert.equal(style.backgroundColor, '#ffffff');
  assert.equal(style.borderWidth, 1);
  });

// ── Batch 2B: alignment, definition, size ───────────────────────────────────

const glyph = (html) => ({
  size: Number(html.match(/data-icon="chevron-back" data-size="(\d+)"/)?.[1]),
  style: JSON.parse(html.match(/<i data-icon="chevron-back"[^>]*data-style="([^"]*)"/)[1].replaceAll('&quot;', '"')),
});

test('the back button has a 26 pt chevron, no offset, and a defined 1 pt outline', () => {
  const html = back({});
  const { size, style } = glyph(html);
  assert.equal(size, 26);
  assert.equal(style.transform, undefined);
  const circle = styleOf(html);
  assert.equal(circle.borderWidth, 1);
  assert.equal(circle.borderColor, '#c9c9c4');
  assert.equal(circle.width, 44);
});

let failed = false;
for (const { name, run } of tests) {
  try { await run(); console.log(`✓ ${name}`); } catch (error) { failed = true; console.error(`✗ ${name}`); console.error(error); }
}
if (failed) process.exitCode = 1;
