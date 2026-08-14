import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modal = await readFile(new URL('./add-to-trip-modal.tsx', import.meta.url), 'utf8');

assert.match(modal, /try \{[\s\S]*await onCreateTrip\(trimmed\);[\s\S]*\} catch \(error\) \{/);
assert.match(modal, /const trip = await onCreateTrip\(trimmed\)/);
assert.match(modal, /setCreatedTrip\(trip\)/);
assert.match(modal, /createdTrip \? 'Place added' : 'Add to Trip'/);
assert.match(modal, /<TripIndexCard[\s\S]*getTripImages\(createdTrip, tripPlaces\)/);
assert.match(modal, /Could not create the Trip\$\{tripRequestDiagnostic\(error\)\}/);
assert.match(modal, /error instanceof CreateTripWithPlaceError && error\.stage === 'attach'/);
assert.match(modal, /The Trip was created, but the place could not be added\$\{tripRequestDiagnostic\(error\)\}/);
assert.match(modal, /tripRequestDiagnostic\(error\)/);
assert.match(modal, /try \{[\s\S]*await onSelectTrip\(tripId\);[\s\S]*\} catch \(error\) \{/);
assert.match(modal, /Could not add this place to the Trip\$\{tripRequestDiagnostic\(error\)\}/);
assert.match(modal, /onPress=\{\(\) => void handleSelectTrip\(trip\.id\)\}/);
assert.match(modal, /onPress=\{\(\) => void handleSubmit\(\)\}/);
assert.match(modal, /label="Open Trip"/);
assert.match(modal, /label="Cancel"/);
console.log('✓ Add to Trip modal reports create, attach, and selection failures inline');
