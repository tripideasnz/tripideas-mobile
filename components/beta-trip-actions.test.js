import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the actual component callbacks with controlled hooks and API promises.
// Native layout and gestures still require Simulator/device checks.
function mount(file, exportName, props, dependencies = {}) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(callback, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        previous?.cleanup?.();
        slots[index] = { deps };
        effects.push(() => { slots[index].cleanup = callback(); });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  const nativeRequire = createRequire(import.meta.url);
  runInNewContext(output, {
    exports: module.exports,
    setTimeout, clearTimeout,
    require(name) {
      if (name in dependencies) return dependencies[name];
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-native') return { Modal: 'Modal', View: 'View', ScrollView: 'ScrollView', Pressable: 'Pressable', Text: 'Text', Keyboard: { dismiss() {} } };
      if (name === '@/constants/design') return { Palette: {}, Space: {}, Screen: {}, Type: {} };
      if (name.startsWith('@/') || name === 'react-native-safe-area-context') return new Proxy({}, { get: (_, key) => key });
      return nativeRequire(name);
    },
  });
  return () => { cursor = 0; effects = []; const tree = module.exports[exportName](props); effects.forEach((effect) => effect()); return tree; };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const match = find(child, predicate);
    if (match) return match;
  }
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
let confirmation;
const favouriteIds = ['favourite-1'];
const trip = { id: 'trip-1', name: 'Weekend', places: [] };
let resolveAdd;
let rejectAdd;
let calls = [];
let closes = 0;
const render = mount('./trip-place-picker.tsx', 'TripPlacePicker', { tripId: trip.id, onClose: () => closes++ }, {
  'react-native': { Modal: 'Modal', View: 'View', ScrollView: 'ScrollView', Keyboard: { dismiss() {} }, Alert: { alert: (...args) => { confirmation = args[2]; } } },
  '@/trips/provider': { useMyTrips: () => ({ getTrip: () => trip, removePlaceFromTrip: (...args) => { calls.push(['remove', ...args]); return Promise.resolve(); }, addPlaceToTrip: (...args) => {
    calls.push(args);
    return new Promise((resolve, reject) => { resolveAdd = resolve; rejectAdd = reject; });
  } }) },
  '@/saved/provider': { useSavedPlaces: () => ({ savedPlaceIds: favouriteIds, isLoading: false }) },
  '@/sanity/place-cards': { fetchPlaceCardsByIds: async () => [{ _id: 'favourite-1', title: 'Walk' }] },
  '@/trips/error-diagnostic': { tripRequestDiagnostic: () => '' },
});
const search = () => find(render(), (node) => node.type === 'PlaceSearch');
const place = { _id: 'place-1', title: 'Beach' };
const select = () => search().props.getTripAction(place).onPress();
select();
select();
assert.equal(calls.length, 1, 'repeated taps before rerender must issue only one mutation');
assert.deepEqual(calls[0], ['trip-1', 'place-1']);
assert.equal(search().props.disabled, true);
assert.equal(search().props.getTripAction(place).isPending, true);
assert.equal(search().props.getTripAction(place).isInTrip, false, 'pending state is not authoritative membership');
find(render(), (node) => node.type === 'Modal').props.onRequestClose();
assert.equal(closes, 0, 'keep pending mutation feedback visible');
rejectAdd(new Error('offline'));
await flush();
assert.equal(search().props.disabled, false);
assert.ok(find(render(), (node) => String(node.props?.children).includes('Could not add this place')));
select();
assert.equal(calls.length, 2, 'failure allows retry');
resolveAdd();
await flush();
assert.equal(find(render(), (node) => node.props?.children === 'Beach added to Trip.'), undefined);
trip.places.push({ placeId: 'place-1' });
assert.equal(search().props.getTripAction(place).isInTrip, true);
select();
assert.equal(calls.length, 2, 'removal waits for confirmation');
confirmation.find((action) => action.text === 'Remove').onPress();
await flush();
assert.deepEqual(calls.at(-1), ['remove', 'trip-1', 'place-1']);

find(render(), (node) => node.type === 'AppButton' && node.props.label === 'Favourites').props.onPress();
render();
await flush();
const favouriteCard = find(render(), (node) => node.type === 'PlaceCard');
assert.equal(favouriteCard.props.onPress, undefined, 'card retains normal detail navigation');
assert.notEqual(favouriteCard.props.showSaveButton, false);
favouriteCard.props.tripAction.onPress();
assert.deepEqual(calls.at(-1), ['trip-1', 'favourite-1'], 'Favourites add directly to the same destination');
resolveAdd();
await flush();

calls = [];
const renderModal = mount('./add-to-trip-modal.tsx', 'AddToTripModal', {
  placeId: 'place-2', trips: [trip], onClose() {}, onOpenTrip() {}, onCreateTrip() {},
  onSelectTrip: (id) => { calls.push(id); return new Promise((resolve, reject) => { resolveAdd = resolve; rejectAdd = reject; }); },
}, {
  '@/trips/error-diagnostic': { tripRequestDiagnostic: () => '' },
  '@/trips/images': { getTripImages: () => [] },
  '@/sanity/place-cards': { fetchPlaceCardsByIds: async () => [] },
});
const row = find(renderModal(), (node) => node.type === 'TripIndexCard');
row.props.onPress();
row.props.onPress();
assert.equal(calls.length, 1);
assert.equal(find(renderModal(), (node) => node.type === 'TripIndexCard').props.disabled, true);
assert.ok(find(renderModal(), (node) => node.props?.children === 'Adding place to Trip…'));
rejectAdd(new Error('offline'));
await flush();
assert.ok(find(renderModal(), (node) => String(node.props?.children).includes('Could not add this place to the Trip')));
find(renderModal(), (node) => node.type === 'TripIndexCard').props.onPress();
resolveAdd(trip);
await flush();
assert.ok(find(renderModal(), (node) => node.props?.children === 'Place added'));
console.log('✓ Trip picker and generic modal acknowledge immediately, guard repeated taps, retain failures, and allow retry');

for (const [helper, label] of [['headerAddAction', 'Add Trip'], ['headerShareAction', 'Share Trip']]) {
  let presses = 0;
  const options = mount('./ui/header-actions.tsx', helper, { accessibilityLabel: label, onPress: () => presses++ }, { '@/components/ui/saved-header': { savedActionHeader: { header: 'shared-header' }, SavedHeaderActionButton: ({ action }) => ({ type: 'Pressable', props: { accessibilityLabel: action.accessibilityLabel, onPress: action.onPress } }) } })();
  assert.equal(typeof options.headerRight, 'function');
  const element = options.headerRight();
  const control = element.type(element.props);
  assert.equal(control.props.accessibilityLabel, label);
  control.props.onPress();
  assert.equal(presses, 1);
}
console.log('✓ Add and Share headers expose accessible controls connected to their existing handlers');

let stopped = 0;
let contextPresses = 0;
let favouritePresses = 0;
const actionDependencies = {
  'expo-router': { useRouter: () => ({ push() {} }) },
  '@/auth/provider': { useSession: () => ({ session: { userId: 'owner' }, signIn: async () => true }) },
  '@/saved/provider': { useSavedPlaces: () => ({ isSaved: () => true, toggleSavedPlace: async () => favouritePresses++ }) },
  '@/trips/provider': { useMyTrips: () => ({ trips: [{ id: 'another-trip', places: [{ placeId: 'beach' }] }] }) },
};
const contextActions = mount('./place-card-actions.tsx', 'PlaceCardActions', {
  placeId: 'beach', tripAction: { isInTrip: false, isPending: false, disabled: false, onPress: () => contextPresses++ },
}, actionDependencies);
const contextButton = find(contextActions(), (node) => node.type === 'AddPlaceToTripButton');
assert.equal(contextButton.props.isInTrip, false, 'another Trip membership does not colour this Trip icon');
contextButton.props.onPress({ stopPropagation: () => stopped++ });
assert.equal(contextPresses, 1);
assert.equal(stopped, 1);
assert.equal(find(contextActions(), (node) => node.type === 'AddToTripModal'), undefined);
find(contextActions(), (node) => node.type === 'SavePlaceButton').props.onPress({ stopPropagation() {} });
await flush();
assert.equal(favouritePresses, 1);
const genericActions = mount('./place-card-actions.tsx', 'PlaceCardActions', { placeId: 'beach' }, actionDependencies);
find(genericActions(), (node) => node.type === 'AddPlaceToTripButton').props.onPress({ stopPropagation() {} });
await flush();
assert.equal(find(genericActions(), (node) => node.type === 'AddToTripModal').props.placeId, 'beach');
let detailRoute;
let sheetClosed = false;
const normalCard = mount('./place-card.tsx', 'PlaceCard', {
  place: { _id: 'beach', title: 'Beach', slug: { current: 'beach' } },
  onOpenPlace: () => { sheetClosed = true; },
}, { 'expo-router': { useRouter: () => ({ push: (route) => { detailRoute = route; } }) } });
normalCard().props.onPress();
assert.equal(sheetClosed, true);
assert.equal(detailRoute.pathname, '/place/[slug]');
assert.equal(detailRoute.params.slug, 'beach');
console.log('✓ standard cards retain heart actions/detail navigation; only contextual Trip icons bypass selection');

for (const context of ['main', 'trip']) {
  let dismissals = 0;
  let requests = 0;
  const renderSearch = mount('./place-search.tsx', 'PlaceSearch', {
    scrollable: true,
    ...(context === 'trip' ? { getTripAction: () => ({ isInTrip: false }) } : {}),
  }, {
    'react-native': { View: 'View', ScrollView: 'ScrollView', Keyboard: { dismiss() { dismissals++; } } },
    '@/sanity/client': { sanityClient: { fetch: async () => { requests++; return [{ _id: 'beach', slug: { current: 'beach' } }]; } } },
  });
  const input = () => find(renderSearch(), (node) => node.type === 'AppTextInput');
  input().props.onChangeText('beach');
  renderSearch();
  await new Promise((resolve) => setTimeout(resolve, 320));
  renderSearch();
  await flush();
  const scroll = find(renderSearch(), (node) => node.type === 'ScrollView');
  scroll.props.onScrollBeginDrag();
  assert.equal(dismissals, 1);
  assert.equal(find(scroll, (node) => node.type === 'AppTextInput'), undefined,
    'the native input is outside the scroll responder and translated sticky header');
  assert.equal(input().props.onPressIn, undefined, 'native input taps are not intercepted by a focus callback');
  assert.equal(input().props.editable, undefined, 'input remains editable by default');
  assert.equal(input().props.value, 'beach');
  assert.equal(requests, 1, 'scroll/refocus preserve the debounced query');
  assert.equal(scroll.props.stickyHeaderIndices, undefined);
}
console.log('✓ main and Trip search dismiss on browse, leave native input outside scroll hit-testing, and preserve the query');
