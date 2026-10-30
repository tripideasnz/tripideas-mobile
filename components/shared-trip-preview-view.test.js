// The Shared Trip preview: two distinct actions, correct Place order, and the states a visitor can be in.
import assert from 'node:assert/strict';

import { alerts, buttonByText, buttons, byLabel, createElement, find, findAll, press, render, textOf } from './render-harness.js';
const { SharedTripPreviewView } = await import('./shared-trip-preview-view.tsx');

const tests = [];
const test = (name, run) => tests.push({ name, run });

function view(overrides = {}) {
  const calls = { copy: 0, join: 0, open: [] };
  const props = {
    cardsById: new Map([['place-b', { _id: 'place-b', title: 'Museum' }], ['place-a', { _id: 'place-a', title: 'Harbour' }]]),
    cardsPending: false,
    creator: 'Ana',
    creatorNote: 'Pack warm',
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

test('shows the title, creator, place count and the creator\'s Trip note', () => {
  const text = textOf(view().tree);
  assert.match(text, /South Island/);
  assert.match(text, /By Ana · 3 places/);
  assert.ok(find(view().tree, byLabel("Creator's Trip note")));
});

test('Places are in the creator\'s order using the existing Place cards, with placeholders for unknown ones', () => {
  const { tree } = view();
  assert.deepEqual(findAll(tree, (n) => n.type === 'PlaceCard').map((n) => n.props.place._id), ['place-b', 'place-a']);
  assert.equal(findAll(tree, byLabel('Place unavailable')).length, 1);
  assert.equal(findAll(view({ cardsPending: true }).tree, byLabel('Loading place')).length, 1);
  assert.match(textOf(view({ placeIds: [] }).tree), /no places yet/);
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

test('the preview shows no participant notes and no note editors', () => {
  const { tree } = view();
  assert.equal(findAll(tree, (n) => n.type === 'AutosaveNote').length, 0);
  assert.equal(findAll(tree, (n) => n.type === 'ShowMoreText').length, 1); // only the creator's Trip note
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
