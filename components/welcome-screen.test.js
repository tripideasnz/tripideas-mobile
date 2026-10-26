// Batch 2F: the welcome screen's Discover and Map entry points.
//
// Automated here: the destinations, the rendered buttons (equal size, labels, icons,
// accessibility), what tapping does (one `replace`, repeat taps ignored), the resulting
// root-stack history (using React Navigation's real StackRouter), and that the existing
// branding/text/background are untouched. How it looks is for the Simulator.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import { StackActions, StackRouter } from '@react-navigation/routers';

const stubSource = `
const base = BASE_URL;
const stubs = ['react-native', 'expo-image'];
export async function resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith('stub:')) return next(specifier, { ...context, parentURL: base });
  if (stubs.includes(specifier)) return { shortCircuit: true, url: 'stub:' + specifier };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (!url.startsWith('stub:')) return next(url, context);
  const sources = {
    'react-native': \`import { createElement } from 'react';
      const flat = (s) => (typeof s === 'function' ? s({ pressed: false }) : s);
      const h = (type) => ({ style, children, accessibilityLabel, accessibilityHint, accessibilityRole, onPress, accessible }) => {
        if (onPress && accessibilityLabel) (globalThis.__presses ??= {})[accessibilityLabel] = onPress;
        return createElement('div', { 'data-type': type, 'data-label': accessibilityLabel, 'data-hint': accessibilityHint, 'data-role': accessibilityRole, 'data-accessible': accessible === undefined ? undefined : String(accessible), 'data-style': JSON.stringify([style].flat(Infinity).map(flat).reduce((a, b) => ({ ...a, ...(b ?? {}) }), {})) }, children);
      };
      export const View = h('View'); export const Text = h('Text'); export const Pressable = h('Pressable');
      export const useWindowDimensions = () => ({ width: globalThis.__screenWidth ?? 440, height: 900 });\`,
    'expo-image': \`import { createElement } from 'react'; export const Image = ({ source, style, accessible, contentFit }) => createElement('img', { 'data-source': JSON.stringify(source), 'data-accessible': String(accessible), 'data-fit': contentFit, 'data-style': JSON.stringify(style) });\`,
  };
  return { format: 'module', shortCircuit: true, source: sources[url.slice(5)] };
}
`;
register(`data:text/javascript,${encodeURIComponent(stubSource.replace('BASE_URL', JSON.stringify(import.meta.url)))}`, import.meta.url);

// Metro turns require('...png') into an asset id; here it just names the file.
globalThis.require = (path) => ({ asset: path });
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { WelcomeEntryButtons, WELCOME_BODY_TEXT_STYLE, WELCOME_BUTTON_GAP, WELCOME_BUTTON_MAX_SIZE, WELCOME_ICON_ASPECT, WELCOME_ICONS_GAP, WELCOME_LABEL_GAP, WELCOME_LOGO_MARGIN_BOTTOM, WELCOME_SIDE_PADDING, WELCOME_TITLE_MARGIN_BOTTOM, WELCOME_TEXT_TOP_FRACTION, welcomeButtonWidth, welcomeButtonsBlockHeight, welcomeTextTop } = await import('./welcome-entry-buttons.tsx');
const { WELCOME_DESTINATIONS, openFromWelcome } = await import('./welcome-navigation.ts');
const { createNavigationGuard } = await import('./map/place-navigation.ts');

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

const html = (screenWidth = 440) => { globalThis.__screenWidth = screenWidth; globalThis.__presses = {}; return renderToStaticMarkup(createElement(WelcomeEntryButtons, { onOpen: (destination) => globalThis.__opened.push(destination.key) })); };
globalThis.__opened = [];
const styleOfButton = (markup, label) => JSON.parse(markup.match(new RegExp(`data-label="${label}"[^>]*data-style="([^"]*)"`))[1].replaceAll('&quot;', '"'));
const images = (markup) => [...markup.matchAll(/<img data-source="([^"]*)" data-accessible="([^"]*)" data-fit="([^"]*)" data-style="([^"]*)"/g)].map((m) => ({ accessible: m[2], fit: m[3], source: JSON.parse(m[1].replaceAll('&quot;', '"')), style: JSON.parse(m[4].replaceAll('&quot;', '"')) }));

test('there are exactly two entry points: Discover and Map, in that order', () => {
  assert.deepEqual(WELCOME_DESTINATIONS.map((d) => [d.key, d.href, d.label]), [['discover', '/discover', 'Discover'], ['map', '/map', 'Map']]);
});

test('Discover goes to the same route the old Start Exploring button used, and Map to the existing Map tab', async () => {
  assert.equal(WELCOME_DESTINATIONS[0].href, '/discover', 'the former Start Exploring destination');
  assert.equal(WELCOME_DESTINATIONS[1].href, '/map');
  const { access } = await import('node:fs/promises');
  await access(new URL('../app/(tabs)/map.tsx', import.meta.url));
  await access(new URL('../app/(tabs)/(discover)/discover.tsx', import.meta.url));
});

test('the buttons use the supplied icon artwork: mountain scene for Discover, New Zealand outline for Map', async () => {
  const markup = html();
  const [discover, map] = images(markup);
  assert.deepEqual(discover.source, { asset: '@/assets/images/welcome-discover.png' });
  assert.deepEqual(map.source, { asset: '@/assets/images/welcome-map.png' });
  const { access } = await import('node:fs/promises');
  await access(new URL('../assets/images/welcome-discover.png', import.meta.url));
  await access(new URL('../assets/images/welcome-map.png', import.meta.url));
  assert.equal(discover.accessible, 'false', 'the image is decoration: the button carries the label');
  assert.equal(map.accessible, 'false');
});

test('both buttons have identical dimensions, larger than the first design (96 pt)', () => {
  const markup = html(440);
  const discover = styleOfButton(markup, 'Discover');
  const map = styleOfButton(markup, 'Map');
  assert.equal(discover.width, map.width);
  assert.equal(discover.height, map.height);
  assert.equal(discover.width, WELCOME_BUTTON_MAX_SIZE);
  assert.ok(discover.width > 96 * 1.5, 'clearly larger than the 96 pt first attempt');
  assert.equal(discover.height, Math.round(WELCOME_BUTTON_MAX_SIZE / WELCOME_ICON_ASPECT), 'the artwork keeps its own proportions');
  const [a, b] = images(markup);
  assert.deepEqual(a.style, b.style, 'the images fill their buttons identically');
  assert.deepEqual(a.style, { height: discover.height, width: discover.width });
});

test('size adapts to the screen: as large as fits up to the maximum, always two equal tiles within the padding', () => {
  for (const [screen, expected] of [[320, 126], [375, 153], [393, 160], [402, 160], [440, 160], [768, 160]]) {
    const width = welcomeButtonWidth(screen);
    assert.equal(width, expected, `${screen} pt wide`);
    assert.ok(2 * width + WELCOME_BUTTON_GAP <= screen - 2 * WELCOME_SIDE_PADDING, `${screen} pt: fits`);
    const markup = html(screen);
    assert.equal(styleOfButton(markup, 'Discover').width, width);
    assert.equal(styleOfButton(markup, 'Map').width, width);
  }
  assert.ok(welcomeButtonWidth(320) >= 44, 'comfortable touch target even on the smallest phone');
});

test('each button has a visible label, accessibility label, role and hint; captions are not read twice', () => {
  const markup = html();
  for (const label of ['Discover', 'Map']) {
    assert.match(markup, new RegExp(`data-label="${label}"[^>]*data-role="button"`));
    assert.match(markup, new RegExp(`>${label}<`), 'visible caption');
  }
  assert.match(markup, /data-hint="Opens Discover to browse islands, regions and places\."/);
  assert.match(markup, /data-hint="Opens the map of places\."/);
  assert.equal((markup.match(/<div data-type="Text" data-accessible="false"/g) ?? []).length, 2, 'captions hidden from VoiceOver');
  assert.ok(markup.indexOf('>Discover<') < markup.indexOf('>Map<'), 'Discover first, then Map');
});

test('tapping a button reports that destination', () => {
  globalThis.__opened = [];
  html();
  globalThis.__presses.Discover();
  globalThis.__presses.Map();
  assert.deepEqual(globalThis.__opened, ['discover', 'map']);
});

// ── Navigation ──────────────────────────────────────────────────────────────

const fakeRouter = () => { const calls = []; return { calls, replace: (href) => calls.push(['replace', href]) }; };

test('Discover and Map each navigate with a single replace (never a push)', () => {
  for (const destination of WELCOME_DESTINATIONS) {
    const router = fakeRouter();
    assert.equal(openFromWelcome(router, destination, createNavigationGuard()), true);
    assert.deepEqual(router.calls, [['replace', destination.href]]);
  }
});

test('a double tap navigates once', () => {
  let now = 1000;
  const guard = createNavigationGuard({ now: () => now });
  const router = fakeRouter();
  assert.equal(openFromWelcome(router, WELCOME_DESTINATIONS[0], guard), true);
  now += 50;
  assert.equal(openFromWelcome(router, WELCOME_DESTINATIONS[1], guard), false);
  assert.equal(router.calls.length, 1);
});

test('after entering, the welcome screen is gone from the root stack: no extra history and no way back to it', () => {
  const routeNames = ['index', '(tabs)', 'place/[slug]'];
  const stack = StackRouter({});
  const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
  const start = { index: 0, key: 'root', preloadedRoutes: [], routeNames, routes: [{ key: 'index-1', name: 'index' }], stale: false, type: 'stack' };
  for (const href of ['/discover', '/map']) {
    // expo-router resolves both to the (tabs) route; `replace` is StackActions.replace.
    const entered = stack.getStateForAction(start, StackActions.replace('(tabs)', { screen: href === '/map' ? 'map' : '(discover)' }), options);
    assert.deepEqual(entered.routes.map((r) => r.name), ['(tabs)'], `${href}: welcome replaced, not stacked`);
    assert.equal(stack.getStateForAction(entered, StackActions.pop(), options), null, `${href}: nothing to go back to, so a swipe cannot reveal the welcome screen`);
  }
  // The previous behaviour (push) would have left the welcome screen underneath.
  const pushed = stack.getStateForAction(start, StackActions.push('(tabs)', {}), options);
  assert.deepEqual(pushed.routes.map((r) => r.name), ['index', '(tabs)']);
});

// ── Typography, layout and artwork (Batch 2F refinement) ────────────────────

test('the labels use exactly the intro text style: same family (the system font), size, colour and line height', async () => {
  const markup = html();
  const labelStyles = [...markup.matchAll(/<div data-type="Text" data-accessible="false" data-style="([^"]*)"/g)].map((m) => JSON.parse(m[1].replaceAll('&quot;', '"')));
  assert.equal(labelStyles.length, 2);
  for (const style of labelStyles) {
    assert.deepEqual(style, { ...WELCOME_BODY_TEXT_STYLE, textAlign: 'center' });
    assert.equal(style.fontFamily, undefined, 'no custom family: the system font, as everywhere else on this page');
  }
  const screen = await read('app/index.tsx');
  assert.match(screen, /<Text style=\{\{ \.\.\.WELCOME_BODY_TEXT_STYLE, maxWidth: 420, textAlign: 'center' \}\}>/, 'the intro paragraph uses the same constant');
  assert.doesNotMatch(screen + (await read('components/welcome-entry-buttons.tsx')), /fontFamily/, 'no font family is set anywhere on the welcome screen');
});

test('the whole text group sits 5% of the screen height lower: the logo starts 27.8% down the screen', () => {
  assert.equal(WELCOME_TEXT_TOP_FRACTION, 0.278);
  assert.equal(Math.round((WELCOME_TEXT_TOP_FRACTION - 0.228) * 1000) / 1000, 0.05, 'from 22.8% (the previous layout on a tall iPhone) to 27.8%');
  assert.equal(welcomeTextTop(956, 59), Math.round(956 * 0.278 - 59));
  assert.equal(welcomeTextTop(852, 59), Math.round(852 * 0.278 - 59));
  assert.ok(welcomeTextTop(667, 20) >= 16, 'never negative or cramped on short screens');
  assert.equal(welcomeTextTop(100, 59), 16);
});

test('the buttons sit a fixed, short distance below the intro text, with their labels', async () => {
  assert.equal(WELCOME_ICONS_GAP, 80, 'down from about 115 pt when the buttons were centred in the leftover space');
  const screen = await read('app/index.tsx');
  assert.match(screen, /<SafeAreaView edges=\{\['top'\]\}/, 'the area runs to the physical bottom of the page');
  const region = screen.match(/<View\s+style=\{\{\s*alignItems: 'center',\s*flex: 1,\s*justifyContent: 'flex-start',\s*minHeight: welcomeButtonsBlockHeight\(width\) \+ WELCOME_ICONS_GAP \+ 32,\s*paddingTop: WELCOME_ICONS_GAP,\s*width: '100%',\s*\}\}>\s*<WelcomeEntryButtons/);
  assert.ok(region, 'the buttons start WELCOME_ICONS_GAP below the text group and never overlap it');
  assert.ok(screen.indexOf(region[0]) > screen.indexOf('cover?.subtitle'), 'the region starts where the intro text ends');
  assert.match(screen, /<ScrollView\s+bounces=\{false\}/, 'content that cannot fit (very large text) scrolls instead of overlapping');
  assert.equal(welcomeButtonsBlockHeight(440), Math.round(160 / WELCOME_ICON_ASPECT) + WELCOME_LABEL_GAP + 26);
});

test('the artwork is genuinely see-through: transparent corners and interior, with the white line work kept', async () => {
  const { readFileSync } = await import('node:fs');
  const { inflateSync } = await import('node:zlib');
  for (const name of ['welcome-discover.png', 'welcome-map.png']) {
    const data = readFileSync(new URL(`../assets/images/${name}`, import.meta.url));
    const width = data.readUInt32BE(16); const height = data.readUInt32BE(20);
    assert.equal(data[25], 6, `${name}: RGBA`);
    let pos = 8; const chunks = [];
    while (pos < data.length) { const length = data.readUInt32BE(pos); const type = data.toString('ascii', pos + 4, pos + 8); if (type === 'IDAT') chunks.push(data.subarray(pos + 8, pos + 8 + length)); pos += 12 + length; }
    const raw = inflateSync(Buffer.concat(chunks)); const stride = width * 4; let rows = []; let prev = Buffer.alloc(stride); let q = 0;
    for (let y = 0; y < height; y += 1) {
      const filter = raw[q]; const line = Buffer.from(raw.subarray(q + 1, q + 1 + stride)); q += 1 + stride;
      for (let i = 0; i < stride; i += 1) {
        const a = i >= 4 ? line[i - 4] : 0; const b = prev[i]; const c = i >= 4 ? prev[i - 4] : 0;
        if (filter === 1) line[i] = (line[i] + a) & 255; else if (filter === 2) line[i] = (line[i] + b) & 255; else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
        else if (filter === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
      }
      rows.push(line); prev = line;
    }
    const alpha = (x, y) => rows[y][x * 4 + 3];
    assert.equal(alpha(0, 0), 0, `${name}: corner is transparent`);
    assert.equal(alpha(width - 1, height - 1), 0);
    let transparent = 0; let solid = 0;
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { const a = alpha(x, y); if (a < 20) transparent += 1; if (a > 220) solid += 1; }
    const total = width * height;
    assert.ok(transparent / total > 0.6, `${name}: the blue behind comes through (${Math.round((transparent / total) * 100)}% transparent)`);
    assert.ok(solid / total > 0.01, `${name}: the white outline and line art are still solid`);
  }
});

test('spacing inside the text group is even and a little looser than before', async () => {
  // Measured on the Simulator with margins 32 and 16: logo to title 60.3 pt, title to intro 26.0 pt
  // between the drawn shapes. The visible gap changes one-for-one with the margin.
  const gap = { logoToTitle: 60.3 - (32 - WELCOME_LOGO_MARGIN_BOTTOM), titleToIntro: 26 + (WELCOME_TITLE_MARGIN_BOTTOM - 16) };
  assert.ok(Math.abs(gap.logoToTitle - gap.titleToIntro) < 1, `visible gaps match (${gap.logoToTitle.toFixed(1)} and ${gap.titleToIntro.toFixed(1)} pt)`);
  assert.ok(gap.logoToTitle > 43.3 && gap.titleToIntro > 43.0, 'looser than the previous 43 pt');
  const screen = await read('app/index.tsx');
  assert.match(screen, /marginBottom: WELCOME_LOGO_MARGIN_BOTTOM/);
  assert.match(screen, /marginBottom: WELCOME_TITLE_MARGIN_BOTTOM/);
  assert.match(screen, /marginTop: welcomeTextTop\(height, insets\.top\)/, 'the group still starts at the same place, so it only grows downward');
});

// ── Unchanged parts of the welcome screen ───────────────────────────────────

test('the welcome screen keeps its branding, copy, background and overlay; Start Exploring is gone', async () => {
  const screen = await read('app/index.tsx');
  assert.match(screen, /<BrandLogo\s+tone="light"/);
  assert.match(screen, /cover\?\.title \?\? 'Welcome to TripIdeas\.nz'/);
  assert.match(screen, /cover\?\.subtitle \?\? cover\?\.fallbackSubtitle \?\? 'Find memorable places, regions, and trip ideas around New Zealand\.'/);
  assert.match(screen, /source=\{\{ uri: cover\.backgroundUrl \}\}/);
  assert.match(screen, /backgroundColor: 'rgba\(0, 0, 0, 0\.42\)'/);
  assert.match(screen, /<Stack\.Screen options=\{\{ headerShown: false \}\} \/>/);
  assert.match(screen, /sanityClient\s*\.fetch<CoverResponse \| null>\(COVER_QUERY\)/);
  assert.doesNotMatch(screen, /Start Exploring|<Link /);
  // The buttons sit directly beneath the introductory text.
  assert.ok(screen.indexOf("cover?.subtitle") < screen.indexOf('<WelcomeEntryButtons'));
  assert.match(screen, /<WelcomeEntryButtons onOpen=\{\(destination\) => openFromWelcome\(router, destination\)\} \/>/);
});

test('the welcome files only use existing navigation and icons: no new dependency, no auth or screen state touched', async () => {
  const files = await Promise.all(['app/index.tsx', 'components/welcome-entry-buttons.tsx', 'components/welcome-navigation.ts'].map(read));
  const source = files.join('\n');
  const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(imports)].sort(), [
    '@/components/brand-logo', '@/components/map/place-navigation', '@/components/welcome-entry-buttons', '@/components/welcome-navigation',
    '@/sanity/client', '@/sanity/queries', '@/sanity/types', 'expo-image', 'expo-router', 'react', 'react-native', 'react-native-safe-area-context',
  ].sort(), 'only modules the app already uses');
  assert.doesNotMatch(source, /@\/auth|useSession|AsyncStorage|useMyTrips|useSavedPlaces/);
});

let failed = false;
for (const { name, run } of tests) {
  try { await run(); console.log(`✓ ${name}`); } catch (error) { failed = true; console.error(`✗ ${name}`); console.error(error); }
}
if (failed) process.exitCode = 1;
