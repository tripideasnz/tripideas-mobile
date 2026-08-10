import assert from 'node:assert/strict';

import { CreateTripWithPlaceError } from './workflow-errors.ts';

const createError = new CreateTripWithPlaceError('create', null);
assert.equal(createError.stage, 'create');
assert.equal(createError.tripId, null);
assert.equal(createError.message, 'The Trip could not be created.');

const cause = new Error('request failed');
const attachError = new CreateTripWithPlaceError('attach', 'trip-1', cause);
assert.equal(attachError.stage, 'attach');
assert.equal(attachError.tripId, 'trip-1');
assert.equal(attachError.cause, cause);
assert.equal(attachError.message, 'The Trip was created, but the place could not be added.');

console.log('✓ create-with-place errors preserve the failed workflow stage');
