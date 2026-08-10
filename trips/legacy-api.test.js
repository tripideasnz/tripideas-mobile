import assert from 'node:assert/strict';

import { setActiveToken } from '../lib/api-client.ts';
import { loadTrip } from './api.ts';

const originalFetch = globalThis.fetch;

async function run() {
  const paths = [];
  setActiveToken('test-token');
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    paths.push(path);
    if (path === '/itinerary/itn_legacy/entries') {
      return new Response('', { status: 404 });
    }
    if (path === '/itinerary/entries') {
      return Response.json([
        {
          id: 'ite_second',
          itineraryId: 'itn_legacy',
          note: null,
          placeId: 'place-2',
        },
        {
          id: 'ite_other',
          itineraryId: 'itn_other',
          note: null,
          placeId: 'ignore-me',
        },
        {
          id: 'ite_first',
          itineraryId: 'itn_legacy',
          note: 'First note',
          placeId: 'place-1',
        },
      ]);
    }
    throw new Error(`Unexpected request: ${path}`);
  };

  try {
    const trip = await loadTrip({
      description: null,
      entryOrder: ['ite_first', 'ite_second'],
      id: 'itn_legacy',
      name: 'Legacy Trip',
    });
    assert.deepEqual(paths, [
      '/itinerary/itn_legacy/entries',
      '/itinerary/entries',
    ]);
    assert.deepEqual(trip.places.map((place) => place.placeId), [
      'place-1',
      'place-2',
    ]);
    assert.equal(trip.places[0].note, 'First note');

    globalThis.fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === '/itinerary/itn_legacy/entries') {
        return new Response('', { status: 404 });
      }
      if (path === '/itinerary/entries') {
        return Response.json(
          {
            message: 'Validation error: Expected string, received null at "[6].placeId"',
            name: 'BAD_REQUEST',
            status: 400,
          },
          { status: 400 }
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    };
    const preserved = await loadTrip({
      description: 'Updated note',
      entryOrder: ['ite_first', 'ite_second'],
      id: 'itn_legacy',
      name: 'Updated Trip',
    }, trip);
    assert.deepEqual(preserved.entries, trip.entries);
    assert.deepEqual(preserved.places.map((place) => place.placeId), [
      'place-1',
      'place-2',
    ]);
    assert.equal(preserved.name, 'Updated Trip');
    assert.equal(preserved.note, 'Updated note');
  } finally {
    globalThis.fetch = originalFetch;
    setActiveToken(null);
  }
}

await run();
console.log('✓ Trip loading handles both usable and invalid legacy entry responses');
