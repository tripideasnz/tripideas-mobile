// Map Places tray animation (Batch 2D).
//
// Automated here: the tray's state rules, its geometry, what the sheet keeps
// mounted, that the map is never replaced, and what the tray handlers do and do
// not touch. NOT covered here (needs the Simulator): how the 220 ms ease-out looks
// and feels, and Reanimated's own mid-flight retargeting on the UI thread.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';

const stubSource = `
const base = BASE_URL;
const stubs = ['react-native', 'react-native-reanimated', 'react-native-worklets', '@expo/vector-icons/MaterialIcons', 'expo-image'];
export async function resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith('stub:')) return next(specifier, { ...context, parentURL: base });
  if (stubs.includes(specifier)) return { shortCircuit: true, url: 'stub:' + specifier };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (!url.startsWith('stub:')) return next(url, context);
  const host = \`import { createElement } from 'react';
    const flat = (s) => (typeof s === 'function' ? s({ pressed: false }) : s);
    export const h = (type) => ({ style, children, onPress, accessibilityLabel, pointerEvents, accessibilityElementsHidden, importantForAccessibility, placeholder, ...rest }) =>
      createElement('div', { 'data-type': type, 'data-label': accessibilityLabel, 'data-pointer': pointerEvents, 'data-a11y-hidden': accessibilityElementsHidden === undefined ? undefined : String(accessibilityElementsHidden), 'data-placeholder': placeholder, 'data-style': JSON.stringify([style].flat(Infinity).map(flat).reduce((a, b) => ({ ...a, ...(b ?? {}) }), {})) }, children);\`;
  const sources = {
    'react-native': host + \`
      import { createElement as ce } from 'react';
      export const View = h('View'); export const Text = h('Text'); export const Pressable = h('Pressable'); export const TextInput = h('TextInput'); export const ScrollView = h('ScrollView');
      export const FlatList = ({ data, renderItem, keyExtractor }) => ce('div', { 'data-type': 'FlatList' }, data.map((item, index) => ce('div', { key: keyExtractor ? keyExtractor(item, index) : index }, renderItem({ item, index }))));
      export const Keyboard = { dismiss() {} }; export const StyleSheet = { hairlineWidth: 1 };\`,
    'react-native-reanimated': host + \`
      export default { View: h('Animated.View') };
      export const Easing = { inOut: (fn) => 'inOut(' + fn + ')', out: (fn) => 'out(' + fn + ')', cubic: 'cubic' };
      export const useSharedValue = (initial) => ({ value: initial });
      export const useAnimatedStyle = (fn) => fn();
      export const withTiming = (to) => to;\`,
    'react-native-worklets': 'export const scheduleOnRN = (fn, ...a) => fn(...a);',
    '@expo/vector-icons/MaterialIcons': \`import { createElement } from 'react'; export default ({ name }) => createElement('i', { 'data-icon': name });\`,
    'expo-image': \`import { createElement } from 'react'; export const Image = () => createElement('img');\`,
  };
  return { format: 'module', shortCircuit: true, source: sources[url.slice(5)] };
}
`;
register(`data:text/javascript,${encodeURIComponent(stubSource.replace('BASE_URL', JSON.stringify(import.meta.url)))}`, import.meta.url);

const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { MapPeekSheet } = await import('./map-peek-sheet.tsx');
const motion = await import('./tray-motion.ts');

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

// ── State rules ─────────────────────────────────────────────────────────────

test('up arrow: minimised → peek → full; down arrow minimises', () => {
  assert.equal(motion.trayAfterUpArrow('minimised'), 'peek');
  assert.equal(motion.trayAfterUpArrow('peek'), 'full');
  assert.equal(motion.trayAfterUpArrow('full'), 'full');
  assert.equal(motion.trayAfterDownArrow(), 'minimised');
});

test('rapid repeated taps always land on one consistent state (the last tap wins, nothing queues)', () => {
  const run = (taps) => taps.reduce((state, tap) => (tap === 'up' ? motion.trayAfterUpArrow(state) : motion.trayAfterDownArrow()), 'peek');
  assert.equal(run(['up', 'up', 'up']), 'full');
  assert.equal(run(['down', 'up', 'down', 'up', 'down']), 'minimised');
  assert.equal(run(['down', 'up']), 'peek');
  assert.equal(run(['down', 'up', 'up']), 'full');
  // The animation target is a pure function of the final state, so reversing mid-flight just retargets.
  for (const state of ['minimised', 'peek', 'full']) {
    assert.equal(motion.sheetProgressTarget(state), state === 'minimised' ? 0 : 1);
    assert.equal(motion.overlayProgressTarget(state), state === 'full' ? 1 : 0);
  }
});

test('timing is 500 ms and the tray height moves linearly in progress between its two rest heights', () => {
  assert.equal(motion.TRAY_ANIMATION_MS, 500);
  assert.equal(motion.sheetHeightAtProgress(0, 289), motion.COLLAPSED_SHEET_HEIGHT);
  assert.equal(motion.sheetHeightAtProgress(1, 289), 289);
  assert.equal(motion.sheetHeightAtProgress(0.5, 289), (64 + 289) / 2);
  let last = -1;
  for (let p = 0; p <= 1; p += 0.1) { const h = motion.sheetHeightAtProgress(p, 289); assert.ok(h > last); last = h; }
});

test('the rest of the screen plans around the settled height, never an in-between value', () => {
  assert.equal(motion.settledSheetHeight('minimised', 289), 64);
  assert.equal(motion.settledSheetHeight('peek', 289), 289);
  assert.equal(motion.settledSheetHeight('full', 300), 300);
});

// ── The sheet itself (rendered) ─────────────────────────────────────────────

const places = [
  { _id: 'a', slug: { current: 'a' }, title: 'Ashby Homestead', subRegion: { name: 'South Auckland' } },
  { _id: 'b', slug: { current: 'b' }, title: 'Arataki Nature Trail', subRegion: { name: 'West Auckland' } },
];
const sheet = (props = {}) => renderToStaticMarkup(createElement(MapPeekSheet, {
  activeFilters: [{ id: 'activity:hike', label: 'Hiking' }], isLoading: false, isMinimised: false, onHandlePress() {}, onMinimise() {},
  onPlacePress() {}, onQueryChange() {}, onRemoveFilter() {}, places, query: '', resultCount: 2, selectedPlaceId: 'b', ...props,
}));
const heightOf = (html) => JSON.parse(html.match(/data-type="Animated\.View"[^>]*data-style="([^"]*)"/)[1].replaceAll('&quot;', '"')).height;

test('the peek and minimised trays render at their two rest heights', () => {
  assert.equal(heightOf(sheet({ isMinimised: false })), 289);
  assert.equal(heightOf(sheet({ isMinimised: true })), 64);
});

test('minimising keeps the list, search and filters mounted (clipped, faded and inert), so nothing resets', () => {
  const peek = sheet({ isMinimised: false });
  const mini = sheet({ isMinimised: true });
  for (const html of [peek, mini]) {
    assert.match(html, /Ashby Homestead/);
    assert.match(html, /Arataki Nature Trail/);
    assert.match(html, /data-placeholder="Search for trip ideas"/);
    assert.match(html, /Hiking/, 'active filters stay');
  }
  assert.match(mini, /data-pointer="none"[^>]*data-a11y-hidden="true"/, 'the clipped body is inert and hidden from VoiceOver');
  assert.match(peek, /data-pointer="auto"[^>]*data-a11y-hidden="false"/);
});

test('the selected Place stays selected through both states', () => {
  for (const isMinimised of [false, true]) {
    const html = sheet({ isMinimised });
    assert.match(html, /data-label="Arataki Nature Trail, selected"/);
    assert.doesNotMatch(html, /Ashby Homestead, selected/);
  }
});

test('arrow controls: labels and which arrow shows are unchanged', () => {
  const peek = sheet({ isMinimised: false });
  assert.match(peek, /data-label="Minimise map tray"/);
  assert.match(peek, /data-label="Open full list view"/);
  const mini = sheet({ isMinimised: true });
  assert.doesNotMatch(mini, /Minimise map tray/);
  assert.match(mini, /data-label="Expand map tray"/);
});

test('the count and the virtualised list are unchanged', async () => {
  assert.match(sheet(), /2 places in view/);
  const source = await read('components/map/map-peek-sheet.tsx');
  for (const prop of [/initialNumToRender=\{6\}/, /windowSize=\{5\}/, /getItemLayout=/, /maxToRenderPerBatch=\{6\}/, /horizontal/, /data=\{places\}/]) assert.match(source, prop);
  assert.doesNotMatch(source, /places\.slice\(|places\.map\(/);
});

test('one shared timing: 500 ms ease-in-out for minimise/expand and for opening and closing the full list', async () => {
  const timing = await read('components/map/tray-timing.ts');
  assert.match(timing, /duration: TRAY_ANIMATION_MS/);
  assert.match(timing, /easing: Easing\.inOut\(Easing\.cubic\)/);
  const [sheetSource, overlay] = await Promise.all([read('components/map/map-peek-sheet.tsx'), read('components/map/map-full-list-overlay.tsx')]);
  assert.equal(sheetSource.match(/TRAY_TIMING_CONFIG/g)?.length, 2, 'imported once, used once');
  assert.equal(overlay.match(/TRAY_TIMING_CONFIG/g)?.length, 2, 'the overlay opens and closes through the same single withTiming call');
  assert.equal(overlay.match(/withTiming\(/g)?.length, 1, 'open and close share one call, so they cannot differ');
  assert.match(timing + sheetSource + overlay, /^(?![\s\S]*\b220\b)/, 'no leftover 220 ms');
});

test('opening the full list: the list mounts first and the slide starts after it is in place', async () => {
  const overlay = await read('components/map/map-full-list-overlay.tsx');
  const mountEffect = overlay.match(/useEffect\(\(\) => \{\s*if \(open\) setMounted\(true\);\s*\}, \[open\]\);/);
  assert.ok(mountEffect, 'a mount effect that only mounts');
  const slideEffect = overlay.match(/useEffect\(\(\) => \{\s*if \(!mounted\) return;\s*progress\.value = withTiming\([\s\S]*?\}, \[open, mounted, progress, unmount\]\);/)?.[0] ?? '';
  assert.ok(slideEffect, 'a separate slide effect that waits for the list to be mounted');
  assert.ok(overlay.indexOf(mountEffect[0]) < overlay.indexOf(slideEffect), 'mount first, slide second');
  assert.doesNotMatch(overlay, /setTimeout|requestAnimationFrame|InteractionManager/, 'sequencing by commit, not by a delay');
});

test('the full list renders a small first window so opening it is cheap, and stays virtualised', async () => {
  const tiles = await read('components/map/map-tile-view.tsx');
  assert.match(tiles, /initialNumToRender=\{4\}/);
  assert.match(tiles, /maxToRenderPerBatch=\{4\}/);
  assert.match(tiles, /windowSize=\{7\}/);
  assert.match(tiles, /data=\{places\}/);
  assert.match(tiles, /numColumns=\{2\}/);
  assert.doesNotMatch(tiles, /places\.slice\(|places\.map\(/);
});

// ── Transition wiring (source) ──────────────────────────────────────────────

test('the sheet animates with Reanimated on the UI thread: one progress value, 500 ms ease-in-out, retargeted not queued', async () => {
  const source = await read('components/map/map-peek-sheet.tsx');
  assert.match(source, /useSharedValue\(/);
  assert.match(source, /progress\.value = withTiming\(/);
  assert.match(source, /progress\.value = withTiming\(\s*sheetProgressTarget\([^)]*\),\s*TRAY_TIMING_CONFIG,/);
  assert.doesNotMatch(source, /Easing\.out|duration: 220/);
  assert.match(source, /useAnimatedStyle\(\(\) => \(\{ height: sheetHeightAtProgress\(progress\.value, expandedHeight\.value\) \}\)\)/);
  assert.match(source, /useAnimatedStyle\(\(\) => \(\{ opacity: progress\.value \}\)\)/);
  assert.match(source, /if \(finished\) scheduleOnRN\(finishTransition\)/, 'only a completed transition reports');
  assert.doesNotMatch(source, /isMinimised \? null/, 'content is no longer unmounted when minimised');
  assert.doesNotMatch(source, /setTimeout|requestAnimationFrame|LayoutAnimation/);
});

test('camera padding follows the settled height only: no per-frame layout feedback', async () => {
  const [map, sheetSource] = await Promise.all([read('app/(tabs)/map.tsx'), read('components/map/map-peek-sheet.tsx')]);
  assert.doesNotMatch(map, /onLayout=\{\(e\) => setPeekSheetHeight/);
  assert.match(map, /onSettledHeight=\{setPeekSheetHeight\}/);
  assert.match(sheetSource, /onSettledHeight\?\.\(|report\?\.\(settledSheetHeight\(/);
  // Unchanged consumers: padding and marker reveal still read the same state.
  assert.equal(map.match(/peekSheetHeight > 0 \? peekSheetHeight : PEEK_SHEET_FALLBACK/g)?.length, 3);
});

test('MapLibre stays mounted in every tray state: the full list is an overlay, not a replacement', async () => {
  const map = await read('app/(tabs)/map.tsx');
  assert.doesNotMatch(map, /if \(trayState === 'full'\) \{\s*return/, 'no early return that swaps the screen tree');
  assert.equal(map.match(/<MapLibreMap\b/g)?.length, 1, 'one map, rendered unconditionally');
  assert.match(map, /<MapFullListOverlay open=\{trayState === 'full'\}>\s*<MapTileView/);
  assert.doesNotMatch(map, /setIsMapReady\(false\)/, 'no re-initialisation handshake is needed any more');
  assert.equal(map.match(/setIsMapReady\(/g)?.length, 1, 'only ever called by the map\'s own load event');
  assert.match(map, /onDidFinishLoadingMap=\{\(\) => setIsMapReady\(true\)\}/);
  const overlay = await read('components/map/map-full-list-overlay.tsx');
  assert.match(overlay, /translateY: \(1 - progress\.value\) \* height/);
  assert.match(overlay, /open \? 1 : 0,\s*TRAY_TIMING_CONFIG,/);
  assert.doesNotMatch(overlay, /Easing\.out|duration: 220/);
  assert.match(overlay, /if \(finished && !open\) scheduleOnRN\(unmount\)/, 'unmounts only after sliding fully away, and not if reopened');
});

test('tray handlers change the tray only: no filters, query, selection, camera or navigation', async () => {
  const map = await read('app/(tabs)/map.tsx');
  assert.match(map, /onHandlePress=\{\(\) => setTrayState\(trayAfterUpArrow\)\}/);
  assert.match(map, /onMinimise=\{\(\) => setTrayState\(trayAfterDownArrow\(\)\)\}/);
  assert.match(map, /onCollapse=\{\(\) => setTrayState\('peek'\)\}/);
  for (const file of ['components/map/map-peek-sheet.tsx', 'components/map/map-full-list-overlay.tsx', 'components/map/tray-motion.ts']) {
    assert.doesNotMatch(await read(file), /expo-router|router\.|setSelection|setSelectedActivityTagIds|cameraRef|fitBounds|easeTo/, file);
  }
});

test('existing behaviour is untouched: marker and thumbnail taps, place opening and filter handlers', async () => {
  const map = await read('app/(tabs)/map.tsx');
  assert.match(map, /tapPlace\(place, 'marker'\);/);
  assert.match(map, /onPlacePress=\{handleThumbnailPress\}/);
  // C5C: Clear now only empties a sheet's pending choice, so the Map's live clear handlers are gone;
  // Apply is where a filter reaches the Map, and it still returns the tray to its peek state.
  assert.match(map, /const applyRegionSelection = [\s\S]*?setTrayState\('peek'\)/);
  assert.match(map, /const applySelection = [\s\S]*?setTrayState\('peek'\)/);
  assert.match(map, /const applyActivityTags = [\s\S]*?setTrayState\('peek'\)/);
});

let failed = false;
for (const { name, run } of tests) {
  try { await run(); console.log(`✓ ${name}`); } catch (error) { failed = true; console.error(`✗ ${name}`); console.error(error); }
}
if (failed) process.exitCode = 1;
