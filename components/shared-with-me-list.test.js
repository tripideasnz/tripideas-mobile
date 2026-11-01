// Shared With Me: the list, its card, the view switch and the saved-copy label.
import assert from 'node:assert/strict';

import { buttons, createElement, find, findAll, press, render, textOf } from './render-harness.js';
const { SharedWithMeList } = await import('./shared-with-me-list.tsx');
const { SharedTripIndexCard } = await import('./shared-trip-index-card.tsx');
const { TripsViewSwitch } = await import('./trips-view-switch.tsx');
const { sharedTripRows } = await import('../shared-trips/view-model.ts');
const { summary } = await import('../shared-trips/fixtures.js');

const tests = [];
const test = (name, run) => tests.push({ name, run });
const resource = (overrides = {}) => ({ data: [], error: null, loadedAt: 1, refreshing: false, source: 'server', status: 'ready', ...overrides });

test('each joined Trip is a whole-row card with title, owner and place count that opens the live Trip', () => {
  const opened = [];
  const list = [summary({ id: 'fc_1', placeCount: 3 }), summary({ id: 'fc_2', managedByTrip: false, owner: { displayName: 'Cleo', id: 'c' }, placeCount: 1, title: 'Web Trip Idea' })];
  const tree = render(createElement(SharedWithMeList, { onOpen: (id) => opened.push(id), resource: resource({ data: list }), rows: sharedTripRows(list, 'user_me') }));
  const cards = buttons(tree);
  assert.deepEqual(cards.map((c) => c.props.accessibilityLabel), ['Open South Island, shared by Ana', 'Open Web Trip Idea, shared by Cleo']);
  assert.match(textOf(tree), /By Ana · 3 places/);
  assert.match(textOf(tree), /By Cleo · 1 place/);
  press(cards[1]);
  assert.deepEqual(opened, ['fc_2']);
});

test('the card uses the established compact card and an empty-montage label, with no forward chevron', () => {
  const tree = render(createElement(SharedTripIndexCard, { onPress() {}, row: sharedTripRows([summary()], 'x')[0] }));
  const collage = find(tree, (n) => n.type === 'TripImageCollage');
  assert.deepEqual([collage.props.images, collage.props.emptyLabel], [[], 'Shared']);
  assert.deepEqual(collage.props.style, { height: 92, width: 112 }); // same 112 × 92 montage region as My Trips
  assert.equal(findAll(tree, (n) => n.type === 'MaterialIcons' || n.type === 'IconAction').length, 0);
});

test('an empty list explains what appears here; loading and offline failures are distinct', () => {
  const empty = textOf(render(createElement(SharedWithMeList, { onOpen() {}, resource: resource(), rows: [] })));
  assert.match(empty, /No Shared Trips yet/);
  assert.match(textOf(render(createElement(SharedWithMeList, { onOpen() {}, resource: resource({ status: 'loading' }), rows: [] }))), /Loading Shared Trips/);
  assert.match(textOf(render(createElement(SharedWithMeList, { onOpen() {}, resource: resource({ error: { kind: 'offline' }, status: 'error' }), rows: [] }))), /Check your connection/);
});

test('a saved copy stays readable offline and is labelled as saved', () => {
  const list = [summary()];
  const tree = render(createElement(SharedWithMeList, {
    onOpen() {},
    resource: resource({ data: list, error: { kind: 'offline' }, source: 'cache' }),
    rows: sharedTripRows(list, 'x'),
  }));
  assert.match(textOf(tree), /You're offline\. Showing the copy saved/);
  assert.equal(buttons(tree).length, 1); // the Trip is still there to open
  const current = render(createElement(SharedWithMeList, { onOpen() {}, resource: resource({ data: list }), rows: sharedTripRows(list, 'x') }));
  assert.doesNotMatch(textOf(current), /saved|offline/i);
});

const tabs = (tree) => findAll(tree, (node) => node.type === 'Pressable' && node.props.accessibilityRole === 'tab');

test('the view switch separates My Trips from Shared With Me and reports the choice', () => {
  const changes = [];
  const tree = render(createElement(TripsViewSwitch, { onChange: (v) => changes.push(v), value: 'mine' }));
  const [mine, shared] = tabs(tree);
  assert.deepEqual([mine.props.accessibilityLabel, shared.props.accessibilityLabel], ['My Trips', 'Shared With Me']);
  assert.deepEqual([mine.props.accessibilityState.selected, shared.props.accessibilityState.selected], [true, false]);
  press(shared);
  assert.deepEqual(changes, ['shared']);
  const other = render(createElement(TripsViewSwitch, { onChange() {}, value: 'shared' }));
  assert.deepEqual(tabs(other).map((b) => b.props.accessibilityState.selected), [false, true]);
});

test('the view switch is one compact segmented control: equal segments, clear selected state, no chrome', () => {
  const tree = render(createElement(TripsViewSwitch, { onChange() {}, value: 'mine' }));
  assert.equal(buttons(tree).length, 0, 'segments are tabs, not separate oversized buttons');
  const track = find(tree, (node) => node.props.accessibilityRole === 'tablist');
  assert.equal(track.props.accessibilityLabel, 'Trips view');
  const [mine, shared] = tabs(tree);
  const a = mine.props.style({ pressed: false });
  const b = shared.props.style({ pressed: false });
  assert.equal(a.flex, 1);
  assert.equal(b.flex, 1);
  assert.equal(a.minHeight, b.minHeight, 'equal height at normal text size');
  assert.ok(a.minHeight <= 36, 'compact');
  assert.equal(a.height, undefined, 'the segment grows with its label instead of clipping it');
  assert.notEqual(a.backgroundColor, b.backgroundColor, 'selected differs from unselected');
  assert.equal(b.backgroundColor, 'transparent');
  for (const style of [a, b]) {
    assert.equal(style.borderWidth, undefined, 'no borders');
    assert.equal(style.shadowOpacity, undefined, 'no shadows');
    assert.equal(style.elevation, undefined, 'no shadows');
  }
  assert.ok(a.minHeight + mine.props.hitSlop.top + mine.props.hitSlop.bottom >= 44, 'touch target is at least 44 points');
  // The labels follow the system text size, but only up to the shared control limit (body text is never capped).
  const labels = findAll(tree, (node) => node.type === 'Text');
  assert.equal(labels.length, 2);
  assert.ok(labels.every((l) => l.props.maxFontSizeMultiplier === 1.4));
  assert.equal(textOf(tree), 'My TripsShared With Me');
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
