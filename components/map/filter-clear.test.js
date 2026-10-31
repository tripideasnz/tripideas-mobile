// C5C (was Batch 2A): the Regions and Activities filters share one header and one Clear, and the shared back button.
//
// The two sheets are rendered to static markup (react-dom/server) with the React
// Native modules replaced by thin host stand-ins, so visibility rules are checked
// on the rendered output, not just the source.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const { chooseRegion, clearPendingActivities, clearPendingRegions, toggleActivity } = await import('./filter-pending.ts');

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

const activities = [{ _id: 's1', name: 'Walks', tags: [{ _id: 'a', name: 'Hike' }, { _id: 'b', name: 'Swim' }] }];
const press = (label) => globalThis.__presses[label]();
const activitiesHtml = (selectedTagIds, handlers = {}) => {
  globalThis.__presses = {};
  return renderToStaticMarkup(createElement(MapActivitiesSheet, { activities, isLoading: false, onApply() {}, onCancel() {}, selectedTagIds, visible: true, ...handlers }));
};
const nav = { north: { _id: 'n', name: 'North Island', regions: [] } };
const regionsHtml = (selection, handlers = {}) => {
  globalThis.__presses = {};
  return renderToStaticMarkup(createElement(MapRegionsSheet, { isLoading: false, navigation: nav, onApply() {}, onCancel() {}, selection, visible: true, ...handlers }));
};

// ── One header, one Clear ───────────────────────────────────────────────────

const REGION = { label: 'Fiordland', regionId: 'r', type: 'region' };
const SUBREGION = { label: 'Te Anau', subRegionId: 's', type: 'subregion' };
const both = () => [['Regions', regionsHtml(REGION)], ['Activities', activitiesHtml(['a'])]];
const headerOf = (html) => html.slice(0, html.indexOf('>Clear<'));

test('both filters have the same header: Cancel on the left, the title in the centre, Apply on the right, and no X', () => {
  for (const [title, html] of both()) {
    const cancel = html.indexOf('data-label="Cancel"');
    const heading = html.indexOf(`>${title}<`);
    const apply = html.indexOf('data-label="Apply"');
    assert.ok(cancel > 0 && cancel < heading && heading < apply, `${title}: Cancel, title, Apply in that order`);
    assert.doesNotMatch(html, /data-icon="close"|Close Region filters|Close without applying|Apply filters/, `${title}: no X and no old labels`);
  }
});

test('the two headers are identical apart from the title and Clear\'s spoken label (one shared frame)', () => {
  const normalise = (html, title, label) => headerOf(html).replace(`>${title}<`, '>TITLE<').replace(label, 'CLEAR_LABEL');
  assert.equal(
    normalise(regionsHtml(REGION), 'Regions', 'Clear region selection'),
    normalise(activitiesHtml(['a']), 'Activities', 'Clear all selected activities')
  );
  assert.match(headerOf(regionsHtml(REGION)), /data-style="[^"]*&quot;color&quot;:&quot;#0080C8&quot;[^"]*&quot;fontSize&quot;:17/, 'Cancel and Apply share one text style');
  for (const source of ['map-regions-sheet.tsx', 'map-activities-sheet.tsx']) {
    // Neither sheet builds its own header any more.
    assert.doesNotMatch(readFileSync(new URL(`./${source}`, import.meta.url), 'utf8'), /<Modal|presentationStyle|accessibilityLabel="Apply/, source);
  }
});

test('Clear sits right-aligned directly below the header, labelled "Clear" in both filters (never "Clear All")', () => {
  for (const [title, html] of both()) {
    const apply = html.indexOf('data-label="Apply"');
    const clear = html.indexOf('>Clear<');
    assert.ok(apply > 0 && clear > apply, `${title}: Clear comes after the header`);
    const row = html.slice(apply, clear);
    assert.match(row, /&quot;alignItems&quot;:&quot;flex-end&quot;/, `${title}: right-aligned`);
    assert.doesNotMatch(html, /Clear All|>Clear all/, `${title}: the label is Clear`);
    assert.equal(html.match(/>Clear</g).length, 1, `${title}: one Clear`);
  }
});

test('Apply is available with nothing selected, and commits exactly what is pending', () => {
  const regions = [];
  regionsHtml({ type: 'all' }, { onApply: (selection) => regions.push(selection) });
  press('Apply');
  assert.deepEqual(regions, [{ type: 'all' }], 'applying an empty Regions selection is allowed');
  const tags = [];
  activitiesHtml([], { onApply: (ids) => tags.push(ids) });
  press('Apply');
  assert.deepEqual(tags, [[]], 'applying an empty Activities selection is allowed');
  const applied = [];
  activitiesHtml(['a', 'b'], { onApply: (ids) => applied.push(ids) });
  press('Apply');
  assert.deepEqual(applied, [['a', 'b']], 'opening stages the applied activities, and Apply passes them on');
});

test('Cancel only closes: it never applies, and there is no other path out that applies', () => {
  const calls = [];
  regionsHtml(REGION, { onApply: () => calls.push('apply'), onCancel: () => calls.push('cancel') });
  press('Cancel');
  activitiesHtml(['a'], { onApply: () => calls.push('apply'), onCancel: () => calls.push('cancel') });
  press('Cancel');
  assert.deepEqual(calls, ['cancel', 'cancel']);
});

test('Clear is dimmed and inert when nothing is pending, live when something is, and keeps its place either way', () => {
  const state = (html, label) => JSON.parse(html.match(new RegExp(`data-label="${label}" data-style="([^"]*)"`))[1].replaceAll('&quot;', '"'));
  assert.equal(state(regionsHtml({ type: 'all' }), 'Clear region selection').opacity, 0.35);
  assert.equal(state(regionsHtml({ type: 'favourites' }), 'Clear region selection').opacity, 0.35, 'a saved scope is not a region');
  assert.equal(state(regionsHtml(REGION), 'Clear region selection').opacity, 1);
  assert.equal(state(regionsHtml(SUBREGION), 'Clear region selection').opacity, 1);
  assert.equal(state(activitiesHtml([]), 'Clear all selected activities').opacity, 0.35);
  assert.equal(state(activitiesHtml(['a']), 'Clear all selected activities').opacity, 1);
  assert.match(activitiesHtml([]), />Clear</, 'still rendered, so the layout does not jump');
});

test('Clear acts on the pending selection only: it neither applies nor closes, and Cancel afterwards restores the applied filter', async () => {
  const calls = [];
  regionsHtml(REGION, { onApply: () => calls.push('apply'), onCancel: () => calls.push('cancel') });
  press('Clear region selection');
  activitiesHtml(['a'], { onApply: () => calls.push('apply'), onCancel: () => calls.push('cancel') });
  press('Clear all selected activities');
  assert.deepEqual(calls, [], 'Clear tells the Map nothing and does not close the sheet');
  // The sheets stage on their own state; the Map no longer has a live "clear" for either.
  const map = await read('app/(tabs)/map.tsx');
  assert.doesNotMatch(map, /clearActivityFilters|clearRegionSelection|onClearAll|onClear=/);
  for (const source of ['map-regions-sheet.tsx', 'map-activities-sheet.tsx']) {
    assert.doesNotMatch(readFileSync(new URL(`./${source}`, import.meta.url), 'utf8'), /onClearAll|onClose\b/, source);
  }
});

test('the pending transitions behind Clear: Regions keeps saved scopes, Activities empties everything', () => {
  assert.deepEqual(clearPendingRegions(REGION), { type: 'all' });
  assert.deepEqual(clearPendingRegions(SUBREGION), { type: 'all' });
  const favourites = { type: 'favourites' };
  assert.equal(clearPendingRegions(favourites), favourites);
  assert.deepEqual(clearPendingActivities(), []);
  assert.deepEqual(clearRegionScope(REGION), { type: 'all' });
  for (const kept of [{ type: 'all' }, { type: 'favourites' }, { label: 'T', tripId: 't', type: 'trip' }]) {
    assert.equal(clearRegionScope(kept), kept, `${kept.type} returned unchanged`);
  }
  assert.deepEqual(toggleActivity(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(chooseRegion({ type: 'all' }, REGION), REGION);
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
