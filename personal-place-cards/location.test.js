import assert from 'node:assert/strict';
import { parsePersonalPlaceCardCoordinates } from './location.ts';

function run() {
  assert.equal(parsePersonalPlaceCardCoordinates('', ''), null);
  assert.equal(parsePersonalPlaceCardCoordinates('  ', '\t'), null);
  assert.equal(parsePersonalPlaceCardCoordinates('-36.8', ''), null);

  assert.deepEqual(parsePersonalPlaceCardCoordinates('0', '0'), {
    latitude: 0,
    longitude: 0,
  });
  assert.deepEqual(parsePersonalPlaceCardCoordinates('-90', '180'), {
    latitude: -90,
    longitude: 180,
  });

  assert.equal(parsePersonalPlaceCardCoordinates('north', '174.7'), null);
  assert.equal(parsePersonalPlaceCardCoordinates('-91', '174.7'), null);
  assert.equal(parsePersonalPlaceCardCoordinates('-36.8', '181'), null);

  console.log('✓ Personal Place Card coordinate parsing');
}

run();
