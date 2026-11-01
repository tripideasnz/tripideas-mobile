#!/usr/bin/env node
// Verifies what a build actually contains, not what its configuration claimed: the endpoints in
// the JavaScript bundle, plus (for an IPA) the shipped Expo config and the signed entitlements.
// Build 20 shipped the wrong Shared Trip URL while every pre-build check passed; run this on the
// finished build before submitting it. Never prints bundle contents beyond own-domain hosts.
//
// It also checks the MapTiler key the build really embeds: present, 20 letters or digits, and its
// SHA-256 one of the approved fingerprints in config/release-endpoints.js. A missing, malformed,
// placeholder or unapproved key fails the check. Only the key's length and the first 8 characters of
// its SHA-256 are printed.
//
//   --variant integration|production   what the build is meant to be (required)
//   --ipa <file>                       a finished iOS build (download with `eas build:view`)
//   --export                           bundle the app now with the current environment
//                                      (`expo export`), e.g. in CI or before a build
//   --bundle <file>                    scan one bundle/text file (used by the tests)
//   --live-map                         also ask MapTiler whether it accepts the embedded key: an
//                                      optional diagnostic, warnings only; an outage never fails this
//

//   node scripts/verify-bundle-endpoints.js --variant integration --ipa build.ipa
'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  APPLE_APP_ID,
  BUNDLE_IDENTIFIER,
  VARIANTS,
  approvedMapKeys,
  extractMapKeys,
  mapKeyProblems,
  scanBundleMapKey,
  scanBundleText,
  validateExpoConfig,
} = require('../config/release-endpoints.js');
const { describeProbe, probeMapStyles } = require('./map-key-probe.js');

const root = path.resolve(path.dirname(process.argv[1]), '..');

// Hermes keeps string literals in the bytecode; printable runs are enough to find URLs.
const printableText = (buffer) => buffer.toString('latin1').replace(/[^\x20-\x7e]+/g, '\n');

function parseArguments(argv) {
  const options = { bundle: undefined, export: false, ipa: undefined, liveMap: false, variant: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--export') options.export = true;
    else if (argument === '--live-map') options.liveMap = true;
    else if (['--bundle', '--ipa', '--variant'].includes(argument)) options[argument.slice(2)] = argv[(index += 1)];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!VARIANTS[options.variant]) throw new Error('--variant integration|production is required.');
  if (!options.bundle && !options.export && !options.ipa) throw new Error('Use --ipa, --export or --bundle.');
  return options;
}

const findFiles = (directory, matches) =>
  readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    return statSync(full).isDirectory() ? findFiles(full, matches) : matches(name) ? [full] : [];
  });

// macOS tooling: `plutil` converts a plist to JSON and `codesign` prints the signed entitlements.
const plistToJson = (input) =>
  JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', '-'], { encoding: 'utf8', input }));

function checkIpa(ipa, variant, problems, notes, warnings) {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'tripideas-ipa-'));
  try {
    execFileSync('unzip', ['-q', ipa, '-d', workspace]);
    const [app] = readdirSync(path.join(workspace, 'Payload')).filter((name) => name.endsWith('.app'));
    const appPath = path.join(workspace, 'Payload', app);

    const info = plistToJson(readFileSync(path.join(appPath, 'Info.plist')));
    if (info.CFBundleIdentifier !== BUNDLE_IDENTIFIER) problems.push(`Info.plist bundle identifier is ${info.CFBundleIdentifier}, expected ${BUNDLE_IDENTIFIER}.`);
    notes.push(`bundle ${info.CFBundleIdentifier}, version ${info.CFBundleShortVersionString} (${info.CFBundleVersion})`);

    const config = JSON.parse(readFileSync(path.join(appPath, 'EXConstants.bundle', 'app.config'), 'utf8'));
    problems.push(...validateExpoConfig({ variant, config }));

    try {
      const entitlements = plistToJson(execFileSync('codesign', ['-d', '--entitlements', ':-', appPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
      const signed = [...(entitlements['com.apple.developer.associated-domains'] ?? [])].sort();
      const expected = [...VARIANTS[variant].associatedDomains].sort();
      if (JSON.stringify(signed) !== JSON.stringify(expected)) problems.push(`Signed associated domains are [${signed}], expected [${expected}].`);
      if (entitlements['application-identifier'] !== APPLE_APP_ID) problems.push(`Signed application identifier is ${entitlements['application-identifier']}, expected ${APPLE_APP_ID}.`);
      notes.push(`signed entitlements: ${APPLE_APP_ID}, associated domains [${signed}]`);
    } catch {
      warnings.push('Signed entitlements were not checked (needs macOS codesign and plutil).');
    }
    return readFileSync(path.join(appPath, 'main.jsbundle'));
  } finally {
    rmSync(workspace, { force: true, recursive: true });
  }
}

function exportBundle() {
  const output = mkdtempSync(path.join(os.tmpdir(), 'tripideas-export-'));
  try {
    // --clear is essential: Metro's transform cache does not key on EXPO_PUBLIC_* values, so a
    // cached run would replay the endpoints of an earlier environment and verify the wrong thing.
    execFileSync('npx', ['expo', 'export', '--clear', '--platform', 'ios', '--output-dir', output], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
    const [bytecode] = findFiles(output, (name) => name.endsWith('.hbc'));
    if (!bytecode) throw new Error('expo export produced no JavaScript bundle.');
    return readFileSync(bytecode);
  } finally {
    rmSync(output, { force: true, recursive: true });
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const approved = approvedMapKeys(process.env);
  const problems = [];
  const warnings = [];
  const notes = [];

  let bundle;
  if (options.ipa) {
    if (!existsSync(options.ipa)) throw new Error(`No such file: ${options.ipa}`);
    bundle = checkIpa(options.ipa, options.variant, problems, notes, warnings);
  } else if (options.export) {
    bundle = exportBundle();
  } else {
    bundle = readFileSync(options.bundle);
  }

  const scan = scanBundleText(printableText(bundle), options.variant);
  problems.push(...scan.problems);
  notes.push(`own-domain hosts in the bundle: ${scan.hosts.join(', ') || 'none'}`);

  const text = printableText(bundle);
  const mapScan = scanBundleMapKey(text, approved.hashes);
  problems.push(...mapScan.problems);
  for (const { fingerprint, length } of mapScan.facts) {
    notes.push(`MapTiler key: length ${length}, fingerprint ${fingerprint}${mapScan.approvedPresent ? ' (approved)' : ' (NOT approved)'}`);
  }
  if (approved.overridden) {
    warnings.push('TRIPIDEAS_TEST_APPROVED_MAP_KEY_SHA256 replaces the approved MapTiler fingerprints: this run is NOT a release verification.');
  }
  if (options.liveMap) {
    // Optional diagnostic on the approved embedded key only; its outcome never fails the check.
    const key = extractMapKeys(text).find((candidate) => mapKeyProblems(candidate, approved.hashes).length === 0);
    if (key) {
      const probe = describeProbe(await probeMapStyles(key));
      notes.push(...probe.notes);
      warnings.push(...probe.warnings);
    } else {
      warnings.push('MapTiler live diagnostic skipped: no approved key in the bundle.');
    }
  }

  for (const note of notes) console.log(`  ${note}`);
  for (const warning of warnings) console.warn(`WARNING: ${warning}`);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`ERROR: ${problem}`);
    console.error(`\nThe ${options.variant} build is NOT valid (${problems.length} problem${problems.length === 1 ? '' : 's'}). Do not submit it.`);
    process.exit(1);
  }
  console.log(`\nThe ${options.variant} build contains the approved endpoints and map key and nothing prohibited.`);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
