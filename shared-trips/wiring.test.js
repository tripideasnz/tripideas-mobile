// Screen wiring for Shared Trips, checked statically (the repo's convention for screens): routes are
// registered, the web share link maps to the preview route, the existing Trips behaviour is retained,
// and nothing structural is offered to participants. Behaviour is covered by the other test files.
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const exists = (relativePath) => access(new URL(`../${relativePath}`, import.meta.url)).then(() => true, () => false);
const tests = [];
const test = (name, run) => tests.push({ name, run });

test('both new routes exist and are registered, and the session binder sits inside the providers', async () => {
  const layout = await read('app/_layout.tsx');
  assert.ok(await exists('app/collections/[collectionId].tsx'));
  assert.ok(await exists('app/shared-trips/[collectionId].tsx'));
  assert.match(layout, /name="collections\/\[collectionId\]"/);
  assert.match(layout, /name="shared-trips\/\[collectionId\]"/);
  assert.match(layout, /<SharedTripsSessionBinder \/>/);
  assert.ok(layout.indexOf('<MyTripsProvider>') < layout.indexOf('<SharedTripsSessionBinder />'));
  assert.ok(layout.indexOf('<SharedTripsSessionBinder />') < layout.indexOf('<Stack'));
});

test('the share link /collections/<id>?k=<token> opens the preview route, and only the token is read from it', async () => {
  // The API builds this link. Expo Router maps /collections/<id> to this file; the token is a capability.
  const link = new URL('https://staging.tripideas.nz/collections/fc_01abc?k=AbC-_123');
  const [segment, id] = link.pathname.split('/').filter(Boolean);
  assert.equal(segment, 'collections');
  assert.ok(await exists(`app/${segment}/[collectionId].tsx`));
  assert.equal(id, 'fc_01abc');
  assert.equal(link.searchParams.get('k'), 'AbC-_123');
  const screen = await read('app/collections/[collectionId].tsx');
  assert.match(screen, /useLocalSearchParams<\{ collectionId\?: string \| string\[\]; k\?: string \| string\[\] \}>/);
  // Nothing else in the link matters: no user id and no "type" decide who someone is or what they may do.
  const code = screen.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /type=shared|searchParams|params\.user|user\?:|&type|ownerId/);
});

test('the preview screen is driven by the controller and the preview state, and works for members and the creator', async () => {
  const screen = await read('app/collections/[collectionId].tsx');
  assert.match(screen, /createPreviewActions\(/);
  assert.match(screen, /previewState\(\{ access, accessPending, load, userId \}\)/);
  assert.match(screen, /if \(state\.kind === 'open-shared'\) router\.replace\(\{ pathname: '\/shared-trips\/\[collectionId\]'/);
  assert.match(screen, /sharedTripsStore\.join\(id, shareKey\)/);
  assert.match(screen, /token,\n      \}\),/); // the link's token goes to the controller
  assert.match(screen, /actions\.sessionChanged\(\)/);
  assert.match(screen, /fetchCollectionPreview\(collectionId, token\)/);
  assert.match(screen, /This shared trip could not be found/);
  assert.match(screen, /can't show shared Trip previews yet/); // an API without the route is said so, not "not found"
  // The legacy public note endpoints are no longer used by the preview.
  assert.doesNotMatch(screen, /fetchPublic|collection-comments|collection-item-comments/);
});

test('the Shared Trip screen refreshes on focus and pull-down, leaves through the store, and handles lost access', async () => {
  const screen = await read('app/shared-trips/[collectionId].tsx');
  assert.match(screen, /useFocusEffect\(/);
  assert.match(screen, /loadDetail\(collectionId, \{ force: true \}\)/);
  assert.match(screen, /<RefreshControl/);
  assert.match(screen, /sharedTripsStore\.leave\(collectionId\)/);
  assert.match(screen, /router\.replace\('\/trips'\)/);
  assert.match(screen, /case 'not-joined':/);
  assert.match(screen, /case 'gone':/);
  assert.match(screen, /case 'sign-in':/);
  assert.match(screen, /saveCopyOfSharedTrip\(copyDependencies/);
  assert.match(screen, /if \(!detail \|\| copyingRef\.current\) return;/); // no double submission
});

test('the Trips index keeps its existing behaviour and gains the Shared With Me view in the same screen', async () => {
  const index = await read('app/trips/index.tsx');
  for (const kept of ['Add Trip', 'Create Trip', 'Cancel Trip creation', 'Delete trip?', 'Import Trips confirmation', 'Retry import', 'useMyTrips()', 'TripIndexCard', 'getTripImages(trip, tripPlaces)', 'No trips yet. Create one for places you want to group together.']) {
    assert.ok(index.includes(kept), kept);
  }
  assert.match(index, /<TripsViewSwitch onChange=\{setView\} value=\{view\} \/>/);
  assert.match(index, /view === 'mine'\s*\? headerAddAction/); // Add Trip belongs to My Trips only
  assert.match(index, /: clearHeaderRightAction\(\)/);
  assert.match(index, /view === 'shared' \? \(\s*<SharedWithMeList/);
  assert.match(index, /sharedTripRows\(shared\.sharedWithMe\.data \?\? \[\], session\.userId\)/);
  assert.match(index, /shared=\{sharedLiveIds\.has\(trip\.id\)\}/);
  assert.match(index, /refreshControl=\{\s*view === 'shared'/); // pull-to-refresh only where it is new
  assert.equal((await read('app/trips/index.tsx')).match(/<SharedWithMeList/g).length, 1);
});

test('there is one My Trips: no second Trips list, and only the Trips index renders the Trip cards', async () => {
  for (const second of ['app/my-trips.tsx', 'app/shared-trips/index.tsx', 'app/shared-with-me.tsx', 'app/trips/shared-with-me.tsx']) {
    assert.equal(await exists(second), false, second);
  }
  const card = await read('components/trip-index-card.tsx');
  assert.match(card, /shared \? ' · Shared' : ''/);
});

test('sharing from a Trip: two clearly different choices, live sharing guarded against double taps, existing choices kept', async () => {
  const detail = await read('app/trips/[tripId].tsx');
  assert.match(detail, /text: 'Preview'/);
  assert.match(detail, /Alert\.alert\('Share this Trip'/);
  assert.match(detail, /SHARE_CHOICES\.copy\.label/);
  assert.match(detail, /SHARE_CHOICES\.live\(sharingActive\)\.label/);
  assert.match(detail, /const wasSharing = sharingActive;/);
  assert.match(detail, /liveShareConfirmation\(isNewLiveShare\(result\.value\.created, wasSharing\), url\)/);
  // Stop sharing is offered only while the link is on, and only to the Trip's owner (this is My Trips).
  assert.match(detail, /\.\.\.\(sharingActive \? \[\{ onPress: stopSharingLive/);
  assert.match(detail, /sharedTripsStore\.stopSharing\(sharedCollectionId\)/);
  assert.match(detail, /if \(!trip \|\| isSharingLive\) return;/);
  assert.match(detail, /sharedTripsStore\.share\(trip\.id\)/);
  assert.match(detail, /Share\.share\(\{ message: liveShareMessage\(trip\.name, url\)/);
  assert.match(detail, /shareErrorMessage\(result\.error\)/);
  assert.match(detail, /Shared live: people with the link can join and add notes/);
  // The existing public-snapshot share and text share are still wired.
  assert.match(detail, /isPublicTripSharingEnabled\(\) \? createPublicShare\(\) : openShareSheet\(\)/);
});

test('opening a link mutates nothing: no effect on the preview screen can join, save, create or sign in', async () => {
  const screen = await read('app/collections/[collectionId].tsx');
  const code = screen.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  // Every useEffect body on the screen, up to its dependency list.
  const effects = [...code.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\}, \[[^\]]*\]\);/g)].map((m) => m[1]);
  assert.ok(effects.length >= 3);
  for (const body of effects) {
    assert.doesNotMatch(body, /\.join\(|saveCopy|\.signIn|signInRef|importTrip|actions\.(join|saveCopy)/, body);
  }
  // The only things that start an action are the two button handlers; sign-in return only continues one.
  assert.match(code, /onJoin=\{\(\) => void actions\.join\(\)\}/);
  assert.match(code, /onSaveCopy=\{\(\) => void actions\.saveCopy\(\)\}/);
  assert.match(code, /actions\.sessionChanged\(\)/);
  // The preview shows who is signed in before either action.
  assert.match(code, /account=\{user \? user\.name \|\| user\.email : null\}/);
});

test('the Shared Trip screen passes the link on through the store and stops sharing only on the creator\'s confirmation', async () => {
  const screen = await read('app/shared-trips/[collectionId].tsx');
  assert.match(screen, /sharedTripsStore\.reshare\(collectionId\)/);
  assert.match(screen, /sharedTripsStore\.stopSharing\(collectionId\)/);
  assert.match(screen, /Share\.share\(\{ message: reshareMessage\(detail\.collection\.title, result\.value\.url\) \}\)/);
  const view = await read('components/shared-trip-detail-view.tsx');
  assert.match(view, /stopSharingConfirmation\(detail\.collection\.title\)/);
  assert.match(view, /controls\.canReshare && onReshare/);
  assert.match(view, /controls\.canStopSharing && onStopSharing/);
});

test('the detail view has no way to change a Trip\'s structure', async () => {
  const view = await read('components/shared-trip-detail-view.tsx');
  for (const forbidden of ['TripPlacePicker', 'onRemove', 'arrow-upward', 'arrow-downward', 'icon="add"', 'icon="edit"', 'renameTrip', 'removeTripEntry', 'drag-reorder']) {
    assert.equal(view.includes(forbidden), false, forbidden);
  }
  assert.match(view, /accessibilityLabel=\{`Delete your note on \$\{subject\}`\}/); // the only delete control is for the viewer's own note
});

test('the notebook cache is still cleared wherever a session ends; saved Trips only on an explicit sign-out', async () => {
  // The policy itself is exercised in cache-session.test.js; this pins the wiring that carries it.
  const provider = await read('auth/provider.tsx');
  assert.match(provider, /async function clearUserCaches\(userId: string\)[\s\S]*clearNotebookCache\(userId\);/);
  assert.equal(provider.match(/clearNotebookCache: clearUserCaches/g).length, 4); // unchanged from before Shared Trips
  assert.equal(/\n\s+clearNotebookCache,\n/.test(provider), false);
  assert.match(provider, /clearSharedTripsCache,\n\s+setActiveToken,\n\s+\},\n\s+reason/);
});

test('the existing independent-copy workflow is untouched and shared by both copy entry points', async () => {
  const snapshotScreen = await read('app/trip/[shareId].tsx');
  assert.match(snapshotScreen, /saveSharedTrip\(dependencies/);
  const save = await read('trips/shared-trip-save.ts');
  assert.match(save, /export function saveSharedTrip\(/);
  assert.match(save, /export const IMPORT_CAPABILITY = 'itinerary-import-v1'/);
  const hook = await read('shared-trips/use-copy-dependencies.ts');
  assert.match(hook, /importTrip: importSharedTripRequest/);
  assert.match(hook, /checkCapability: \(\) => checkApiCapability\(IMPORT_CAPABILITY\)/);
  const copy = await read('shared-trips/copy.ts');
  assert.match(copy, /saveSharedTrip\(dependencies/);
});

let failed = 0;
for (const { name, run } of tests) {
  try {
    await run();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}
if (failed) process.exitCode = 1;
