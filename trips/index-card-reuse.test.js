import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../app/trips/index.tsx', import.meta.url), 'utf8');
const modal = await readFile(new URL('../components/add-to-trip-modal.tsx', import.meta.url), 'utf8');
const card = await readFile(new URL('../components/trip-index-card.tsx', import.meta.url), 'utf8');

assert.match(index, /<TripIndexCard/);
assert.match(modal, /<TripIndexCard/);
assert.match(card, /<TripImageCollage images=\{images\}/);
assert.match(card, /height: 92, width: 112/);

console.log('✓ Trips index and create confirmation reuse the canonical collage card');
