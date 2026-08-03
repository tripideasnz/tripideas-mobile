import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const [editor, tripDetail] = await Promise.all([
  read('app/personal-place-cards/[cardId].tsx'),
  read('app/trips/[tripId].tsx'),
]);

assert.match(editor, /parsePersonalPlaceCardCoordinates\(latitude, longitude\)/);
assert.match(editor, /attachedTripIds\.length > 0 \? \(/);
assert.match(editor, /Remove this Place Card from \{attachedTripIds\.length\}/);
assert.match(editor, /\) : \(\s*<AppButton\s+label="Delete Personal Place"/);
console.log('✓ attached cards show detach guidance instead of a Delete action');

assert.match(tripDetail, /useFocusEffect\(/);
assert.match(tripDetail, /void refresh\(\)/);
console.log('✓ Trip detail refreshes canonical entries whenever it regains focus');
