// B2: the shared Trip view renders title, Trip note and Places in the original order with
// their notes, and offers Save to My Trips. The real components are rendered with the native
// modules stubbed and the resolved element tree inspected; how it looks is for the Simulator.
// The route's wiring (navigation, layout registration, provider) is checked statically below.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';

const stubSource = `
const base = BASE_URL;
const stubs = ['react-native', '@/components/place-card', '@/components/ui/show-more-text'];
export async function resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.startsWith('stub:')) return next(specifier, { ...context, parentURL: base });
  if (stubs.includes(specifier)) return { shortCircuit: true, url: 'stub:' + specifier };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (!url.startsWith('stub:')) return next(url, context);
  const sources = {
    'react-native': \`import { createElement } from 'react'; const h = (t) => (p) => createElement(t, p); export const View = h('View'); export const Text = h('Text'); export const Pressable = h('Pressable'); export const ScrollView = h('ScrollView');\`,
    '@/components/place-card': \`import { createElement } from 'react'; export const PlaceCard = (p) => createElement('PlaceCard', p);\`,
    '@/components/ui/show-more-text': \`import { createElement } from 'react'; export const ShowMoreText = (p) => createElement('ShowMoreText', p);\`,
  };
  return { format: 'module', shortCircuit: true, source: sources[url.slice(5)] };
}
`;
register(`data:text/javascript,${encodeURIComponent(stubSource.replace('BASE_URL', JSON.stringify(import.meta.url)))}`, import.meta.url);

const { createElement } = await import('react');
const { SharedTripView } = await import('./shared-trip-view.tsx');

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

const render = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (Array.isArray(node)) return node.map(render).filter((child) => child !== null);
  if (typeof node !== 'object') return node;
  const { type, props } = node;
  if (typeof type === 'function') return render(type(props));
  const kids = render(props.children);
  return { children: kids === null ? [] : [kids].flat(Infinity), props, type };
};
const walk = (tree, visit) => {
  if (!tree || typeof tree !== 'object') return;
  visit(tree);
  tree.children.forEach((child) => walk(child, visit));
};
const find = (tree, predicate) => {
  const found = [];
  walk(tree, (node) => predicate(node) && found.push(node));
  return found;
};
const texts = (tree) => (typeof tree === 'string' || typeof tree === 'number' ? [String(tree)] : (tree?.children ?? []).flatMap(texts));

const trip = {
  note: 'Two weeks around the island',
  places: [
    { note: 'Go early', placeId: 'place-b', title: 'Harbour' },
    { note: '', placeId: 'place-a', title: 'Museum' },
    { note: 'Book ahead', placeId: 'place-c', title: 'Gardens' },
  ],
  title: 'Shared South Island',
};
const cards = [
  { _id: 'place-a', title: 'Museum' },
  { _id: 'place-b', title: 'Harbour' },
];
const view = (overrides = {}) =>
  render(createElement(SharedTripView, {
    isSaving: false,
    message: null,
    onOpenSavedTrip: () => {},
    onSave: () => {},
    placeCards: cards,
    trip,
    ...overrides,
  }));

test('shows the title, place count and Trip note', () => {
  const tree = view();
  const all = texts(tree);
  assert.ok(all.includes('Shared South Island'));
  assert.ok(all.includes('3 places'));
  const note = find(tree, (node) => node.type === 'ShowMoreText');
  assert.equal(note.length, 1);
  assert.equal(note[0].props.value, 'Two weeks around the island');
});

test('lists Places in the original order, using the full card when available', () => {
  const tree = view();
  const order = [];
  walk(tree, (node) => {
    if (node.type === 'PlaceCard') order.push(node.props.place.title);
    if (node.type === 'View' && texts(node).includes('Gardens') && !texts(node).includes('Harbour')) order.push('fallback:Gardens');
  });
  // Harbour (card), Museum (card), Gardens (no card: snapshot title fallback) — snapshot order.
  assert.deepEqual(order.filter((entry) => entry !== undefined).slice(0, 3), ['Harbour', 'Museum', 'fallback:Gardens']);
  const placeCards = find(tree, (node) => node.type === 'PlaceCard');
  assert.ok(placeCards.every((node) => node.props.showSaveButton === false), 'no save-heart in a shared view');
});

test('shows each Place note, and none for an empty note', () => {
  const all = texts(view());
  assert.ok(all.includes('Go early'));
  assert.ok(all.includes('Book ahead'));
  assert.equal(all.filter((text) => text === 'Note').length, 2, 'Museum has no note box');
});

test('offers Save to My Trips; while saving it is busy and disabled', () => {
  const buttons = (tree) => find(tree, (node) => node.type === 'Pressable' && node.props.accessibilityLabel === 'Save to My Trips');
  const idle = buttons(view());
  assert.equal(idle.length, 1);
  assert.ok(texts(idle[0]).includes('Save to My Trips'));
  assert.ok(!idle[0].props.disabled);

  const saving = buttons(view({ isSaving: true }));
  assert.equal(saving[0].props.disabled, true);
  assert.equal(saving[0].props.accessibilityState.busy, true);
  assert.ok(texts(saving[0]).includes('Saving…'));
});

test('Save calls onSave', () => {
  let saved = 0;
  const [button] = find(view({ onSave: () => (saved += 1) }), (node) => node.props.accessibilityLabel === 'Save to My Trips');
  button.props.onPress();
  assert.equal(saved, 1);
});

test('shows a message with a polite live region, and offers to open an existing saved Trip', () => {
  const opened = [];
  const tree = view({
    message: { openSavedTripId: 'trip-1', text: 'This Trip may already be saved in your account.', tone: 'muted' },
    onOpenSavedTrip: (id) => opened.push(id),
  });
  assert.ok(texts(tree).includes('This Trip may already be saved in your account.'));
  assert.equal(find(tree, (node) => node.props.accessibilityLiveRegion === 'polite').length, 1);
  const [open] = find(tree, (node) => node.type === 'Pressable' && texts(node).includes('Open saved Trip'));
  open.props.onPress();
  assert.deepEqual(opened, ['trip-1']);
});

test('an empty shared Trip says so and still shows the title', () => {
  const tree = view({ placeCards: [], trip: { note: '', places: [], title: 'Empty trip' } });
  const all = texts(tree);
  assert.ok(all.includes('Empty trip'));
  assert.ok(all.includes('0 places'));
  assert.ok(all.includes('This trip has no places yet.'));
  assert.equal(find(tree, (node) => node.type === 'ShowMoreText').length, 0);
});

test('route wiring: opens the new Trip in the existing editor, reuses one attempt store, gates on the capability', async () => {
  const route = await read('app/trip/[shareId].tsx');
  assert.match(route, /router\.replace\(\{ pathname: '\/trips\/\[tripId\]', params: \{ tripId \} \}\)/);
  assert.match(route, /router\.replace/);
  assert.match(route, /outcome\.kind === 'saved'[\s\S]*openTrip\(outcome\.tripId\)/);
  assert.match(route, /checkApiCapability\(IMPORT_CAPABILITY\)/);
  assert.match(route, /importSharedTripRequest/);
  assert.match(route, /refreshAfterServerChange/);
  assert.match(route, /mode: 'resume'/);
  assert.match(route, /const attemptStore = createAsyncStorageAttemptStore\(\)/);
  // One ID per Save lives in the saver, never created by the screen on its own.
  assert.ok(!/randomUUID\(\)[\s\S]*randomUUID\(\)/.test(route));
  assert.match(await read('trips/shared-trip-save.ts'), /export const IMPORT_CAPABILITY = 'itinerary-import-v1'/);
});

test('the screen is anonymous-readable and registered with the shared header treatment', async () => {
  const layout = await read('app/_layout.tsx');
  assert.match(layout, /name="trip\/\[shareId\]"/);
  assert.match(layout, /headerLeft: \(\) => <HeaderBackButton fallbackHref="\/" \/>,\s*title: 'Shared Trip'/);
  const route = await read('app/trip/[shareId].tsx');
  assert.ok(!/Stack\.Protected|redirect|Redirect/.test(route), 'no sign-in gate before viewing');
  assert.ok(!/headers?:\s*\{[^}]*Authorization/i.test(await read('trips/shared-trip.ts')));
});

test('existing sharing is untouched', async () => {
  const sharing = await read('trips/public-sharing.ts');
  assert.match(sharing, /export async function createPublicTripShare/);
  const shared = await read('app/trips/[tripId]/shared.tsx');
  assert.match(shared, /SharedTripPreviewScreen/);
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
