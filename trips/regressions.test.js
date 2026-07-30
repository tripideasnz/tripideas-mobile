import assert from 'node:assert/strict';

import { getTripImages } from './images.ts';
import {
  buildPublicTripSnapshot,
  buildPublicTripUrl,
} from './public-sharing.ts';

const trip = {
  id: 'itn_server_authoritative',
  name: 'North Island',
  note: 'Trip note',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  places: [
    {
      addedAt: '2026-07-01T00:00:00.000Z',
      entryId: 'ite_one',
      note: 'Entry note',
      placeId: 'place-one',
    },
  ],
};
const cards = [{
  _id: 'place-one',
  title: 'Taupō',
  slug: { current: 'taupo' },
  imageUrl: 'https://images.example.test/taupo.jpg',
  imageAlt: 'Lake Taupō',
  coordinates: { lat: -38.68, lng: 176.07 },
}];

async function run() {
  assert.deepEqual(getTripImages(trip, cards), [{
    alt: 'Lake Taupō',
    url: 'https://images.example.test/taupo.jpg',
  }]);
  const snapshot = buildPublicTripSnapshot({ places: cards, trip });
  assert.equal(snapshot.sourceTripId, 'itn_server_authoritative');
  assert.equal(snapshot.note, 'Trip note');
  assert.equal(snapshot.places[0].placeId, 'place-one');
  assert.equal(snapshot.places[0].note, 'Entry note');
  assert.equal(buildPublicTripUrl('existing-share'), 'https://tripideas.nz/trip/existing-share');
  console.log('✓ API Trip map/cover and independent public snapshot compatibility');
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
