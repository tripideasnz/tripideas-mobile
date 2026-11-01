# Release configuration, validation and build process

**Status, 2026-11-01:** sections 1 to 5 were audited on 2026-10-29 and still describe the code at `release/shared-trips-mobile-rc2` (`d7bef7d`): `eas.json` profiles, the `preview` environment (now holding only the map style URL) and the silent production defaults are unchanged. Section 6 is historical. Sections 8 to 11 are the **current release procedure**, as exercised for TestFlight builds 25 to 28. Related: [architecture](architecture.md) · [development guidelines](development-guidelines.md) · [handover for Anu](mobile-web-api-handover.md).

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

Local development (`expo start`) reads `.env.local` (untracked; `.env.example` has placeholders).

### Findings

1. **Conflict:** `EXPO_PUBLIC_TRIP_SHARE_API_URL` differs between `eas.json` and the `preview` environment (cause of build 20).
2. **Silent defaults to production** when a variable is missing: `lib/api-client.ts` (API), `trips/shared-trip.ts` and `trips/public-sharing.ts` (share), `trips/public-sharing.ts` gate (API), and `constants/map.ts` (`key=MISSING_KEY`). A missing variable never fails; it points the build at production or breaks the map. This also means a local run without `.env.local` talks to the production API.
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
| Effective, on the build worker | `eas-build-post-install` in `package.json` runs `validate-release-config.js --effective` | The variables the worker really uses are approved, before anything compiles. A wrong or missing value fails the build early. **Enforced for integration and TestFlight profiles only.** Production builds pass through unchecked until that gate is separately approved (`--enforce-production` runs it by hand). |
| Built app | `npm run verify:bundle -- --variant <v> --ipa <file>` (or `--export` before building) | The JavaScript bundle contains the approved API and snapshot URLs, references no other tripideas.nz or railway.app host, and the shipped Expo config and signed entitlements match. |

Notes:
- Legitimate production references in an integration bundle (`www` link base and Universal Link domain, `api.tripideas.nz` gate constant, the production share default) are allowed. The snapshot check is a positive one: the staging URL must be present. A production bundle may not reference staging or Railway hosts.
- `--export` clears Metro's cache (`--clear`). Without it Metro replays the endpoints of an earlier environment, which was observed while building these checks.
- Nothing prints secrets. The map style is checked by shape only.

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
| 3. Environment | Check the map key held by the EAS `preview` environment by fingerprint only (section 9) | Length 20, approved fingerprint |
| 4. Build | `npx --yes eas-cli@27.2.0 build --platform ios --profile testflight-staging --non-interactive --no-wait --json` | A build id; `gitCommitHash` equals the approved commit; build number auto-increments (`appVersionSource: remote`) |
| 5. Wait | Poll `eas build:view <id> --json` until `FINISHED` | `FINISHED`, no error. The worker also runs `eas-build-post-install`, which fails the build early if the effective endpoints are wrong |
| 6. Inspect the IPA | Download `artifacts.buildUrl`, unzip. Check `Info.plist` (bundle id `nz.tripideas.app`, version, build number), signed entitlements (`codesign -d --entitlements :-`: associated domains `www.tripideas.nz` and `staging.tripideas.nz`, team id), `npm run verify:bundle -- --variant integration --ipa <file>`, and the MapTiler check (section 9). Confirm that the changes of this release are present in the bundle (search for new strings) and that no production or other-staging host appears | All pass. **If any check fails, do not submit and do not rebuild without approval** |
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

The map style key travels in `EXPO_PUBLIC_MAP_STYLE_URL` and is embedded in the bundle. A build with the wrong or missing key has blank maps (`MISSING_KEY` yields HTTP 403). Verify **before** building (the EAS environment) and **after** (the IPA), by fingerprint, never by printing the key.

- **Approved fingerprint:** `7f01cd44`. This is the first 8 hex characters of the SHA-256 of the 20-character key. If the key is ever rotated, update this value in the same change.
- **EAS environment check:** run a small script inside the environment that prints only the key's length and fingerprint, for example `npx --yes eas-cli@27.2.0 env:exec preview "python3 -I check.py" --non-interactive`, where `check.py` reads `EXPO_PUBLIC_MAP_STYLE_URL`, extracts `key=([A-Za-z0-9_]+)`, and prints `len(key)` and `sha256(key[:20]).hexdigest()[:8]`. Expect length 20 and `7f01cd44`.
- **IPA check:** unzip the IPA and search `Payload/*.app/main.jsbundle` for `api.maptiler.com/maps/<style>/style.json?key=<key>`. **Take exactly the first 20 characters of the captured key.** The compiled bundle packs adjacent strings together, so a greedy pattern also captures following letters; this produced a false "rejected key" report for builds 22 to 24, which were in fact correct. Require exactly one distinct key, the approved fingerprint, no `MISSING_KEY`, and HTTP 200 from both `maps/streets-v2/style.json` and `maps/satellite/style.json` using that key.
- **Do not submit an IPA that fails.** Stop and report.
- The key is public in every shipped build, so protect it at MapTiler (quota, restrictions) rather than by secrecy. Local Metro runs need the same value in `.env.local`/the Metro environment, otherwise maps are blank.

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

