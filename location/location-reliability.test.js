import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createForegroundLocationService } from './foreground-acquire.ts';
import { distanceMeters } from './geo.ts';
import {
  initialLocateState,
  isLocateBusy,
  locateReducer,
  locateStatus,
} from './locate-flow.ts';
import { REFINE_MOVE_THRESHOLD_METERS, runMapLocate } from './map-locate.ts';
import { createSingleFlight } from './single-flight.ts';
import { needsRecentre } from '../components/place-map-camera.ts';

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const tests = [];
const test = (name, run) => tests.push({ name, run });

const NOW = 1_800_000_000_000;
const coords = (latitude, longitude, accuracy = 10) => ({ accuracy, latitude, longitude });

// A scriptable stand-in for expo-location that records every call.
const fakeLocation = (overrides = {}) => {
  const calls = [];
  const log = (name, value) => async (...args) => {
    calls.push(name);
    const result = typeof value === 'function' ? value(...args) : value;
    return result;
  };
  const module = {
    Accuracy: { Balanced: 3, High: 4 },
    getCurrentPositionAsync: log('current', overrides.current ?? { coords: coords(-41.29, 174.78) }),
    getForegroundPermissionsAsync: log('permission', overrides.permission ?? { canAskAgain: true, granted: true, status: 'granted' }),
    getLastKnownPositionAsync: log('lastKnown', overrides.lastKnown ?? null),
    hasServicesEnabledAsync: log('services', overrides.services ?? true),
    requestForegroundPermissionsAsync: log('request', overrides.request ?? { canAskAgain: false, granted: true, status: 'granted' }),
  };
  return { calls, module };
};
const serviceFor = (fake) => createForegroundLocationService({ location: fake.module, now: () => NOW });

// ── Permission handling ──────────────────────────────────────────────────────

test('granted permission yields a fresh, non-approximate fix', async () => {
  const fake = fakeLocation();
  const result = await serviceFor(fake).acquire({ accuracy: 'high' });
  assert.equal(result.status, 'fix');
  assert.equal(result.fix.approximate, false);
  assert.deepEqual(result.fix.point, { accuracyMeters: 10, latitude: -41.29, longitude: 174.78 });
});

test('a denial that cannot be re-asked never prompts', async () => {
  const fake = fakeLocation({ permission: { canAskAgain: false, granted: false, status: 'denied' } });
  const result = await serviceFor(fake).acquire();
  assert.deepEqual(result, { reason: 'denied', status: 'failed' });
  assert.equal(fake.calls.includes('request'), false);
  assert.equal(fake.calls.includes('current'), false);
});

test('a first-time denial prompts once and is never prompted for again', async () => {
  const fake = fakeLocation({
    permission: { canAskAgain: true, granted: false, status: 'undetermined' },
    request: { canAskAgain: true, granted: false, status: 'denied' },
  });
  const service = serviceFor(fake);
  assert.equal((await service.acquire()).reason, 'denied');
  assert.equal((await service.acquire()).reason, 'denied');
  assert.equal(fake.calls.filter((call) => call === 'request').length, 1, 'only one system prompt');
});

test('a granted permission is remembered, so repeat requests skip the check', async () => {
  const fake = fakeLocation();
  const service = serviceFor(fake);
  await service.acquire();
  await service.acquire();
  assert.equal(fake.calls.filter((call) => call === 'permission').length, 1);
});

test('permission revoked in Settings mid-session is reported as denied', async () => {
  let granted = true;
  const fake = fakeLocation({
    current: () => { granted = false; throw new Error('E_LOCATION_UNAUTHORIZED'); },
    permission: () => ({ canAskAgain: false, granted, status: granted ? 'granted' : 'denied' }),
  });
  const service = serviceFor(fake);
  const first = await service.acquire();
  assert.deepEqual(first, { reason: 'denied', status: 'failed' });
});

// ── Services unavailable, timeout and last-known ─────────────────────────────

test('disabled Location Services fail clearly without requesting a position', async () => {
  const fake = fakeLocation({ services: false });
  const result = await serviceFor(fake).acquire();
  assert.deepEqual(result, { reason: 'services-disabled', status: 'failed' });
  assert.equal(fake.calls.includes('current'), false);
});

test('a hung high-accuracy request times out; with no cached position it fails as a timeout', async () => {
  const fake = fakeLocation({ current: () => new Promise(() => {}) });
  const result = await serviceFor(fake).acquire({ accuracy: 'high', timeoutMs: 25 });
  assert.deepEqual(result, { reason: 'timeout', status: 'failed' });
});

test('a timeout falls back to the last-known position, flagged approximate with its age', async () => {
  const fake = fakeLocation({
    current: () => new Promise(() => {}),
    lastKnown: { coords: coords(-36.85, 174.76, 300), timestamp: NOW - 3 * 60_000 },
  });
  const result = await serviceFor(fake).acquire({ timeoutMs: 25 });
  assert.equal(result.status, 'approximate');
  assert.equal(result.reason, 'timeout');
  assert.equal(result.fix.approximate, true);
  assert.equal(result.fix.ageMs, 3 * 60_000);
});

test('a failing position request with a cached position degrades to approximate, not an error', async () => {
  const fake = fakeLocation({
    current: () => { throw new Error('E_LOCATION_UNAVAILABLE'); },
    lastKnown: { coords: coords(-36.85, 174.76, 200), timestamp: NOW - 60_000 },
  });
  const result = await serviceFor(fake).acquire();
  assert.equal(result.status, 'approximate');
  assert.equal(result.reason, 'unavailable');
});

test('without any position a failing request is unavailable', async () => {
  const fake = fakeLocation({ current: () => { throw new Error('E_LOCATION_UNAVAILABLE'); } });
  assert.deepEqual(await serviceFor(fake).acquire(), { reason: 'unavailable', status: 'failed' });
});

// ── Approximate-to-accurate refinement ───────────────────────────────────────

test('a recent cached position is offered first, then replaced by a fresh fix', async () => {
  const order = [];
  const fake = fakeLocation({
    current: () => { order.push('fresh-requested'); return { coords: coords(-41.2901, 174.7801, 8) }; },
    lastKnown: { coords: coords(-41.29, 174.78, 150), timestamp: NOW - 90_000 },
  });
  const result = await serviceFor(fake).acquire({
    onApproximate: (fix) => order.push(`approximate:${fix.approximate}:${fix.ageMs}`),
  });
  assert.deepEqual(order, ['approximate:true:90000', 'fresh-requested']);
  assert.equal(result.status, 'fix');
  assert.equal(result.fix.approximate, false);
  assert.equal(result.fix.point.accuracyMeters, 8);
});

test('the cached position is only requested within a bounded age and radius', async () => {
  let seen;
  const fake = fakeLocation({ lastKnown: (options) => { seen = options; return null; } });
  await serviceFor(fake).acquire();
  assert.equal(seen.maxAge, 5 * 60_000);
  assert.equal(seen.requiredAccuracy, 1_000);
});

// ── Repeated-tap prevention ──────────────────────────────────────────────────

test('overlapping requests share one position request', async () => {
  let release;
  const fake = fakeLocation({ current: () => new Promise((resolve) => { release = () => resolve({ coords: coords(1, 2) }); }) });
  const service = serviceFor(fake);
  const first = service.acquire();
  const second = service.acquire();
  await new Promise((resolve) => setImmediate(resolve));
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(fake.calls.filter((call) => call === 'current').length, 1);
  assert.equal(a.status, 'fix');
  assert.equal(b.status, 'fix');
});

test('the single-flight guard ignores taps while an operation is active', async () => {
  const flight = createSingleFlight();
  let release;
  let runs = 0;
  const first = flight.run(() => { runs += 1; return new Promise((resolve) => { release = resolve; }); });
  assert.equal(flight.isActive, true);
  const second = await flight.run(async () => { runs += 1; });
  assert.deepEqual(second, { skipped: true });
  release('done');
  assert.deepEqual(await first, { skipped: false, value: 'done' });
  assert.equal(runs, 1);
  assert.equal(flight.isActive, false);
  assert.equal((await flight.run(async () => 'again')).skipped, false);
});

// ── Personal Place: approximate is never silently saved ──────────────────────

const fix = (approximate, ageMs = 0, accuracy = 10) => ({
  ageMs,
  approximate,
  point: { accuracyMeters: accuracy, latitude: -41, longitude: 174 },
});

test('locate flow: busy while locating or saving, with distinct feedback', () => {
  let state = locateReducer(initialLocateState, { type: 'started' });
  assert.equal(isLocateBusy(state), true);
  assert.equal(locateStatus(state).text, 'Finding your location…');
  state = locateReducer(state, { fix: fix(true, 120_000, 250), type: 'approximate' });
  assert.match(locateStatus(state).text, /recent position from about 2 minutes ago\. Improving accuracy/);
  assert.equal(isLocateBusy(state), true);
  state = locateReducer(state, { type: 'save-started' });
  assert.equal(isLocateBusy(state), true);
  state = locateReducer(state, { approximate: false, type: 'saved' });
  assert.equal(isLocateBusy(state), false);
  assert.deepEqual(locateStatus(state), { needsSettings: false, text: 'Location saved.', tone: 'success' });
});

test('an approximate-only result waits for explicit confirmation and is worded as approximate', () => {
  const state = locateReducer({ approximate: fix(true), kind: 'locating' }, { fix: fix(true, 4 * 60_000, 350), reason: 'timeout', type: 'needs-confirmation' });
  assert.equal(state.kind, 'confirm-approximate');
  assert.equal(isLocateBusy(state), false, 'nothing has been saved or is saving');
  const text = locateStatus(state).text;
  assert.match(text, /approximate location from about 4 minutes ago/);
  assert.match(text, /within about 400 m/);
  assert.doesNotMatch(text, /-41|174|±/, 'no misleading coordinate precision');
  const saved = locateReducer(locateReducer(state, { type: 'save-started' }), { approximate: true, type: 'saved' });
  assert.match(locateStatus(saved).text, /Approximate location saved/);
  assert.equal(locateReducer(state, { type: 'dismissed' }).kind, 'idle');
});

test('failures give actionable wording; Settings is offered only where it can help', () => {
  const denied = locateStatus(locateReducer(initialLocateState, { reason: 'denied', type: 'failed' }));
  assert.match(denied.text, /permission is off/);
  assert.equal(denied.needsSettings, true);
  assert.equal(locateStatus(locateReducer(initialLocateState, { reason: 'services-disabled', type: 'failed' })).needsSettings, true);
  const timeout = locateStatus(locateReducer(initialLocateState, { reason: 'timeout', type: 'failed' }));
  assert.match(timeout.text, /Try again/);
  assert.equal(timeout.needsSettings, false);
  const saveFailed = locateStatus(locateReducer(initialLocateState, { message: 'Could not save. Tap to retry.', type: 'save-failed' }));
  assert.equal(saveFailed.tone, 'danger');
  assert.equal(saveFailed.needsSettings, false);
});

test('Locate now saves only a fresh fix automatically and keeps the existing save path', async () => {
  const hook = await read('location/use-locate-now.ts');
  const editor = await read('app/personal-place-cards/[cardId].tsx');
  assert.match(hook, /if \(result\.status === 'fix'\) await persist\(result\.fix\.point, false\)/);
  assert.match(hook, /dispatch\(\{ fix: result\.fix, reason: result\.reason, type: 'needs-confirmation' \}\)/);
  assert.match(hook, /state\.kind !== 'confirm-approximate'/);
  assert.match(editor, /locationConfirmed: true/);
  assert.match(editor, /locationSource: 'USER_SELECTED'/);
  assert.match(editor, /disabled=\{locateNow\.isBusy\}/);
  assert.match(editor, /label="Locate on map"/);
});

// ── Manual selection preserved ───────────────────────────────────────────────

test('manual map selection still needs an explicit save with confirmed coordinates', async () => {
  const picker = await read('components/map/saved-location-picker.tsx');
  const cardPicker = await read('app/personal-place-cards/location-picker.tsx');
  assert.match(picker, /setSelected\(\{ latitude, longitude \}\)/);
  assert.match(picker, /disabled=\{!selected \|\| saving\}/);
  assert.match(picker, /if \(!selected \|\| saving\) return/);
  assert.match(cardPicker, /locationConfirmed: true, locationSource: 'USER_SELECTED'/);
});

// ── Main map: recentre without touching filters ──────────────────────────────

const point = (latitude, longitude, accuracyMeters = 20) => ({ accuracyMeters, latitude, longitude });
const harness = (acquireImpl) => {
  const events = [];
  return {
    events,
    run: () => runMapLocate({
      acquire: acquireImpl,
      moveCamera: (p, duration) => events.push(['move', p.latitude, p.longitude, duration]),
      notifyFailure: (reason) => events.push(['failure', reason]),
      setPosition: (p) => events.push(['marker', p.latitude, p.longitude]),
    }),
  };
};

test('a cached position centres the map at once; a materially different fix refines it', async () => {
  const h = harness(async ({ onApproximate }) => {
    onApproximate(fix(true, 60_000));
    return { fix: { ageMs: 0, approximate: false, point: point(-41.1, 174) }, status: 'fix' };
  });
  await h.run();
  assert.deepEqual(h.events.filter((event) => event[0] === 'move'), [['move', -41, 174, 400], ['move', -41.1, 174, 250]]);
});

test('a refinement within the threshold updates the marker without another camera animation', async () => {
  const h = harness(async ({ onApproximate }) => {
    onApproximate({ ageMs: 1000, approximate: true, point: point(-41, 174) });
    return { fix: { ageMs: 0, approximate: false, point: point(-41.00005, 174) }, status: 'fix' };
  });
  await h.run();
  assert.ok(distanceMeters(point(-41, 174), point(-41.00005, 174)) < REFINE_MOVE_THRESHOLD_METERS);
  assert.equal(h.events.filter((event) => event[0] === 'move').length, 1);
  assert.equal(h.events.filter((event) => event[0] === 'marker').length, 2);
});

test('without a cached position the first fix centres once; approximate-only results do not raise an alert', async () => {
  const fresh = harness(async () => ({ fix: { ageMs: 0, approximate: false, point: point(-41, 174) }, status: 'fix' }));
  await fresh.run();
  assert.deepEqual(fresh.events.filter((event) => event[0] === 'move'), [['move', -41, 174, 400]]);
  const cachedOnly = harness(async () => ({ fix: fix(true, 60_000), reason: 'timeout', status: 'approximate' }));
  await cachedOnly.run();
  assert.equal(cachedOnly.events.filter((event) => event[0] === 'failure').length, 0);
  assert.equal(cachedOnly.events.filter((event) => event[0] === 'move').length, 1);
});

test('failures notify and never move the camera', async () => {
  const h = harness(async () => ({ reason: 'denied', status: 'failed' }));
  await h.run();
  assert.deepEqual(h.events, [['failure', 'denied']]);
});

test('recentring uses the shared hook and leaves every filter alone', async () => {
  const map = await read('app/(tabs)/map.tsx');
  const hook = await read('location/use-map-user-location.ts');
  assert.match(map, /useMapUserLocation\(cameraRef, \{/);
  assert.doesNotMatch(map, /getOneForegroundLocation/);
  const cancelFit = map.match(/const cancelPendingFit = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\);/)?.[0] ?? '';
  assert.ok(cancelFit);
  assert.doesNotMatch(cancelFit, /setSelection|setSelectedActivityTagIds|setQuery|clearPlaceContext|setPlaceContext/);
  assert.doesNotMatch(hook, /setSelection|setSelectedActivityTagIds|setQuery|Filter/);
  assert.match(hook, /createSingleFlight\(\)/);
  assert.match(map, /isLocating=\{isLocating\}/);
  assert.match(map, /getZoom: getCurrentZoom/);
});

// ── Saved-location thumbnail ─────────────────────────────────────────────────

test('the thumbnail only recentres when ready and when the coordinates changed', () => {
  const at = { latitude: -41.29, longitude: 174.78 };
  assert.equal(needsRecentre(false, at, { latitude: -36, longitude: 174 }), false, 'not ready: wait for the map');
  assert.equal(needsRecentre(true, at, at), false, 'already centred: no repeated animation');
  assert.equal(needsRecentre(true, at, { latitude: -36.85, longitude: 174.76 }), true);
});

test('the thumbnail waits for MapLibre readiness before moving the camera', async () => {
  const preview = await read('components/place-map-preview.tsx');
  assert.match(preview, /onDidFinishLoadingMap=\{\(\) => setMapReady\(true\)\}/);
  assert.match(preview, /needsRecentre\(mapReady, applied\.current, next\)/);
  assert.match(preview, /initialViewState=\{\{\s*center: \[longitude, latitude\]/);
  assert.match(preview, /<Marker lngLat=\{\[longitude, latitude\]\}>/);
  assert.match(preview, /dragPan=\{false\}/);
});

// ── Privacy ──────────────────────────────────────────────────────────────────

test('location handling is foreground-only, one-shot and never persisted', async () => {
  for (const file of [
    'location/foreground.ts',
    'location/foreground-acquire.ts',
    'location/locate-flow.ts',
    'location/map-locate.ts',
    'location/use-locate-now.ts',
    'location/use-map-user-location.ts',
  ]) {
    const source = await read(file);
    assert.doesNotMatch(source, /Background|watchPositionAsync|startLocationUpdates|AsyncStorage|SecureStore|setItem/, file);
  }
  assert.doesNotMatch(await read('app.json'), /"isIosBackgroundLocationEnabled": true|"isAndroidBackgroundLocationEnabled": true/);
});

test('great-circle distance is sensible', () => {
  assert.ok(Math.abs(distanceMeters(point(0, 0), point(0, 0.001)) - 111.19) < 1);
  assert.equal(distanceMeters(point(-41, 174), point(-41, 174)), 0);
});

let failed = false;
for (const { name, run } of tests) {
  try {
    await run();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed = true;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}
if (failed) process.exitCode = 1;
