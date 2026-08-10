import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modal = await readFile(new URL('./add-to-trip-modal.tsx', import.meta.url), 'utf8');

assert.match(modal, /try \{[\s\S]*await onCreateTrip\(trimmed\);[\s\S]*\} catch \{/);
assert.match(modal, /Could not create the Trip\. Check your connection and try again\./);
assert.match(modal, /error instanceof CreateTripWithPlaceError && error\.stage === 'attach'/);
assert.match(modal, /The Trip was created, but the place could not be added\./);
assert.match(modal, /try \{[\s\S]*await onSelectTrip\(tripId\);[\s\S]*\} catch \{/);
assert.match(modal, /Could not add this place to the Trip\. Check your connection and try again\./);
assert.match(modal, /onPress=\{\(\) => void handleSelectTrip\(trip\.id\)\}/);
assert.match(modal, /onPress=\{\(\) => void handleSubmit\(\)\}/);
console.log('✓ Add to Trip modal reports create, attach, and selection failures inline');
