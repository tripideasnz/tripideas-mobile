// B2: receiving a shared Trip — anonymous snapshot retrieval, parsing, and the B1 import body.
import assert from 'node:assert/strict';

import {
  SHARE_ID_PATTERN,
  buildImportRequest,
  buildSharedTripSnapshotUrl,
  fetchSharedTrip,
  normalizeShareId,
  parseSharedTrip,
} from './shared-trip.ts';

const shareId = '0123456789abcdef';
const attemptId = '3f2b8c1e-5d4a-4f7e-9a6b-1c2d3e4f5a6b';
const snapshot = {
  coverImageUrl: 'https://cdn.sanity.io/cover.jpg',
  note: 'Trip-level note',
  placeCount: 3,
  places: [
    { coordinates: { lat: -41.2, lng: 174.7 }, imageUrl: 'https://cdn.sanity.io/a.jpg', note: 'Go early', placeId: 'place-b', slug: 'harbour', subtitle: 'Wellington', title: 'Harbour' },
    { note: '', placeId: 'place-a', title: 'Museum' },
    { note: 'Book ahead', placeId: 'place-c', title: 'Gardens' },
  ],
  title: 'Shared South Island',
};

const tests = [];
const test = (name, run) => tests.push({ name, run });

test('retrieves the snapshot anonymously from the web endpoint (no credentials sent)', async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ headers: init?.headers ?? {}, url: String(url) });
    return Response.json(snapshot);
  };
  const result = await fetchSharedTrip(shareId, fetcher);
  assert.equal(result.status, 'ok');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://www.tripideas.nz/api/trips/share/${shareId}`);
  assert.equal(calls[0].url, buildSharedTripSnapshotUrl(shareId));
  const headerNames = Object.keys(calls[0].headers).map((name) => name.toLowerCase());
  assert.ok(!headerNames.includes('authorization'));
  assert.ok(!headerNames.includes('cookie'));
});

test('keeps title, Trip note and every Place in the original order with its note', async () => {
  const { trip } = await fetchSharedTrip(shareId, async () => Response.json(snapshot));
  assert.equal(trip.title, 'Shared South Island');
  assert.equal(trip.note, 'Trip-level note');
  assert.deepEqual(trip.places.map((place) => place.placeId), ['place-b', 'place-a', 'place-c']);
  assert.deepEqual(trip.places.map((place) => place.note), ['Go early', '', 'Book ahead']);
  assert.equal(trip.places[0].subtitle, 'Wellington');
  assert.deepEqual(trip.places[0].coordinates, { lat: -41.2, lng: 174.7 });
});

test('a missing or null note becomes an empty note, not a failure', () => {
  const trip = parseSharedTrip({ places: [{ note: null, placeId: 'p', title: 'P' }, { placeId: 'q', title: 'Q' }], title: 'T' });
  assert.equal(trip.note, '');
  assert.deepEqual(trip.places.map((place) => place.note), ['', '']);
});

test('an unknown or malformed share link is not-found without any request', async () => {
  let called = 0;
  const fetcher = async () => {
    called += 1;
    return Response.json(snapshot);
  };
  for (const bad of ['', 'short', 'ZZZZZZZZZZZZZZZZ', '0123456789ABCDEF', '0123456789abcdef0', '../etc']) {
    assert.deepEqual(await fetchSharedTrip(bad, fetcher), { status: 'not-found' });
  }
  assert.equal(called, 0);
  assert.equal(normalizeShareId(undefined), null);
  assert.equal(normalizeShareId(['bad']), null);
  assert.equal(normalizeShareId([shareId, 'x']), shareId);
  assert.equal(normalizeShareId(` ${shareId} `), shareId);
  assert.ok(SHARE_ID_PATTERN.test(shareId));
});

test('a 404 from the server is not-found', async () => {
  const result = await fetchSharedTrip(shareId, async () => Response.json({ error: 'not_found' }, { status: 404 }));
  assert.deepEqual(result, { status: 'not-found' });
});

test('network failure, server errors and unusable bodies are unavailable (retryable), not not-found', async () => {
  const unavailable = { status: 'unavailable' };
  assert.deepEqual(await fetchSharedTrip(shareId, async () => { throw new TypeError('Network request failed'); }), unavailable);
  assert.deepEqual(await fetchSharedTrip(shareId, async () => Response.json({}, { status: 502 })), unavailable);
  assert.deepEqual(await fetchSharedTrip(shareId, async () => new Response('<html>', { status: 200 })), unavailable);
  assert.deepEqual(await fetchSharedTrip(shareId, async () => Response.json({ places: 'nope', title: 'T' })), unavailable);
  assert.deepEqual(await fetchSharedTrip(shareId, async () => Response.json({ places: [{ title: 'No id' }], title: 'T' })), unavailable);
  assert.deepEqual(await fetchSharedTrip(shareId, async () => Response.json({ places: [], title: '   ' })), unavailable);
});

test('an empty shared Trip is valid', () => {
  assert.deepEqual(parseSharedTrip({ note: '', places: [], title: 'Empty' }), {
    coverImageUrl: undefined,
    note: '',
    places: [],
    title: 'Empty',
  });
});

test('the B1 import body carries only title, note, editorial Place IDs, notes and order', () => {
  const trip = parseSharedTrip(snapshot);
  const body = buildImportRequest(attemptId, trip);
  assert.deepEqual(body, {
    description: 'Trip-level note',
    entries: [
      { note: 'Go early', placeId: 'place-b' },
      { note: '', placeId: 'place-a' },
      { note: 'Book ahead', placeId: 'place-c' },
    ],
    id: attemptId,
    name: 'Shared South Island',
  });
  const text = JSON.stringify(body);
  for (const untrusted of ['coordinates', 'imageUrl', 'subtitle', 'slug', 'Harbour', 'cdn.sanity.io', 'type', 'personalPlaceCardId']) {
    assert.ok(!text.includes(untrusted), `${untrusted} must not be sent`);
  }
});

test('the same snapshot and attempt ID always produce an identical body (safe server-side retry)', () => {
  const first = JSON.stringify(buildImportRequest(attemptId, parseSharedTrip(snapshot)));
  const second = JSON.stringify(buildImportRequest(attemptId, parseSharedTrip(JSON.parse(JSON.stringify(snapshot)))));
  assert.equal(first, second);
  assert.notEqual(first, JSON.stringify(buildImportRequest('another-id', parseSharedTrip(snapshot))));
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
