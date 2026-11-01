#!/usr/bin/env node
// Release configuration validation: fails (exit 1) when a build would use endpoints other than
// the ones approved for it in config/release-endpoints.js. It never prints secret values; the
// map style URL (which contains a key) is checked by shape only.
//
//   --effective            Validate the environment THIS process will build with. This is what
//                          runs on the EAS worker (package.json "eas-build-post-install"), where
//                          it sees the real, final variables. Reads EAS_BUILD_PROFILE.
//                          Enforced for EVERY profile, production included: a missing or wrong
//                          value, or an unapproved map key, fails the build before it compiles.
//   --profile <name>       Workstation preflight of an eas.json profile. Add --remote to also
//                          read the profile's EAS environment (needs `eas login`). Which source
//                          wins when both define a variable is undocumented, so every defined
//                          value must be approved.
//   --live                 Also probe the deployed API, share route and Universal Link file, and ask
//                          MapTiler whether it accepts the map key (a diagnostic: warnings only, an
//                          outage never fails the check).
//
// The MapTiler key must be the approved one for store builds (testflight-staging, production): its
// length, format and SHA-256 are checked against config/release-endpoints.js, and the key is never
// printed. Internal profiles (development, preview) get warnings instead of errors.
//
//   node scripts/validate-release-config.js --profile testflight-staging --remote --live
'use strict';

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const releaseEndpoints = require('../config/release-endpoints.js');
const { describeProbe, probeMapStyles } = require('./map-key-probe.js');

const {
  APPLE_APP_ID,
  MOBILE_CALLBACK,
  PROFILES,
  REQUIRED_KEYS,
  VARIANTS,
  approvedMapKeys,
  fingerprintOf,
  mapKeyOfStyleUrl,
  mapKeyProblems,
  normalizeUrl,
  validateBuildEnv,
  validateCallbackSource,
  validateEasJson,
  validateExpoConfig,
} = releaseEndpoints;

const root = path.resolve(path.dirname(process.argv[1]), '..');
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const KEPT_KEYS = new Set([...REQUIRED_KEYS, 'APP_VARIANT']);

// Reads one EAS environment into memory (sensitive values included, never printed).
function readRemoteEnvironment(environment) {
  const output = execFileSync(
    'npx',
    ['eas-cli', 'env:list', environment, '--include-sensitive', '--format', 'short'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const env = {};
  const unreadable = [];
  for (const line of output.split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match || !KEPT_KEYS.has(match[1])) continue;
    if (match[2].startsWith('*****')) unreadable.push(match[1]);
    else env[match[1]] = match[2];
  }
  return { env, unreadable };
}

function expoConfigFor(appVariant) {
  const previous = process.env.APP_VARIANT;
  if (appVariant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = appVariant;
  try {
    return require('../app.config.js')({ config: structuredClone(readJson('app.json').expo) });
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
}

// Probes the deployed endpoints a build of this variant depends on. No sign-in, nothing written.
async function liveChecks(variant) {
  const spec = VARIANTS[variant];
  const problems = [];
  const notes = [];
  const attempt = async (label, run) => {
    try {
      await run();
    } catch (error) {
      problems.push(`${label}: ${error.message}`);
    }
  };

  await attempt('API identity', async () => {
    const response = await fetch(`${spec.api}/version`);
    const body = await response.json();
    if (response.status !== 200 || body.apiVersion !== 1) throw new Error(`unexpected /version answer (${response.status})`);
    if (body.environment !== variant) throw new Error(`reports environment "${body.environment}", expected "${variant}"`);
    if (!body.capabilities?.includes('itinerary-import-v1')) throw new Error('itinerary-import-v1 capability missing');
    notes.push(`API ${spec.api} is the ${body.environment} API, build ${String(body.build).slice(0, 7)}`);
  });

  await attempt('Import route', async () => {
    const response = await fetch(`${spec.api}/itinerary/import`, { method: 'POST', body: '{}' });
    if (response.status !== 401) throw new Error(`unauthenticated POST /itinerary/import returned ${response.status}, expected 401`);
  });

  await attempt('WorkOS mobile sign-in', async () => {
    const response = await fetch(`${spec.api}/auth/mobile/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', codeChallengeMethod: 'S256' }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.status !== 200 || typeof body.url !== 'string') throw new Error(`POST /auth/mobile/authorize returned HTTP ${response.status} without a sign-in URL`);
    const params = new URL(body.url).searchParams;
    if (params.get('redirect_uri') !== MOBILE_CALLBACK) throw new Error(`redirect_uri is ${params.get('redirect_uri')}, expected ${MOBILE_CALLBACK}`);
    if (params.get('client_id') !== spec.workosClientId) throw new Error(`WorkOS client is ${params.get('client_id')}, expected ${spec.workosClientId}`);
    notes.push(`WorkOS client ${spec.workosClientId} with callback ${MOBILE_CALLBACK}`);
  });

  // A route that exists answers an unknown share ID with JSON {"error":"not_found"}; a missing
  // route answers with an HTML 404 page (which is what build 20 received from production).
  await attempt('Shared Trip snapshot route', async () => {
    const response = await fetch(`${spec.tripShare}/0123456789abcdef`);
    const type = response.headers.get('content-type') ?? '';
    if (response.status !== 404 || !type.includes('application/json')) {
      throw new Error(`${spec.tripShare} is not serving the snapshot route (HTTP ${response.status}, ${type || 'no content type'})`);
    }
  });

  await attempt('Universal Link association file', async () => {
    const response = await fetch(`https://${spec.aasaHost}/.well-known/apple-app-site-association`);
    if (response.status !== 200) throw new Error(`https://${spec.aasaHost} returned ${response.status} for the association file`);
    const text = await response.text();
    if (!text.includes(APPLE_APP_ID) || !text.includes('/trip/')) throw new Error(`association file does not list ${APPLE_APP_ID} for /trip/`);
  });

  return { problems, notes };
}

// How the map key looks in the report: length and the first 8 characters of its SHA-256, never the key.
function mapNote(styleUrl, approvedHashes) {
  const key = mapKeyOfStyleUrl(styleUrl);
  if (!key) return 'MAP_STYLE_URL=set (no readable key)';
  const approved = mapKeyProblems(key, approvedHashes).length === 0;
  return `MAP_STYLE_URL=set (key length ${key.length}, fingerprint ${fingerprintOf(key)}, ${approved ? 'approved' : 'NOT approved'})`;
}

function parseArguments(argv) {
  const options = { effective: false, live: false, profile: undefined, remote: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--effective') options.effective = true;
    else if (argument === '--live') options.live = true;
    else if (argument === '--remote') options.remote = true;
    else if (argument === '--profile') options.profile = argv[(index += 1)];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options.effective && !options.profile) {
    throw new Error('Use --effective (on the build worker) or --profile <name> (preflight).');
  }

  const problems = [];
  const warnings = [];
  const notes = [];
  let profile = options.profile;
  let sources;
  let appVariant;

  if (options.effective) {
    profile = profile ?? process.env.EAS_BUILD_PROFILE;
    if (!profile) {
      profile = process.env.APP_VARIANT === 'integration' ? 'testflight-staging' : 'production';
      warnings.push(`EAS_BUILD_PROFILE is not set; validating as "${profile}".`);
    }
    // Every build is checked, production included (the production gate was enabled with the
    // approval of 2026-11-02). A profile that is not registered in PROFILES fails here too.
    sources = [{ name: 'build environment', env: process.env }];
    appVariant = process.env.APP_VARIANT;
  } else {
    const eas = readJson('eas.json');
    problems.push(...validateEasJson(eas));
    const definition = eas.build?.[profile];
    if (!definition) throw new Error(`eas.json has no "${profile}" profile.`);
    sources = [{ name: `eas.json "${profile}"`, env: definition.env ?? {} }];
    appVariant = definition.env?.APP_VARIANT;
    if (options.remote) {
      if (definition.environment) {
        const { env, unreadable } = readRemoteEnvironment(definition.environment);
        sources.push({ name: `EAS environment "${definition.environment}"`, env });
        for (const key of unreadable) problems.push(`EAS environment "${definition.environment}": ${key} is masked and cannot be checked.`);
      } else {
        warnings.push(`"${profile}" sets no EAS environment; EAS may still apply a default one (not documented). Confirm with \`eas config --profile ${profile}\`.`);
      }
    }
  }

  const known = PROFILES[profile];
  const approvedKeys = approvedMapKeys(process.env);
  if (approvedKeys.overridden) {
    warnings.push('TRIPIDEAS_TEST_APPROVED_MAP_KEY_SHA256 replaces the approved MapTiler fingerprints: this run is NOT a release verification.');
  }
  const result = validateBuildEnv({
    approvedMapKeySha256: approvedKeys.hashes,
    deferMissing: !options.effective && !options.remote,
    profile,
    sources,
  });
  problems.push(...result.problems);
  warnings.push(...result.warnings);
  if (!options.effective && !options.remote) {
    warnings.push('The EAS environment was not read, so variables it supplies are unchecked. Add --remote for the full preflight.');
  }

  if (known) {
    problems.push(...validateExpoConfig({ variant: known.variant, config: expoConfigFor(appVariant) }));
    problems.push(...validateCallbackSource(readFileSync(path.join(root, 'auth/provider.tsx'), 'utf8')));
    notes.push(`profile "${profile}" builds the ${known.variant} variant (${known.store ? 'store' : 'internal'} distribution)`);
    for (const { name, env } of sources) {
      const shown = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_TRIP_SHARE_API_URL']
        .filter((key) => env[key])
        .map((key) => `${key.replace('EXPO_PUBLIC_', '')}=${normalizeUrl(env[key])}`);
      const map = env.EXPO_PUBLIC_MAP_STYLE_URL ? mapNote(env.EXPO_PUBLIC_MAP_STYLE_URL, approvedKeys.hashes) : null;
      notes.push(`${name}: ${[...shown, map].filter(Boolean).join(', ') || 'no endpoint variables'}`);
    }
    if (options.live) {
      const live = await liveChecks(known.variant);
      problems.push(...live.problems);
      notes.push(...live.notes);
      // Optional MapTiler diagnostic: an answer other than 200, or no answer at all, is only a warning.
      const style = sources.map(({ env }) => env.EXPO_PUBLIC_MAP_STYLE_URL).find(Boolean);
      const key = style ? mapKeyOfStyleUrl(style) : undefined;
      if (key && mapKeyProblems(key, approvedKeys.hashes).length === 0) {
        const probe = describeProbe(await probeMapStyles(key));
        notes.push(...probe.notes);
        warnings.push(...probe.warnings);
      }
    }
  }

  for (const note of notes) console.log(`  ${note}`);
  for (const warning of warnings) console.warn(`WARNING: ${warning}`);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`ERROR: ${problem}`);
    console.error(`\nRelease configuration for "${profile}" is NOT valid (${problems.length} problem${problems.length === 1 ? '' : 's'}).`);
    process.exit(1);
  }
  console.log(`\nRelease configuration for "${profile}" is valid.`);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
