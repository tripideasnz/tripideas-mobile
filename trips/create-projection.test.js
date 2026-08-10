import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const provider = await readFile(new URL('./provider.tsx', import.meta.url), 'utf8');
const createSection = provider.slice(
  provider.indexOf('const createTrip = useCallback'),
  provider.indexOf('const addPlaceToTrip = useCallback')
);
const createWithPlaceSection = provider.slice(
  provider.indexOf('const createTripWithPlace = useCallback'),
  provider.indexOf('const renameTrip = useCallback')
);

assert.doesNotMatch(createSection, /listTripSummaries|loadTrip/);
assert.match(createSection, /entries: \[\]/);
assert.match(createWithPlaceSection, /entryId = await addEditorialEntryRequest/);
assert.match(createWithPlaceSection, /editorialPlace: \{ id: trimmedPlaceId \}/);
assert.doesNotMatch(createWithPlaceSection, /listTripSummaries|loadTrip/);

console.log('✓ confirmed Trip creates build their projection without incompatible reads');
