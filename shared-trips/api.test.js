// Shared Trips API clients: paths, methods, bodies, authentication, strict parsing and error mapping.
import assert from 'node:assert/strict';

import { ApiError, setActiveToken, setAuthenticatedSessionHandlers } from '../lib/api-client.ts';
import * as api from './api.ts';
import { classifyError } from './errors.ts';
import { detail, fakeFetch, on, onPrefix, previewDto, summary } from './fixtures.js';
import { previewLoadFailure } from './view-model.ts';

const originalFetch = globalThis.fetch;
const tests = [];
const test = (name, run) => tests.push({ name, run });
const withFetch = async (fetcher, run) => {
  globalThis.fetch = fetcher;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
};
const json = (value, status = 200) => Response.json(value, { status });

test('lists Shared With Me and reads one Shared Trip with the bearer token', async () => {
  setActiveToken('token-1');
  const fetcher = fakeFetch([
    [on('GET', '/shared-trips'), () => json({ sharedTrips: [summary()] })],
    [on('GET', '/shared-trips/fc_1'), () => json(detail())],
  ]);
  await withFetch(fetcher, async () => {
    const list = await api.listSharedTrips();
    assert.deepEqual(list.map((trip) => trip.id), ['fc_1']);
    const one = await api.getSharedTrip('fc_1');
    assert.deepEqual(one.places.map((p) => p.itemId), ['fci_a', 'fci_b', 'fci_c']);
    assert.equal(one.viewer.role, 'member');
  });
  assert.ok(fetcher.calls.every((call) => call.headers.Authorization === 'Bearer token-1'));
});

test('ids in paths are encoded', async () => {
  setActiveToken('t');
  const fetcher = fakeFetch([[onPrefix('GET', '/shared-trips/'), () => json(detail())]]);
  await withFetch(fetcher, () => api.getSharedTrip('a/b c'));
  assert.equal(fetcher.calls[0].path, '/shared-trips/a%2Fb%20c');
});

test('sharing a Trip sends a bodyless POST with no JSON content type', async () => {
  setActiveToken('t');
  const fetcher = fakeFetch([[on('POST', '/itinerary/itn_1/share'), () => json({ collectionId: 'fc_1', created: true, url: 'https://web/x' }, 201)]]);
  await withFetch(fetcher, async () => {
    assert.deepEqual(await api.shareTrip('itn_1'), { collectionId: 'fc_1', created: true, url: 'https://web/x' });
  });
  assert.equal(fetcher.calls[0].headers['Content-Type'], undefined);
  assert.equal(fetcher.calls[0].body, undefined);
});

test('join and leave use the existing collection routes, joining as the signed-in user', async () => {
  setActiveToken('t');
  const fetcher = fakeFetch([
    [on('POST', '/favourites-collection/share'), () => json({ alreadyShared: true, collectionId: 'fc_1', id: 's' })],
    [on('POST', '/favourites-collection/exit'), () => json({ success: true })],
  ]);
  await withFetch(fetcher, async () => {
    assert.deepEqual(await api.joinSharedTrip('fc_1'), { alreadyJoined: true });
    await api.leaveSharedTrip('fc_1');
  });
  assert.deepEqual(fetcher.calls.map((c) => [c.method, c.path, c.body]), [
    ['POST', '/favourites-collection/share', { collectionId: 'fc_1' }],
    ['POST', '/favourites-collection/exit', { collectionId: 'fc_1' }],
  ]);
  assert.equal(JSON.stringify(fetcher.calls[0].body).includes('shareToUserId'), false); // never names another user
});

test('note calls create, edit and delete only by note id or item id', async () => {
  setActiveToken('t');
  const fetcher = fakeFetch([
    [on('POST', '/collection-comments'), () => json({ id: 'cn_new' })],
    [onPrefix('PATCH', '/collection-comments/'), () => json({ id: 'cn_new' })],
    [onPrefix('DELETE', '/collection-comments/'), () => new Response(null, { status: 204 })],
    [on('POST', '/collection-item-comments'), () => json({ id: 'pn_new' })],
    [onPrefix('PATCH', '/collection-item-comments/'), () => json({ id: 'pn_new' })],
    [onPrefix('DELETE', '/collection-item-comments/'), () => new Response(null, { status: 204 })],
  ]);
  await withFetch(fetcher, async () => {
    assert.deepEqual(await api.saveCollectionNote('fc_1', 'hello'), { id: 'cn_new' });
    await api.updateCollectionNote('cn_new', 'edited');
    await api.deleteCollectionNote('cn_new');
    assert.deepEqual(await api.savePlaceNote('fci_a', 'place'), { id: 'pn_new' });
    await api.updatePlaceNote('pn_new', 'edited place');
    await api.deletePlaceNote('pn_new');
  });
  assert.deepEqual(fetcher.calls.map((c) => [c.method, c.path, c.body]), [
    ['POST', '/collection-comments', { collectionId: 'fc_1', text: 'hello' }],
    ['PATCH', '/collection-comments/cn_new', { text: 'edited' }],
    ['DELETE', '/collection-comments/cn_new', undefined],
    ['POST', '/collection-item-comments', { collectionItemId: 'fci_a', text: 'place' }],
    ['PATCH', '/collection-item-comments/pn_new', { text: 'edited place' }],
    ['DELETE', '/collection-item-comments/pn_new', undefined],
  ]);
  assert.equal(fetcher.calls[2].headers['Content-Type'], undefined); // bodyless DELETE
});

test('the public preview is one request, works signed out, and parses the creator\'s content', async () => {
  setActiveToken(null);
  const fetcher = fakeFetch([[on('GET', '/collections/fc_1/preview'), () => json({ ...previewDto(), extra: 'ignored', creator: { displayName: 'Ana', email: 'x@y.z' } })]]);
  await withFetch(fetcher, async () => {
    assert.deepEqual(await api.fetchCollectionPreview('fc_1'), {
      creatorName: 'Ana',
      id: 'fc_1',
      places: [
        { note: 'Book early', placeId: 'place-a' },
        { note: null, placeId: 'place-b' },
        { note: 'Sunrise', placeId: 'place-c' },
      ],
      title: 'South Island',
      tripNote: 'Pack warm',
    });
  });
  assert.equal(fetcher.calls.length, 1); // no per-Place or per-note requests
  assert.equal(fetcher.calls[0].headers.Authorization, undefined);
});

test('a preview with no creator name or notes is valid; blank notes mean "no note"', async () => {
  setActiveToken(null);
  const fetcher = fakeFetch([[on('GET', '/collections/fc_1/preview'), () => json(previewDto({
    creator: { displayName: null }, places: [{ note: { text: '   ', updatedAt: 'u' }, placeId: 'p', position: 0 }], tripNote: null,
  }))]]);
  await withFetch(fetcher, async () => {
    const preview = await api.fetchCollectionPreview('fc_1');
    assert.equal(preview.creatorName, null);
    assert.equal(preview.tripNote, null);
    assert.deepEqual(preview.places, [{ note: null, placeId: 'p' }]);
  });
});

test('an incomplete or inconsistent preview is refused as a whole (never a half-read Trip)', async () => {
  setActiveToken(null);
  const broken = {
    'no places list': (d) => { delete d.places; },
    'no creator': (d) => { delete d.creator; },
    'a Place without an id': (d) => { d.places[1].placeId = ''; },
    'Places out of order': (d) => { d.places[1].position = 5; },
    'a note without text': (d) => { d.places[0].note = { updatedAt: 'u' }; },
    'a blank title': (d) => { d.collection.title = '  '; },
    'not shared': (d) => { d.sharing.status = 'private'; },
    'not copyable': (d) => { d.sharing.canSaveCopy = false; },
    'not an object': (d, set) => set('nope'),
  };
  for (const [label, damage] of Object.entries(broken)) {
    let body = previewDto();
    damage(body, (value) => { body = value; });
    await withFetch(fakeFetch([[on('GET', '/collections/fc_1/preview'), () => json(body)]]), async () => {
      await assert.rejects(api.fetchCollectionPreview('fc_1'), (e) => e.code === 'malformed_response', label);
    });
  }
});

test('the preview route\'s errors are told apart: unavailable Trip, invalid link, and an API without the route', async () => {
  setActiveToken(null);
  const fail = (status, body) => fakeFetch([[on('GET', '/collections/fc_1/preview'), () => json(body, status)]]);
  const outcome = async (fetcher) => withFetch(fetcher, async () => { try { await api.fetchCollectionPreview('fc_1'); } catch (e) { outcome.last = e; } });
  await outcome(fail(404, { code: 'preview_unavailable', message: 'x' }));
  assert.equal(previewLoadFailure(outcome.last).status, 'not-found');
  await outcome(fail(400, { code: 'invalid_collection_id', message: 'x' }));
  assert.equal(previewLoadFailure(outcome.last).status, 'not-found');
  await outcome(fail(404, { message: 'Not found' })); // a generic route 404: this API build lacks the capability
  assert.equal(previewLoadFailure(outcome.last).status, 'unsupported');
  await outcome(fail(503, { message: 'down' }));
  assert.equal(previewLoadFailure(outcome.last).status, 'unavailable');
  assert.equal(previewLoadFailure(new TypeError('Network request failed')).status, 'unavailable');
  assert.equal(api.SHARED_TRIP_PREVIEW_CAPABILITY, 'shared-trip-preview-v1');
});

test('owned Trips carry the collection that publishes them; older APIs without the field mean "not shared"', async () => {
  setActiveToken('t');
  const fetcher = fakeFetch([[on('GET', '/itinerary'), () => json([
    { description: null, entryOrder: [], id: 'itn_1', name: 'A', sharedCollectionId: 'fc_1' },
    { description: 'n', entryOrder: ['e'], id: 'itn_2', name: 'B' },
    { description: null, entryOrder: [], id: 'itn_3', name: 'C', sharedCollectionId: null },
  ])]]);
  await withFetch(fetcher, async () => {
    assert.deepEqual(await api.listOwnedTrips(), [
      { id: 'itn_1', name: 'A', sharedCollectionId: 'fc_1' },
      { id: 'itn_2', name: 'B', sharedCollectionId: null },
      { id: 'itn_3', name: 'C', sharedCollectionId: null },
    ]);
  });
  const bad = fakeFetch([[on('GET', '/itinerary'), () => json([{ description: null, entryOrder: [], id: 'x', name: 'y', sharedCollectionId: 5 }])]]);
  await withFetch(bad, async () => {
    await assert.rejects(api.listOwnedTrips(), (e) => e instanceof ApiError && e.code === 'malformed_response');
  });
});

test('a response missing a field the app needs is malformed, never a half-filled Trip', async () => {
  setActiveToken('t');
  const broken = [
    () => { const d = detail(); delete d.permissions.canLeave; return d; },
    () => { const d = detail(); d.places[1].position = 7; return d; },
    () => { const d = detail(); d.viewer.role = 'admin'; return d; },
    () => { const d = detail(); d.notes[0].author = null; return d; },
    () => ({ ...detail(), places: 'nope' }),
  ];
  for (const make of broken) {
    await withFetch(fakeFetch([[onPrefix('GET', '/shared-trips/'), () => json(make())]]), async () => {
      await assert.rejects(api.getSharedTrip('fc_1'), (e) => e instanceof ApiError && e.code === 'malformed_response');
    });
  }
  await withFetch(fakeFetch([[on('GET', '/shared-trips'), () => json({ sharedTrips: [{ id: 'x' }] })]]), async () => {
    await assert.rejects(api.listSharedTrips(), (e) => e instanceof ApiError && e.code === 'malformed_response');
  });
});

test('fields the app does not know are ignored (forward compatible)', async () => {
  setActiveToken('t');
  const d = detail();
  d.extra = 'x';
  d.places[0].extra = true;
  d.notes[0].author.email = 'must-not-matter';
  await withFetch(fakeFetch([[onPrefix('GET', '/shared-trips/'), () => json(d)]]), async () => {
    const parsed = await api.getSharedTrip('fc_1');
    assert.equal('extra' in parsed, false);
    assert.equal('email' in parsed.notes[0].author, false);
  });
});

test('an unreadable body is malformed_response; a failed network call is not an ApiError', async () => {
  setActiveToken('t');
  await withFetch(fakeFetch([[onPrefix('GET', '/shared-trips/'), () => new Response('<html>', { status: 200 })]]), async () => {
    await assert.rejects(api.getSharedTrip('fc_1'), (e) => e instanceof ApiError && e.code === 'malformed_response');
  });
  await withFetch(async () => { throw new TypeError('Network request failed'); }, async () => {
    await assert.rejects(api.getSharedTrip('fc_1'), (e) => !(e instanceof ApiError));
  });
});

test('no session: the request is refused locally with mobile_session_required', async () => {
  setActiveToken(null);
  const fetcher = fakeFetch([]);
  await withFetch(fetcher, async () => {
    await assert.rejects(api.getSharedTrip('fc_1'), (e) => e instanceof ApiError && e.code === 'mobile_session_required' && e.status === 401);
  });
  assert.equal(fetcher.calls.length, 0);
});

test('an expired session is refreshed once and the request retried with the new token', async () => {
  setActiveToken('old');
  let refreshed = 0;
  setAuthenticatedSessionHandlers({
    invalidate: async () => { throw new Error('should not invalidate'); },
    refresh: async () => { refreshed += 1; setActiveToken('new'); return true; },
  });
  const fetcher = fakeFetch([[on('GET', '/shared-trips'), (call) => call.headers.Authorization === 'Bearer new' ? json({ sharedTrips: [] }) : json({ name: 'UNAUTHORIZED' }, 401)]]);
  try {
    await withFetch(fetcher, async () => { assert.deepEqual(await api.listSharedTrips(), []); });
  } finally {
    setAuthenticatedSessionHandlers(null);
  }
  assert.equal(refreshed, 1);
  assert.deepEqual(fetcher.calls.map((c) => c.headers.Authorization), ['Bearer old', 'Bearer new']);
});

test('when the refresh fails the original 401 surfaces; a second 401 invalidates the session', async () => {
  setActiveToken('old');
  setAuthenticatedSessionHandlers({ invalidate: async () => { throw new Error('unexpected'); }, refresh: async () => false });
  try {
    await withFetch(fakeFetch([[on('GET', '/shared-trips'), () => json({ name: 'UNAUTHORIZED' }, 401)]]), async () => {
      await assert.rejects(api.listSharedTrips(), (e) => e instanceof ApiError && e.status === 401);
    });
    let invalidated = 0;
    setAuthenticatedSessionHandlers({ invalidate: async () => { invalidated += 1; }, refresh: async () => true });
    await withFetch(fakeFetch([[on('GET', '/shared-trips'), () => json({ name: 'UNAUTHORIZED' }, 401)]]), async () => {
      await assert.rejects(api.listSharedTrips(), (e) => e instanceof ApiError && e.status === 401);
    });
    assert.equal(invalidated, 1);
  } finally {
    setAuthenticatedSessionHandlers(null);
  }
});

test('the capability check reads /version and treats an unreachable server as unreachable, not unsupported', async () => {
  const ok = fakeFetch([[on('GET', '/version'), () => json({ apiVersion: 1, capabilities: ['shared-trips-v1'] })]]);
  await withFetch(ok, async () => assert.equal(await api.checkSharedTripsCapability(), 'supported'));
  await withFetch(fakeFetch([[on('GET', '/version'), () => json({ apiVersion: 1, capabilities: ['notebooks'] })]]), async () =>
    assert.equal(await api.checkSharedTripsCapability(), 'unsupported'));
  await withFetch(async () => { throw new TypeError('offline'); }, async () => assert.equal(await api.checkSharedTripsCapability(), 'unreachable'));
});

// ---- error classification ----
test('errors are classified so a missing route is never shown as a deleted Trip', () => {
  const e = (status, code) => new ApiError(status, code);
  assert.equal(classifyError(new TypeError('Network request failed')).kind, 'offline');
  assert.equal(classifyError(e(401, 'UNAUTHORIZED')).kind, 'session-expired');
  assert.equal(classifyError(e(401, 'mobile_session_required')).kind, 'session-expired');
  assert.equal(classifyError(e(403, 'not_joined')).kind, 'not-joined');
  assert.equal(classifyError(e(404, 'collection_not_found')).kind, 'not-found');
  assert.equal(classifyError(e(404, 'preview_unavailable')).kind, 'not-found');
  assert.equal(classifyError(e(404, 'NOT_FOUND')).kind, 'unsupported');
  assert.equal(classifyError(e(404, 'request_failed')).kind, 'unsupported');
  assert.equal(classifyError(e(409, 'managed_by_trip')).kind, 'managed-by-trip');
  assert.equal(classifyError(e(422, 'personal_places_not_shareable')).kind, 'rejected');
  assert.equal(classifyError(e(422, 'personal_places_not_shareable')).code, 'personal_places_not_shareable');
  assert.equal(classifyError(e(400, 'request_failed')).kind, 'rejected');
  assert.equal(classifyError(e(429, 'x')).kind, 'server');
  assert.equal(classifyError(e(503, 'x')).kind, 'server');
  assert.equal(classifyError(e(500, 'malformed_response')).kind, 'server');
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
globalThis.fetch = originalFetch;
if (failed) process.exitCode = 1;
