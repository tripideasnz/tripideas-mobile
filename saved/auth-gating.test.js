import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [actions, favourites, personalList, saved, savedProvider, trips] = await Promise.all([
  read('components/place-card-actions.tsx'),
  read('app/favourites/index.tsx'),
  read('app/personal-place-cards/index.tsx'),
  read('app/(tabs)/saved.tsx'),
  read('saved/provider.tsx'),
  read('app/trips/index.tsx'),
]);

assert.match(saved, /if \(!session && !\(await signIn\(\)\)\) return/);
assert.match(actions, /if \(!session && !\(await signIn\(\)\)\) return/g);
assert.match(favourites, /Sign in to save Favourites/);
assert.match(trips, /Sign in to view and edit your private Trips/);
assert.match(personalList, /Sign in to view and edit your private Personal Places/);
assert.doesNotMatch(savedProvider, /setAnonSavedPlaceIds|getAnonSavedPlaceIds/);

console.log('✓ Saved actions gate private content and do not create anonymous Favourites');
