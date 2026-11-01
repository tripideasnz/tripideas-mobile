// Required public configuration: the app has no default for the API or Shared Trip URL. A missing
// or malformed value stops it with a message naming the variable, and a missing value can never
// enable public Trip sharing or point a non-production build at production.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { VARIANTS } = require('./release-endpoints.js');
const { InvalidConfigError, MissingConfigError, requireEnv, requireHttpUrlEnv } =
  await import('./required-env.ts');

const API = 'EXPO_PUBLIC_API_URL';
const SHARE = 'EXPO_PUBLIC_TRIP_SHARE_API_URL';

test('a missing, empty or blank value is a MissingConfigError that names the variable', () => {
  for (const value of [undefined, '', '   ', '\n']) {
    assert.throws(
      () => requireHttpUrlEnv(API, value),
      (error) => error instanceof MissingConfigError && error.variable === API && error.message.startsWith(`${API} is not set`)
    );
    assert.throws(() => requireEnv(SHARE, value), MissingConfigError);
  }
});

test('the message tells the developer what to do and never contains a value', () => {
  const error = (() => { try { requireHttpUrlEnv(API, undefined); } catch (e) { return e; } })();
  assert.match(error.message, /\.env\.example/);
  assert.match(error.message, /--clear/);
  assert.match(error.message, /docs\/release-configuration\.md/);
  const secretLooking = 'ftp://user:hunter2@host.example/?key=SECRETKEY123';
  const invalid = (() => { try { requireHttpUrlEnv(API, secretLooking); } catch (e) { return e; } })();
  assert.ok(invalid instanceof InvalidConfigError);
  assert.equal(invalid.variable, API);
  assert.ok(!invalid.message.includes('hunter2') && !invalid.message.includes('SECRETKEY123') && !invalid.message.includes('host.example'));
});

test('a value that is not an http(s) URL is an InvalidConfigError', () => {
  for (const value of ['not a url', 'ftp://example.com', 'https://', '//example.com', 'api.example.com', 'https:// spaced.example']) {
    assert.throws(() => requireHttpUrlEnv(API, value), InvalidConfigError, value);
  }
});

test('valid values are returned trimmed, https and local http alike', () => {
  assert.equal(requireHttpUrlEnv(API, '  https://api.example.test  '), 'https://api.example.test');
  assert.equal(requireHttpUrlEnv(API, 'http://localhost:3001'), 'http://localhost:3001');
  assert.equal(requireHttpUrlEnv(SHARE, VARIANTS.integration.tripShare), VARIANTS.integration.tripShare);
});

// Real modules in a child process with NO configuration: the loader's test values are switched off.
const inChild = (code, env = {}) =>
  spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/test-loader.mjs', '--input-type=module', '-e', code], {
    cwd: root,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, TRIPIDEAS_TEST_NO_ENV_DEFAULTS: '1', ...env },
  });
const outcome = (code, env) => {
  const result = inChild(`try { ${code} } catch (e) { console.log(JSON.stringify({ name: e.name, variable: e.variable, message: e.message })); }`, env);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout.trim().split('\n').pop()) : null;
};

test('the API client refuses to load without EXPO_PUBLIC_API_URL: it does not fall back to production', () => {
  const failure = outcome(`await import('./lib/api-client.ts');`);
  assert.equal(failure?.name, 'MissingConfigError');
  assert.equal(failure.variable, API);
  assert.ok(!failure.message.includes('tripideas.nz'), 'the message names no environment');
  assert.equal(outcome(`await import('./lib/api-client.ts');`, { [API]: '   ' })?.name, 'MissingConfigError');
  assert.equal(outcome(`await import('./lib/api-client.ts');`, { [API]: 'not a url' })?.name, 'InvalidConfigError');
});

test('the API client takes exactly the configured URL, minus trailing slashes', () => {
  const result = inChild(
    `const { API_BASE_URL } = await import('./lib/api-client.ts'); console.log(API_BASE_URL);`,
    { [API]: 'https://api.example.test///' }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'https://api.example.test');
});

test('receiving a shared Trip refuses to load without EXPO_PUBLIC_TRIP_SHARE_API_URL', () => {
  const failure = outcome(`await import('./trips/shared-trip.ts');`);
  assert.equal(failure?.name, 'MissingConfigError');
  assert.equal(failure.variable, SHARE);
  const ok = inChild(
    `const m = await import('./trips/shared-trip.ts'); console.log(m.buildSharedTripSnapshotUrl('0123456789abcdef'));`,
    { [SHARE]: 'https://share.example.test/api/trips/share/' }
  );
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout.trim(), 'https://share.example.test/api/trips/share/0123456789abcdef');
});

test('public Trip sharing is disabled whenever the API URL is missing, blank or anything but the production API', () => {
  const gate = (argument) =>
    inChild(`const { isPublicTripSharingEnabled: g } = await import('./trips/public-sharing.ts'); console.log(g(${argument}));`).stdout.trim();
  assert.equal(gate(''), 'false', 'no argument reads the environment, which is empty here');
  assert.equal(gate('undefined'), 'false');
  assert.equal(gate(`''`), 'false');
  assert.equal(gate(`'   '`), 'false');
  assert.equal(gate(`'${VARIANTS.integration.api}'`), 'false');
  assert.equal(gate(`'http://localhost:3001'`), 'false');
  assert.equal(gate(`'${VARIANTS.production.api}'`), 'true');
  assert.equal(gate(`'${VARIANTS.production.api}/'`), 'true');
  // The environment alone decides when nothing is passed.
  const fromEnv = (value) => inChild(`const { isPublicTripSharingEnabled: g } = await import('./trips/public-sharing.ts'); console.log(g());`, value === undefined ? {} : { [API]: value }).stdout.trim();
  assert.equal(fromEnv(undefined), 'false');
  assert.equal(fromEnv(VARIANTS.integration.api), 'false');
  assert.equal(fromEnv(VARIANTS.production.api), 'true');
});

test('a production-gated share with the share URL missing is a configuration error, never a network failure and never a request', () => {
  const failure = outcome(
    `globalThis.fetch = async () => { throw new Error('NETWORK CALL'); };
     const { createPublicTripShare } = await import('./trips/public-sharing.ts');
     await createPublicTripShare({ places: [], sourceTripId: 'itn_test', title: 'Test' });`,
    { [API]: VARIANTS.production.api }
  );
  assert.equal(failure?.name, 'MissingConfigError');
  assert.equal(failure.variable, SHARE);
  // Not the production API: disabled, and the missing share URL is not even read.
  const disabled = inChild(
    `globalThis.fetch = async () => { throw new Error('NETWORK CALL'); };
     const { createPublicTripShare } = await import('./trips/public-sharing.ts');
     console.log(JSON.stringify(await createPublicTripShare({ places: [], sourceTripId: 'itn_test', title: 'Test' })));`,
    { [API]: VARIANTS.integration.api }
  );
  assert.equal(disabled.status, 0, disabled.stderr);
  assert.deepEqual(JSON.parse(disabled.stdout.trim()), { reason: 'disabled', status: 'unavailable' });
});

// ── Guards against bringing a silent default back ────────────────────────────────────────────────

const sourceFiles = (directory, found = []) => {
  for (const name of readdirSync(directory)) {
    if (['node_modules', 'ios', 'android', '.git', '.expo', 'dist', 'docs', 'audit'].includes(name)) continue;
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (/\.(ts|tsx)$/.test(name)) found.push(full);
  }
  return found;
};
const app = sourceFiles(root).map((file) => ({ file: path.relative(root, file), text: readFileSync(file, 'utf8') }));

test('no application source falls back to a URL when EXPO_PUBLIC_* is missing', () => {
  const offenders = [];
  for (const { file, text } of app) {
    // `process.env.EXPO_PUBLIC_X ?? '...'` or `?? SOME_URL_CONSTANT` in any form.
    if (/process\.env\.EXPO_PUBLIC_[A-Z_]+\s*(\?\?|\|\|)/.test(text) && file !== 'constants/map.ts') offenders.push(`${file}: default for an EXPO_PUBLIC_ variable`);
    if (/process\.env\.EXPO_PUBLIC_(API|TRIP)[A-Z_]*\?\./.test(text)) offenders.push(`${file}: optional chaining on a required variable`);
    if (/https:\/\/(www\.)?tripideas\.nz\/api\/trips\/share/.test(text)) offenders.push(`${file}: hard-coded share endpoint`);
  }
  assert.deepEqual(offenders, []);
});

test('the exact production API and share URLs never appear in application code, so finding them in a bundle proves configuration', () => {
  for (const url of [VARIANTS.production.api, VARIANTS.production.tripShare, VARIANTS.integration.api, VARIANTS.integration.tripShare]) {
    const holders = app.filter(({ text }) => text.includes(url)).map(({ file }) => file);
    assert.deepEqual(holders, [], `${url} must come only from EXPO_PUBLIC_* configuration`);
  }
  // The public-sharing gate still recognises the production API, by pattern.
  const gate = app.find(({ file }) => file === 'trips/public-sharing.ts').text;
  assert.match(gate, /const PRODUCTION_API_URL = \/\^https:\\\/\\\/api\\\.tripideas\\\.nz\$\/i;/);
});

test('the three variables are read through requireHttpUrlEnv with the literal process.env expression, so Expo inlines them', () => {
  const read = (file) => app.find((entry) => entry.file === file).text;
  assert.match(read('lib/api-client.ts'), /requireHttpUrlEnv\('EXPO_PUBLIC_API_URL', process\.env\.EXPO_PUBLIC_API_URL\)/);
  assert.match(read('trips/shared-trip.ts'), /requireHttpUrlEnv\(\s*'EXPO_PUBLIC_TRIP_SHARE_API_URL',\s*process\.env\.EXPO_PUBLIC_TRIP_SHARE_API_URL\s*\)/);
  assert.match(read('trips/public-sharing.ts'), /requireHttpUrlEnv\('EXPO_PUBLIC_TRIP_SHARE_API_URL', process\.env\.EXPO_PUBLIC_TRIP_SHARE_API_URL\)/);
  const code = (text) => text.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
  assert.ok(!app.some(({ text }) => /process\.env\[/.test(code(text))), 'dynamic lookups are not inlined by Expo');
});

test('.env.example shows the integration configuration, never production values', () => {
  const example = readFileSync(path.join(root, '.env.example'), 'utf8');
  const value = (name) => new RegExp(`^${name}=(.*)$`, 'm').exec(example)?.[1];
  assert.equal(value(API), VARIANTS.integration.api);
  assert.equal(value(SHARE), VARIANTS.integration.tripShare);
  assert.match(value('EXPO_PUBLIC_MAP_STYLE_URL') ?? '', /^https:\/\/api\.maptiler\.com\/maps\/streets-v2\/style\.json\?key=[A-Za-z0-9_<>-]+$/);
  assert.doesNotMatch(example.replace(/^#.*$/gm, ''), /api\.tripideas\.nz|www\.tripideas\.nz/);
  assert.match(example, /--clear/, 'tells developers to restart Metro with a cleared cache');
});
