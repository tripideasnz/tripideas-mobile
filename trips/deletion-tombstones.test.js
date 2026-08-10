import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const provider = await readFile(new URL('./provider.tsx', import.meta.url), 'utf8');
const api = await readFile(new URL('./api.ts', import.meta.url), 'utf8');

assert.match(provider, /deletedTripIdsRef\.current = await tripStorage\.addDeletedTripId/);
assert.match(provider, /listTrips\([\s\S]*deletedTripIdsRef\.current/);
assert.match(api, /summaries = \(await listTripSummaries\(\)\)\.filter\(\(summary\) => !excluded\.has\(summary\.id\)\)/);

console.log('✓ confirmed deletions remain excluded from legacy staging lists');
