import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const [list, detail, entry, autosave, autosaveStatus, expandable, api, provider] = await Promise.all([
  read('app/trips/index.tsx'),
  read('app/trips/[tripId].tsx'),
  read('components/trip-entry-card.tsx'),
  read('components/ui/autosave-note.tsx'),
  read('components/ui/autosave-status.tsx'),
  read('components/ui/expandable-text.tsx'),
  read('trips/api.ts'),
  read('trips/provider.tsx'),
]);

assert.match(list, /accessibilityLabel="Add Trip"/);
assert.match(list, /accessibilityLabel="Add Trip"[\s\S]*MaterialIcons color=\{Palette\.trip\} name="add" size=\{30\}/);
assert.match(list, /accessibilityLabel=\{`Open \$\{trip\.name\}`\}/);
assert.match(list, /accessibilityLabel=\{`Delete \$\{trip\.name\}`\}/);
assert.match(list, /size="compact"/);
assert.match(list, /'Delete trip\?'/);
assert.match(list, /void deleteTrip\(trip\.id\)/);
assert.ok(list.indexOf('accessibilityLabel={`Delete ${trip.name}`}') > list.indexOf('</Pressable>'));
console.log('✓ Trips list separates card navigation from confirmed trash actions');

assert.doesNotMatch(detail, /Save Note|Show on Map|Delete trip/);
assert.match(detail, /accessibilityLabel="Show Trip on map"/);
assert.match(detail, /if \(router\.canGoBack\(\)\)/);
assert.match(detail, /router\.back\(\)/);
assert.doesNotMatch(detail, /HeaderBackButton onPress=\{\(\) => router\.replace\('\/trips'\)\}/);
assert.match(detail, /accessibilityLabel="Share Trip"/);
assert.match(detail, /<Text style=\{\{ flex: 1, \.\.\.Type\.cardTitle \}\}>Trip note<\/Text>/);
assert.match(entry, /<Text style=\{\{ \.\.\.Type\.cardTitle, marginBottom: Space\.sm \}\}>Note for \{title\}<\/Text>/);
assert.ok(detail.indexOf('accessibilityLabel="Share Trip"') > detail.indexOf('accessibilityLabel="Show Trip on map"'));
assert.match(detail, /Public sharing unavailable/);
console.log('✓ Trip detail uses one guarded Map and Share icon cluster without deletion');

assert.match(detail, /<AutosaveNote/);
assert.match(entry, /<AutosaveNote/);
assert.doesNotMatch(entry, /Save Note/);
assert.match(autosave, /setTimeout\(\(\) =>/);
assert.match(autosave, /}, 700\)/);
assert.match(autosaveStatus, /Saving…/);
assert.match(autosaveStatus, /Could not save\. Tap to retry\./);
assert.match(autosaveStatus, /minHeight: 17/);
assert.match(autosaveStatus, /opacity: state === 'idle' \? 0 : 1/);
assert.match(autosave, /awaitingAuthoritativeRef/);
assert.match(autosave, /revisionRef\.current > 0/);
assert.match(expandable, /show more/);
assert.match(expandable, /show less/);
assert.match(detail, /updateTripNote\(trip\.id, note\)/);
assert.match(detail, /updateTripEntryNote\(trip\.id, entry\.id, note\)/);
console.log('✓ Trip and entry notes share debounced autosave, feedback, and expansion');

assert.match(entry, /name="location-on"/);
assert.match(entry, /accessibilityLabel="Personal Place"/);
assert.match(entry, /<PlaceCard embedded place=\{editorialPlace\}/);
assert.doesNotMatch(entry, /favorite.*Personal Place|Personal Place.*favorite/s);
console.log('✓ Personal entries use the shared pin while editorial cards retain favourite semantics');

assert.match(entry, /icon="arrow-upward"/);
assert.match(entry, /icon="arrow-downward"/);
assert.match(entry, /name="more-horiz"/);
assert.match(entry, /Remove from Trip/);
assert.match(detail, /entryOffsetsRef\.current\[entry\.id\]/);
assert.match(detail, /scrollRef\.current\?\.scrollTo/);
assert.match(detail, /setHighlightedEntryId/);
assert.doesNotMatch(detail, /reorderTripEntries/);
assert.match(api, /updateEntryNoteRequest/);
assert.doesNotMatch(api, /updatePersonalPlaceCard.*updateEntryNoteRequest|updateEntryNoteRequest.*updatePersonalPlaceCard/s);
console.log('✓ arrows navigate measured adjacent cards and entry-note mutation remains entry-scoped');

assert.doesNotMatch(provider, /void next\.finally/);
assert.match(provider, /void next\.then\([\s\S]*pending\.delete\(key\)/);
console.log('✓ failed Trip mutations clean up without creating an unhandled rejection');
