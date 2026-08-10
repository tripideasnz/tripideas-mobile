import assert from 'node:assert/strict';

import { ApiError } from '../lib/api-client.ts';
import { tripRequestDiagnostic } from './error-diagnostic.ts';
import { CreateTripWithPlaceError } from './workflow-errors.ts';

const apiError = new ApiError(422, 'invalid_place');
assert.equal(tripRequestDiagnostic(apiError), ' (422: invalid_place)');
assert.equal(
  tripRequestDiagnostic(new CreateTripWithPlaceError('attach', 'trip-1', apiError)),
  ' (422: invalid_place)'
);
assert.equal(tripRequestDiagnostic(new Error('offline')), '');

console.log('✓ Trip request diagnostics expose only API status and code');
