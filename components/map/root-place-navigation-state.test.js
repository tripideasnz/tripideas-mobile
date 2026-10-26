// The root-stack Place, tested against React Navigation's real routers.
//
// The app is a root Stack whose first screen is the tab navigator ((tabs), holding
// Discover's own stack, Search, Saved, Map and Profile) with the Place pushed above
// it. These tests apply the real StackRouter actions to that state and inspect the
// result: destinations, history, that the tabs underneath are not rebuilt, and that
// the iOS edge swipe (which dispatches StackActions.pop) and the visible back arrow
// (router.back -> GO_BACK) produce the same state.
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { CommonActions, StackActions, StackRouter } from '@react-navigation/routers';

import { backFromPlace, createNavigationGuard, openPlaceFromMap } from './place-navigation.ts';

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

const rootNames = ['index', '(tabs)', 'favourites/index', 'trips/[tripId]', 'notebooks/[notebookId]', 'place/[slug]'];
const router = StackRouter({});
const options = { routeNames: rootNames, routeParamList: {}, routeGetIdList: {} };
let keyCounter = 0;
const route = (name, extra = {}) => ({ key: `${name}-${++keyCounter}`, name, ...extra });

// The (tabs) route carries its nested navigator state; that object's identity is what
// tells us the tabs were left alone (React keeps a screen mounted while its route key
// and nested state are unchanged).
const tabsRoute = (focused, discoverScreens = ['discover']) => route('(tabs)', {
  state: {
    index: ['(discover)', 'search', 'saved', 'map', 'profile'].indexOf(focused),
    key: 'tabs',
    routeNames: ['(discover)', 'search', 'saved', 'map', 'profile'],
    routes: ['(discover)', 'search', 'saved', 'map', 'profile'].map((name) => (
      name === '(discover)'
        ? route(name, { state: { index: discoverScreens.length - 1, key: 'discover-stack', routeNames: discoverScreens, routes: discoverScreens.map((n) => route(n)), stale: false, type: 'stack' } })
        : route(name))),
    stale: false,
    type: 'tab',
  },
});
const stack = (...routes) => ({ index: routes.length - 1, key: 'root', preloadedRoutes: [], routeNames: rootNames, routes, stale: false, type: 'stack' });
const names = (state) => state.routes.map((r) => r.name);
const push = (state, name, params) => router.getStateForAction(state, StackActions.push(name, params), options);
const back = (state) => router.getStateForAction(state, CommonActions.goBack(), options);
const swipe = (state) => router.getStateForAction(state, StackActions.pop(1), options);

for (const [label, focused] of [['Search', 'search'], ['Map', 'map']]) {
  test(`${label} → Place pushes one Place above the tabs; the tabs stay as they were`, () => {
    const tabs = tabsRoute(focused);
    const opened = push(stack(route('index'), tabs), 'place/[slug]', { origin: label.toLowerCase(), slug: 'x' });
    assert.deepEqual(names(opened), ['index', '(tabs)', 'place/[slug]']);
    assert.equal(opened.routes[1], tabs, 'the tabs route object is untouched');
  });

  test(`${label} → Place → Back returns to the same ${label} screen without rebuilding anything`, () => {
    const tabs = tabsRoute(focused);
    const start = stack(route('index'), tabs);
    const returned = back(push(start, 'place/[slug]', { slug: 'x' }));
    assert.deepEqual(names(returned), ['index', '(tabs)']);
    assert.equal(returned.routes[1], tabs, 'same route key and identical nested state, so the screen stays mounted');
    assert.equal(returned.routes[1].state.routes[returned.routes[1].state.index].name, focused === 'search' ? 'search' : 'map');
    assert.equal(returned.routes.length, start.routes.length, 'no duplicate tab or Place instances');
  });

  test(`${label}: the edge swipe and the back arrow give the identical state`, () => {
    const opened = push(stack(route('index'), tabsRoute(focused)), 'place/[slug]', { slug: 'x' });
    assert.deepEqual(swipe(opened), back(opened));
  });
}

test('Discover → Region → Place → Back keeps the whole Discover hierarchy', () => {
  const tabs = tabsRoute('(discover)', ['discover', 'island/[slug]', 'region/[slug]', 'subregion/[slug]']);
  const opened = push(stack(route('index'), tabs), 'place/[slug]', { slug: 'x' });
  const returned = back(opened);
  assert.equal(returned.routes[1], tabs);
  assert.deepEqual(returned.routes[1].state.routes[0].state.routes.map((r) => r.name), ['discover', 'island/[slug]', 'region/[slug]', 'subregion/[slug]']);
  assert.deepEqual(swipe(opened), returned);
});

test('Favourites, Trip and Notebook → Place → Back return to that screen, in place', () => {
  for (const name of ['favourites/index', 'trips/[tripId]', 'notebooks/[notebookId]']) {
    const tabs = tabsRoute('saved');
    const origin = route(name, { params: { tripId: 't1', notebookId: 'n1' } });
    const start = stack(route('index'), tabs, origin);
    const opened = push(start, 'place/[slug]', { origin: name, slug: 'x' });
    assert.deepEqual(names(opened), ['index', '(tabs)', name, 'place/[slug]']);
    const returned = back(opened);
    assert.deepEqual(names(returned), ['index', '(tabs)', name]);
    assert.equal(returned.routes[2], origin, 'the originating screen keeps its params and key');
    assert.deepEqual(swipe(opened), returned);
  }
});

test('a nearby Place opens above the first and Back returns to the first Place', () => {
  const first = route('place/[slug]', { params: { slug: 'a' } });
  const opened = push(stack(route('index'), tabsRoute('search'), first), 'place/[slug]', { slug: 'b' });
  assert.deepEqual(opened.routes.map((r) => r.params?.slug), [undefined, undefined, 'a', 'b']);
  assert.equal(back(opened).routes[2], first);
});

test('repeat taps open one Place: the guarded opener pushes once', () => {
  const pushes = [];
  const fake = { push: (href) => pushes.push(href) };
  const guard = createNavigationGuard();
  assert.equal(openPlaceFromMap(fake, 'milford', guard), true);
  assert.equal(openPlaceFromMap(fake, 'milford', guard), false);
  assert.equal(pushes.length, 1);
});

test('"Show on Trip Ideas map" pops to the existing tabs instead of stacking a second tab navigator', () => {
  const tabs = tabsRoute('search');
  const opened = push(stack(route('index'), tabs), 'place/[slug]', { slug: 'x' });
  const popped = router.getStateForAction(opened, StackActions.popTo('(tabs)', { params: { lat: '1', lng: '2' }, screen: 'map' }), options);
  assert.equal(names(popped).filter((n) => n === '(tabs)').length, 1, 'exactly one tab navigator');
  assert.deepEqual(names(popped), ['index', '(tabs)']);
});

test('a Place opened directly (deep link / cold start) is the only route: pop is impossible and the fallback is used', () => {
  const alone = stack(route('place/[slug]', { params: { slug: 'x' } }));
  assert.equal(back(alone), null, 'the stack cannot pop its only screen');
  const calls = [];
  const fake = { back: () => calls.push('back'), canGoBack: () => false, dismissTo: (h) => calls.push(['dismissTo', h]), replace: (h) => calls.push(['replace', h]) };
  assert.equal(backFromPlace(fake, {}, createNavigationGuard()), 'fallback');
  assert.deepEqual(calls, [['replace', '/discover']], 'never router.back() without history');
});

test('an unknown Place id still renders the Place screen with a header and a safe fallback', async () => {
  const place = await read('app/place/[slug].tsx');
  assert.match(place, /if \(!selectedSlug\)/);
  assert.match(place, /<Stack\.Screen/);
});

test("Expo Router's own route builder finds exactly one Place route, at the root, with the public /place/[slug] path", () => {
  const require = createRequire(import.meta.url);
  const appRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../app');
  const keys = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|jsx?)$/.test(entry)) keys.push(`./${path.relative(appRoot, full).split(path.sep).join('/')}`);
    }
  })(appRoot);
  const context = Object.assign(() => ({ default: () => null }), { id: 'ctx', keys: () => keys, resolve: (key) => key });
  const tree = require('expo-router/build/getRoutes.js').getRoutes(context, { ignoreEntryPoints: true, ignoreRequireErrors: true, skipGenerated: true });
  const found = [];
  (function visit(node, trail) {
    for (const child of node.children ?? []) {
      const next = [...trail, child.route];
      if (/(^|\/)place\/\[slug\]$/.test(child.route ?? '')) found.push(next.join(' > '));
      visit(child, next);
    }
  })(tree, []);
  assert.deepEqual(found, ['place/[slug]'], 'one Place route, directly under the root layout (not inside (tabs) or (discover))');
});

test('no obsolete cross-tab return logic remains anywhere in the app', async () => {
  const helper = await read('components/map/place-navigation.ts');
  assert.doesNotMatch(helper, /returnToOriginTab|returnToMapFromPlace|returnToSearchFromPlace|popPlaceFromStack|PlaceStackNavigation/);
  for (const file of ['app/place/[slug].tsx', 'app/(tabs)/map.tsx', 'app/(tabs)/search.tsx', 'components/place-card.tsx', 'components/place-search.tsx']) {
    assert.doesNotMatch(await read(file), /returnToOriginTab|returnToMapFromPlace|returnToSearchFromPlace|popPlaceFromStack/, file);
  }
  assert.doesNotMatch(helper, /setTimeout|requestAnimationFrame|InteractionManager/, 'no timing workarounds');
});

let failed = false;
for (const { name, run } of tests) {
  try { await run(); console.log(`✓ ${name}`); } catch (error) { failed = true; console.error(`✗ ${name}`); console.error(error); }
}
if (failed) process.exitCode = 1;
