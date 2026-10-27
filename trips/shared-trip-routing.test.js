// B4b: the shared https link reaches the shared Trip route in the app (iOS Universal Links).
// Config and routing are checked statically; the real association is validated on a device
// with a signed build and a deployed apple-app-site-association file.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { buildPublicTripUrl } from './public-sharing.ts';
import { buildImportRequest, normalizeShareId, parseSharedTrip } from './shared-trip.ts';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

const shareId = '0123456789abcdef';

test('iOS declares the www.tripideas.nz associated domain and keeps its identity and scheme', async () => {
  const { expo } = JSON.parse(await read('app.json'));
  assert.deepEqual(expo.ios.associatedDomains, ['applinks:www.tripideas.nz']);
  assert.equal(expo.ios.bundleIdentifier, 'nz.tripideas.app');
  assert.equal(expo.scheme, 'tripideas');
});

test('Android is untouched in this stage', async () => {
  const { expo } = JSON.parse(await read('app.json'));
  assert.equal(expo.android.package, undefined);
  assert.equal(expo.android.intentFilters, undefined);
});

test('the WorkOS callback still uses the custom scheme and has its route', async () => {
  assert.match(await read('auth/provider.tsx'), /const MOBILE_REDIRECT_URI = 'tripideas:\/\/auth\/callback'/);
  assert.match(await read('app/auth.tsx'), /tripideas:\/\/auth\/callback/);
});

test('new shared links use the canonical www host, matching the web share endpoint', () => {
  assert.equal(buildPublicTripUrl(shareId), `https://www.tripideas.nz/trip/${shareId}`);
  assert.ok(!/https:\/\/tripideas\.nz\/trip/.test(buildPublicTripUrl(shareId)));
});

test('the path of a canonical link is the shared Trip route and yields the share ID', async () => {
  const url = new URL(buildPublicTripUrl(shareId));
  assert.equal(url.hostname, 'www.tripideas.nz');
  const [first, id] = url.pathname.split('/').filter(Boolean);
  assert.equal(first, 'trip');
  assert.equal(normalizeShareId(id), shareId);
  // Expo Router maps /trip/<shareId> to this file, with no change to the route itself.
  assert.ok((await read('app/trip/[shareId].tsx')).includes('normalizeShareId(rawShareId)'));
  // The sign-in return marker added by the web is ignored by the route (only shareId is read).
  const route = await read('app/trip/[shareId].tsx');
  assert.ok(!/resume/.test(route.split('useLocalSearchParams')[1].split('\n')[0]));
});

test('a link with an invalid ID is rejected by the route rather than fetched', () => {
  for (const bad of ['short', '../x', 'ZZZZZZZZZZZZZZZZ', `${shareId}0`]) {
    assert.equal(normalizeShareId(bad), null);
  }
});

test('opening a link needs no sign-in; only Save does (route unchanged)', async () => {
  const route = await read('app/trip/[shareId].tsx');
  assert.ok(!/Stack\.Protected|Redirect|redirect\(/.test(route));
  assert.match(route, /needs-sign-in/);
  const trip = parseSharedTrip({ note: 'n', places: [{ note: 'x', placeId: 'p', title: 'P' }], title: 'T' });
  assert.deepEqual(Object.keys(buildImportRequest('id', trip)).sort(), ['description', 'entries', 'id', 'name']);
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
