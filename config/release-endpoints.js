// Single source of truth for the endpoints each kind of TripIdeas mobile build may use, and the
// pure checks that enforce it. No network and no file access here, so everything is unit-tested
// (config/release-endpoints.test.js). Used by:
//   - scripts/validate-release-config.js  (preflight, and on the EAS worker via eas-build-post-install)
//   - scripts/verify-bundle-endpoints.js  (the built app: JavaScript bundle and Expo config)
//
// Why this exists: TestFlight build 20 was meant to read shared Trips from staging, but the
// share URL is defined both in eas.json and in the EAS "preview" environment, and the build
// baked in the environment's production value. Nothing checked the effective cloud values, and
// the app silently falls back to production when a variable is missing. These checks fail the
// build instead. Update the table below only when an endpoint is intentionally moved.
'use strict';

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

const URL_KEYS = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_TRIP_SHARE_API_URL'];
const REQUIRED_KEYS = [...URL_KEYS, 'EXPO_PUBLIC_MAP_STYLE_URL'];

const normalizeUrl = (value) => String(value ?? '').trim().replace(/\/+$/, '');
const approvedFor = (variant) => ({
  EXPO_PUBLIC_API_URL: VARIANTS[variant].api,
  EXPO_PUBLIC_TRIP_SHARE_API_URL: VARIANTS[variant].tripShare,
});

// Same rule as app.config.js: only the exact value "integration" selects the integration variant.
const variantOfEnv = (env) => (env.APP_VARIANT === 'integration' ? 'integration' : 'production');

// The map style URL embeds a key, so it is validated by shape and never echoed.
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
 */
function validateBuildEnv({ profile, sources, deferMissing = false }) {
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

  // Required variables must exist somewhere (otherwise the app silently falls back to a default).
  for (const key of REQUIRED_KEYS) {
    if (defined(key).length === 0) {
      report.push(`${key} is not set by any source, so the app would use its built-in default.`);
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
  for (const { name, env } of defined('EXPO_PUBLIC_MAP_STYLE_URL')) {
    const problem = mapStyleProblem(env.EXPO_PUBLIC_MAP_STYLE_URL);
    if (problem) problems.push(`${name}: ${problem}.`);
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
 * may appear. (The production share URL is also a code default, so it can legitimately appear
 * in an integration bundle; its presence alone proves nothing, the approved URL's presence does.)
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

module.exports = {
  APPLE_APP_ID,
  BUNDLE_IDENTIFIER,
  MOBILE_CALLBACK,
  PROFILES,
  REQUIRED_KEYS,
  URL_SCHEME,
  VARIANTS,
  normalizeUrl,
  scanBundleText,
  validateBuildEnv,
  validateCallbackSource,
  validateEasJson,
  validateExpoConfig,
  variantOfEnv,
};
