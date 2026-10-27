import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const originalFetch = globalThis.fetch;

const { createPublicTripShare, isPublicTripSharingEnabled } = await import('./public-sharing.ts');

assert.equal(isPublicTripSharingEnabled('https://api.tripideas.nz'), true);
assert.equal(isPublicTripSharingEnabled('https://api.tripideas.nz/'), true);
assert.equal(isPublicTripSharingEnabled('https://integration-api-integration.up.railway.app'), false);
assert.equal(isPublicTripSharingEnabled('https://tripideas-api-integration-staging.up.railway.app'), false);
assert.equal(isPublicTripSharingEnabled('http://localhost:3001'), false);
console.log('✓ Public Trip links are enabled only for the production API');

let fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  throw new Error('unexpected network call');
};
try {
  process.env.EXPO_PUBLIC_API_URL = 'https://integration-api-integration.up.railway.app';
  const result = await createPublicTripShare({ places: [], sourceTripId: 'itn_test', title: 'Test' });
  assert.deepEqual(result, { reason: 'disabled', status: 'unavailable' });
  assert.equal(fetchCalls, 0);
} finally {
  globalThis.fetch = originalFetch;
  if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
}
console.log('✓ Internal builds never send public Trip snapshots');

const tripDetail = await readFile(new URL('../app/trips/[tripId].tsx', import.meta.url), 'utf8');
assert.match(
  tripDetail,
  /isPublicTripSharingEnabled\(\) \? createPublicShare\(\) : openShareSheet\(\)/
);
assert.match(tripDetail, /text: 'Preview'/);
console.log('✓ Trip Share falls back to text sharing in internal builds');
