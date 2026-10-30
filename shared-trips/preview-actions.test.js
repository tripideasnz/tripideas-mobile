// The preview's Join Trip and Save a Copy: the controller behind the buttons, and the copy source for
// someone who has not joined. Network access and sign-in are replaced by fakes.
import assert from 'node:assert/strict';

import { ApiError } from '../lib/api-client.ts';
import { toPreviewSnapshot } from './copy.ts';
import { createPreviewActions } from './preview-actions.ts';
import { buildImportRequest } from '../trips/shared-trip.ts';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

const preview = {
  creatorName: 'Ana',
  id: 'fc_1',
  places: [
    { note: 'Book early', placeId: 'place-a' },
    { note: null, placeId: 'place-b' }, // the creator wrote nothing here (a participant may have: never public)
    { note: 'Sunrise', placeId: 'place-c' },
  ],
  title: 'South Island',
  tripNote: 'Pack warm',
};
const copied = {
  note: 'Pack warm',
  places: [
    { note: 'Book early', placeId: 'place-a', title: '' },
    { note: '', placeId: 'place-b', title: '' },
    { note: 'Sunrise', placeId: 'place-c', title: '' },
  ],
  title: 'South Island',
};

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
  const log = { changes: [], joined: 0, saved: [], signIns: 0, joins: [] };
  let userId = overrides.userId ?? null;
  const copyDependencies = overrides.copyDependencies ?? saveDeps();
  const actions = createPreviewActions({
    collectionId: 'fc_1',
    copyDependencies,
    getPreview: () => (overrides.noPreview ? null : overrides.preview ?? preview),
    getUserId: () => userId,
    join: overrides.join ?? (async (id) => { log.joins.push(id); return { ok: true, value: {} }; }),
    onChange: (state) => log.changes.push(state),
    onJoined: () => { log.joined += 1; },
    onSaved: (id) => log.saved.push(id),
    signIn: overrides.signIn ?? (async () => { log.signIns += 1; return true; }),
  });
  return { actions, copyDependencies, log, setUser: (id) => { userId = id; actions.sessionChanged(); } };
}

// ---- the copy source for someone who has not joined ----------------------------------------------------
test('the copy source is the creator\'s content only, in the creator\'s order, with no further requests', () => {
  const source = toPreviewSnapshot(preview);
  assert.deepEqual(source, copied);
  assert.equal(toPreviewSnapshot.length, 1); // takes the preview alone: there is nothing else to read
  for (const forbidden of ['Ben', 'Booked', 'fc_1', 'user_', 'Ana']) assert.equal(JSON.stringify(source).includes(forbidden), false, forbidden);
});

test('an incomplete preview is never turned into a copy source', () => {
  for (const damaged of [
    { ...preview, title: '  ' },
    { ...preview, places: [{ note: 'x', placeId: '' }] },
  ]) {
    assert.throws(() => toPreviewSnapshot(damaged), (e) => e.name === 'SharedTripsFailure' && e.failure.code === 'incomplete_preview');
  }
});

test('an empty Trip copies cleanly', () => {
  assert.deepEqual(toPreviewSnapshot({ ...preview, places: [] }), { note: 'Pack warm', places: [], title: 'South Island' });
  assert.deepEqual(toPreviewSnapshot({ ...preview, places: [], tripNote: null }).note, '');
});

// ---- Save a Copy ---------------------------------------------------------------------------------------------
test('Save a Copy signed in: the owner\'s content is imported as a new Trip, with no sharing attributes', async () => {
  const { actions, copyDependencies, log } = controller({ userId: 'user_member' });
  await actions.saveCopy();
  assert.equal(copyDependencies.sent.length, 1);
  const body = copyDependencies.sent[0];
  assert.deepEqual(Object.keys(body).sort(), ['description', 'entries', 'id', 'name']);
  assert.deepEqual(body, buildImportRequest(body.id, copied));
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

test('Save a Copy does not proceed from an incomplete preview, and says so', async () => {
  const c = controller({ preview: { ...preview, places: [{ note: 'x', placeId: '' }] }, userId: 'user_member' });
  await c.actions.saveCopy();
  assert.equal(c.copyDependencies.sent.length, 0);
  assert.match(c.actions.getState().message.text, /incomplete.*no copy was made/);
  assert.equal(c.actions.getState().message.tone, 'danger');
  assert.equal(c.actions.getState().busy, null);
  assert.equal(c.log.saved.length, 0);
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
