import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const [headers, places, trips, tripDetail, editor, photos] = await Promise.all([
  read('components/ui/header-actions.tsx'),
  read('app/personal-place-cards/index.tsx'),
  read('app/trips/index.tsx'),
  read('app/trips/[tripId].tsx'),
  read('app/personal-place-cards/[cardId].tsx'),
  read('personal-place-cards/photos.ts'),
]);

assert.match(headers, /unstable_headerRightItems/);
assert.match(headers, /nativeItem\('plus', action\)/);
assert.match(headers, /nativeItem\('square\.and\.arrow\.up', action\)/);
assert.match(headers, /hidesSharedBackground: true/);
assert.match(headers, /Platform\.OS === 'ios'/);
assert.match(headers, /height: 44/);
assert.match(headers, /width: 44/);
assert.match(places, /headerAddAction\(/);
assert.match(trips, /headerAddAction\(/);
assert.match(tripDetail, /headerShareAction\(/);
assert.match(tripDetail, /clearHeaderRightAction\(\)/);
assert.match(headers, /unstable_headerRightItems: \(\) => \[\]/);
assert.doesNotMatch(places, /headerRight:[\s\S]{0,250}<MaterialIcons/);
assert.doesNotMatch(trips, /headerRight:[\s\S]{0,250}<MaterialIcons/);
console.log('✓ retained native headers avoid custom iOS header hosts and keep a fixed Android fallback');

assert.match(trips, /accessibilityLabel="Create Trip"[\s\S]{0,180}color=\{Palette\.success\}/);
assert.match(trips, /accessibilityLabel="Cancel Trip creation"[\s\S]{0,180}color=\{Palette\.danger\}/);
assert.match(trips, /disabled=\{!newTripName\.trim\(\) \|\| isCreatingTrip\}/);
assert.match(trips, /Creating trip…/);
console.log('✓ Trip creation confirmation and cancellation use semantic colours');

assert.match(editor, /<AppText variant="section">Photos<\/AppText>/);
assert.doesNotMatch(editor, /<AppText variant="section">Main photo<\/AppText>/);
assert.doesNotMatch(editor, /<AppText[^>]*>Body photos<\/AppText>/);
assert.match(editor, /label="Add body photos"/);
assert.match(editor, /bodyMedia\.map/);
assert.match(editor, /pendingBodyPreviews\.map/);
assert.match(editor, /aspectRatio: 1/);
assert.match(editor, /Loading photo…/);
assert.match(editor, /Uploading…/);
assert.match(editor, /Upload paused/);
assert.match(editor, /Retry photo uploads/);
assert.match(photos, /listNativePhotoUploads/);
assert.match(photos, /upload\?\.localFileUri \?\? null/);
assert.match(photos, /pending\.filter\(\(item\) => item\.cardId === cardId\)/);
console.log('✓ Personal Place photos use one fixed grid with durable restart and retry previews');
