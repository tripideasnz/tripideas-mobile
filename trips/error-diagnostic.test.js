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
assert.equal(
  tripRequestDiagnostic(new ApiError(400, 'BAD_REQUEST', 'Validation error: Required at "placeId"')),
  ' (400: BAD_REQUEST — Validation error: Required at "placeId")'
);
assert.equal(
  tripRequestDiagnostic(new ApiError(404, 'request_failed', undefined, {
    requestPath: '/itinerary',
    responseUrl: 'https://example.invalid/not-found',
  })),
  ' (404: request_failed; /itinerary → https://example.invalid/not-found)'
);

console.log('✓ Trip request diagnostics expose the safe API validation reason');
