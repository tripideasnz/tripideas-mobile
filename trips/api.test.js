import assert from 'node:assert/strict';

import { setActiveToken } from '../lib/api-client.ts';
import {
  addEditorialEntryRequest,
  createTripRequest,
  deleteEntryRequest,
  deleteTripRequest,
  listTrips,
  updateEntryNoteRequest,
  updateTripRequest,
} from './api.ts';

const originalFetch = globalThis.fetch;

async function run() {
  const calls = [];
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
      return Response.json([{
        id: 'ite_1',
        itineraryId: 'itn_1',
        type: 'editorialPlace',
        order: 0,
        note: 'Entry note',
        editorialPlace: { id: 'sanity-place' },
      }]);
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
  assert.deepEqual(JSON.parse(String(calls[4][1].body)).entryOrder, [
    'ite_1',
    'ite_2',
  ]);
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
