// The joined Shared Trip view: owner versus participant controls, author-labelled notes, the Exit
// confirmation, saved-copy labelling, and the absence of any Trip-structure controls.
import assert from 'node:assert/strict';

import { alerts, buttonByText, byLabel, createElement, find, findAll, press, render, textOf } from './render-harness.js';
const { SharedTripDetailView } = await import('./shared-trip-detail-view.tsx');
const { detail, memberNote, note } = await import('../shared-trips/fixtures.js');

const tests = [];
const test = (name, run) => tests.push({ name, run });

function view(overrides = {}) {
  const calls = { copy: 0, delete: [], leave: 0, open: [], save: [] };
  const props = {
    cardsById: new Map([['place-a', { _id: 'place-a', title: 'Harbour' }], ['place-b', { _id: 'place-b', title: 'Museum' }]]),
    cardsPending: false,
    copyMessage: null,
    detail: detail(),
    freshness: { kind: 'current', message: null },
    handlers: {
      onDeletePlaceNote: async (itemId) => { calls.delete.push(['place', itemId]); },
      onDeleteTripNote: async () => { calls.delete.push(['trip']); },
      onSavePlaceNote: async (itemId, text) => { calls.save.push(['place', itemId, text]); },
      onSaveTripNote: async (text) => { calls.save.push(['trip', text]); },
    },
    isCopying: false,
    isLeaving: false,
    membershipMessage: null,
    onLeave: () => { calls.leave += 1; },
    onOpenCopy: (id) => calls.open.push(id),
    onSaveCopy: () => { calls.copy += 1; },
    ...overrides,
  };
  alerts.length = 0;
  return { calls, tree: render(createElement(SharedTripDetailView, props)) };
}
const creatorDetail = () => detail({
  permissions: { ...detail().permissions, canLeave: false },
  viewer: { id: 'user_owner', joinedAt: null, role: 'owner' },
  notes: [note({ id: 'cn_owner', mine: true, canEdit: true, canDelete: true, text: 'Pack warm' })],
  places: detail().places.map((p) => ({ ...p, notes: [] })),
});

test('shows the title, creator, place count and the viewer\'s membership', () => {
  const { tree } = view();
  const text = textOf(tree);
  assert.match(text, /South Island/);
  assert.match(text, /By Ana · 3 places/);
  assert.match(text, /You joined/);
  assert.match(text, /Ana decides which places are in this Trip/);
});

test('Places appear in the creator\'s order, each as an existing Place card', () => {
  const { tree } = view();
  assert.deepEqual(findAll(tree, (n) => n.type === 'PlaceCard').map((n) => n.props.place._id), ['place-a', 'place-b']);
  assert.ok(findAll(tree, (n) => n.type === 'PlaceCard').every((n) => n.props.showSaveButton === false && n.props.embedded === true));
  // place-c has no card yet: a placeholder, in its position, not a missing Place.
  assert.equal(findAll(tree, byLabel('Place unavailable')).length, 1);
  assert.equal(findAll(view({ cardsPending: true }).tree, byLabel('Loading place')).length, 1);
});

test('a participant is offered no way to change the Trip\'s structure', () => {
  const { tree } = view();
  const labels = findAll(tree, (n) => n.props?.accessibilityLabel).map((n) => n.props.accessibilityLabel.toLowerCase());
  for (const forbidden of ['remove', 'reorder', 'move', 'add place', 'add places', 'rename', 'edit trip name', 'previous place', 'next place']) {
    assert.equal(labels.some((l) => l.includes(forbidden)), false, forbidden);
  }
  const icons = findAll(tree, (n) => n.type === 'IconAction').map((n) => n.props.icon);
  for (const icon of ['add', 'edit', 'arrow-upward', 'arrow-downward', 'close']) assert.equal(icons.includes(icon), false, icon);
  assert.equal(findAll(tree, (n) => n.type === 'TripPlacePicker').length, 0);
});

test('other people\'s notes are read-only and labelled by author; the viewer gets an editor for their own', () => {
  const { tree } = view();
  const text = textOf(tree);
  assert.match(text, /Ana \(creator\)/);
  const labels = findAll(tree, (n) => n.type === 'ShowMoreText').map((n) => n.props.accessibilityLabel);
  assert.ok(labels.includes('Note by Ana (creator)'));
  // Editors exist only for the viewer's own notes: Trip note + three Places.
  const editors = findAll(tree, (n) => n.type === 'AutosaveNote');
  assert.deepEqual(editors.map((n) => n.props.accessibilityLabel), ['Your note on this Trip', 'Your note for Harbour', 'Your note for Museum', 'Your note for this place']);
  assert.deepEqual(editors.map((n) => n.props.value), ['Bring a hat', 'Booked', '', '']);
  // Nobody else's text ever appears inside an editor.
  assert.equal(editors.some((n) => /Pack warm|Book early|Sunrise/.test(n.props.value)), false);
});

test('writing, editing and clearing the viewer\'s own note go to the right handlers', async () => {
  const { calls, tree } = view();
  const editors = findAll(tree, (n) => n.type === 'AutosaveNote');
  await editors[0].props.onSave('Bring two hats'); // edit the Trip note
  await editors[1].props.onSave('Booked, confirmed'); // edit a Place note
  await editors[2].props.onSave('First note here'); // create on a Place without one
  await editors[1].props.onSave('   '); // clearing deletes the existing note
  await editors[2].props.onSave(''); // clearing when there is nothing is a no-op
  assert.deepEqual(calls.save, [['trip', 'Bring two hats'], ['place', 'fci_a', 'Booked, confirmed'], ['place', 'fci_b', 'First note here']]);
  assert.deepEqual(calls.delete, [['place', 'fci_a']]);
});

test('deleting one\'s own note asks first, names the scope, and only then deletes', async () => {
  const { calls, tree } = view();
  const del = find(tree, byLabel('Delete your note on this Trip'));
  assert.ok(del);
  assert.equal(del.props.destructive, true);
  press(del);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].title, 'Delete your note?');
  assert.match(alerts[0].message, /deleted for everyone on this Trip/);
  assert.equal(alerts[0].buttons[0].style, 'cancel'); // Cancel first
  assert.deepEqual(calls.delete, []);
  alerts[0].buttons[1].onPress();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls.delete, [['trip']]);
  // Only the viewer's own notes have a delete control.
  assert.equal(findAll(tree, (n) => n.type === 'IconAction' && /^Delete your note/.test(n.props.accessibilityLabel)).length, 2);
});

test('a note the server says cannot be edited is shown read-only, even if it is the viewer\'s', () => {
  const d = detail();
  d.notes = [memberNote({ canEdit: false, canDelete: false, id: 'locked', text: 'Locked note' })];
  const { tree } = view({ detail: d });
  assert.equal(findAll(tree, (n) => n.type === 'AutosaveNote').some((n) => n.props.accessibilityLabel === 'Your note on this Trip'), false);
  assert.equal(findAll(tree, byLabel('Delete your note on this Trip')).length, 0);
  assert.match(textOf(tree), /Locked note|You/);
});

test('permissions switch the note editors off: nobody is offered a field they may not use', () => {
  const d = detail({ permissions: { ...detail().permissions, canAddCollectionNote: false, canAddPlaceNote: false } });
  d.notes = d.notes.filter((n) => !n.mine);
  d.places = d.places.map((p) => ({ ...p, notes: p.notes.filter((n) => !n.mine) }));
  assert.equal(findAll(view({ detail: d }).tree, (n) => n.type === 'AutosaveNote').length, 0);
});

test('Leave Trip is offered to a member, and the confirmation says their notes will be deleted', () => {
  const { calls, tree } = view();
  const leave = buttonByText(tree, 'Leave Trip');
  assert.ok(leave);
  press(leave);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].title, 'Leave this Trip?');
  assert.match(alerts[0].message, /South Island/);
  assert.match(alerts[0].message, /Your own notes on this Trip will be deleted and cannot be restored/);
  assert.equal(alerts[0].buttons[0].text, 'Cancel');
  assert.equal(alerts[0].buttons[0].style, 'cancel');
  assert.equal(calls.leave, 0); // nothing yet
  alerts[0].buttons[0].onPress?.();
  assert.equal(calls.leave, 0); // Cancel does not leave
  alerts[0].buttons[1].onPress();
  assert.equal(calls.leave, 1);
});

// ---- sharing the link: reshare, stop, and what an off link means --------------------------------------
const withLinkHandlers = (calls) => ({
  onReshare: () => { calls.reshare = (calls.reshare ?? 0) + 1; },
  onStopSharing: () => { calls.stop = (calls.stop ?? 0) + 1; },
});
const creatorSharing = (active = true) => ({
  ...creatorDetail(),
  sharing: { active, canReshare: active, canStop: active },
});

test('a member of an active Shared Trip can pass the link on, but is never offered Stop sharing', () => {
  const calls = { copy: 0, delete: [], leave: 0, open: [], save: [] };
  const { tree } = view({ ...withLinkHandlers(calls) });
  const share = buttonByText(tree, 'Share link');
  assert.ok(share);
  press(share);
  assert.equal(calls.reshare, 1);
  assert.equal(buttonByText(tree, 'Stop sharing'), undefined); // the server says canStop is false for a participant
  assert.ok(buttonByText(tree, 'Leave Trip'));
});

test('even if a stop handler is supplied, a participant has no Stop sharing control', () => {
  const calls = {};
  const { tree } = view({ ...withLinkHandlers(calls), detail: detail({ sharing: { active: true, canReshare: true, canStop: false } }) });
  assert.equal(buttonByText(tree, 'Stop sharing'), undefined);
});

test('the creator can pass the link on and stop sharing; stopping asks first and says what stays', () => {
  const calls = {};
  const { tree } = view({ ...withLinkHandlers(calls), detail: creatorSharing(true) });
  assert.ok(buttonByText(tree, 'Share link'));
  press(buttonByText(tree, 'Stop sharing'));
  assert.equal(calls.stop, undefined); // nothing yet: a confirmation comes first
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].title, 'Stop sharing this Trip?');
  assert.match(alerts[0].message, /already joined keep their access and their notes/);
  assert.deepEqual(alerts[0].buttons.map((b) => b.text), ['Cancel', 'Stop sharing']);
  alerts[0].buttons[0].onPress?.();
  assert.equal(calls.stop, undefined); // cancelling changes nothing
  alerts[0].buttons[1].onPress();
  assert.equal(calls.stop, 1);
});

test('when sharing is off nobody can pass the link on or stop it, and each person is told what that means', () => {
  const calls = {};
  const member = view({ ...withLinkHandlers(calls), detail: detail({ sharing: { active: false, canReshare: false, canStop: false } }) });
  assert.equal(buttonByText(member.tree, 'Share link'), undefined);
  assert.equal(buttonByText(member.tree, 'Stop sharing'), undefined);
  assert.match(textOf(member.tree), /Ana has stopped sharing this Trip\. You keep your access and your notes\./);
  const creator = view({ ...withLinkHandlers(calls), detail: creatorSharing(false) });
  assert.equal(buttonByText(creator.tree, 'Share link'), undefined);
  assert.match(textOf(creator.tree), /Sharing is off\. People who already joined keep their access/);
});

test('a link problem is shown where the person is looking, and the buttons are disabled while it works', () => {
  const calls = {};
  const { tree } = view({ ...withLinkHandlers(calls), isSharingBusy: true, linkMessage: 'Only the creator can start or stop sharing this Trip.' });
  assert.match(textOf(tree), /Only the creator can start or stop sharing this Trip\./);
  assert.equal(buttonByText(tree, 'Share link').props.disabled, true);
});

test('the creator sees no Leave Trip, is told where to change Places, and has no membership prompt', () => {
  const { tree } = view({ detail: creatorDetail() });
  assert.equal(buttonByText(tree, 'Leave Trip'), undefined);
  assert.match(textOf(tree), /You created this Trip/);
  assert.match(textOf(tree), /You change this Trip's Places in My Trips/);
});

test('Save a Copy is separate from Join and Leave, and cannot be tapped twice while saving', () => {
  const idle = view();
  const copy = buttonByText(idle.tree, 'Save a Copy');
  assert.ok(copy);
  press(copy);
  assert.equal(idle.calls.copy, 1);
  const busy = view({ isCopying: true });
  const saving = buttonByText(busy.tree, 'Saving…');
  assert.equal(saving.props.disabled, true);
  assert.equal(saving.props.accessibilityState.busy, true);
  assert.equal(buttonByText(view({ detail: detail({ permissions: { ...detail().permissions, canSaveCopy: false } }) }).tree, 'Save a Copy'), undefined);
});

test('after a copy is saved the person is offered the new Trip, not the live one', () => {
  const { calls, tree } = view({ copyMessage: { openSavedTripId: 'itn_new', text: 'Saved.', tone: 'muted' } });
  press(buttonByText(tree, 'Open saved Trip'));
  assert.deepEqual(calls.open, ['itn_new']);
});

test('a leave in progress disables Leave and a failed leave is explained', () => {
  const leaving = view({ isLeaving: true });
  assert.equal(buttonByText(leaving.tree, 'Leaving…').props.disabled, true);
  assert.match(textOf(view({ membershipMessage: 'Could not leave' }).tree), /Could not leave/);
});

test('a saved copy or a failed refresh is labelled and never shown as current', () => {
  const cached = view({ freshness: { kind: 'cached', message: "You're offline. Showing the copy saved 3 Oct." } });
  assert.ok(find(cached.tree, byLabel("You're offline. Showing the copy saved 3 Oct.")));
  assert.equal(findAll(view().tree, (n) => n.props?.accessibilityLiveRegion === 'polite' && /saved|refresh/i.test(textOf(n))).length, 0);
});

test('an empty Trip says so; the viewer\'s Trip note editor is still available', () => {
  const { tree } = view({ detail: detail({ places: [] }) });
  assert.match(textOf(tree), /hasn't added any places yet/);
  assert.equal(findAll(tree, (n) => n.type === 'AutosaveNote').length, 1);
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
