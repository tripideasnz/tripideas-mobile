// B2: saving a shared Trip — one attempt ID per Save, sign-in continuation, retries, 409s, capability.
import assert from 'node:assert/strict';

import { ApiError } from '../lib/api-client.ts';
import { createAsyncStorageAttemptStore } from './shared-trip-attempts.ts';
import { describeSaveFeedback } from './shared-trip-messages.ts';
import { RESUME_WINDOW_MS, saveSharedTrip } from './shared-trip-save.ts';

const shareId = '0123456789abcdef';
const trip = {
  note: 'Trip-level note',
  places: [
    { note: 'Go early', placeId: 'place-b', title: 'Harbour' },
    { note: '', placeId: 'place-a', title: 'Museum' },
  ],
  title: 'Shared South Island',
};

const memoryStore = () => {
  const attempts = new Map();
  return {
    attempts,
    clear: async (id) => void attempts.delete(id),
    load: async (id) => attempts.get(id) ?? null,
    save: async (attempt) => void attempts.set(attempt.shareId, { ...attempt }),
  };
};

// Fresh fakes per test. `importTrip` is scripted: each call takes the next step.
const setup = ({ capability = 'supported', import: steps = [], ownTrips = [], refreshFails = false } = {}) => {
  const store = memoryStore();
  const calls = { import: [], refresh: 0, sleeps: [], ids: 0 };
  let clock = 1_000_000;
  const queue = [...steps];
  const dependencies = {
    checkCapability: async () => (typeof capability === 'function' ? capability() : capability),
    importTrip: async (body) => {
      calls.import.push(body);
      const step = queue.length > 1 ? queue.shift() : queue[0];
      if (step instanceof Error) throw step;
      return typeof step === 'function' ? step(body) : step ?? { created: true, id: body.id };
    },
    listOwnTripIds: async () => ownTrips,
    newId: () => `attempt-${++calls.ids}`,
    now: () => clock,
    refreshTrips: async () => {
      calls.refresh += 1;
      calls.order.push('refresh');
      if (refreshFails) throw new Error('refresh failed');
    },
    sleep: async (ms) => void calls.sleeps.push(ms),
    store,
  };
  calls.order = [];
  const advance = (ms) => (clock += ms);
  const save = (overrides = {}) =>
    saveSharedTrip(dependencies, { mode: 'tap', shareId, trip, userId: 'user_a', ...overrides });
  return { advance, calls, dependencies, save, store };
};

const apiError = (status, code) => new ApiError(status, code);

const tests = [];
const test = (name, run) => tests.push({ name, run });

test('successful import: sends the B1 body, refreshes Trips, then returns the new Trip to open', async () => {
  const t = setup();
  const outcome = await t.save();
  assert.deepEqual(outcome, { created: true, kind: 'saved', tripId: 'attempt-1' });
  assert.equal(t.calls.import.length, 1);
  assert.deepEqual(t.calls.import[0], {
    description: 'Trip-level note',
    entries: [{ note: 'Go early', placeId: 'place-b' }, { note: '', placeId: 'place-a' }],
    id: 'attempt-1',
    name: 'Shared South Island',
  });
  assert.equal(t.calls.refresh, 1, 'the recipient’s Trips are refreshed');
  assert.equal(t.store.attempts.get(shareId).phase, 'saved');
  assert.equal(t.store.attempts.get(shareId).tripId, 'attempt-1');
});

test('an identical retry answered with 200 is a normal success for the same Trip', async () => {
  const t = setup({ import: [{ created: false, id: 'attempt-1' }] });
  assert.deepEqual(await t.save(), { created: false, kind: 'saved', tripId: 'attempt-1' });
});

test('a refresh failure after a successful import does not lose the saved Trip', async () => {
  const t = setup({ refreshFails: true });
  assert.equal((await t.save()).kind, 'saved');
});

test('signed out: nothing is sent, the attempt is kept, and the same ID is used after sign-in', async () => {
  const t = setup();
  const first = await t.save({ userId: null });
  assert.deepEqual(first, { kind: 'needs-sign-in' });
  assert.equal(t.calls.import.length, 0);
  const pending = t.store.attempts.get(shareId);
  assert.equal(pending.phase, 'awaiting-auth');
  assert.equal(pending.attemptId, 'attempt-1');

  // The screen remounts after the sign-in round trip and continues.
  const second = await t.save({ userId: 'user_a' });
  assert.equal(second.kind, 'saved');
  assert.equal(second.tripId, 'attempt-1');
  assert.equal(t.calls.ids, 1, 'one ID for the whole Save');
  assert.equal(t.calls.import.length, 1);
});

test('after a remount the pending Save resumes automatically with the same ID, and only once', async () => {
  const t = setup();
  await t.save({ userId: null });
  const resumed = await t.save({ mode: 'resume', userId: 'user_a' });
  assert.deepEqual(resumed, { created: true, kind: 'saved', tripId: 'attempt-1' });
  assert.equal((await t.save({ mode: 'resume', userId: 'user_a' })).kind, 'nothing-pending');
  assert.equal(t.calls.import.length, 1);
});

test('resume never starts a Save the user did not begin, and ignores stale attempts', async () => {
  const t = setup();
  assert.equal((await t.save({ mode: 'resume' })).kind, 'nothing-pending');
  assert.equal(t.store.attempts.size, 0);
  assert.equal(t.calls.ids, 0);

  await t.save({ userId: null });
  t.advance(RESUME_WINDOW_MS + 1);
  assert.equal((await t.save({ mode: 'resume', userId: 'user_a' })).kind, 'nothing-pending');
  assert.equal(t.calls.import.length, 0);
});

test('repeated taps while a Save is running share one request and one Trip', async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const t = setup({ import: [async (body) => { await gate; return { created: true, id: body.id }; }] });
  const taps = [t.save(), t.save(), t.save()];
  await new Promise((resolve) => setTimeout(resolve, 10));
  release();
  const outcomes = await Promise.all(taps);
  assert.ok(outcomes.every((outcome) => outcome.kind === 'saved' && outcome.tripId === 'attempt-1'));
  assert.equal(t.calls.import.length, 1);
  assert.equal(t.calls.ids, 1);
});

test('network failure is retried with the same ID and the identical body', async () => {
  const t = setup({ import: [new TypeError('Network request failed'), new TypeError('Network request failed'), { created: true, id: 'attempt-1' }] });
  const outcome = await t.save();
  assert.equal(outcome.kind, 'saved');
  assert.equal(t.calls.import.length, 3);
  assert.equal(new Set(t.calls.import.map((body) => JSON.stringify(body))).size, 1);
  assert.equal(t.calls.ids, 1);
  assert.deepEqual(t.calls.sleeps, [600, 1200]);
});

test('an ambiguous failure never creates a new ID; the next tap re-sends the same request', async () => {
  const t = setup({ import: [new TypeError('Network request failed')] });
  assert.equal((await t.save()).kind, 'offline');
  assert.equal(t.calls.import.length, 3);
  assert.equal(t.store.attempts.get(shareId).phase, 'submitting');

  const retry = setup();
  retry.store.attempts.set(shareId, { ...t.store.attempts.get(shareId) });
  const outcome = await retry.save();
  assert.equal(outcome.tripId, 'attempt-1');
  assert.equal(retry.calls.ids, 0, 'no new ID was generated');
});

test('server errors are retried then reported as failed, keeping the attempt', async () => {
  const t = setup({ import: [apiError(503, 'unavailable')] });
  assert.equal((await t.save()).kind, 'failed');
  assert.equal(t.calls.import.length, 3);
  assert.equal(t.store.attempts.get(shareId).attemptId, 'attempt-1');
});

test('a 422 is rejected without retrying, and the next explicit tap starts a fresh attempt', async () => {
  const t = setup({ import: [apiError(422, 'validation_failed')] });
  assert.equal((await t.save()).kind, 'rejected');
  assert.equal(t.calls.import.length, 1);
  assert.equal(t.store.attempts.has(shareId), false);
});

test('409 content mismatch on a Trip the account owns: no new copy, offer the existing Trip', async () => {
  const t = setup({ import: [apiError(409, 'itinerary_import_content_mismatch')], ownTrips: ['attempt-1', 'other'] });
  const outcome = await t.save();
  assert.deepEqual(outcome, { code: 'itinerary_import_content_mismatch', existingTripId: 'attempt-1', kind: 'conflict' });
  assert.equal(t.calls.import.length, 1, 'not retried');
  assert.equal(t.calls.ids, 1, 'no automatic new copy');
  const message = describeSaveFeedback(outcome);
  assert.equal(message.openSavedTripId, 'attempt-1');
  assert.match(message.text, /already be saved/);
  assert.match(message.text, /edited/);

  // A later deliberate tap is a new Save with a new ID.
  const second = await saveSharedTrip(t.dependencies, { mode: 'tap', shareId, trip, userId: 'user_a' });
  assert.equal(second.kind, 'conflict', 'scripted server still conflicts');
  assert.equal(t.calls.import.at(-1).id, 'attempt-2');
});

test('409 content mismatch that cannot be verified as owned offers nothing to open', async () => {
  const t = setup({ import: [apiError(409, 'itinerary_import_content_mismatch')], ownTrips: [] });
  const outcome = await t.save();
  assert.equal(outcome.kind, 'conflict');
  assert.equal(outcome.existingTripId, undefined);
  assert.equal(describeSaveFeedback(outcome).openSavedTripId, undefined);
  assert.equal(t.store.attempts.has(shareId), false);
});

test('409 deleted and 409 in-use end the attempt without an automatic copy', async () => {
  for (const code of ['itinerary_deleted', 'itinerary_id_in_use']) {
    const t = setup({ import: [apiError(409, code)] });
    const outcome = await t.save();
    assert.deepEqual(outcome, { code, kind: 'conflict' });
    assert.equal(t.calls.import.length, 1);
    assert.equal(t.store.attempts.has(shareId), false);
  }
});

test('a deleted saved copy: the next explicit tap saves a new copy under a new ID', async () => {
  const t = setup({ import: [apiError(409, 'itinerary_deleted'), { created: true, id: 'attempt-2' }] });
  await t.save();
  const next = await t.save();
  assert.deepEqual(next, { created: true, kind: 'saved', tripId: 'attempt-2' });
});

test('a deliberate second Save after a completed one creates another independent copy', async () => {
  const t = setup({ import: [(body) => ({ created: true, id: body.id })] });
  const first = await t.save();
  const second = await t.save();
  assert.equal(first.tripId, 'attempt-1');
  assert.equal(second.tripId, 'attempt-2');
  assert.notEqual(first.tripId, second.tripId);
});

test('an attempt submitted by another account is never reused', async () => {
  const t = setup();
  t.store.attempts.set(shareId, { attemptId: 'old', createdAt: 1_000_000, ownerUserId: 'user_other', phase: 'submitting', shareId });
  const outcome = await t.save({ userId: 'user_a' });
  assert.equal(outcome.tripId, 'attempt-1');
  assert.equal(t.calls.import[0].id, 'attempt-1');
});

test('missing capability: nothing is sent, no sign-in is requested, the Save is not reported as done', async () => {
  const t = setup({ capability: 'unsupported' });
  for (const userId of [null, 'user_a']) {
    const outcome = await t.save({ userId });
    assert.deepEqual(outcome, { kind: 'unsupported' });
  }
  assert.equal(t.calls.import.length, 0);
  assert.equal(t.calls.refresh, 0);
  assert.equal(t.store.attempts.get(shareId).attemptId, 'attempt-1', 'pending state is preserved');
  const message = describeSaveFeedback({ kind: 'unsupported' });
  assert.match(message.text, /not available yet/);
  assert.ok(!/\b(404|409|422|endpoint|capability|itinerary)\b/i.test(message.text));
});

test('an unreachable API is offline, not "unsupported", and sends nothing', async () => {
  const t = setup({ capability: 'unreachable' });
  assert.deepEqual(await t.save(), { kind: 'offline' });
  assert.equal(t.calls.import.length, 0);
});

test('a 401 from the import returns to sign-in without losing the attempt', async () => {
  const t = setup({ import: [apiError(401, 'mobile_session_required')] });
  assert.deepEqual(await t.save(), { kind: 'needs-sign-in' });
  assert.equal(t.store.attempts.get(shareId).phase, 'awaiting-auth');
  assert.equal(t.store.attempts.get(shareId).attemptId, 'attempt-1');
});

test('user-facing messages avoid technical terms', () => {
  const outcomes = [
    { kind: 'needs-sign-in' }, { kind: 'sign-in-cancelled' }, { kind: 'unsupported' }, { kind: 'offline' },
    { kind: 'failed' }, { kind: 'rejected' },
    { code: 'itinerary_deleted', kind: 'conflict' }, { code: 'itinerary_id_in_use', kind: 'conflict' },
    { code: 'itinerary_import_content_mismatch', kind: 'conflict' },
    { code: 'itinerary_import_content_mismatch', existingTripId: 'x', kind: 'conflict' },
  ];
  for (const outcome of outcomes) {
    const message = describeSaveFeedback(outcome);
    assert.ok(message.text.length > 0);
    assert.ok(!/\b(40\d|42\d|50\d|http|api|endpoint|itn_|uuid|itinerary|409)\b/i.test(message.text), message.text);
  }
  assert.equal(describeSaveFeedback({ created: true, kind: 'saved', tripId: 'x' }), null);
});

test('the attempt store round-trips and ignores corrupt or mismatched data', async () => {
  const data = new Map();
  const storage = {
    getItem: async (key) => data.get(key) ?? null,
    removeItem: async (key) => void data.delete(key),
    setItem: async (key, value) => void data.set(key, value),
  };
  const store = createAsyncStorageAttemptStore(storage);
  const attempt = { attemptId: 'a1', createdAt: 5, ownerUserId: null, phase: 'awaiting-auth', shareId };
  assert.equal(await store.load(shareId), null);
  await store.save(attempt);
  assert.deepEqual(await store.load(shareId), attempt);
  await store.clear(shareId);
  assert.equal(await store.load(shareId), null);

  const [key] = (await store.save(attempt), [...data.keys()]);
  data.set(key, '{not json');
  assert.equal(await store.load(shareId), null);
  data.set(key, JSON.stringify({ ...attempt, shareId: 'ffffffffffffffff' }));
  assert.equal(await store.load(shareId), null);
  data.set(key, JSON.stringify({ ...attempt, phase: 'bogus' }));
  assert.equal(await store.load(shareId), null);
  assert.ok(!JSON.stringify([...data.values()]).includes('Shared South Island'), 'no Trip content is stored');
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
