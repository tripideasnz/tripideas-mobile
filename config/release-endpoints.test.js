// Release configuration guards (config/release-endpoints.js and the two scripts that use it).
// These exist because TestFlight build 20 shipped the production Shared Trip URL while the
// repository tests, which only read eas.json, all passed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const endpoints = require('./release-endpoints.js');
const {
  scanBundleText,
  validateBuildEnv,
  validateCallbackSource,
  validateEasJson,
  validateExpoConfig,
} = endpoints;

const STAGING_API = 'https://tripideas-api-integration-staging.up.railway.app';
const STAGING_SHARE = 'https://staging.tripideas.nz/api/trips/share';
const PRODUCTION_SHARE = 'https://www.tripideas.nz/api/trips/share';
const MAP = 'https://api.maptiler.com/maps/streets-v2/style.json?key=SECRETKEY123';
const integrationEnv = {
  APP_VARIANT: 'integration',
  EXPO_PUBLIC_API_URL: STAGING_API,
  EXPO_PUBLIC_MAP_STYLE_URL: MAP,
  EXPO_PUBLIC_TRIP_SHARE_API_URL: STAGING_SHARE,
};
const productionEnv = {
  EXPO_PUBLIC_API_URL: 'https://api.tripideas.nz',
  EXPO_PUBLIC_MAP_STYLE_URL: MAP,
  EXPO_PUBLIC_TRIP_SHARE_API_URL: PRODUCTION_SHARE,
};
const check = (profile, ...sources) =>
  validateBuildEnv({ profile, sources: sources.map((env, index) => ({ env, name: `source${index + 1}` })) });

test('the approved integration and production environments pass', () => {
  assert.deepEqual(check('testflight-staging', integrationEnv).problems, []);
  assert.deepEqual(check('production', productionEnv).problems, []);
});

test('build 20: eas.json says staging but the EAS environment says production, and either order fails', () => {
  const profileValues = { ...integrationEnv, EXPO_PUBLIC_MAP_STYLE_URL: undefined };
  const environmentValues = { EXPO_PUBLIC_MAP_STYLE_URL: MAP, EXPO_PUBLIC_TRIP_SHARE_API_URL: PRODUCTION_SHARE };
  for (const sources of [[profileValues, environmentValues], [environmentValues, profileValues]]) {
    const { problems } = check('testflight-staging', ...sources);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /EXPO_PUBLIC_TRIP_SHARE_API_URL is https:\/\/www\.tripideas\.nz\/api\/trips\/share, expected https:\/\/staging\.tripideas\.nz/);
  }
});

test('integration builds cannot use production endpoints, nor production builds staging ones', () => {
  assert.equal(check('testflight-staging', { ...integrationEnv, EXPO_PUBLIC_API_URL: 'https://api.tripideas.nz' }).problems.length, 1);
  assert.equal(check('testflight-staging', { ...integrationEnv, EXPO_PUBLIC_API_URL: 'https://tripideas-api-staging.up.railway.app' }).problems.length, 1);
  assert.equal(check('production', { ...productionEnv, EXPO_PUBLIC_TRIP_SHARE_API_URL: STAGING_SHARE }).problems.length, 1);
  assert.equal(check('production', { ...productionEnv, EXPO_PUBLIC_API_URL: STAGING_API }).problems.length, 1);
});

test('a trailing slash is the same URL', () => {
  assert.deepEqual(check('testflight-staging', { ...integrationEnv, EXPO_PUBLIC_TRIP_SHARE_API_URL: `${STAGING_SHARE}/` }).problems, []);
});

test('a missing variable is an error for store builds (it would silently fall back to production) and a warning for internal ones', () => {
  for (const key of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_TRIP_SHARE_API_URL', 'EXPO_PUBLIC_MAP_STYLE_URL']) {
    const { [key]: removed, ...rest } = integrationEnv;
    assert.match(check('testflight-staging', rest).problems.join('\n'), new RegExp(`${key} is not set by any source`));
    assert.deepEqual(check('preview', rest).problems, []);
    assert.match(check('preview', rest).warnings.join('\n'), new RegExp(key));
  }
  const { EXPO_PUBLIC_TRIP_SHARE_API_URL, ...rest } = productionEnv;
  assert.match(check('production', rest).problems.join('\n'), /EXPO_PUBLIC_TRIP_SHARE_API_URL is not set/);
});

test('deferMissing lets a preflight that has not read the EAS environment continue', () => {
  const { EXPO_PUBLIC_MAP_STYLE_URL, ...rest } = integrationEnv;
  const result = validateBuildEnv({ deferMissing: true, profile: 'testflight-staging', sources: [{ env: rest, name: 'eas.json' }] });
  assert.deepEqual(result.problems, []);
  assert.equal(result.warnings.length, 1);
});

test('APP_VARIANT must match the profile: integration builds need it, the production build must not set it', () => {
  const { APP_VARIANT, ...withoutVariant } = integrationEnv;
  assert.match(check('testflight-staging', withoutVariant).problems.join('\n'), /APP_VARIANT=integration is not set/);
  assert.match(check('testflight-staging', { ...integrationEnv, APP_VARIANT: 'staging' }).problems.join('\n'), /APP_VARIANT is "staging"/);
  assert.match(check('production', { ...productionEnv, APP_VARIANT: 'integration' }).problems.join('\n'), /production build must not set it/);
});

test('the map style must be an https URL with a real key, and the key is never reported', () => {
  for (const value of ['not a url', 'http://api.maptiler.com/x?key=abc', 'https://api.maptiler.com/x', 'https://api.maptiler.com/x?key=MISSING_KEY']) {
    const { problems } = check('testflight-staging', { ...integrationEnv, EXPO_PUBLIC_MAP_STYLE_URL: value });
    assert.equal(problems.length, 1, value);
  }
  const everything = JSON.stringify(check('testflight-staging', { ...integrationEnv, EXPO_PUBLIC_API_URL: 'https://wrong.example' }));
  assert.ok(!everything.includes('SECRETKEY123'));
});

test('an unknown build profile is rejected rather than guessed', () => {
  assert.match(check('qa-nightly', integrationEnv).problems[0], /Unknown build profile "qa-nightly"/);
});

test('Expo config: identity, scheme and Universal Link domains per variant', () => {
  const base = { ios: { bundleIdentifier: 'nz.tripideas.app' }, scheme: 'tripideas' };
  const withDomains = (associatedDomains, extra = {}) => ({ ...base, ios: { ...base.ios, associatedDomains }, ...extra });
  assert.deepEqual(validateExpoConfig({ config: withDomains(['applinks:staging.tripideas.nz', 'applinks:www.tripideas.nz']), variant: 'integration' }), []);
  assert.deepEqual(validateExpoConfig({ config: withDomains(['applinks:www.tripideas.nz']), variant: 'production' }), []);
  assert.equal(validateExpoConfig({ config: withDomains(['applinks:www.tripideas.nz']), variant: 'integration' }).length, 1);
  assert.equal(validateExpoConfig({ config: withDomains(['applinks:www.tripideas.nz', 'applinks:staging.tripideas.nz']), variant: 'production' }).length, 1);
  assert.equal(validateExpoConfig({ config: { ...withDomains(['applinks:www.tripideas.nz']), scheme: 'other' }, variant: 'production' }).length, 1);
  assert.equal(validateExpoConfig({ config: { ios: { associatedDomains: ['applinks:www.tripideas.nz'], bundleIdentifier: 'nz.example' }, scheme: 'tripideas' }, variant: 'production' }).length, 1);
});

test('the WorkOS mobile callback constant is checked in the app source', () => {
  assert.deepEqual(validateCallbackSource(readFileSync(path.join(root, 'auth/provider.tsx'), 'utf8')), []);
  assert.equal(validateCallbackSource("const MOBILE_REDIRECT_URI = 'tripideas://wrong'").length, 1);
  assert.equal(validateCallbackSource('').length, 1);
});

test('the committed eas.json passes, and breaking it is caught', () => {
  const eas = JSON.parse(readFileSync(path.join(root, 'eas.json'), 'utf8'));
  assert.deepEqual(validateEasJson(eas), []);

  const wrongShare = structuredClone(eas);
  wrongShare.build['testflight-staging'].env.EXPO_PUBLIC_TRIP_SHARE_API_URL = PRODUCTION_SHARE;
  assert.equal(validateEasJson(wrongShare).length, 1);

  const productionOverride = structuredClone(eas);
  productionOverride.build.production.env = { EXPO_PUBLIC_API_URL: STAGING_API };
  assert.match(validateEasJson(productionOverride).join('\n'), /production" must not define env/);

  const wrongEnvironment = structuredClone(eas);
  wrongEnvironment.build.production.environment = 'preview';
  assert.match(validateEasJson(wrongEnvironment).join('\n'), /must use the production EAS environment/);

  const unregistered = structuredClone(eas);
  unregistered.build['qa-nightly'] = { distribution: 'internal' };
  assert.match(validateEasJson(unregistered).join('\n'), /"qa-nightly" is not in PROFILES/);

  const missing = structuredClone(eas);
  delete missing.build['testflight-staging'];
  assert.match(validateEasJson(missing).join('\n'), /no "testflight-staging" profile/);
});

// Hermes stores literals back to back, so the fixtures run strings together as the real bundle does.
const bundle = (...literals) => literals.join('\n');
const integrationBundle = bundle(
  STAGING_API + 'AppStateFocusChange',
  STAGING_SHARE + 's/capabilities',
  'https://www.tripideas.nz/trip', // canonical shared link base: legitimate
  'https://api.tripideas.nz', // gate that blocks public share creation in integration builds: legitimate
  'https://tripideas.nzrgba',
  PRODUCTION_SHARE // code default: legitimate to be present
);

test('bundle scan: an integration bundle with the approved URLs passes, production references being legitimate', () => {
  const result = scanBundleText(integrationBundle, 'integration');
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.hosts, ['api.tripideas.nz', 'staging.tripideas.nz', 'tripideas-api-integration-staging.up.railway.app', 'tripideas.nz', 'www.tripideas.nz']);
});

test('bundle scan: build 20 (production share URL baked in, no staging URL) fails', () => {
  const build20 = bundle(STAGING_API, PRODUCTION_SHARE + 's/capabilities', 'https://api.tripideas.nz', 'https://tripideas.nz');
  const { problems } = scanBundleText(build20, 'integration');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /does not contain the Shared Trip snapshot URL https:\/\/staging\.tripideas\.nz\/api\/trips\/share/);
});

test('bundle scan: any other own-domain or Railway host fails an integration bundle', () => {
  for (const host of ['tripideas-api-staging.up.railway.app', 'tripideas-api-production.up.railway.app', 'integration-api-integration.up.railway.app', 'admin.tripideas.nz']) {
    const { problems } = scanBundleText(bundle(integrationBundle, `https://${host}/x`), 'integration');
    assert.equal(problems.length, 1, host);
    assert.match(problems[0], new RegExp(host.replace(/\./g, '\\.')));
  }
});

test('bundle scan: a production bundle must carry the production URLs and no staging or Railway host', () => {
  const production = bundle('https://api.tripideas.nz', PRODUCTION_SHARE, 'https://www.tripideas.nz/trip');
  assert.deepEqual(scanBundleText(production, 'production').problems, []);
  assert.equal(scanBundleText(bundle(production, STAGING_SHARE), 'production').problems.length, 1);
  assert.equal(scanBundleText(bundle(production, STAGING_API), 'production').problems.length, 1);
  assert.equal(scanBundleText(integrationBundle, 'production').problems.length >= 2, true);
});

// The command-line tools, end to end.
const run = (script, args, env = {}) =>
  spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, ...env },
  });

test('verify-bundle-endpoints exits 0 for a good bundle and 1 for build 20, never printing secrets', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'bundle-test-'));
  try {
    const good = path.join(directory, 'good.bundle');
    const bad = path.join(directory, 'bad.bundle');
    writeFileSync(good, integrationBundle);
    writeFileSync(bad, bundle(STAGING_API, PRODUCTION_SHARE));
    assert.equal(run('verify-bundle-endpoints.js', ['--variant', 'integration', '--bundle', good]).status, 0);
    const failed = run('verify-bundle-endpoints.js', ['--variant', 'integration', '--bundle', bad]);
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /Do not submit it/);
    assert.equal(run('verify-bundle-endpoints.js', ['--bundle', good]).status, 1, '--variant is required');
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test('validate-release-config --effective passes the corrected worker environment and fails build 20 and a missing variable', () => {
  const worker = { EAS_BUILD_PROFILE: 'testflight-staging', ...integrationEnv };
  const good = run('validate-release-config.js', ['--effective'], worker);
  assert.equal(good.status, 0, good.stderr);
  assert.ok(!good.stdout.includes('SECRETKEY123') && !good.stderr.includes('SECRETKEY123'));

  const build20 = run('validate-release-config.js', ['--effective'], { ...worker, EXPO_PUBLIC_TRIP_SHARE_API_URL: PRODUCTION_SHARE });
  assert.equal(build20.status, 1);
  assert.match(build20.stderr, /expected https:\/\/staging\.tripideas\.nz\/api\/trips\/share/);

  const { EXPO_PUBLIC_TRIP_SHARE_API_URL, ...missing } = worker;
  assert.equal(run('validate-release-config.js', ['--effective'], missing).status, 1);

  // A new, unregistered profile is rejected when it builds the integration variant.
  assert.equal(run('validate-release-config.js', ['--effective'], { ...worker, EAS_BUILD_PROFILE: 'qa-nightly' }).status, 1);
});

test('the cloud gate does not apply to production builds until it is separately approved', () => {
  // Through the hook (no flag) a production build passes through unchecked, even a wrong one.
  for (const env of [productionEnv, { ...productionEnv, EXPO_PUBLIC_API_URL: STAGING_API }, {}]) {
    const result = run('validate-release-config.js', ['--effective'], { EAS_BUILD_PROFILE: 'production', ...env });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /not enforced for the "production" build/);
  }
  // No profile and no integration variant is treated the same way; an unknown profile too.
  assert.equal(run('validate-release-config.js', ['--effective'], productionEnv).status, 0);
  assert.equal(run('validate-release-config.js', ['--effective'], { EAS_BUILD_PROFILE: 'qa-nightly' }).status, 0);

  // The production rules still exist and can be run by hand.
  const flag = ['--effective', '--enforce-production'];
  assert.equal(run('validate-release-config.js', flag, { EAS_BUILD_PROFILE: 'production', ...productionEnv }).status, 0);
  assert.equal(run('validate-release-config.js', flag, { EAS_BUILD_PROFILE: 'production', ...productionEnv, APP_VARIANT: 'integration' }).status, 1);
  assert.equal(run('validate-release-config.js', flag, { EAS_BUILD_PROFILE: 'production', ...productionEnv, EXPO_PUBLIC_TRIP_SHARE_API_URL: STAGING_SHARE }).status, 1);
});

test('the worker hook cannot be switched off from the build environment', () => {
  const source = readFileSync(path.join(root, 'scripts/validate-release-config.js'), 'utf8');
  assert.ok(!/process\.env\.(SKIP|DISABLE|BYPASS)/i.test(source));
});

test('the export check bypasses Metro\'s cache, which does not key on EXPO_PUBLIC_* values', () => {
  const source = readFileSync(path.join(root, 'scripts/verify-bundle-endpoints.js'), 'utf8');
  assert.match(source, /'expo', 'export', '--clear'/);
});

test('the worker runs the validator before building', () => {
  const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  assert.equal(scripts['eas-build-post-install'], 'node scripts/validate-release-config.js --effective');
  assert.match(scripts['verify:bundle'], /verify-bundle-endpoints\.js/);
  assert.match(scripts['validate:release'], /validate-release-config\.js/);
});
