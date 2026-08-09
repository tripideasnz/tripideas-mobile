import assert from 'node:assert/strict';

import {
  PERSONAL_PLACE_AUTOSAVE_DELAY_MS,
  reconcilePersonalPlaceAutosave,
  shouldAdoptPersonalPlaceAutosave,
} from './autosave.ts';

assert.equal(PERSONAL_PLACE_AUTOSAVE_DELAY_MS, 650);
assert.equal(shouldAdoptPersonalPlaceAutosave(3, 3), true);
assert.equal(shouldAdoptPersonalPlaceAutosave(4, 3), false);
assert.equal(
  reconcilePersonalPlaceAutosave('Saved title', 'Newer local title', 4, 3),
  'Newer local title'
);
assert.equal(
  reconcilePersonalPlaceAutosave('Saved body', 'Saved body draft', 3, 3),
  'Saved body'
);
console.log('✓ Personal Place autosave preserves newer typing and adopts current saves');
