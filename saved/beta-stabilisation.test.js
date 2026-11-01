import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const [headers, places, trips, tripDetail, editor, photos, photoReconciliation] = await Promise.all([
  read('components/ui/header-actions.tsx'),
  read('app/personal-place-cards/index.tsx'),
  read('app/trips/index.tsx'),
  read('app/trips/[tripId].tsx'),
  read('app/personal-place-cards/[cardId].tsx'),
  read('personal-place-cards/photos.ts'),
  read('personal-place-cards/photo-reconciliation.ts'),
]);

assert.match(headers, /actionOptions\('add', action\)/);
assert.match(headers, /actionOptions\('share', action\)/);
assert.match(headers, /headerRight: \(\) => <SavedHeaderActionButton action=\{action\} icon=\{icon\} \/>/);
assert.doesNotMatch(headers, /unstable_headerRightItems/);
// Fixed size lives in the shared header (verified at component level in ui/saved-header.test.js).
assert.match(await read('components/ui/saved-header.tsx'), /SAVED_HEADER_CONTROL_SIZE = 44/);
assert.match(places, /headerAddAction\(/);
assert.match(places, /options=\{session \? headerAddAction/);
assert.match(trips, /headerAddAction\(/);
assert.match(tripDetail, /headerShareAction\(/);
assert.match(tripDetail, /clearHeaderRightAction\(\)/);
assert.match(headers, /headerRight: \(\) => null/);
assert.doesNotMatch(places, /headerRight:[\s\S]{0,250}<MaterialIcons/);
assert.doesNotMatch(trips, /headerRight:[\s\S]{0,250}<MaterialIcons/);
console.log('✓ shared header controls keep Add and Share available across platforms');

assert.match(trips, /accessibilityLabel="Create Trip"[\s\S]{0,180}color=\{Palette\.success\}/);
assert.match(trips, /accessibilityLabel="Cancel Trip creation"[\s\S]{0,180}color=\{Palette\.danger\}/);
assert.match(trips, /disabled=\{!newTripName\.trim\(\) \|\| isCreatingTrip\}/);
assert.match(trips, /accessibilityLabel="Creating Trip"/);
assert.match(trips, /<ActivityIndicator/);
assert.doesNotMatch(trips, /<StatusText>Creating trip/);
console.log('✓ Trip creation confirmation and cancellation use semantic colours');

assert.match(editor, /<AppText variant="section">Photos<\/AppText>/);
assert.doesNotMatch(editor, /<AppText variant="section">Main photo<\/AppText>/);
assert.doesNotMatch(editor, /<AppText[^>]*>Body photos<\/AppText>/);
assert.match(editor, /label="Body photos"/);
assert.match(editor, /bodyMedia\.map/);
assert.match(editor, /pendingBodyPreviews\.map/);
assert.match(editor, /aspectRatio: 1/);
assert.match(editor, /Loading photo…/);
assert.match(editor, /Uploading…/);
assert.match(editor, /Photo failed to upload/);
assert.match(editor, /label="Try again"/);
assert.match(editor, /retryPersonalPlaceCardPhoto\(/);
assert.doesNotMatch(editor, /Upload paused/);
assert.doesNotMatch(editor, /Retry photo uploads/);
assert.match(photos, /listNativePhotoUploads/);
assert.match(photos, /allPending\.filter\(\(item\) => item\.cardId === card\.id\)/);
assert.match(photos, /reconcilePendingPersonalPlacePhotos\(cardPending, uploads, card\)/);
assert.match(photoReconciliation, /uri: upload\.localFileUri/);
console.log('✓ Personal Place photos use one fixed grid with durable restart and retry previews');
