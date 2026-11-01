// Single source of truth for the endpoints each kind of TripIdeas mobile build may use, and the
// pure checks that enforce it. No network and no file access here, so everything is unit-tested
// (config/release-endpoints.test.js). Used by:
//   - scripts/validate-release-config.js  (preflight, and on the EAS worker via eas-build-post-install)
//   - scripts/verify-bundle-endpoints.js  (the built app: JavaScript bundle and Expo config)
//
// Why this exists: TestFlight build 20 was meant to read shared Trips from staging, but the
// share URL is defined both in eas.json and in the EAS "preview" environment, and the build
// baked in the environment's production value. Nothing checked the effective cloud values. These
// checks fail the build instead. The app itself no longer has a default for a missing API or share
// URL (config/required-env.ts): it stops at startup. Update the table below only when an endpoint
// is intentionally moved.
'use strict';

const { createHash } = require('node:crypto');

const BUNDLE_IDENTIFIER = 'nz.tripideas.app';
const URL_SCHEME = 'tripideas';
const MOBILE_CALLBACK = 'tripideas://auth/callback';
const APPLE_APP_ID = 'AX2S87Y7LD.nz.tripideas.app';

// "integration" = internal and TestFlight staging builds (APP_VARIANT=integration, see app.config.js).
// "production" = the App Store build.
const VARIANTS = {
  integration: {
    api: 'https://tripideas-api-integration-staging.up.railway.app',
    tripShare: 'https://staging.tripideas.nz/api/trips/share',
    associatedDomains: ['applinks:www.tripideas.nz', 'applinks:staging.tripideas.nz'],
    workosClientId: 'client_01JVNTDDEEWD4WH5GV1RP70PPQ',
    aasaHost: 'staging.tripideas.nz',
    // Hosts a built integration app may mention. The production names are legitimate here:
    // www is the canonical shared-link host and a Universal Link domain, and api.tripideas.nz is
    // the constant that keeps integration builds from creating public shares. They do not make
    // production calls: the API and share URLs are checked separately and exactly.
    allowedHosts: [
      'tripideas-api-integration-staging.up.railway.app',
      'staging.tripideas.nz',
      'www.tripideas.nz',
      'api.tripideas.nz',
      'tripideas.nz',
    ],
  },
  production: {
    api: 'https://api.tripideas.nz',
    tripShare: 'https://www.tripideas.nz/api/trips/share',
    associatedDomains: ['applinks:www.tripideas.nz'],
    workosClientId: 'client_01JEJKPNMVM3YC53R55AE8YQD3',
    aasaHost: 'www.tripideas.nz',
    allowedHosts: ['api.tripideas.nz', 'www.tripideas.nz', 'tripideas.nz'],
  },
};

// Which eas.json build profile produces which kind of build. A new profile must be added here.
const PROFILES = {
  development: { variant: 'integration', store: false },
  preview: { variant: 'integration', store: false },
  'testflight-staging': { variant: 'integration', store: true },
  production: { variant: 'production', store: true },
};

// ── The MapTiler key ─────────────────────────────────────────────────────────────────────────────
// The key travels inside EXPO_PUBLIC_MAP_STYLE_URL and ships in every build (it is restricted at
// MapTiler, not hidden). A build with a missing, mistyped or stale key has blank maps, and nothing
// else fails. The key is therefore identified here by the SHA-256 of the key itself, never by the
// key. THIS IS THE ONE PLACE the approved fingerprint lives; to rotate the key, see "Rotating the
// MapTiler key" in docs/release-configuration.md.
//
//   sha256 = SHA-256 of the 20-character key, as lowercase hex (64 characters).
//   The short form quoted in reports is its first 8 characters: 7f01cd44. A prefix is only a label;
//   every check compares the full 64 characters.
//
// Verified 2026-11-02: the EAS "preview" and "production" environments and TestFlight build 28's IPA
// all carry the key with this SHA-256, and MapTiler answered HTTP 200 for its streets and satellite styles.
const MAP_KEY = {
  approvedSha256: ['7f01cd442c4bb846e36c8494ac8466666b982b75b0a01344e4f03c00988c8853'],
  format: /^[A-Za-z0-9]{20}$/,
  length: 20,
};
const PLACEHOLDER_MAP_KEY = 'MISSING_KEY';

const sha256Hex = (text) => createHash('sha256').update(text).digest('hex');
const fingerprintOf = (key) => sha256Hex(String(key)).slice(0, 8);

/**
 * The approved key fingerprints for this run. Tests (and a rotation rehearsal) may REPLACE the
 * approved list with TRIPIDEAS_TEST_APPROVED_MAP_KEY_SHA256 (comma-separated SHA-256 hex); the scripts
 * then say so loudly and the result is not a release verification. It is refused on the EAS build
 * worker (EAS_BUILD=true), so a build cannot be waved through with it.
 */
function approvedMapKeys(env = process.env) {
  const override = env.TRIPIDEAS_TEST_APPROVED_MAP_KEY_SHA256;
  if (override === undefined) return { hashes: MAP_KEY.approvedSha256, overridden: false };
  if (env.EAS_BUILD === 'true') {
    throw new Error('TRIPIDEAS_TEST_APPROVED_MAP_KEY_SHA256 must not be set on the EAS build worker.');
  }
  const hashes = override.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (hashes.length === 0 || hashes.some((value) => !/^[0-9a-f]{64}$/.test(value))) {
    throw new Error('TRIPIDEAS_TEST_APPROVED_MAP_KEY_SHA256 must list 64-character SHA-256 hex values.');
  }
  return { hashes, overridden: true };
}

/**
 * Problems with one map key: a missing, placeholder, wrongly formed or unapproved key. Each message
 * continues the sentence "the map key ..." and carries only the length or the first 8 characters of the
 * key's SHA-256, never the key.
 */
function mapKeyProblems(key, approved = MAP_KEY.approvedSha256) {
  if (typeof key !== 'string' || key === '') return ['is missing'];
  if (key.startsWith(PLACEHOLDER_MAP_KEY)) return [`is the ${PLACEHOLDER_MAP_KEY} placeholder, so every map would be blank`];
  if (key.length !== MAP_KEY.length) return [`has ${key.length} characters, expected ${MAP_KEY.length}`];
  if (!MAP_KEY.format.test(key)) return ['contains characters other than letters and digits'];
  if (!approved.includes(sha256Hex(key))) {
    return [`has fingerprint ${fingerprintOf(key)}, which is not approved (approved: ${approved.map((hash) => hash.slice(0, 8)).join(', ')}); see config/release-endpoints.js`];
  }
  return [];
}

const URL_KEYS = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_TRIP_SHARE_API_URL'];
const REQUIRED_KEYS = [...URL_KEYS, 'EXPO_PUBLIC_MAP_STYLE_URL'];

const normalizeUrl = (value) => String(value ?? '').trim().replace(/\/+$/, '');
const approvedFor = (variant) => ({
  EXPO_PUBLIC_API_URL: VARIANTS[variant].api,
  EXPO_PUBLIC_TRIP_SHARE_API_URL: VARIANTS[variant].tripShare,
});

// Same rule as app.config.js: only the exact value "integration" selects the integration variant.
const variantOfEnv = (env) => (env.APP_VARIANT === 'integration' ? 'integration' : 'production');

// The key embedded in a map style URL, or undefined.
function mapKeyOfStyleUrl(value) {
  try {
    return new URL(String(value)).searchParams.get('key') ?? undefined;
  } catch {
    return undefined;
  }
}

// The map style URL embeds a key, so it is validated by shape and never echoed. (The key itself is
// checked against the approved fingerprint by mapKeyProblems.)
function mapStyleProblem(value) {
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    return 'EXPO_PUBLIC_MAP_STYLE_URL is not a valid URL';
  }
  if (parsed.protocol !== 'https:') return 'EXPO_PUBLIC_MAP_STYLE_URL must be https';
  const key = parsed.searchParams.get('key');
  if (!key || key === 'MISSING_KEY') return 'EXPO_PUBLIC_MAP_STYLE_URL has no map key';
  return null;
}

/**
 * Checks the environment a build will use. `sources` is a list of { name, env } candidates
 * (eas.json profile env, EAS environment, process.env on the worker...). Because it is not
 * documented which source wins when a variable is defined in several, EVERY defined value must
 * be acceptable: one wrong candidate fails the check, whichever would have won.
 * `deferMissing` turns "not set by any source" into a warning, for a preflight that has not read
 * the EAS environment the missing variables would come from.
 * The map key must be the approved one (see MAP_KEY): a problem for store builds (TestFlight and
 * App Store), a warning for internal ones, so development and preview profiles keep working.
 */
function validateBuildEnv({ profile, sources, deferMissing = false, approvedMapKeySha256 = MAP_KEY.approvedSha256 }) {
  const problems = [];
  const warnings = [];
  const known = PROFILES[profile];
  if (!known) {
    problems.push(`Unknown build profile "${profile}": add it to PROFILES in config/release-endpoints.js.`);
    return { problems, warnings };
  }
  const variant = known.variant;
  const approved = approvedFor(variant);
  const defined = (key) => sources.filter(({ env }) => env[key] !== undefined && env[key] !== '');
  const report = known.store && !deferMissing ? problems : warnings;

  // APP_VARIANT
  for (const { name, env } of sources) {
    const value = env.APP_VARIANT;
    if (variant === 'integration' && value !== 'integration') {
      if (value !== undefined) problems.push(`${name}: APP_VARIANT is "${value}", expected "integration".`);
    } else if (variant === 'production' && value !== undefined && value !== 'production') {
      problems.push(`${name}: APP_VARIANT is "${value}"; the production build must not set it.`);
    }
  }
  if (variant === 'integration' && defined('APP_VARIANT').length === 0) {
    problems.push('APP_VARIANT=integration is not set by any source; the staging Universal Link domain would be missing.');
  }

  // Required variables must exist somewhere. The app has no defaults: without the API or share URL
  // it stops at startup, and without the map style every map is blank.
  for (const key of REQUIRED_KEYS) {
    if (defined(key).length === 0) {
      report.push(
        key === 'EXPO_PUBLIC_MAP_STYLE_URL'
          ? `${key} is not set by any source, so every map would be blank.`
          : `${key} is not set by any source, so the app would stop at startup (it has no default).`
      );
    }
  }

  // Every defined value must be the approved one.
  for (const key of URL_KEYS) {
    for (const { name, env } of defined(key)) {
      if (normalizeUrl(env[key]) !== approved[key]) {
        problems.push(`${name}: ${key} is ${normalizeUrl(env[key])}, expected ${approved[key]} for ${variant} builds.`);
      }
    }
  }
  const keyReport = known.store ? problems : warnings;
  for (const { name, env } of defined('EXPO_PUBLIC_MAP_STYLE_URL')) {
    const problem = mapStyleProblem(env.EXPO_PUBLIC_MAP_STYLE_URL);
    if (problem) {
      problems.push(`${name}: ${problem}.`);
      continue;
    }
    for (const message of mapKeyProblems(mapKeyOfStyleUrl(env.EXPO_PUBLIC_MAP_STYLE_URL), approvedMapKeySha256)) {
      keyReport.push(`${name}: the map key in EXPO_PUBLIC_MAP_STYLE_URL ${message}.`);
    }
  }
  return { problems, warnings };
}

/** The Expo config that ships in the app: identity, scheme and Universal Link domains. */
function validateExpoConfig({ variant, config }) {
  const problems = [];
  if (config?.ios?.bundleIdentifier !== BUNDLE_IDENTIFIER) {
    problems.push(`ios.bundleIdentifier is ${config?.ios?.bundleIdentifier}, expected ${BUNDLE_IDENTIFIER}.`);
  }
  if (config?.scheme !== URL_SCHEME) problems.push(`scheme is ${config?.scheme}, expected ${URL_SCHEME}.`);
  const actual = [...(config?.ios?.associatedDomains ?? [])].sort();
  const expected = [...VARIANTS[variant].associatedDomains].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    problems.push(`ios.associatedDomains is [${actual}], expected [${expected}] for ${variant} builds.`);
  }
  return problems;
}

/** The WorkOS mobile callback is a constant in the app; it must match the scheme and the API. */
function validateCallbackSource(authProviderSource) {
  const match = /const MOBILE_REDIRECT_URI = '([^']+)'/.exec(authProviderSource);
  return match && match[1] === MOBILE_CALLBACK
    ? []
    : [`auth/provider.tsx MOBILE_REDIRECT_URI is ${match ? match[1] : 'missing'}, expected ${MOBILE_CALLBACK}.`];
}

/** eas.json itself: each profile's own env must be approved, and production must stay untouched. */
function validateEasJson(eas) {
  const problems = [];
  for (const [name, known] of Object.entries(PROFILES)) {
    const profile = eas.build?.[name];
    if (!profile) {
      problems.push(`eas.json has no "${name}" profile.`);
      continue;
    }
    if (known.variant === 'production') {
      if (profile.env) problems.push(`eas.json "${name}" must not define env (production values live in the EAS production environment).`);
      if (profile.environment !== 'production') problems.push(`eas.json "${name}" must use the production EAS environment.`);
      continue;
    }
    // The profile alone need not define everything (the map style comes from the EAS environment).
    const { problems: found } = validateBuildEnv({
      deferMissing: true,
      profile: name,
      sources: [{ name: `eas.json ${name}`, env: profile.env ?? {} }],
    });
    problems.push(...found);
  }
  for (const name of Object.keys(eas.build ?? {})) {
    if (!PROFILES[name]) problems.push(`eas.json profile "${name}" is not in PROFILES (config/release-endpoints.js).`);
  }
  return problems;
}

// Hermes stores string literals back to back, so a host is matched by its known suffix instead
// of by whitespace, and only hosts under our own domains are examined.
const OWN_HOST = /https?:\/\/((?:[a-z0-9-]+\.)*(?:tripideas\.nz|up\.railway\.app))/gi;

/**
 * Checks text extracted from a built app's JavaScript bundle. The approved API and share URLs
 * must be present, and no tripideas.nz or railway.app host outside the variant's allowed list
 * may appear. The approved URLs appear in application code nowhere (config/required-env.test.js),
 * so finding one in a bundle proves it was supplied as configuration.
 */
function scanBundleText(text, variant) {
  const problems = [];
  const spec = VARIANTS[variant];
  for (const [label, url] of [['API', spec.api], ['Shared Trip snapshot', spec.tripShare]]) {
    if (!text.includes(url)) problems.push(`The bundle does not contain the ${label} URL ${url} required for ${variant} builds.`);
  }
  const hosts = new Set([...text.matchAll(OWN_HOST)].map((match) => match[1].toLowerCase()));
  for (const host of [...hosts].sort()) {
    if (!spec.allowedHosts.includes(host)) problems.push(`The bundle references ${host}, which ${variant} builds must not use.`);
  }
  return { problems, hosts: [...hosts].sort() };
}

// "style.json?key=<key>" as it appears in a MapTiler style URL inside the bundle.
const STYLE_KEY = /style\.json\?key=([A-Za-z0-9_-]+)/g;

/**
 * The map keys embedded in a built app's JavaScript bundle text. Hermes packs neighbouring string
 * literals together, so a greedy match runs on well past the key (71 characters were captured for a
 * 20-character key in build 28). A key is therefore its first MAP_KEY.length characters, and a
 * shorter capture is kept as is so that it is reported as malformed.
 */
function extractMapKeys(text) {
  return [...text.matchAll(STYLE_KEY)].map((match) => match[1].slice(0, MAP_KEY.length));
}

/**
 * The embedded map key must be present, well formed and approved. A MISSING_KEY placeholder is
 * tolerated only when an approved key is also present (it is then the unused fallback in
 * constants/map.ts); on its own it means the build had no map configuration. Reports lengths and the
 * first 8 characters of each key's SHA-256, never a key.
 */
function scanBundleMapKey(text, approved = MAP_KEY.approvedSha256) {
  const problems = [];
  const keys = [...new Set(extractMapKeys(text))];
  const placeholders = keys.filter((key) => key.startsWith(PLACEHOLDER_MAP_KEY));
  const real = keys.filter((key) => !key.startsWith(PLACEHOLDER_MAP_KEY));
  const approvedPresent = real.some((key) => mapKeyProblems(key, approved).length === 0);
  if (keys.length === 0) {
    problems.push('The bundle contains no MapTiler style URL with a key, so every map would be blank.');
  }
  if (real.length === 0 && placeholders.length > 0) {
    problems.push(`The bundle's only map key is the ${PLACEHOLDER_MAP_KEY} placeholder: EXPO_PUBLIC_MAP_STYLE_URL was not supplied, so every map would be blank.`);
  }
  for (const key of real) {
    for (const message of mapKeyProblems(key, approved)) problems.push(`The bundle's map key ${message}.`);
  }
  if (real.length > 1) problems.push(`The bundle contains ${real.length} different map keys, expected exactly one.`);
  return {
    approvedPresent,
    facts: real.map((key) => ({ fingerprint: fingerprintOf(key), length: key.length })),
    problems,
  };
}

module.exports = {
  APPLE_APP_ID,
  BUNDLE_IDENTIFIER,
  MAP_KEY,
  MOBILE_CALLBACK,
  PROFILES,
  REQUIRED_KEYS,
  URL_SCHEME,
  VARIANTS,
  approvedMapKeys,
  extractMapKeys,
  fingerprintOf,
  mapKeyOfStyleUrl,
  mapKeyProblems,
  normalizeUrl,
  scanBundleMapKey,
  scanBundleText,
  sha256Hex,
  validateBuildEnv,
  validateCallbackSource,
  validateEasJson,
  validateExpoConfig,
  variantOfEnv,
};
