// The preview's Join Trip and Save a Copy: the controller behind the buttons, and the copy source for
// someone who has not joined. Network access and sign-in are replaced by fakes.
import assert from 'node:assert/strict';

import { ApiError } from '../lib/api-client.ts';
import { loadPreviewCopySource, creatorNameFromPublicNotes } from './copy.ts';
import { createPreviewActions } from './preview-actions.ts';
import { buildImportRequest } from '../trips/shared-trip.ts';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

const preview = {
  createdAt: 'c', id: 'fc_1', name: 'South Island', ownerId: 'user_owner', updatedAt: 'u',
  items: [{ id: 'fci_a', placeId: 'place-a' }, { id: 'fci_b', placeId: 'place-b' }, { id: 'fci_c', placeId: 'place-c' }],
};
const pub = (authorId, text, authorName = null) => ({ authorId, authorName, text });
const publicNotes = {
  trip: [pub('user_member', 'Bring a hat', 'Ben'), pub('user_owner', 'Pack warm', 'Ana')],
  fci_a: [pub('user_member', 'Booked', 'Ben'), pub('user_owner', 'Book early', 'Ana')],
  fci_b: [pub('user_member', 'Only a member wrote here', 'Ben')],
  fci_c: [pub('user_owner', 'Sunrise', 'Ana')],
};
const readers = (log = []) => ({
  fetchPlaceNotes: async (id) => { log.push(['place', id]); return publicNotes[id]; },
  fetchTripNotes: async (id) => { log.push(['trip', id]); return publicNotes.trip; },
});

function saveDeps(overrides = {}) {
  const attempts = new Map(); const sent = []; let n = 0;
  return {
    checkCapability: async () => 'supported',
    importTrip: async (body) => { sent.push(body); return { created: true, id: body.id }; },
    listOwnTripIds: async () => [], newId: () => `00000000-0000-4000-8000-00000000000${(n += 1)}`, now: () => 1000,
    refreshTrips: async () => {}, sent, sleep: async () => {},
    store: { clear: async (k) => { attempts.delete(k); }, load: async (k) => attempts.get(k) ?? null, save: async (a) => { attempts.set(a.shareId, a); } },
    ...overrides,
  };
}

function controller(overrides = {}) {
  const log = { changes: [], joined: 0, saved: [], signIns: 0, joins: [], reads: [] };
  let userId = overrides.userId ?? null;
  const copyDependencies = overrides.copyDependencies ?? saveDeps();
  const actions = createPreviewActions({
    collectionId: 'fc_1',
    copyDependencies,
    getPreview: () => (overrides.noPreview ? null : preview),
    getUserId: () => userId,
    join: overrides.join ?? (async (id) => { log.joins.push(id); return { ok: true, value: {} }; }),
    onChange: (state) => log.changes.push(state),
    onJoined: () => { log.joined += 1; },
    onSaved: (id) => log.saved.push(id),
    readers: overrides.readers ?? readers(log.reads),
    signIn: overrides.signIn ?? (async () => { log.signIns += 1; return true; }),
  });
  return { actions, copyDependencies, log, setUser: (id) => { userId = id; actions.sessionChanged(); } };
}

// ---- the copy source for someone who has not joined ----------------------------------------------------
test('the copy source has the creator\'s notes only, in the creator\'s order, from existing public endpoints', async () => {
  const reads = [];
  const source = await loadPreviewCopySource(preview, readers(reads));
  assert.deepEqual(source, {
    note: 'Pack warm',
    places: [
      { note: 'Book early', placeId: 'place-a', title: '' },
      { note: '', placeId: 'place-b', title: '' }, // only a participant wrote here: nothing is copied
      { note: 'Sunrise', placeId: 'place-c', title: '' },
    ],
    title: 'South Island',
  });
  assert.equal(JSON.stringify(source).includes('Ben'), false);
  assert.equal(JSON.stringify(source).includes('Booked'), false);
  assert.equal(reads.length, 1 + preview.items.length); // one Trip read plus one per Place (a known cost)
});

test('a failed read means no copy source at all, never a copy without the creator\'s notes', async () => {
  const flaky = { ...readers(), fetchPlaceNotes: async (id) => { if (id === 'fci_b') throw new TypeError('Network request failed'); return publicNotes[id]; } };
  await assert.rejects(loadPreviewCopySource(preview, flaky), (e) => e.name === 'SharedTripsFailure' && e.failure.kind === 'offline');
  const server = { ...readers(), fetchTripNotes: async () => { throw new ApiError(503, 'x'); } };
  await assert.rejects(loadPreviewCopySource(preview, server), (e) => e.failure.kind === 'server');
});

test('reads are bounded and an empty Trip copies cleanly', async () => {
  let running = 0; let peak = 0;
  const big = { ...preview, items: Array.from({ length: 30 }, (_, i) => ({ id: `fci_${i}`, placeId: `p${i}` })) };
  await loadPreviewCopySource(big, {
    fetchPlaceNotes: async () => { running += 1; peak = Math.max(peak, running); await settle(); running -= 1; return []; },
    fetchTripNotes: async () => [],
  });
  assert.ok(peak <= 6);
  assert.deepEqual(await loadPreviewCopySource({ ...preview, items: [] }, readers()), { note: 'Pack warm', places: [], title: 'South Island' });
});

test('the creator\'s name is used only when the public notes carry it', () => {
  assert.equal(creatorNameFromPublicNotes(publicNotes.trip, 'user_owner'), 'Ana');
  assert.equal(creatorNameFromPublicNotes([pub('user_member', 'x', 'Ben')], 'user_owner'), null);
  assert.equal(creatorNameFromPublicNotes([], 'user_owner'), null);
});

// ---- Save a Copy ---------------------------------------------------------------------------------------------
test('Save a Copy signed in: the owner\'s content is imported as a new Trip, with no sharing attributes', async () => {
  const { actions, copyDependencies, log } = controller({ userId: 'user_member' });
  await actions.saveCopy();
  assert.equal(copyDependencies.sent.length, 1);
  const body = copyDependencies.sent[0];
  assert.deepEqual(Object.keys(body).sort(), ['description', 'entries', 'id', 'name']);
  assert.deepEqual(body, buildImportRequest(body.id, { note: 'Pack warm', places: [{ note: 'Book early', placeId: 'place-a', title: '' }, { note: '', placeId: 'place-b', title: '' }, { note: 'Sunrise', placeId: 'place-c', title: '' }], title: 'South Island' }));
  const sent = JSON.stringify(body);
  for (const forbidden of ['fc_1', 'fci_', 'user_', 'Ben', 'Booked', 'Bring a hat', 'collection']) assert.equal(sent.includes(forbidden), false, forbidden);
  assert.deepEqual(log.saved, [body.id]);
  assert.equal(log.joins.length, 0); // no membership was created
  assert.equal(log.joined, 0);
  assert.deepEqual(actions.getState(), { busy: null, message: null });
});

test('Save a Copy signed out: sign in opens, then the same Save continues with the same attempt id', async () => {
  const c = controller({ userId: null, signIn: async () => { c.log.signIns += 1; return true; } });
  await c.actions.saveCopy();
  assert.equal(c.log.signIns, 1);
  assert.equal(c.copyDependencies.sent.length, 0);
  assert.equal(c.actions.getState().busy, 'copy'); // still waiting for the session
  c.setUser('user_new');
  await settle(); await settle();
  assert.equal(c.copyDependencies.sent.length, 1);
  assert.equal(c.log.saved.length, 1);
  assert.equal(c.log.reads.length, 1 + preview.items.length); // the creator's notes were read once, not again
});

test('cancelling sign-in leaves everything untouched, with a message', async () => {
  const c = controller({ signIn: async () => false });
  await c.actions.saveCopy();
  assert.equal(c.copyDependencies.sent.length, 0);
  assert.deepEqual(c.actions.getState().busy, null);
  assert.match(c.actions.getState().message.text, /Sign in/);
  await c.actions.join();
  assert.match(c.actions.getState().message.text, /Sign in to join/);
  assert.equal(c.log.joins.length, 0);
});

test('Save a Copy does not proceed without the creator\'s notes, and a retry can succeed', async () => {
  let failing = true;
  const flaky = { fetchPlaceNotes: async (id) => { if (failing) throw new TypeError('offline'); return publicNotes[id]; }, fetchTripNotes: async () => publicNotes.trip };
  const c = controller({ readers: flaky, userId: 'user_member' });
  await c.actions.saveCopy();
  assert.equal(c.copyDependencies.sent.length, 0);
  assert.match(c.actions.getState().message.text, /no copy was made/);
  assert.equal(c.actions.getState().message.tone, 'danger');
  assert.equal(c.actions.getState().busy, null);
  failing = false;
  await c.actions.saveCopy();
  assert.equal(c.copyDependencies.sent.length, 1);
});

test('refusals from the existing Save workflow are reported, not hidden', async () => {
  const rejected = controller({ copyDependencies: saveDeps({ importTrip: async () => { throw new ApiError(400, 'invalid_body'); } }), userId: 'u' });
  await rejected.actions.saveCopy();
  assert.equal(rejected.log.saved.length, 0);
  assert.ok(rejected.actions.getState().message);
  const unsupported = controller({ copyDependencies: saveDeps({ checkCapability: async () => 'unsupported' }), userId: 'u' });
  await unsupported.actions.saveCopy();
  assert.match(unsupported.actions.getState().message.text, /not available yet/);
});

test('two quick taps make one copy', async () => {
  const gate = deferred();
  const deps = saveDeps();
  deps.importTrip = async (body) => { deps.sent.push(body); await gate.promise; return { created: true, id: body.id }; };
  const c = controller({ copyDependencies: deps, userId: 'u' });
  const first = c.actions.saveCopy();
  const second = c.actions.saveCopy();
  await settle();
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(c.log.saved.length, 1);
  assert.equal(new Set(c.copyDependencies.sent.map((b) => b.id)).size, 1);
});

test('nothing happens before the preview has loaded', async () => {
  const c = controller({ noPreview: true, userId: 'u' });
  await c.actions.saveCopy();
  assert.equal(c.log.changes.length, 0);
  assert.equal(c.copyDependencies.sent.length, 0);
});

// ---- Join Trip ----------------------------------------------------------------------------------------------------
test('Join Trip joins the live Trip and opens it; it makes no copy', async () => {
  const c = controller({ userId: 'user_member' });
  await c.actions.join();
  assert.deepEqual(c.log.joins, ['fc_1']);
  assert.equal(c.log.joined, 1);
  assert.equal(c.copyDependencies.sent.length, 0);
  assert.equal(c.log.saved.length, 0);
  assert.equal(c.actions.getState().busy, null);
});

test('Join Trip signed out signs in first, then joins once the session arrives', async () => {
  const c = controller({ userId: null });
  await c.actions.join();
  assert.equal(c.log.signIns, 1);
  assert.equal(c.log.joins.length, 0);
  assert.equal(c.actions.getState().busy, 'join');
  c.setUser('user_new');
  await settle(); await settle();
  assert.deepEqual(c.log.joins, ['fc_1']);
  assert.equal(c.log.joined, 1);
});

test('a failed join says why, keeps the person on the preview and allows another try', async () => {
  let ok = false;
  const c = controller({ join: async () => (ok ? { ok: true, value: {} } : { error: { kind: 'offline' }, ok: false }), userId: 'u' });
  await c.actions.join();
  assert.equal(c.log.joined, 0);
  assert.match(c.actions.getState().message.text, /Check your connection/);
  assert.equal(c.actions.getState().busy, null);
  ok = true;
  await c.actions.join();
  assert.equal(c.log.joined, 1);
  assert.equal(c.actions.getState().message, null);
});

test('only one action runs at a time: joining blocks Save a Copy and vice versa', async () => {
  const gate = deferred();
  const c = controller({ join: async () => { await gate.promise; return { ok: true, value: {} }; }, userId: 'u' });
  const joining = c.actions.join();
  await c.actions.saveCopy();
  assert.equal(c.copyDependencies.sent.length, 0);
  gate.resolve();
  await joining;
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
