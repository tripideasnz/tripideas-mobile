// Integration (TestFlight) build configuration: it must reach the integration API and the
// staging website only, keep the production build untouched, and never create public shares.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

const INTEGRATION_API = 'https://tripideas-api-integration-staging.up.railway.app';
const STAGING_SNAPSHOT_API = 'https://staging.tripideas.nz/api/trips/share';
const PRODUCTION_HOSTS = /api\.tripideas\.nz|www\.tripideas\.nz|integration-api-integration/;

const eas = JSON.parse(await read('eas.json'));
const appJson = JSON.parse(await read('app.json'));
const withVariant = (variant) => {
  const previous = process.env.APP_VARIANT;
  if (variant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;
  try {
    return require('../app.config.js')({ config: structuredClone(appJson.expo) });
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
};

test('every integration profile uses the integration API, the staging snapshot host and the integration variant', () => {
  for (const name of ['development', 'preview', 'testflight-staging']) {
    const { env } = eas.build[name];
    assert.equal(env.EXPO_PUBLIC_API_URL, INTEGRATION_API, name);
    assert.equal(env.EXPO_PUBLIC_TRIP_SHARE_API_URL, STAGING_SNAPSHOT_API, name);
    assert.equal(env.APP_VARIANT, 'integration', name);
    assert.ok(!PRODUCTION_HOSTS.test(JSON.stringify(env)), `${name} must not name a production host`);
  }
});

test('the TestFlight profile uses the EAS preview environment, never production', () => {
  assert.equal(eas.build['testflight-staging'].environment, 'preview');
  assert.equal(eas.build['testflight-staging'].distribution, 'store');
  assert.equal(eas.build['testflight-staging'].channel, 'preview');
  for (const name of ['development', 'preview']) assert.equal(eas.build[name].environment, undefined);
});

test('the production profile is untouched: production environment, no integration overrides', () => {
  const production = eas.build.production;
  assert.equal(production.environment, 'production');
  assert.equal(production.channel, 'production');
  assert.equal(production.env, undefined);
  assert.ok(!/staging|integration|APP_VARIANT/.test(JSON.stringify(production)));
});

test('integration builds associate with www and staging; every other build only with www', () => {
  assert.deepEqual(withVariant('integration').ios.associatedDomains, ['applinks:www.tripideas.nz', 'applinks:staging.tripideas.nz']);
  assert.deepEqual(withVariant(undefined).ios.associatedDomains, ['applinks:www.tripideas.nz']);
  assert.deepEqual(withVariant('production').ios.associatedDomains, ['applinks:www.tripideas.nz']);
  assert.deepEqual(appJson.expo.ios.associatedDomains, ['applinks:www.tripideas.nz']);
});

test('bundle ID, scheme, WorkOS callback and the rest of the Expo config are unchanged in both variants', async () => {
  for (const variant of ['integration', undefined]) {
    const config = withVariant(variant);
    assert.equal(config.ios.bundleIdentifier, 'nz.tripideas.app');
    assert.equal(config.scheme, 'tripideas');
    assert.equal(config.android.package, undefined);
    assert.equal(config.android.intentFilters, undefined);
    assert.deepEqual({ ...config, ios: undefined }, { ...appJson.expo, ios: undefined });
    assert.deepEqual({ ...config.ios, associatedDomains: undefined }, { ...appJson.expo.ios, associatedDomains: undefined });
  }
  assert.match(await read('auth/provider.tsx'), /const MOBILE_REDIRECT_URI = 'tripideas:\/\/auth\/callback'/);
});

test('the integration profiles can never create public shares (the API is not the production API)', async () => {
  const { isPublicTripSharingEnabled } = await import('../trips/public-sharing.ts');
  for (const name of ['development', 'preview', 'testflight-staging']) {
    assert.equal(isPublicTripSharingEnabled(eas.build[name].env.EXPO_PUBLIC_API_URL), false, name);
  }
  assert.equal(isPublicTripSharingEnabled('https://api.tripideas.nz'), true);
});

test('the snapshot, share and API URLs come only from configuration: no profile and no code supplies a default', async () => {
  // The three variables are required (config/required-env.ts); the profiles and the EAS environments
  // supply them. Production builds get theirs from the EAS "production" environment, which the
  // preflight and bundle verification check (docs/release-configuration.md).
  const sharedTrip = await read('trips/shared-trip.ts');
  const publicSharing = await read('trips/public-sharing.ts');
  const apiClient = await read('lib/api-client.ts');
  assert.match(sharedTrip, /requireHttpUrlEnv\(\s*'EXPO_PUBLIC_TRIP_SHARE_API_URL',\s*process\.env\.EXPO_PUBLIC_TRIP_SHARE_API_URL/);
  assert.match(publicSharing, /requireHttpUrlEnv\('EXPO_PUBLIC_TRIP_SHARE_API_URL', process\.env\.EXPO_PUBLIC_TRIP_SHARE_API_URL\)/);
  assert.match(apiClient, /requireHttpUrlEnv\('EXPO_PUBLIC_API_URL', process\.env\.EXPO_PUBLIC_API_URL\)/);
  for (const source of [sharedTrip, publicSharing, apiClient]) {
    assert.doesNotMatch(source, /EXPO_PUBLIC_[A-Z_]+\s*\?\?/);
    assert.doesNotMatch(source, /https:\/\/api\.tripideas\.nz|tripideas\.nz\/api\/trips\/share/);
  }
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
