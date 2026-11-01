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
const { describeProbe, probeMapStyles } = require('../scripts/map-key-probe.js');
const {
  MAP_KEY,
  approvedMapKeys,
  extractMapKeys,
  mapKeyProblems,
  scanBundleMapKey,
  scanBundleText,
  sha256Hex,
  validateBuildEnv,
  validateCallbackSource,
  validateEasJson,
  validateExpoConfig,
} = endpoints;

const STAGING_API = 'https://tripideas-api-integration-staging.up.railway.app';
const STAGING_SHARE = 'https://staging.tripideas.nz/api/trips/share';
const PRODUCTION_SHARE = 'https://www.tripideas.nz/api/trips/share';
// A made-up 20-character key: the real one is never in the repository. Tests approve it by its SHA-256,
// exactly as the real key is approved by MAP_KEY.approvedSha256.
const TEST_KEY = 'SECRETKEY12345678901';
const TEST_KEY_SHA256 = sha256Hex(TEST_KEY);
const MAP = `https://api.maptiler.com/maps/streets-v2/style.json?key=${TEST_KEY}`;
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
  validateBuildEnv({
    approvedMapKeySha256: [TEST_KEY_SHA256],
    profile,
    sources: sources.map((env, index) => ({ env, name: `source${index + 1}` })),
  });

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

test('a missing variable is an error for store builds (the app has no default and would stop at startup) and a warning for internal ones', () => {
  for (const key of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_TRIP_SHARE_API_URL', 'EXPO_PUBLIC_MAP_STYLE_URL']) {
    const { [key]: removed, ...rest } = integrationEnv;
    assert.match(check('testflight-staging', rest).problems.join('\n'), new RegExp(`${key} is not set by any source`));
    assert.deepEqual(check('preview', rest).problems, []);
    assert.match(check('preview', rest).warnings.join('\n'), new RegExp(key));
  }
  const { EXPO_PUBLIC_TRIP_SHARE_API_URL, ...rest } = productionEnv;
  assert.match(check('production', rest).problems.join('\n'), /EXPO_PUBLIC_TRIP_SHARE_API_URL is not set/);
  // The message says what happens: no hidden fall-back to production any more.
  const { EXPO_PUBLIC_API_URL, ...noApi } = integrationEnv;
  assert.match(check('testflight-staging', noApi).problems.join('\n'), /would stop at startup \(it has no default\)/);
  const { EXPO_PUBLIC_MAP_STYLE_URL, ...noMap } = integrationEnv;
  assert.match(check('testflight-staging', noMap).problems.join('\n'), /every map would be blank/);
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
  PRODUCTION_SHARE // an integration bundle may mention the production share endpoint: allowed host
);
// The map style literal as Hermes stores it: the key followed by the next literals, run together.
const mapLiteral = (key) => `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}ackIgnoreMeSomeOtherLiteralFollowingIt`;
const goodBundle = bundle(integrationBundle, mapLiteral(TEST_KEY));

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
// `run` approves the made-up TEST_KEY (and says so loudly); `runReal` uses the real approved fingerprints.
const runReal = (script, args, env = {}) =>
  spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, ...env },
  });
const run = (script, args, env = {}) =>
  runReal(script, args, { TRIPIDEAS_TEST_APPROVED_MAP_KEY_SHA256: TEST_KEY_SHA256, ...env });

test('verify-bundle-endpoints exits 0 for a good bundle and 1 for build 20, never printing secrets', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'bundle-test-'));
  try {
    const good = path.join(directory, 'good.bundle');
    const bad = path.join(directory, 'bad.bundle');
    writeFileSync(good, goodBundle);
    writeFileSync(bad, bundle(STAGING_API, PRODUCTION_SHARE, mapLiteral(TEST_KEY)));
    const passed = run('verify-bundle-endpoints.js', ['--variant', 'integration', '--bundle', good]);
    assert.equal(passed.status, 0, passed.stderr);
    assert.match(passed.stdout, new RegExp(`MapTiler key: length 20, fingerprint ${TEST_KEY_SHA256.slice(0, 8)} \\(approved\\)`));
    assert.match(passed.stderr, /NOT a release verification/, 'a replaced approved list is flagged loudly');
    for (const output of [passed.stdout, passed.stderr]) assert.ok(!output.includes(TEST_KEY.slice(0, 12)), 'the key is never printed');
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
  assert.match(good.stdout, new RegExp(`key length 20, fingerprint ${TEST_KEY_SHA256.slice(0, 8)}, approved`));

  const build20 = run('validate-release-config.js', ['--effective'], { ...worker, EXPO_PUBLIC_TRIP_SHARE_API_URL: PRODUCTION_SHARE });
  assert.equal(build20.status, 1);
  assert.match(build20.stderr, /expected https:\/\/staging\.tripideas\.nz\/api\/trips\/share/);

  const { EXPO_PUBLIC_TRIP_SHARE_API_URL, ...missing } = worker;
  assert.equal(run('validate-release-config.js', ['--effective'], missing).status, 1);

  // A new, unregistered profile is rejected when it builds the integration variant.
  assert.equal(run('validate-release-config.js', ['--effective'], { ...worker, EAS_BUILD_PROFILE: 'qa-nightly' }).status, 1);
});

test('the cloud gate covers production builds too: the same checks as testflight-staging', () => {
  const production = { EAS_BUILD_PROFILE: 'production', ...productionEnv };
  const effective = (env, runner = run) => runner('validate-release-config.js', ['--effective'], env);
  const good = effective(production);
  assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /profile "production" builds the production variant/);
  assert.match(good.stdout, new RegExp(`key length 20, fingerprint ${TEST_KEY_SHA256.slice(0, 8)}, approved`));
  assert.doesNotMatch(good.stdout, /not enforced/);

  // Wrong or missing values fail the production build.
  const wrong = [
    { ...production, EXPO_PUBLIC_API_URL: STAGING_API },
    { ...production, EXPO_PUBLIC_TRIP_SHARE_API_URL: STAGING_SHARE },
    { ...production, APP_VARIANT: 'integration' },
    { ...production, EXPO_PUBLIC_MAP_STYLE_URL: 'https://api.maptiler.com/maps/streets-v2/style.json?key=ABCDEFGHIJKLMNOPQRST' },
  ];
  for (const env of wrong) assert.equal(effective(env).status, 1, JSON.stringify(Object.keys(env)));
  for (const key of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_TRIP_SHARE_API_URL', 'EXPO_PUBLIC_MAP_STYLE_URL']) {
    const { [key]: removed, ...rest } = production;
    const result = effective(rest);
    assert.equal(result.status, 1, key);
    assert.match(result.stderr, new RegExp(`${key} is not set by any source`));
  }
  assert.equal(effective({ EAS_BUILD_PROFILE: 'production' }).status, 1, 'an empty production environment fails');

  // The real approved fingerprints reject the made-up key, so a stand-in cannot pass the gate.
  const real = effective(production, runReal);
  assert.equal(real.status, 1);
  assert.match(real.stderr, /the map key in EXPO_PUBLIC_MAP_STYLE_URL has fingerprint [0-9a-f]{8}, which is not approved/);
  for (const output of [good, real].flatMap((r) => [r.stdout, r.stderr])) assert.ok(!output.includes(TEST_KEY.slice(0, 12)), 'the key is never printed');

  // No profile name: validated as production (or integration with APP_VARIANT), never skipped.
  assert.equal(effective(productionEnv).status, 0);
  assert.equal(effective({}).status, 1);
  // An unregistered profile no longer passes unchecked, whatever it builds.
  assert.equal(effective({ EAS_BUILD_PROFILE: 'qa-nightly', ...productionEnv }).status, 1);
  assert.match(effective({ EAS_BUILD_PROFILE: 'qa-nightly', ...productionEnv }).stderr, /Unknown build profile "qa-nightly"/);
  // The old opt-in flag is gone: nothing is opt-in any more.
  assert.equal(run('validate-release-config.js', ['--effective', '--enforce-production'], production).status, 1);
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

// ── The MapTiler key ────────────────────────────────────────────────────────────────────────────

test('the approved fingerprint list is one documented place and well formed', () => {
  assert.ok(MAP_KEY.approvedSha256.length >= 1);
  for (const hash of MAP_KEY.approvedSha256) assert.match(hash, /^[0-9a-f]{64}$/, 'full SHA-256, never a prefix');
  assert.equal(new Set(MAP_KEY.approvedSha256).size, MAP_KEY.approvedSha256.length, 'no duplicates');
  assert.equal(MAP_KEY.length, 20);
  // The short form used in reports and release notes is the first 8 characters of the full hash; the
  // documentation must name exactly the approved ones, so a rotation updates both together.
  const documented = readFileSync(path.join(root, 'docs/release-configuration.md'), 'utf8');
  const section = documented.slice(documented.indexOf('## 9. MapTiler verification'), documented.indexOf('## 10.'));
  for (const hash of MAP_KEY.approvedSha256) assert.ok(section.includes(`**\`${hash.slice(0, 8)}\`**`), `docs/release-configuration.md section 9 names ${hash.slice(0, 8)}`);
  const named = [...section.matchAll(/\*\*`([0-9a-f]{8})`\*\*/g)].map((match) => match[1]);
  assert.deepEqual(named.sort(), MAP_KEY.approvedSha256.map((hash) => hash.slice(0, 8)).sort(), 'and nothing else');
  // Nothing else in the repository carries a copy of the fingerprint list: this is the single source.
  const holders = ['config/release-endpoints.js', 'scripts/validate-release-config.js', 'scripts/verify-bundle-endpoints.js', 'scripts/map-key-probe.js']
    .filter((file) => readFileSync(path.join(root, file), 'utf8').includes(MAP_KEY.approvedSha256[0]));
  assert.deepEqual(holders, ['config/release-endpoints.js']);
});

test('the fingerprint is the SHA-256 of the 20-character key, as lowercase hex', () => {
  // A known vector pins the calculation: UTF-8 bytes of the key, no newline, no salt.
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Hex(TEST_KEY), TEST_KEY_SHA256);
  assert.equal(TEST_KEY_SHA256.slice(0, 8).length, 8);
});

test('a map key must be present, 20 letters or digits, and approved; messages never contain the key', () => {
  const approved = [TEST_KEY_SHA256];
  assert.deepEqual(mapKeyProblems(TEST_KEY, approved), []);
  assert.match(mapKeyProblems(undefined, approved)[0], /is missing/);
  assert.match(mapKeyProblems('', approved)[0], /is missing/);
  assert.match(mapKeyProblems('MISSING_KEY', approved)[0], /placeholder/);
  assert.match(mapKeyProblems(TEST_KEY.slice(0, 19), approved)[0], /19 characters, expected 20/);
  assert.match(mapKeyProblems(`${TEST_KEY}X`, approved)[0], /21 characters, expected 20/);
  assert.match(mapKeyProblems(`${TEST_KEY.slice(0, 19)}_`, approved)[0], /other than letters and digits/);
  const wrong = 'ABCDEFGHIJKLMNOPQRST';
  const mismatch = mapKeyProblems(wrong, approved);
  assert.match(mismatch[0], /has fingerprint [0-9a-f]{8}, which is not approved/);
  assert.ok(mismatch[0].includes(TEST_KEY_SHA256.slice(0, 8)), 'lists the approved prefixes');
  for (const message of [...mismatch, ...mapKeyProblems(TEST_KEY.slice(0, 19), approved), ...mapKeyProblems(`${TEST_KEY.slice(0, 19)}_`, approved)]) {
    assert.ok(!message.includes(wrong.slice(0, 8)) && !message.includes(TEST_KEY.slice(0, 8)), 'no part of a key in a message');
  }
  // The real approved list rejects the made-up key: a stand-in cannot pass by accident.
  assert.match(mapKeyProblems(TEST_KEY)[0], /not approved/);
});

test('store builds reject a wrong, malformed or placeholder map key; internal builds only warn', () => {
  for (const key of ['ABCDEFGHIJKLMNOPQRST', TEST_KEY.slice(0, 19), `${TEST_KEY}X`]) {
    const env = { ...integrationEnv, EXPO_PUBLIC_MAP_STYLE_URL: `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}` };
    const store = check('testflight-staging', env);
    assert.equal(store.problems.length, 1, key);
    assert.match(store.problems[0], /the map key in EXPO_PUBLIC_MAP_STYLE_URL /);
    assert.ok(!JSON.stringify(store).includes(key.slice(0, 8)), 'the key is not reported');
    const internal = check('preview', env);
    assert.deepEqual(internal.problems, [], 'development and preview profiles keep working');
    assert.equal(internal.warnings.length, 1);
    assert.match(check('production', { ...productionEnv, EXPO_PUBLIC_MAP_STYLE_URL: env.EXPO_PUBLIC_MAP_STYLE_URL }).problems.join(), /map key/);
  }
  // The placeholder is rejected everywhere, as before.
  const placeholder = { ...integrationEnv, EXPO_PUBLIC_MAP_STYLE_URL: 'https://api.maptiler.com/maps/streets-v2/style.json?key=MISSING_KEY' };
  assert.equal(check('preview', placeholder).problems.length, 1);
  // Real approved fingerprints: the made-up key is not one.
  const real = validateBuildEnv({ profile: 'testflight-staging', sources: [{ env: integrationEnv, name: 'worker' }] });
  assert.match(real.problems.join(), /not approved/);
});

test('bundle map key: approved key passes, whatever literals Hermes ran after it', () => {
  const approved = [TEST_KEY_SHA256];
  const scan = scanBundleMapKey(bundle('x', mapLiteral(TEST_KEY), 'y'), approved);
  assert.deepEqual(scan.problems, []);
  assert.equal(scan.approvedPresent, true);
  assert.deepEqual(scan.facts, [{ fingerprint: TEST_KEY_SHA256.slice(0, 8), length: 20 }]);
  // A greedy match would have captured far more than the key; exactly 20 characters are the key.
  assert.equal(extractMapKeys(mapLiteral(TEST_KEY))[0], TEST_KEY);
  assert.equal(extractMapKeys(mapLiteral(TEST_KEY))[0].length, 20);
});

test('bundle map key: missing, placeholder, malformed, wrong and multiple keys all fail without printing a key', () => {
  const approved = [TEST_KEY_SHA256];
  const wrong = 'ABCDEFGHIJKLMNOPQRST';
  const cases = {
    'no style URL at all': [bundle(STAGING_API), /no MapTiler style URL/],
    'placeholder only (the variable was not supplied)': [mapLiteral('MISSING_KEY'), /only map key is the MISSING_KEY placeholder/],
    // A short key is only recognisable as short when something that is not a key character follows it;
    // run together with the next literal it reads as a 20-character key and is rejected as unapproved.
    'too short': [`https://api.maptiler.com/maps/streets-v2/style.json?key=${TEST_KEY.slice(0, 12)}\nnext`, /12 characters, expected 20/],
    'short and run together': [mapLiteral(TEST_KEY.slice(0, 12)), /which is not approved/],
    'wrong key': [mapLiteral(wrong), /has fingerprint [0-9a-f]{8}, which is not approved/],
    'two different keys': [bundle(mapLiteral(TEST_KEY), mapLiteral(wrong)), /2 different map keys/],
  };
  for (const [name, [text, pattern]] of Object.entries(cases)) {
    const { problems } = scanBundleMapKey(text, approved);
    assert.match(problems.join('\n'), pattern, name);
    assert.ok(!problems.join('\n').includes(wrong.slice(0, 8)) && !problems.join('\n').includes(TEST_KEY.slice(0, 8)), `${name}: no key in the report`);
  }
  // The unused placeholder fallback in constants/map.ts is tolerated only beside an approved key.
  const both = scanBundleMapKey(bundle(mapLiteral(TEST_KEY), mapLiteral('MISSING_KEY')), approved);
  assert.deepEqual(both.problems, []);
  assert.equal(scanBundleMapKey(mapLiteral('MISSING_KEY'), approved).problems.length >= 1, true);
});

test('verify-bundle rejects a missing, placeholder or unapproved key and never prints one', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'bundle-key-test-'));
  try {
    const write = (name, text) => { const file = path.join(directory, name); writeFileSync(file, text); return file; };
    const args = (file) => ['--variant', 'integration', '--bundle', file];
    const none = run('verify-bundle-endpoints.js', args(write('none', integrationBundle)));
    assert.equal(none.status, 1);
    assert.match(none.stderr, /no MapTiler style URL/);
    const placeholder = run('verify-bundle-endpoints.js', args(write('ph', bundle(integrationBundle, mapLiteral('MISSING_KEY')))));
    assert.equal(placeholder.status, 1);
    assert.match(placeholder.stderr, /MISSING_KEY placeholder/);
    // With the REAL approved fingerprints the made-up key is rejected, so a stand-in cannot pass.
    const real = runReal('verify-bundle-endpoints.js', args(write('real', goodBundle)));
    assert.equal(real.status, 1);
    assert.match(real.stderr, /fingerprint [0-9a-f]{8}, which is not approved/);
    assert.match(real.stdout, /NOT approved/);
    for (const output of [none, placeholder, real].flatMap((r) => [r.stdout, r.stderr])) assert.ok(!output.includes(TEST_KEY.slice(0, 12)));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test('validate-release-config: store profiles fail on an unapproved key, internal ones warn, neither prints it', () => {
  const worker = { EAS_BUILD_PROFILE: 'testflight-staging', ...integrationEnv };
  const store = runReal('validate-release-config.js', ['--effective'], worker);
  assert.equal(store.status, 1);
  assert.match(store.stderr, /the map key in EXPO_PUBLIC_MAP_STYLE_URL has fingerprint [0-9a-f]{8}, which is not approved/);
  const internal = runReal('validate-release-config.js', ['--effective'], { ...worker, EAS_BUILD_PROFILE: 'preview' });
  assert.equal(internal.status, 0, internal.stderr);
  assert.match(internal.stderr, /WARNING: .*which is not approved/);
  for (const output of [store, internal].flatMap((r) => [r.stdout, r.stderr])) assert.ok(!output.includes(TEST_KEY.slice(0, 12)));
  // The production gate applies the same key rule (its own test above covers the rest).
  const production = { EAS_BUILD_PROFILE: 'production', ...productionEnv };
  assert.equal(runReal('validate-release-config.js', ['--effective'], production).status, 1);
  assert.equal(run('validate-release-config.js', ['--effective'], production).status, 0);
});

test('the approved list can be replaced for tests only, never on the EAS build worker', () => {
  assert.deepEqual(approvedMapKeys({}), { hashes: MAP_KEY.approvedSha256, overridden: false });
  assert.deepEqual(approvedMapKeys({ TRIPIDEAS_TEST_APPROVED_MAP_KEY_SHA256: TEST_KEY_SHA256 }), { hashes: [TEST_KEY_SHA256], overridden: true });
  assert.throws(() => approvedMapKeys({ EAS_BUILD: 'true', TRIPIDEAS_TEST_APPROVED_MAP_KEY_SHA256: TEST_KEY_SHA256 }), /must not be set on the EAS build worker/);
  assert.throws(() => approvedMapKeys({ TRIPIDEAS_TEST_APPROVED_MAP_KEY_SHA256: 'abcd1234' }), /64-character/);
  assert.throws(() => approvedMapKeys({ TRIPIDEAS_TEST_APPROVED_MAP_KEY_SHA256: '' }), /64-character/);
  // End to end: on the worker the override makes the script fail instead of waving the build through.
  const onWorker = run('validate-release-config.js', ['--effective'], { EAS_BUILD: 'true', EAS_BUILD_PROFILE: 'testflight-staging', ...integrationEnv });
  assert.equal(onWorker.status, 1);
  assert.match(onWorker.stderr, /must not be set on the EAS build worker/);
  assert.equal(run('verify-bundle-endpoints.js', ['--variant', 'integration', '--bundle', '/nonexistent'], { EAS_BUILD: 'true' }).status, 1);
});

test('the MapTiler live diagnostic only ever warns: an outage, a rejection or a timeout cannot fail anything', async () => {
  const answer = (status) => async () => ({ status });
  const down = async () => { throw new TypeError('fetch failed for https://api.maptiler.com/maps/x?key=SECRET'); };
  const ok = describeProbe(await probeMapStyles(TEST_KEY, answer(200)));
  assert.deepEqual(ok.warnings, []);
  assert.equal(ok.notes.length, 2);
  const rejected = describeProbe(await probeMapStyles(TEST_KEY, answer(403)));
  assert.equal(rejected.warnings.length, 2);
  assert.match(rejected.warnings[0], /answered HTTP 403 \(diagnostic only: this does not fail the build\)/);
  const unreachable = describeProbe(await probeMapStyles(TEST_KEY, down));
  assert.equal(unreachable.warnings.length, 2);
  assert.match(unreachable.warnings[0], /could not be reached/);
  const timedOut = describeProbe(await probeMapStyles(TEST_KEY, (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('x'), { name: 'AbortError' })))), 20));
  assert.match(timedOut.warnings[0], /timed out/);
  for (const text of [...ok.notes, ...rejected.warnings, ...unreachable.warnings, ...timedOut.warnings]) {
    assert.ok(!text.includes(TEST_KEY) && !text.includes('SECRET') && !text.includes('http'), 'no key or URL in diagnostics');
  }
  // Neither script treats the probe as a gate: it feeds notes and warnings only.
  for (const file of ['scripts/validate-release-config.js', 'scripts/verify-bundle-endpoints.js']) {
    const source = readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /warnings\.push\(\.\.\.probe\.warnings\)/);
    assert.doesNotMatch(source, /problems\.push\(\.\.\.probe/);
  }
});

