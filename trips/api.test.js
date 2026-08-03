import assert from 'node:assert/strict';

import { ApiError, setActiveToken } from '../lib/api-client.ts';
import {
  addEditorialEntryRequest,
  addPersonalCardEntryRequest,
  createTripRequest,
  deleteEntryRequest,
  deleteTripRequest,
  listTrips,
  parseTripEntry,
  updateEntryNoteRequest,
  updateTripRequest,
} from './api.ts';

const originalFetch = globalThis.fetch;

async function run() {
  const calls = [];
  let projectedPersonalTitle = 'Original title';
  setActiveToken('test-token');
  globalThis.fetch = async (input, init) => {
    calls.push([String(input), init]);
    const path = String(input);
    if (path.endsWith('/itinerary') && !init?.method) {
      return Response.json([{
        id: 'itn_1',
        name: 'North Island',
        description: 'Trip note',
        entryOrder: ['ite_1'],
      }]);
    }
    if (path.endsWith('/itinerary/itn_1/entries')) {
      return Response.json([
        {
          id: 'ite_1',
          itineraryId: 'itn_1',
          type: 'editorialPlace',
          order: 0,
          note: 'Entry note',
          editorialPlace: { id: 'sanity-place' },
        },
        {
          id: 'ite_personal',
          itineraryId: 'itn_1',
          type: 'personalPlaceCard',
          order: 1,
          note: null,
          personalPlaceCard: {
            id: 'ppc_1',
            title: projectedPersonalTitle,
            body: 'Canonical body',
            location: null,
            version: projectedPersonalTitle === 'Original title' ? 1 : 2,
            media: [],
            readiness: { isTripIdeaReady: true, readinessIssues: [] },
            createdAt: '2026-07-30T00:00:00.000Z',
            updatedAt: '2026-07-30T00:00:00.000Z',
          },
        },
      ]);
    }
    if (path.endsWith('/entry') && init?.method === 'POST') {
      return Response.json({ id: 'ite_2' });
    }
    if (path.endsWith('/itinerary') && init?.method === 'POST') {
      return Response.json({ id: 'itn_2' });
    }
    return Response.json({ ok: true });
  };

  const trips = await listTrips();
  assert.equal(trips[0].id, 'itn_1');
  assert.equal(trips[0].note, 'Trip note');
  assert.deepEqual(trips[0].places[0], {
    addedAt: trips[0].places[0].addedAt,
    entryId: 'ite_1',
    note: 'Entry note',
    placeId: 'sanity-place',
  });

  await createTripRequest({ id: 'itn_2', name: 'South', entryOrder: [] });
  await addEditorialEntryRequest('itn_1', {
    id: 'ite_2',
    note: 'Keep',
    placeId: 'sanity-two',
  });
  await addPersonalCardEntryRequest('itn_1', {
    id: 'ite_personal',
    note: 'Private stop',
    personalPlaceCardId: 'ppc_1',
  });
  await updateTripRequest('itn_1', {
    description: 'Updated',
    entryOrder: ['ite_1', 'ite_2'],
    name: 'North',
  });
  await updateEntryNoteRequest('itn_1', 'ite_1', 'Changed');
  await deleteEntryRequest('itn_1', 'ite_1');
  await deleteTripRequest('itn_1');

  assert.equal(calls.every(([, init]) =>
    new Headers(init?.headers).get('Authorization') === 'Bearer test-token'
  ), true);
  assert.deepEqual(JSON.parse(String(calls[3][1].body)), {
    id: 'ite_2',
    note: 'Keep',
    placeId: 'sanity-two',
    type: 'editorialPlace',
  });
  assert.deepEqual(JSON.parse(String(calls[5][1].body)).entryOrder, [
    'ite_1',
    'ite_2',
  ]);
  projectedPersonalTitle = 'Updated title';
  const refreshedTrips = await listTrips(trips);
  const refreshedPersonalEntry = refreshedTrips[0].entries.find(
    (entry) => entry.type === 'personalPlaceCard' && 'personalPlaceCard' in entry
  );
  assert.equal(refreshedPersonalEntry.personalPlaceCard.title, 'Updated title');
  const personal = parseTripEntry({
    id: 'ite_personal',
    itineraryId: 'itn_1',
    note: 'Private stop',
    order: 1,
    type: 'personalPlaceCard',
    personalPlaceCard: {
      id: 'ppc_1', title: null, body: null, location: null, version: 1, media: [],
      readiness: { isTripIdeaReady: false, readinessIssues: ['missing_title'] },
      createdAt: '2026-07-30T00:00:00.000Z',
      updatedAt: '2026-07-30T00:00:00.000Z',
    },
  });
  assert.equal(personal.type, 'personalPlaceCard');
  const unavailable = parseTripEntry({
    id: 'ite_missing',
    itineraryId: 'itn_1',
    note: 'Retained',
    order: 2,
    type: 'personalPlaceCard',
    unavailable: { reason: 'personal_place_card_unavailable' },
  });
  assert.equal(unavailable.unavailable.reason, 'personal_place_card_unavailable');
  assert.throws(() => parseTripEntry({
    id: 'bad', itineraryId: 'itn_1', note: null, order: 0, type: 'unknown',
  }), ApiError);
  console.log('✓ authenticated Trip API contract and editorial DTO parsing');
}

void run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
    setActiveToken(null);
  });
