# Release configuration, validation and build process

**Status, 2026-11-01:** sections 1 to 5 were audited on 2026-10-29 and still describe the code at `release/shared-trips-mobile-rc2` (`d7bef7d`): `eas.json` profiles, the `preview` environment (now holding only the map style URL) and the silent production defaults are unchanged. Section 6 is historical. Sections 8 to 11 are the **current release procedure**, as exercised for TestFlight builds 25 to 28. **Updated 2026-11-02:** the app no longer falls back to production when a configuration value is missing, and MapTiler key verification is automated. Required variables per environment and the fail-fast behaviour are in [section 12](#12-required-configuration-and-fail-fast-behaviour); the key checks and rotation are in [section 9](#9-maptiler-verification). Related: [architecture](architecture.md) · [development guidelines](development-guidelines.md) · [handover for Anu](mobile-web-api-handover.md).

Audited 2026-10-29 against `beta/mobile-testflight-integration-prep` at `ceaab5f` plus the validation added after TestFlight build 20. Values below are non-secret endpoints; the map style URL contains a key and is only ever reported as "set".

## 1. Why this exists

TestFlight build 20 (profile `testflight-staging`) read shared Trips from `https://www.tripideas.nz/api/trips/share` instead of `https://staging.tripideas.nz/api/trips/share`. The production site does not serve that route, so every link answered 404 and the app showed "could not be found".

Cause: `EXPO_PUBLIC_TRIP_SHARE_API_URL` is defined twice, in `eas.json` (staging) and in the EAS `preview` environment (production). The EAS CLI says the profile wins, but the shipped bundle contained the environment's value. Which source wins on EAS's servers is not documented, and no check looked at the effective cloud values: the existing `config/testflight-integration.test.js` only reads `eas.json`, so it passed.

## 2. Source of truth

`config/release-endpoints.js` holds the approved endpoints for the two kinds of build. Everything else is checked against it.

| | integration (`development`, `preview`, `testflight-staging`) | production (`production`) |
|---|---|---|
| API (`EXPO_PUBLIC_API_URL`) | `https://tripideas-api-integration-staging.up.railway.app` | `https://api.tripideas.nz` |
| Shared Trip snapshots (`EXPO_PUBLIC_TRIP_SHARE_API_URL`) | `https://staging.tripideas.nz/api/trips/share` | `https://www.tripideas.nz/api/trips/share` |
| Map style (`EXPO_PUBLIC_MAP_STYLE_URL`) | https URL with a real key | same |
| `APP_VARIANT` | `integration` | unset |
| Associated domains | `applinks:www.tripideas.nz`, `applinks:staging.tripideas.nz` | `applinks:www.tripideas.nz` |
| WorkOS client (server side, verified live) | `client_01JVNTDDEEWD4WH5GV1RP70PPQ` | `client_01JEJKPNMVM3YC53R55AE8YQD3` |
| Mobile callback (constant in `auth/provider.tsx`) | `tripideas://auth/callback` | same |
| Universal Link file | `https://staging.tripideas.nz/.well-known/apple-app-site-association` | `https://www.tripideas.nz/.well-known/apple-app-site-association` |

## 3. Effective configuration by profile (as audited)

| Profile | Distribution / channel | EAS environment | Defined in `eas.json` | Defined in the EAS environment |
|---|---|---|---|---|
| `development` | internal dev client / `development` | none set (EAS default undocumented) | `APP_VARIANT`, API, share | n/a (`development` environment is empty) |
| `preview` | internal / `preview` | none set | `APP_VARIANT`, API, share | n/a |
| `testflight-staging` | store / `preview` | `preview` | `APP_VARIANT`, API, share | map style, **share (production value: conflict, removed by section 4)** |
| `production` | store / `production` | `production` | nothing | API (`api.tripideas.nz`), map style, share (`www`) |

Local development (`expo start`) reads `.env.local` (untracked). `.env.example` holds the **integration** values and a map key placeholder; all three variables are required (section 12).

### Findings

1. **Conflict:** `EXPO_PUBLIC_TRIP_SHARE_API_URL` differs between `eas.json` and the `preview` environment (cause of build 20).
2. **Silent defaults to production (resolved 2026-11-02).** `lib/api-client.ts` (API), `trips/shared-trip.ts` and `trips/public-sharing.ts` (share) and the public-sharing gate used to fall back to production when a variable was missing, so a local run without `.env.local` (or with stale Metro values) talked to the production API and could publish public Trip snapshots. They now require the variable and stop with an error naming it; the gate is disabled unless the configured API URL is exactly the production API (section 12). `constants/map.ts` still uses the `MISSING_KEY` placeholder when the map style is absent (blank maps, no data risk); release builds are protected by the key checks in section 9.
3. **Other consumers of the `preview` environment:** `testflight-staging` in `beta/mobile-mvp` and `feature/itinerary-planner-mobile` also set `environment: "preview"`. They define only `EXPO_PUBLIC_API_URL` (`https://integration-api-integration.up.railway.app`) in `eas.json`. They read the share URL only in `trips/public-sharing.ts`, whose code default is the production `www` URL, so they are unaffected by the removal in section 4.
4. **EAS environments:** `preview` holds map style and share; `production` holds API, map style and share; `development` is empty. Custom environments need an Enterprise or Production Expo plan (per Expo's documentation; the plan was not checked).
5. **Update channels:** `preview` and `production` exist; no EAS Update has been published to `preview`. Builds check for updates on launch, so a published update would reach every build on its channel.

## 4. Remote EAS configuration

**Applied 2026-10-29 (Option A, approved):** `EXPO_PUBLIC_TRIP_SHARE_API_URL` was deleted from the EAS `preview` environment (record ID `877cc77c-fe8b-45f7-a325-b13179d21223`, `preview` only, project scope, sensitive). Before and after metadata for all three environments was compared: that was the only change; production's separate record (`08147460-…`, shared scope) and every other variable are untouched. Before deleting it was confirmed that the other branches read the variable only through a code default identical to its value, so their effective share URL is unchanged. The prior state and rollback command are recorded outside Git in `~/tripideas-release/build21/eas-preview-env-rollback.md` (no secret values).

Options that were considered, least disruptive first:

| Option | Effect on the other `preview` consumers | Risk |
|---|---|---|
| **A. Delete `EXPO_PUBLIC_TRIP_SHARE_API_URL` from the `preview` environment** | None in behaviour: those branches read the variable only in `trips/public-sharing.ts` to create shares, and its code default is the same production `www` URL the variable holds today (checked on both branches). This branch takes the staging value from `eas.json`, and no source overlaps. | A remote deletion. Restorable by re-creating the variable with `https://www.tripideas.nz/api/trips/share`. |
| B. Change that variable to the staging URL | Other branches' TestFlight builds would read staging snapshots. | Changes other workflows. |
| C. A dedicated `integration` environment holding map style and the staging share URL, with `environment: "integration"` in this branch's profiles | None; `preview` is untouched. | Needs a plan that supports custom environments; larger change. |

Rollback of option A: re-create the variable in `preview` with the same value and sensitive visibility (command in the record above). Run the preflight below with `--remote` before every build.

## 5. Automated validation

| Layer | Command | What it proves |
|---|---|---|
| Unit tests | `node --loader ./scripts/test-loader.mjs --test config/release-endpoints.test.js` | The rules themselves, including the build 20 conditions, in either precedence order. |
| Preflight | `npm run validate:release -- --profile <name> --remote --live` | `eas.json` is consistent; every value defined by `eas.json` or the EAS environment is approved (precedence-independent); the API, import route, WorkOS client and callback, snapshot route (JSON 404, not an HTML 404) and Universal Link file are live. |
| Effective, on the build worker | `eas-build-post-install` in `package.json` runs `validate-release-config.js --effective` | The variables the worker really uses are approved, and the map key is the approved key (store profiles), before anything compiles. A wrong or missing value fails the build early. **Enforced for integration and TestFlight profiles only.** Production builds pass through unchecked until that gate is separately approved (`--enforce-production` runs it by hand). |
| Built app | `npm run verify:bundle -- --variant <v> --ipa <file>` (or `--export` before building) | The JavaScript bundle contains the approved API and snapshot URLs and exactly one MapTiler key, which is the approved key (length, format, SHA-256), references no other tripideas.nz or railway.app host, and the shipped Expo config and signed entitlements match. |

Notes:
- Legitimate production references in an integration bundle (the `www` link base and Universal Link domain, the `api.tripideas.nz` host in the allowed list) are allowed. The approved API and share URLs appear in application code nowhere, so finding one in a bundle proves it was supplied as configuration (guarded by `config/required-env.test.js`). The snapshot check is a positive one: the staging URL must be present. A production bundle may not reference staging or Railway hosts.
- `--export` clears Metro's cache (`--clear`). Without it Metro replays the endpoints of an earlier environment, which was observed while building these checks.
- Nothing prints secrets. The map style is checked by shape, and its key by length, format and SHA-256; reports show only the key's length and the first 8 characters of its SHA-256.

## 6. Creating and verifying build 21 (historical: superseded by section 8)

1. Remote option A applied (section 4) and this change committed.
2. Create a clean worktree at the approved commit and `npm ci`; `git status` must be empty.
3. Tests, `npx tsc --noEmit`, `npx expo lint` all pass.
4. `npm run validate:release -- --profile testflight-staging --remote --live` passes.
5. `npx eas-cli build --platform ios --profile testflight-staging` (interactive). The worker's `eas-build-post-install` repeats the check with the real environment.
6. Download the IPA from `eas build:view <id> --json` and run `npm run verify:bundle -- --variant integration --ipa <file>`. It must pass before submission.
7. `eas submit`, then on a device open the three acceptance links (`/trip/acce5570a0000001`, `…2`, `…3`) and confirm each loads.
8. Record the build ID, commit and results.

## 7. Release readiness

> Status as of 2026-10-29. Not re-verified against live production on 2026-11-01. The Shared Trips work since then (live sharing, Personal Place photos, UI corrections) changes items 1, 2 and 4 (the API and web now have the routes on integration/staging only); production remains unverified. The current list, with what is verified and what needs Anu's confirmation, is in [mobile-web-api-handover.md](mobile-web-api-handover.md).

### Release blockers (for a production release candidate)

1. Production API (`api.tripideas.nz`) is behind the integration API: no `/version`, no `/itinerary/import`, no `/auth/mobile/authorize` answer in the live check. Saving a shared Trip cannot work against production.
2. Production web lacks the snapshot route (`/api/trips/share/<id>` is an HTML 404) and the Universal Link file (404), so mobile reads and Universal Links fail for `www` links. It also needs `ADMIN_SECRET` before this web code is deployed there.
3. ~~Remote EAS conflict~~ resolved (section 4). Still open: the production cloud gate is off until separately approved, and the hook is not yet proven on a real EAS worker.
4. Public share payload includes private Trip and Place notes (register P0-04, P0-14a): needs an owner decision.
5. Account deletion, legal and profile information (register P0-10), and the authentication gaps in P0-02 (sign-out is local only; the hosted WorkOS session stays active).
6. Physical-device acceptance on at least two iPhones (P0-12), including Universal Links, sign-in and Save.
7. MapTiler key ships in the client bundle: confirm quota and referrer restrictions (P0-14c).

### Important, non-blocking

- Mobile treats every 404 as "not found". Per the shared API contract (rule 8) a route 404 is an environment failure and must not read as missing user content; distinguish the snapshot route's JSON `not_found` from an HTML 404.
- Web Save from `staging.tripideas.nz` needs a `tripideas.nz` hostname for the integration API (cross-site cookies are blocked by Safari and Incognito). Production is same-site and unaffected.
- Remove the silent production defaults in `api-client.ts`, `shared-trip.ts`, `public-sharing.ts` and `map.ts` for non-production builds, so the app fails loudly rather than calling production.
- Pin the EAS CLI (`eas.json` `cli.version` is only `>= 16.0.0`) and record Node and Xcode image versions; `ios/` is generated and stale; align Expo patch versions (P3-05).
- Confirm the back-control expectation (the style guide's circular `HeaderBackButton` is the documented standard).
- Add an owner-visible record of which build is on which environment.

### Future enhancements

- A dedicated EAS environment per target and an `eas-build-on-success` gate that downloads and verifies the finished IPA automatically.
- A shared "Shared with Me" list, revocation and permissions (register P0-05b to P0-05d).
- Account switching (P2-03), request de-duplication and the performance items in P3.

## 8. Current TestFlight release procedure (cloud build, verified through build 28)

Run from a clean worktree at the approved commit on the release branch. Each of build, submit and any remote-configuration change needs its own approval ([development guidelines](development-guidelines.md) section 8). The EAS CLI is invoked as `npx --yes eas-cli@27.2.0` (the version used so far; `eas.json` only requires `>= 16.0.0`). **Builds are cloud builds; local iOS builds are not supported on the release machine** (no CocoaPods or fastlane).

| Step | What to do | Pass condition |
|---|---|---|
| 1. Preflight | `git status` clean; `git rev-parse --short HEAD` equals the approved SHA; expected commits present (`git merge-base --is-ancestor <sha> HEAD`); no unrelated diff since the previous build (`git diff --stat <prev> HEAD`) | Matches the approval |
| 2. Checks | `npx tsc --noEmit`; targeted tests for the changes | No errors |
| 3. Environment | `npm run validate:release -- --profile testflight-staging --remote` (reads the EAS environment; add `--live` to probe the deployed API; it also reports the map key's length and fingerprint) | Valid, key `approved` |
| 4. Build | `npx --yes eas-cli@27.2.0 build --platform ios --profile testflight-staging --non-interactive --no-wait --json` | A build id; `gitCommitHash` equals the approved commit; build number auto-increments (`appVersionSource: remote`) |
| 5. Wait | Poll `eas build:view <id> --json` until `FINISHED` | `FINISHED`, no error. The worker also runs `eas-build-post-install`, which fails the build early if the effective endpoints are wrong |
| 6. Inspect the IPA | Download `artifacts.buildUrl` (use `curl -L`). Run `npm run verify:bundle -- --variant integration --ipa <file>`: it checks `Info.plist` (bundle id, version, build number), the signed entitlements, the embedded endpoints, no production or other-staging host, and the **MapTiler key** (section 9). Confirm that this release's changes are in the bundle (search for new strings). Add `--live-map` for the optional MapTiler diagnostic | All checks pass. **If any fails, do not submit and do not rebuild without approval** |
| 7. Submit | See below | Submission `FINISHED` |
| 8. Record | Build id, number, commit, submission id, check results (in the release records, with no secret values) | Written down |

**Submission.** `eas.json` has `submit.production` only, with no `testflight-staging` entry, so `eas submit --profile testflight-staging` needs the App Store Connect app id (`ascAppId`, `6792389752` for TripIdeas). It has been supplied by running `eas submit` from a **temporary folder** containing copies of `app.config.js`, `app.json`, `package.json`, `tsconfig.json`, a symlink to `node_modules` and an `eas.json` that adds `submit.testflight-staging.ios.ascAppId`; the folder is deleted afterwards and the repository is untouched. The command is `eas submit --platform ios --profile testflight-staging --id <build id> --non-interactive --no-wait`, using the App Store Connect API key stored in EAS credentials. Adding that profile to `eas.json` would remove the workaround; it is a configuration change that needs approval. EAS reports delivery to App Store Connect; **Apple's processing and internal-tester availability cannot be read from the CLI**: confirm in TestFlight (processing normally takes minutes).

Never use EAS Update for this release: builds check for updates on launch and an update on the `preview` channel would reach every build on it.

### Recent TestFlight builds (`testflight-staging`, integration API)

| Build | Commit | Notes |
|---|---|---|
| 25 | `7ea8ba9` | Superseded: Dynamic Type defect |
| 26 | `ff9f425` | Superseded: stacked Personal Place buttons rejected |
| 27 | `e145439` | Approved Personal Place layouts restored; accepted on device |
| 28 | `d7bef7d` | Photo flicker corrections and standardised button pairs; submitted, EAS submission `FINISHED`; the owner reported it satisfactory for release preparation (2026-11-02). Production and the full device checklist (sign-in, Universal Links) are still unverified |

## 9. MapTiler verification

The map style key travels in `EXPO_PUBLIC_MAP_STYLE_URL` and is embedded in the bundle. A build with a wrong or missing key has blank maps (`MISSING_KEY` yields HTTP 403) and nothing else fails, so the key is verified by the scripts, before and after the build, by fingerprint. The key itself is never printed or stored in the repository.

**The approved fingerprint lives in one place:** `MAP_KEY.approvedSha256` in [`config/release-endpoints.js`](../config/release-endpoints.js). Each entry is the full 64-character SHA-256 of the 20-character key (UTF-8 bytes, no newline, lowercase hex). Reports and this document quote only its first 8 characters, **`7f01cd44`**; a prefix is a label, every check compares all 64. Verified 2026-11-02 from three independent sources, which agree: the EAS `preview` environment, the EAS `production` environment, and the key embedded in TestFlight build 28; MapTiler answered HTTP 200 for its streets and satellite styles. (`config/release-endpoints.test.js` checks that the list is well formed and that this document names the same prefixes.)

| Check | Where | Store builds (`testflight-staging`, `production`) | Internal (`development`, `preview`) |
|---|---|---|---|
| Map style variable set, `https`, has a `key` | `validate:release`, worker `--effective` | error | error if malformed; warning if missing (blank maps) |
| Key is 20 letters or digits, not the `MISSING_KEY` placeholder | same | error | warning |
| Key's SHA-256 is approved | same | error | warning |
| Embedded key: present, exactly one real key, well formed, approved | `verify:bundle` (IPA, `--export` or `--bundle`) | error | not applicable |
| MapTiler accepts the key (streets and satellite styles) | `validate:release --live`, `verify:bundle --live-map` | **warning only** | warning only |

- **Extraction.** Hermes packs adjacent string literals together, so a greedy pattern over-captures (71 characters for build 28's 20-character key, which once produced a false "rejected key" report). The scripts take exactly the first 20 characters after `style.json?key=`. A placeholder in the bundle is tolerated only beside an approved key (it is the unused fallback in `constants/map.ts`); alone it fails.
- **The live check is a diagnostic, never a gate.** A MapTiler outage, timeout or rejection prints a warning and cannot fail a build. The approved key and fingerprint decide.
- **Failures print** the key's length and the first 8 characters of its SHA-256 and the approved prefixes, never the key. **Do not submit an IPA that fails; stop and report.**
- **The production gate** still runs only when asked (`--enforce-production`, section 5). Run by hand against the real `production` EAS environment on 2026-11-02 it passed, with the approved key.
- **Test override.** `TRIPIDEAS_TEST_APPROVED_MAP_KEY_SHA256` (comma-separated SHA-256 hex) replaces the approved list so tests can use a made-up key. The scripts then warn that the run is not a release verification, and they refuse it on the EAS worker (`EAS_BUILD=true`). Never use it for a real release.
- **Local runs** need the same value in `.env.local` or the Metro environment, or maps are blank.
- The key ships in every build, so restrict it at MapTiler (quota, restrictions) rather than rely on secrecy.

### Rotating the MapTiler key

Builds already installed carry the old key, so **the old key must keep working until no supported build uses it.**

1. Create the new key at MapTiler with the same restrictions and quota. Keep the old key active.
2. Fingerprint the new key without printing or saving it: `read -s KEY; printf %s "$KEY" | shasum -a 256; unset KEY` (paste the key, press Return). Confirm the key is 20 letters or digits.
3. Add the new 64-character hash to `MAP_KEY.approvedSha256` **next to** the old one, add its first 8 characters to this section, and commit. Both keys are now accepted.
4. With approval, update `EXPO_PUBLIC_MAP_STYLE_URL` in the EAS `preview` and `production` environments (record the previous state and the rollback command outside Git) and in the website if it shares the key. Run `validate:release --profile <p> --remote` (it must report the new fingerprint as approved), build, then `verify:bundle` on the IPA before submitting.
5. When the last build with the old key is out of use, revoke the old key at MapTiler and remove its hash and prefix. `verify:bundle` then rejects any build that still carries it.
6. Rollback: restore the old EAS value and rebuild; the old hash stays approved until step 5.

## 10. App Store and production submission requirements

What is in the repository (verified): bundle id `nz.tripideas.app`, version `1.0.0`, build numbers from EAS (remote), `ITSAppUsesNonExemptEncryption: false`, a location usage string, `supportsTablet: true`, associated domain `applinks:www.tripideas.nz` (production variant), URL schemes `tripideas` and `nz.tripideas.app`, in-app Privacy Policy (a Sanity page).

Needed and **not verified here**:

- A production build uses the `production` profile (channel and EAS environment `production`; it sets no `EXPO_PUBLIC_*` values in `eas.json`). The `production` EAS environment must hold the production API URL, the map style and the share URL, as recorded on 2026-10-29. The effective-configuration gate is enforced only for integration and TestFlight profiles; run `--enforce-production` by hand before a production build.
- The production API and website must have the routes the app needs (`/version`, `/itinerary/*`, `/auth/mobile/*`, sharing and Personal Place routes; the Universal Link association file for `www.tripideas.nz`). On 2026-10-29 production lacked several of them, and the 2026-10-31 release records still list the production association file as 404; re-check live before relying on either.
- Store listing, screenshots, privacy answers, an iPad decision, a Terms of Use, and an in-app way to delete the account (App Store guideline 5.1.1(v)) are open items from the release register (P0-10, P0-13).
- Physical-device acceptance by the owner on at least two iPhones, including Universal Links, sign-in and sharing, before any production or external TestFlight release.

## 11. Release coordination and rollback

- **Order matters.** Sharing enforcement lives in the API; older web and mobile builds read collections by id alone and break against it. The API, web and mobile therefore ship in **one coordinated window**, with no dual-sharing period. Do not release mobile alone, and do not roll the API back without rolling web and mobile back.
- **Environments are separate.** Integration (the Shared Trips integration API and database, `staging.tripideas.nz` web) must never be pointed at production or at the legacy staging database, as a fallback or otherwise. Each environment has its own database, storage bucket, WorkOS application and credentials.
- **Mobile rollback:** TestFlight builds can be superseded or have testing stopped; a build already reviewed or released on the App Store can only be replaced by a new build (or removed from sale). There is no OTA fix (EAS Update is not used), so a mobile fix is a new build.
- **API and web rollback:** redeploy the previous image or deployment recorded for each service; never re-point a service's `DATABASE_URL` as a rollback. The sharing migration is additive (two nullable columns and an index), so it can stay when code is rolled back.
- **Remote configuration changes** (EAS environments, secrets) need their own record of the before state and the rollback command, kept outside Git and free of secret values.
- Keep an owner-visible record of which build is on which environment and commit (section 8 table), and update it with every build.

## 12. Required configuration and fail-fast behaviour

This is the single reference for configuration; other documents link here.

**The app has no default for any of these.** If `EXPO_PUBLIC_API_URL` or `EXPO_PUBLIC_TRIP_SHARE_API_URL` is missing, blank or not an http(s) URL, the app stops at startup with an error that names the variable (never its value) and says where to set it (`config/required-env.ts`). It never falls back to production or to any other environment. The map style is the exception: without it maps are blank, and release builds are caught by the checks in section 9.

| Variable | Used for | Development (`.env.local`) | Integration (`development`, `preview`, `testflight-staging`) | Production (`production`) |
|---|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | The TripIdeas API | integration URL (see `.env.example`); a local API may use `http://` | `eas.json` profile `env` | EAS `production` environment: `https://api.tripideas.nz` |
| `EXPO_PUBLIC_TRIP_SHARE_API_URL` | Shared Trip snapshots and public share creation (website `/api/trips/share`) | staging website (see `.env.example`) | `eas.json` profile `env` | EAS `production` environment: `https://www.tripideas.nz/api/trips/share` |
| `EXPO_PUBLIC_MAP_STYLE_URL` | MapTiler styles (contains the key) | your own `.env.local` | EAS `preview` environment (`testflight-staging` only; see below) | EAS `production` environment |
| `APP_VARIANT` | `integration` adds the staging Universal Link domain | not needed | `eas.json` profile `env` (`integration`) | must be unset |

- **Verified 2026-11-02, read-only:** the EAS `production` environment holds all three variables with the approved production API and share URLs and the approved map key; the `preview` environment holds the map style only (the share URL was removed from it on 2026-10-29, section 4).
- **`development` and `preview` profiles** set no EAS environment, so they get no map style from EAS and show blank maps unless the variable is supplied another way. The validator warns, not fails. To get maps in those builds, supply `EXPO_PUBLIC_MAP_STYLE_URL` through an EAS environment (adding `environment` to the profile is a profile change that needs approval) or build locally from a shell that has it.
- **Public Trip sharing** (the older snapshot share, which writes to the production dataset) is enabled only when the configured API URL is exactly `https://api.tripideas.nz`. A missing or blank API URL, an integration URL or a local URL never enables it.
- **Metro caches transformed files without keying on `EXPO_PUBLIC_*` values.** After changing `.env.local`, restart with `npx expo start --clear`; otherwise the old values are replayed. `verify:bundle --export` clears the cache for this reason.
- **Tests** run without an Expo environment, so the test loader (`scripts/test-loader.mjs`) gives modules under test obviously fake values (`api.test.invalid`, `share.test.invalid`). A test that needs the variables absent sets `TRIPIDEAS_TEST_NO_ENV_DEFAULTS=1` in a child process (`config/required-env.test.js`).
- **Release gating.** On the EAS worker `eas-build-post-install` fails an integration or TestFlight build whose effective variables are missing or not the approved ones, or whose map key is not approved. **A production build is not gated by the worker** (section 5); until that is separately approved, a production build is checked by hand: `validate:release --profile production --remote`, then `verify:bundle --variant production --ipa <file>` before submitting. Because the app now stops at startup without its variables, a production build lacking them would crash on launch rather than quietly use the production default: the production gate would prevent that and is the recommended next step.
- **Still the owner's or Anu's:** enabling the production worker gate; supplying `environment` to the `development` and `preview` profiles if maps are wanted there; the MapTiler key's restrictions and rotation (section 9); keeping the `production` EAS environment complete; and the API, website and credentials outside this repository.

