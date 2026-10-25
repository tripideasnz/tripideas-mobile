import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { getTripImages } from '../trips/images.ts';

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const trip = {
  entries: [{
    id: 'entry-1',
    itineraryId: 'trip-1',
    note: null,
    order: 0,
    personalPlaceCard: { id: 'card-1', title: 'Private beach' },
    type: 'personalPlaceCard',
  }],
  id: 'trip-1',
  name: 'Trip',
  places: [],
};

console.log('Personal photo rendering');

assert.deepEqual(getTripImages(trip, [], { 'card-1': 'https://signed.example/photo' }), [
  { alt: 'Private beach', url: 'https://signed.example/photo' },
]);
console.log('✓ plain URL input keeps its previous output shape');

assert.deepEqual(
  getTripImages(trip, [], {
    'card-1': { cacheKey: 'tripideas:personal-photo:v1:u:a', photoAssetId: 'a', url: 'https://signed.example/photo' },
  }),
  [{
    alt: 'Private beach',
    cacheKey: 'tripideas:personal-photo:v1:u:a',
    photoAssetId: 'a',
    url: 'https://signed.example/photo',
  }]
);
console.log('✓ loaded private photos carry the stable cache key and asset identity');

assert.deepEqual(
  getTripImages(trip, [], { 'card-1': { failed: true, photoAssetId: 'a', url: null } }),
  [{ alt: 'Private beach', failed: true, photoAssetId: 'a', url: '' }]
);
assert.deepEqual(getTripImages(trip, [], {}), []);
console.log('✓ failed photos become a retry placeholder; unloaded photos are omitted');

const [collage, detail, grid, card] = await Promise.all([
  read('components/trip-image-collage.tsx'),
  read('components/place-detail-content.tsx'),
  read('components/place-photo-grid.tsx'),
  read('components/personal-place-card-view.tsx'),
]);
assert.match(collage, /cacheKey: image\.cacheKey, uri: image\.url/);
assert.match(collage, /Photo unavailable\. Tap to retry\./);
assert.match(detail, /cacheKey: hero\.cacheKey, uri: hero\.url/);
assert.match(grid, /item\.cacheKey/);
assert.match(grid, /image\.cacheKey/);
assert.match(card, /photos\.retry\(/);
assert.match(card, /photos\.reportError\(/);
assert.doesNotMatch(card, /setCoverImages|retryImage|authorizationRevision/);
console.log('✓ every private-photo renderer passes the cache key and has a bounded error path');
