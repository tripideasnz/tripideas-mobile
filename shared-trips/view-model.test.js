// Shared Trips view model: list separation, cached-vs-current labelling, permission-driven controls,
// the preview's reaction to sign-in and membership, and the wording of confirmations and errors.
import assert from 'node:assert/strict';

import {
  PREVIEW_ACTIONS,
  SHARE_CHOICES,
  authorLabel,
  deleteNoteConfirmation,
  detailControls,
  detailViewState,
  emptySharedMessage,
  errorMessage,
  formatWhen,
  freshness,
  leaveConfirmation,
  liveShareMessage,
  markSharedTrips,
  membershipErrorMessage,
  membershipStatus,
  noteErrorMessage,
  ownerLabel,
  previewState,
  shareErrorMessage,
  sharedTripRows,
  splitNotes,
} from './view-model.ts';
import { detail, memberNote, note, summary } from './fixtures.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const at = (ms) => `@${ms}`;
const resource = (overrides = {}) => ({ data: [1], error: null, loadedAt: 5000, refreshing: false, source: 'server', status: 'ready', ...overrides });
const entry = (overrides = {}) => ({ access: 'granted', data: detail(), error: null, loadedAt: 1, refreshing: false, source: 'server', status: 'ready', ...overrides });

// ---- My Trips and Shared With Me are separate lists ------------------------------------------
test('Shared With Me lists only what the user joined and never anything they own', () => {
  const rows = sharedTripRows([
    summary({ id: 'fc_1', owner: { displayName: 'Ana', id: 'user_a' }, placeCount: 3, title: 'South Island' }),
    summary({ id: 'fc_mine', owner: { displayName: 'Me', id: 'user_me' }, title: 'My own, somehow listed' }),
    summary({ id: 'fc_2', managedByTrip: false, owner: { displayName: null, id: 'user_b' }, placeCount: 1, title: 'Made on the web' }),
  ], 'user_me');
  assert.deepEqual(rows.map((r) => r.id), ['fc_1', 'fc_2']);
  assert.equal(rows[0].subtitle, 'By Ana · 3 places');
  assert.equal(rows[1].subtitle, 'By a TripIdeas traveller · 1 place'); // no invented name
  assert.equal(rows[0].accessibilityLabel, 'Open South Island, shared by Ana');
});

test('web-created collections appear in Shared With Me just like app Trips', () => {
  const rows = sharedTripRows([summary({ id: 'web', managedByTrip: false, title: 'Web Trip Idea' })], 'someone');
  assert.deepEqual(rows.map((r) => r.title), ['Web Trip Idea']);
});

test('owned Trips are marked as shared without being duplicated or reordered', () => {
  const trips = [{ id: 'itn_1', name: 'A' }, { id: 'itn_2', name: 'B' }, { id: 'itn_3', name: 'C' }];
  const marked = markSharedTrips(trips, [
    { id: 'itn_2', name: 'B', sharedCollectionId: 'fc_9' },
    { id: 'itn_1', name: 'A', sharedCollectionId: null },
  ]);
  assert.deepEqual(marked.map((t) => [t.id, t.sharedCollectionId]), [['itn_1', null], ['itn_2', 'fc_9'], ['itn_3', null]]);
  assert.equal(marked.length, trips.length);
  assert.deepEqual(markSharedTrips(trips, null).map((t) => t.sharedCollectionId), [null, null, null]);
});

test('empty Shared With Me explains itself; loading and errors are distinct', () => {
  assert.match(emptySharedMessage({ error: null, status: 'loading' }), /Loading/);
  assert.match(emptySharedMessage({ error: { kind: 'offline' }, status: 'error' }), /Check your connection/);
  assert.match(emptySharedMessage({ error: null, status: 'ready' }), /No Shared Trips yet/);
});

// ---- cached versus current -----------------------------------------------------------------------
test('current server content carries no label; saved copies and failed refreshes are labelled', () => {
  assert.deepEqual(freshness(resource(), at), { kind: 'current', message: null });
  assert.deepEqual(freshness(resource({ data: null }), at), { kind: 'current', message: null });
  assert.equal(freshness(resource({ source: 'cache' }), at).kind, 'cached');
  assert.match(freshness(resource({ source: 'cache' }), at).message, /copy saved @5000\. Pull down to refresh/);
  assert.match(freshness(resource({ error: { kind: 'offline' }, source: 'cache' }), at).message, /You're offline\. Showing the copy saved @5000/);
  assert.match(freshness(resource({ refreshing: true, source: 'cache' }), at).message, /Refreshing/);
  assert.match(freshness(resource({ error: { kind: 'session-expired' }, source: 'cache' }), at).message, /Sign in again/);
  const failed = freshness(resource({ error: { kind: 'server' } }), at);
  assert.equal(failed.kind, 'refresh-failed');
  assert.match(failed.message, /Couldn't refresh\. Showing the update from @5000/);
  assert.match(freshness(resource({ error: { kind: 'session-expired' } }), at).message, /Sign in again to refresh/);
});

test('a saved copy is never described as current, whatever else is true', () => {
  for (const error of [null, { kind: 'offline' }, { kind: 'server' }, { kind: 'rejected' }]) {
    assert.notEqual(freshness(resource({ error, source: 'cache' }), at).kind, 'current');
  }
  assert.equal(typeof formatWhen(0), 'string');
});

// ---- the joined Trip -----------------------------------------------------------------------------------
test('the detail screen state follows what the server said about access', () => {
  assert.equal(detailViewState(undefined).kind, 'loading');
  assert.equal(detailViewState(entry({ data: null, status: 'loading' })).kind, 'loading');
  assert.equal(detailViewState(entry()).kind, 'ready');
  assert.equal(detailViewState(entry({ access: 'unknown', source: 'cache' })).kind, 'ready'); // saved copy is readable
  assert.equal(detailViewState(entry({ access: 'not-joined', data: null })).kind, 'not-joined'); // lost membership
  assert.equal(detailViewState(entry({ access: 'gone', data: null })).kind, 'gone'); // deleted Trip
  assert.equal(detailViewState(entry({ data: null, error: { kind: 'session-expired' }, status: 'error' })).kind, 'sign-in');
  const failed = detailViewState(entry({ data: null, error: { kind: 'offline' }, status: 'error' }));
  assert.equal(failed.kind, 'error');
  assert.match(failed.message, /Check your connection/);
  // Data wins over a stale error: a refresh failure never blanks the Trip.
  assert.equal(detailViewState(entry({ error: { kind: 'offline' } })).kind, 'ready');
});

test('controls come from the server permissions: a member can leave and copy, the creator cannot leave', () => {
  const member = detailControls(detail());
  assert.deepEqual(member, { canLeave: true, canSaveCopy: true, canWritePlaceNotes: true, canWriteTripNote: true, isCreator: false, structure: false });
  const creator = detail({ permissions: { ...detail().permissions, canLeave: false }, viewer: { id: 'user_owner', joinedAt: null, role: 'owner' } });
  const owner = detailControls(creator);
  assert.equal(owner.canLeave, false);
  assert.equal(owner.isCreator, true);
  // Even a (wrong) permission cannot make the creator leave their own Trip.
  const odd = detail({ viewer: { id: 'user_owner', joinedAt: null, role: 'owner' } });
  assert.equal(detailControls(odd).canLeave, false);
  const restricted = detailControls(detail({ permissions: { ...detail().permissions, canAddPlaceNote: false, canAddCollectionNote: false, canSaveCopy: false } }));
  assert.deepEqual([restricted.canWritePlaceNotes, restricted.canWriteTripNote, restricted.canSaveCopy], [false, false, false]);
});

test('participants are told the creator decides the Places: structure is false for a Trip-managed collection', () => {
  assert.equal(detailControls(detail()).structure, false);
});

test('membership status says who the viewer is', () => {
  assert.equal(membershipStatus(detail({ viewer: { id: 'u', joinedAt: null, role: 'owner' } })), 'You created this Trip');
  assert.equal(membershipStatus(detail(), (iso) => `on ${iso.slice(0, 10)}`), 'You joined on 2026-10-03');
  assert.equal(membershipStatus(detail({ viewer: { id: 'u', joinedAt: null, role: 'member' } })), 'You are a member');
});

test('notes are labelled by author and split into the viewer\'s own and everyone else\'s', () => {
  const notes = [note({ id: 'o' }), memberNote({ id: 'm' }), note({ author: { displayName: 'Cleo', id: 'c', isCollectionOwner: false }, id: 'c' }), note({ author: { displayName: null, id: 'd', isCollectionOwner: false }, id: 'd' }), note({ author: { displayName: null, id: 'x', isCollectionOwner: true }, id: 'x' })];
  assert.deepEqual(notes.map(authorLabel), ['Ana (creator)', 'You', 'Cleo', 'Another traveller', 'Creator']);
  const { mine, others } = splitNotes(notes);
  assert.equal(mine.id, 'm');
  assert.deepEqual(others.map((n) => n.id), ['o', 'c', 'd', 'x']);
  assert.equal(splitNotes([]).mine, null);
  assert.equal(ownerLabel({ displayName: '  ' }), 'a TripIdeas traveller');
});

test('the Exit confirmation names the consequence for the leaver\'s own notes', () => {
  const dialog = leaveConfirmation('South Island');
  assert.equal(dialog.title, 'Leave this Trip?');
  assert.match(dialog.message, /South Island/);
  assert.match(dialog.message, /Your own notes on this Trip will be deleted/);
  assert.match(dialog.message, /cannot be restored/);
  assert.match(dialog.message, /Other people's notes and the creator's Trip are not affected/);
  assert.equal(dialog.cancelLabel, 'Cancel');
  assert.match(deleteNoteConfirmation('this Trip').message, /deleted for everyone/);
});

// ---- the preview ------------------------------------------------------------------------------------------
const loaded = { preview: { id: 'fc_1', items: [], name: 'South Island', ownerId: 'user_owner' }, status: 'ok' };
test('the preview works signed out, with a sign-in hint, and signed in without one', () => {
  assert.deepEqual(previewState({ access: undefined, load: loaded, userId: null }), { kind: 'preview', signInHint: 'Sign in to join this Trip or save your own copy.' });
  assert.deepEqual(previewState({ access: 'not-joined', load: loaded, userId: 'user_x' }), { kind: 'preview', signInHint: null });
  assert.deepEqual(previewState({ access: 'unknown', load: loaded, userId: 'user_x' }), { kind: 'preview', signInHint: null });
});

test('members and the creator go straight to the live Trip; signed-out visitors never do', () => {
  assert.equal(previewState({ access: 'granted', load: loaded, userId: 'user_member' }).kind, 'open-shared');
  assert.equal(previewState({ access: 'granted', load: 'loading', userId: 'user_member' }).kind, 'open-shared');
  assert.equal(previewState({ access: undefined, load: loaded, userId: 'user_owner' }).kind, 'open-shared'); // the creator's own link
  assert.equal(previewState({ access: 'granted', load: loaded, userId: null }).kind, 'preview'); // stale access without a session
});

test('the preview reports loading, a missing Trip and an unavailable server separately', () => {
  assert.equal(previewState({ access: undefined, load: 'loading', userId: null }).kind, 'loading');
  assert.equal(previewState({ access: undefined, load: { status: 'not-found' }, userId: null }).kind, 'not-found');
  assert.equal(previewState({ access: undefined, load: { status: 'unavailable' }, userId: null }).kind, 'unavailable');
});

test('Join Trip and Save a Copy are described as different things', () => {
  assert.equal(PREVIEW_ACTIONS.join.label, 'Join Trip');
  assert.equal(PREVIEW_ACTIONS.copy.label, 'Save a Copy');
  assert.match(PREVIEW_ACTIONS.join.explanation, /as they update it/);
  assert.match(PREVIEW_ACTIONS.copy.explanation, /will not change when they edit theirs/);
  assert.match(PREVIEW_ACTIONS.copy.explanation, /your changes will not reach them/);
  assert.doesNotMatch(PREVIEW_ACTIONS.join.explanation, /copy/i);
});

// ---- sharing from My Trips -----------------------------------------------------------------------------
test('the share choices separate a live Trip from a copy and say when a Trip is already shared', () => {
  assert.equal(SHARE_CHOICES.live(false).label, 'Share live Trip');
  assert.equal(SHARE_CHOICES.live(true).label, 'Live Trip link');
  assert.match(SHARE_CHOICES.live(true).message, /already shared live/);
  assert.match(SHARE_CHOICES.live(false).message, /cannot change your Places/);
  assert.equal(SHARE_CHOICES.copy.label, 'Share a copy');
  assert.equal(liveShareMessage('South Island', 'https://web/x'), 'Join my Trip "South Island" on TripIdeas: https://web/x');
});

// ---- messages ---------------------------------------------------------------------------------------------
test('error messages are specific and actionable', () => {
  assert.match(shareErrorMessage({ code: 'personal_places_not_shareable', kind: 'rejected' }), /Personal Places/);
  assert.match(shareErrorMessage({ kind: 'offline' }), /Check your connection/);
  assert.match(errorMessage({ kind: 'session-expired' }, 'x'), /Sign in again/);
  assert.match(errorMessage({ kind: 'unsupported' }, 'x'), /not ready for Shared Trips/);
  assert.match(membershipErrorMessage('joining', { kind: 'rejected' }), /may be your own Trip/);
  assert.match(membershipErrorMessage('leaving', { kind: 'offline' }), /leave this Trip/);
  assert.match(noteErrorMessage({ kind: 'forbidden' }), /only change your own notes/);
  assert.match(noteErrorMessage({ kind: 'not-joined' }), /no longer part of this Trip/);
  assert.match(noteErrorMessage({ kind: 'rejected' }), /has been refreshed/);
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
