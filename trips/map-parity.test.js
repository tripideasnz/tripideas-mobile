import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [map, selection, pin, controls] = await Promise.all([
  readFile(new URL('../app/trips/[tripId]/map.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/map/use-map-selection.ts', import.meta.url), 'utf8'),
  readFile(new URL('../components/map/map-pin.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/map/map-controls.tsx', import.meta.url), 'utf8'),
]);

assert.match(map, /useMapSelection\(openSelection\)/);
assert.match(selection, /selectedId === nextId \? 'open' : 'select'/);
assert.match(map, /activate\(markerId, \{ kind: 'editorial', place \}\)/);
assert.match(map, /activate\(`personal:\$\{item\.entryId\}`/);
assert.match(map, /emphasis=\{selectedPlaceId ===/);
assert.match(map, /accessibilityState=\{\{ selected: true \}\}/);
assert.match(map, /borderColor: Palette\.trip/);
assert.match(map, /<MapPin/);
assert.match(pin, /selected: '#005FA3'/);
assert.match(map, /onPress=\{clearSelection\}/);
assert.match(map, /PersonalPlaceCardView[\s\S]*onPress=\{\(\) => openSelection/);
assert.match(map, /PlaceCard onPress=\{\(\) => openSelection/);
assert.match(map, /pathname: '\/place\/\[slug\]'/);
assert.match(map, /pathname: '\/personal-place-cards\/\[cardId\]'/);
assert.match(map, /MapZoomControls/);
assert.match(controls, /accessibilityLabel="Zoom in"/);
assert.match(map, /fitBounds/);
assert.match(map, /Some places could not be shown on the map/);
assert.doesNotMatch(map, /setSelectedPlaceId/);
console.log('✓ Trip map shares first-select, second-open semantics for editorial and Personal Place entries');
