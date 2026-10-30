// The Shared Trip preview: two distinct actions, correct Place order, and the states a visitor can be in.
import assert from 'node:assert/strict';

import { alerts, buttonByText, buttons, byLabel, createElement, find, findAll, press, render, textOf } from './render-harness.js';
const { SharedTripPreviewView } = await import('./shared-trip-preview-view.tsx');

const tests = [];
const test = (name, run) => tests.push({ name, run });

const pn = (text, name, creator) => ({ author: { displayName: name, isCollectionOwner: creator }, text, updatedAt: 'u' });

/** The text of every note shown, in order (notes are rendered by ShowMoreText). */
const noteValues = (tree) => findAll(tree, (n) => n.type === 'ShowMoreText').map((n) => n.props.value);

function view(overrides = {}) {
  const calls = { copy: 0, join: 0, open: [] };
  const props = {
    cardsById: new Map([['place-b', { _id: 'place-b', title: 'Museum' }], ['place-a', { _id: 'place-a', title: 'Harbour' }]]),
    cardsPending: false,
    creator: 'Ana',
    tripNotes: [pn('Pack warm', 'Ana', true), pn('Bring a hat', 'Ben', false)],
    isCopying: false,
    isJoining: false,
    message: null,
    onJoin: () => { calls.join += 1; },
    onOpenCopy: (id) => calls.open.push(id),
    onSaveCopy: () => { calls.copy += 1; },
    placeIds: ['place-b', 'place-a', 'place-c'],
    signInHint: null,
    title: 'South Island',
    ...overrides,
  };
  alerts.length = 0;
  return { calls, tree: render(createElement(SharedTripPreviewView, props)) };
}

test('shows the title, creator and place count, and every Trip note with its author', () => {
  const text = textOf(view().tree);
  assert.match(text, /South Island/);
  assert.match(text, /By Ana · 3 places/);
  assert.ok(find(view().tree, byLabel('Trip notes')));
  assert.ok(find(view().tree, byLabel('Note by Ana (creator)')));
  assert.ok(find(view().tree, byLabel('Note by Ben')));
  assert.deepEqual(noteValues(view().tree), ['Pack warm', 'Bring a hat']); // the creator's first, as the API orders them
});

test('Places are in the creator\'s order using the existing Place cards, with placeholders for unknown ones', () => {
  const { tree } = view();
  assert.deepEqual(findAll(tree, (n) => n.type === 'PlaceCard').map((n) => n.props.place._id), ['place-b', 'place-a']);
  assert.equal(findAll(tree, byLabel('Place unavailable')).length, 1);
  assert.equal(findAll(view({ cardsPending: true }).tree, byLabel('Loading place')).length, 1);
  assert.match(textOf(view({ placeIds: [] }).tree), /no places yet/);
});

test('every note on a Place appears under that Place with its author, in order; Places without notes show none', () => {
  const placeNotes = [[pn('Book early', 'Ana', true), pn('Booked', 'Ben', false)], [], [pn('Sunrise', 'Ana', true)]];
  const { tree } = view({ placeNotes });
  // Trip notes first (Pack warm, Bring a hat), then each Place's notes in the creator's Place order.
  assert.deepEqual(noteValues(tree), ['Pack warm', 'Bring a hat', 'Book early', 'Booked', 'Sunrise']);
  assert.equal(findAll(tree, byLabel('Note by Ben')).length >= 1, true);
  assert.equal(findAll(view({ placeNotes: [[], [], []], tripNotes: [] }).tree, (n) => String(n.props?.accessibilityLabel ?? '').startsWith('Note by')).length, 0);
});

test('the signed-in account is named before Join or Save, and nothing is named when signed out', () => {
  assert.match(textOf(view({ account: 'sam@example.test' }).tree), /Signed in as sam@example\.test/);
  assert.ok(find(view({ account: 'Sam' }).tree, byLabel('Signed in as Sam')));
  assert.doesNotMatch(textOf(view({ account: null }).tree), /Signed in as/);
});

test('Join Trip and Save a Copy are two separate buttons that do different things', () => {
  const { calls, tree } = view();
  const join = buttonByText(tree, 'Join Trip');
  const copy = buttonByText(tree, 'Save a Copy');
  assert.ok(join && copy);
  assert.notEqual(join, copy);
  press(join);
  assert.deepEqual([calls.join, calls.copy], [1, 0]);
  press(copy);
  assert.deepEqual([calls.join, calls.copy], [1, 1]);
  const text = textOf(tree);
  assert.match(text, /as they update it/);
  assert.match(text, /will not change when they edit theirs/);
});

test('while one action runs both buttons are disabled and busy is exposed', () => {
  for (const [flag, label] of [['isJoining', 'Joining…'], ['isCopying', 'Saving…']]) {
    const { tree } = view({ [flag]: true });
    const all = buttons(tree);
    assert.equal(all.length, 2);
    assert.ok(all.every((b) => b.props.disabled === true));
    assert.equal(buttonByText(tree, label).props.accessibilityState.busy, true);
  }
});

test('signed-out visitors can read the preview and are told to sign in to act', () => {
  const { tree } = view({ signInHint: 'Sign in to join this Trip or save your own copy.' });
  assert.match(textOf(tree), /Sign in to join this Trip or save your own copy/);
  assert.equal(view({ signInHint: null }).tree && /Sign in to join/.test(textOf(view({ signInHint: null }).tree)), false);
});

test('failures and the saved-copy shortcut appear next to the actions', () => {
  const failed = view({ message: { text: "Couldn't read the creator's notes.", tone: 'danger' } });
  assert.match(textOf(failed.tree), /Couldn't read the creator's notes/);
  const existing = view({ message: { openSavedTripId: 'itn_9', text: 'Already saved.', tone: 'muted' } });
  press(buttonByText(existing.tree, 'Open saved Trip'));
  assert.deepEqual(existing.calls.open, ['itn_9']);
});

test('the preview is read-only: shared notes are shown, never edited, and no structure controls exist', () => {
  const { tree } = view({ placeNotes: [[pn('x', 'Ben', false)], [], []] });
  assert.equal(findAll(tree, (n) => n.type === 'AutosaveNote').length, 0);
  assert.equal(findAll(tree, (n) => n.type === 'TextInput' || n.type === 'AppTextInput').length, 0);
  assert.deepEqual(buttons(tree).map((b) => textOf(b)).sort(), ['Join Trip', 'Save a Copy']);
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
