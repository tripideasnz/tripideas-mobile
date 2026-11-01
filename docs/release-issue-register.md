# TripIdeas mobile: release issue register

> **Historical snapshot, 2026-10-26, branch `beta/mobile-mvp-clean`. Not the current status.** It predates unified secure sharing and the TestFlight builds 25 to 28. Do not use its status columns for release decisions; use [mobile-web-api-handover.md](mobile-web-api-handover.md) and [release-configuration.md](release-configuration.md). What has changed since:
>
> | Register item | Then | Now (code at `d7bef7d`, acceptance on integration) |
> |---|---|---|
> | P0-04, P0-05a Trip sharing | Public snapshot, no revocation | **Live sharing** with a capability link, Stop sharing and rotation; the snapshot share remains, production-only and without Personal Places |
> | P0-05b received links | Missing; no associated domains | Associated domains and a `collections/[collectionId]` route exist; staging association file verified; production association file **404 as of 2026-10-31**; no physical-device test |
> | P0-05c, P0-05d Shared With Me, permissions | Missing | Shared With Me list, Join, Leave, participant notes, owner-only controls implemented; permissions enforced by the API; verified with two accounts on integration (Simulator and web) |
> | P0-08 Personal Places | Partial | Photo reliability and flicker corrections (`4acff79`, `b919ff9`, `1906716`); integration photo storage working; two-account device isolation not yet verified |
> | P0-13 TestFlight preparation | Partial | Release validation scripts and a verified cloud-build procedure (release-configuration sections 5, 8, 9); production configuration still unverified |
> | P0-10 legal and account deletion, P0-02 sign-out, P0-12 device acceptance | Open | **Still open** |
> | Test files | 78 | 105 |
>
> Items not listed are unchanged or were not re-checked.

Read-only audit of branch `beta/mobile-mvp-clean` at `9f10dc35d19de3f87cb54c43e0cd0a13f2a66557` (the September consolidation commit `33d40c6` plus the 12 local commits after it; push state cannot be verified from this checkout). Prepared 2026-10-26.

## Sources and limitations

- **Available:** `docs/beta-feedback-september-2026.md`, `docs/product-decisions.md`, `docs/mobile-ui-ux-style-guide.md`, git history, the code and 78 test files in this checkout, and the acceptance results reported during this engagement (Simulator only).
- **Not available:** the "Tripideas App - Issues List" (not in the repository and not found by file name on this machine). Its items cannot be mapped, so P2 is incomplete and P0/P1 may be missing items from it.
- **Not inspected:** the API and web repositories (no read-only access was approved for this audit). Statements about them rely on mobile code and on earlier work in this engagement, and are marked unverified.
- **Status meaning:** COMPLETE = implemented *and* accepted. PARTIAL = implemented or partly done, with a stated gap. MISSING = not implemented. UNVERIFIED = code may exist but acceptance has not happened. Code existing is never treated as acceptance.

## 1. Executive summary

**Headline:** the Trips, Map, Personal Places and navigation work is in good shape and Simulator-accepted, but five release-blocking areas remain: **Trip sharing and Shared with Me, legal/account deletion, the production build configuration, native location verification and device acceptance** (the welcome screen is done and Simulator-accepted; account switching is now post-release). Nothing has been verified on a physical device, and the installed binary cannot yet exercise location permission.

| Priority | Items | COMPLETE | PARTIAL | MISSING | UNVERIFIED |
|---|---|---|---|---|---|
| P0 | 17 | 1 | 11 | 4 | 1 |
| P1 | 9 | 2 | 3 | 0 | 4 |
| P2 | 3 | 0 | 0 | 2 | 1 |
| P3 | 8 | 0 | 3 | 3 | 2 |
| OUT | 4 | 4 | 0 | 0 | 0 |
| **Total** | **41** | **7** | **17** | **9** | **8** |

Note: P0-05a duplicates P0-04 and is counted once for the Shared with Me breakdown.

## 2. P0 release checklist

| ID | Item | Status | Evidence | Acceptance criteria | Next action |
|---|---|---|---|---|---|
| P0-01 | **Welcome-screen redesign**<br>Two equally prominent Discover and Map entry points beneath the introductory text. | COMPLETE | Batch 2F, implemented locally and uncommitted: `components/welcome-entry-buttons.tsx` (two identical glass-style icon buttons using the supplied artwork in `assets/images/welcome-discover.png` and `welcome-map.png`, up to 160 pt, with labels in the intro text's style), `components/welcome-navigation.ts` (destinations `/discover` and `/map`, one `replace` each, repeat taps ignored), `app/index.tsx` (logo, copy, background and overlay unchanged; "Start Exploring" removed). 11 tests in `components/welcome-screen.test.js`. Accepted visually in the Simulator (iPhone 17 Pro Max); committed in Batch 2F. | Discover and Map buttons are the same size and weight, directly beneath the intro text, readable on small and large iPhones; Discover opens the Discover tab, Map opens the Map tab; entering leaves no welcome screen in the history and an edge swipe cannot bring it back; VoiceOver reads "Discover" and "Map" as buttons; native launch splash unchanged. | None beyond confirming on a physical device in the final pass (P0-12). |
| P0-02 | **Authentication reliability, sign-out, sign-in and account isolation**<br>Reliable authentication; functional sign-out; no access to private local data after sign-out; a successful subsequent sign-in; user data isolated between accounts. (Account switching itself is now P2-03.) | PARTIAL | `auth/provider.tsx` `signOut` clears stored tokens and the notebook cache and cancels that user's photo uploads; Trips, Saved and Personal Places providers clear and key their state and caches by user (Trips covered by 51 provider tests including sign-out and account-change races). Known behaviour: sign-out is local-only (TODO `POST /auth/mobile/logout`) and the hosted WorkOS session stays active, so signing in again returns straight to the same account; this is acceptable for P0 but is why switching accounts is deferred. | After sign-out no Trip, Favourite, Personal Place, photo or count from the previous user is visible, including after relaunch; signing in again succeeds; where a second account is available, its data never shows the first account's; verified on a device. | Device verification of sign-out, relaunch and re-sign-in; add Saved and Personal Places sign-out tests if device testing finds gaps. |
| P0-03 | **Trip creation, editing, saving and reopening**<br>Create, rename, annotate, add/remove Places, reorder, delete; changes persist and reopen correctly. | PARTIAL | `trips/provider.tsx`, `app/trips/*`; commits `33d40c6`, `288d66e`, `9f10dc3`; 78 test files pass incl. 51 Trips provider tests. Simulator-accepted in this engagement: open/return from Place, repeated navigation, rename persistence, deletion without reappearance. | On a physical device: create a Trip, add/remove Places, edit notes and name, kill and relaunch, offline open, delete; no flicker or lost edits. | Include in the final device pass; no known code defect. |
| P0-04 | **Trip sharing (sending)**<br>Share a Trip with another person via a link. | PARTIAL | Mobile creates a public snapshot: `trips/public-sharing.ts` POSTs to `https://www.tripideas.nz/api/trips/share` (override `EXPO_PUBLIC_TRIP_SHARE_API_URL`) with no authentication; preview route `/trips/[tripId]/shared`; native share sheet; Personal Place guard (public snapshots exclude Personal Places). The snapshot includes the Trip note and every per-Place note. No revocation and no link to the owner's account. A separate secure-sharing API worktree exists locally (owner/participant/link access, share and stop-sharing) but its merge, deploy and mobile integration are unverified. | Owner can share, see who/what is shared, and revoke; private notes are not published without explicit consent; link opens correctly for recipients; verified end to end. | Decide the sharing model (Q2) and whether notes are included before more work. |
| P0-05a | **Shared with Me: sharing a Trip**<br>See P0-04. | PARTIAL | See P0-04. | See P0-04. | Resolve with P0-04. |
| P0-05b | **Shared with Me: opening a received sharing link**<br>Tapping a received link opens the shared Trip in the app (or web fallback). | MISSING | `app.json` has only the `tripideas` custom scheme and `nz.tripideas.app`; no `ios.associatedDomains` (no universal links); no route or handler for share tokens in `app/`. | A received https link opens the app to the correct Trip, or the web page if the app is absent; invalid/revoked links show a clear message. | Needs a domain association file on the web side and a route in mobile (cross-repo, Q3). |
| P0-05c | **Shared with Me: list of previously received Trips**<br>A Shared with Me area lists Trips shared with the user. | MISSING | No Shared-with-Me code or UI in mobile (searched `app`, `components`, `trips`, `lib`, `auth`). The API worktree models participants who have saved/joined a shared Trip; mobile has no client for it. | Signed-in user sees received Trips, can open them, and loses access when the owner revokes. | Depends on Q2 and Q3; API and web availability to be confirmed with approved read-only access. |
| P0-05d | **Shared with Me: permissions and revocation**<br>Owner can revoke; recipients' access is enforced server-side. | MISSING | No mobile revocation for Trips. Notebook sharing has revoke UI (`app/notebooks/[notebookId]/sharing.tsx`) but Notebooks are flagged off. API-side: earlier inspection of the sharing worktree showed owner/participant/link checks and `stopSharing`; not re-inspected for this audit. | Revoke removes access for link holders; comments/edits limited to participants; tested against the API. | Part of the sharing decision (Q2). |
| P0-06 | **Personal location and Map location behaviour**<br>Locator centres on the user, handles denied/unavailable, keeps filters, no camera jumps. | PARTIAL | Commit `cd8252d` and `location/*` with tests. `app.json` contains the location usage string, but the installed Simulator binary's `Info.plist` does not (checked: 0 occurrences), so permission prompts cannot be verified with this build. | Native rebuild that includes the usage string; on a physical device test granted, denied and unavailable states, filters retained, red marker, pan/zoom without camera reset. | Native rebuild (needs approval), then device pass. |
| P0-07 | **Search keyboard**<br>Search input stays usable: keyboard reopens after browsing; query and results retained. | UNVERIFIED | `components/place-search.tsx`: single pinned input, `keyboardShouldPersistTaps="handled"`, dismiss on drag/submit. `docs/beta-feedback-september-2026.md` states physical-device/TestFlight verification was never done. | Enter query, scroll/dismiss, tap input: keyboard reopens; query and results kept; same in the Trip place picker. | Physical-device check only. |
| P0-08 | **Personal Places**<br>Create, edit, photos, delete, attach to Trips; private to the account. | PARTIAL | `personal-place-cards/*`, commit `4acff79` (photo read reliability, with tests); user confirmed photo speed is much improved. Photo authorisation takes 1.9-3.3 s per photo on first Trip open (integration API). | Two-account isolation on a device; create/edit/delete with photos; offline behaviour; attach to a Trip and reopen. | Device pass; measure against the production API. |
| P0-09 | **Core Map functionality**<br>Markers, clusters, filters, Place opening, tray, camera preservation. | PARTIAL | Commits `574932a`, `809f9f6`, `678a70a`, `c6ddb7e`, `3109bfe`, `d01539a`; first-tap marker, Clear/Clear All, root-stack Place with preserved camera, 500 ms tray animation; Simulator-accepted. Map data is ~1,600 places. | Physical-device smoothness with the full marker set; filters, search, saved scopes, return from Place all retain state. | Include in the device pass. |
| P0-10 | **Profile and legal information**<br>Account controls, help, privacy policy, terms, support, account deletion. | PARTIAL | `app/(tabs)/profile.tsx`: account card, sign-in/out, Help topics, feedback mailto `hello@tripideas.nz`, Privacy Policy (CMS page via Sanity, `app/privacy-policy.tsx`). No Terms of Use, no in-app account deletion, no app version/build line. | Terms and Privacy reachable in app and listed for the store; in-app way to request/perform account deletion (App Store guideline 5.1.1(v) applies to apps with account creation); support contact works. | Content and decision needed (Q4), then a small mobile batch. |
| P0-11 | **Release reconciliation**<br>One accurate record of what is done, verified and outstanding. | PARTIAL | This register. `docs/beta-feedback-september-2026.md` is a good baseline but pre-dates 12 later commits and reports an old test count; the original "Tripideas App - Issues List" is not in the repository or found by name on disk. | Register agreed by the product owner; Issues List items mapped; stale documents updated. | Provide the Issues List so every item can be mapped. |
| P0-12 | **Final physical-device acceptance**<br>A full pass on real iPhones before release. | MISSING | The September report records no device session or TestFlight build; all acceptance in this engagement was on the iPhone 17 Pro Max Simulator (iOS 26.5). | Checklist covering P0-02..P0-10 passed on at least two physical iPhones, one older iOS version and one small screen. | Schedule after the native rebuild. |
| P0-13 | **TestFlight and publication preparation**<br>A production-configured build submitted to TestFlight and the App Store. | PARTIAL | `eas.json`: `testflight-staging` points at the integration API; `production` sets no `EXPO_PUBLIC_*` values. `constants/map.ts` falls back to `key=MISSING_KEY` if `EXPO_PUBLIC_MAP_STYLE_URL` is absent, so the production map breaks unless EAS-hosted environment variables supply it (not verifiable from here). API URL defaults to `https://api.tripideas.nz`. Bundle id `nz.tripideas.app`, version 1.0.0, `supportsTablet: true`, `ITSAppUsesNonExemptEncryption: false`. `ios/` is generated and git-ignored (and stale). | Production EAS environment confirmed (API URL, map style key, share API); build installs and runs against production services; store listing, screenshots, privacy answers ready; iPad decision made. | Verify EAS production variables with account access (needs approval), then build. |
| P0-14 | **Data-integrity, security and performance review**<br>No significant defects before release. | PARTIAL | Fixed in this engagement: stale refresh overwriting edits, deleted Trip reappearing, cache write ordering (`9f10dc3`). Open: (a) public share payload includes private notes (see P0-04); (b) integration API calls take 1-3.3 s each, production unmeasured; (c) MapTiler key is shipped in the client bundle (`EXPO_PUBLIC_MAP_STYLE_URL`) - confirm quota and restrictions; (d) local-only sign-out leaves the hosted session active (accepted for P0; account switching is P2-03). | Each open item has an owner decision; production latency measured and accepted. | Cover (a) in the sharing work; measure (b) on production; confirm (c) with the key owner. |

### Shared with Me: what exists today

| Capability | Mobile | API / web |
|---|---|---|
| Sharing a Trip | Public snapshot link via `https://www.tripideas.nz/api/trips/share`, unauthenticated, includes notes, no revocation | Web endpoint exists (assumed from the URL); secure-sharing API worktree exists locally, unverified |
| Opening a received link | **Absent** (no universal links, no share route) | Unverified |
| Shared with Me list | **Absent** | Participant model seen earlier in the API worktree; unverified |
| Permissions and revocation | **Absent for Trips** (exists for Notebooks, which are flagged off) | `stopSharing` and owner/participant/link checks seen earlier; unverified |

## 3. P1 / P2 / P3 backlog

### P1: UI/UX

| ID | Item | Status | Evidence | Acceptance criteria | Next action |
|---|---|---|---|---|---|
| P1-01 | **Trips list shows "Loading trips..." until thumbnails arrive**<br>No blocking indicator on the Trips list. | PARTIAL | `app/trips/index.tsx` gate `isLoading || (isLoadingPlaces && no cards)`; Trip detail was fixed in `288d66e`. | List renders immediately with placeholder thumbnails. | Small batch after P0 work. |
| P1-02 | **Saved card for Personal Places flashes "Loading…" on every focus refresh**<br>No flash while refreshing. | PARTIAL | Trips card fixed in `288d66e`; Personal Places refresh still toggles `isLoading` (`personal-place-cards/provider.tsx`). | Count stays visible during background refresh. | Mirror the Trips loading/refreshing split. |
| P1-03 | **Consistent loading indicators**<br>Spinner vs text vs skeleton used consistently. | PARTIAL | Mixed `LoadingView` spinners and `StatusText` messages across Trips, Favourites, Search, Place. | One documented pattern applied to all list/detail screens. | Add to the style guide, then apply. |
| P1-04 | **Empty states**<br>Helpful, consistent empty states. | UNVERIFIED | Present for Favourites, Trips, Personal Places, Search, sub-region, Map saved sheet; wording and styling not audited together. | Review each on a device with a new account. | Design review. |
| P1-05 | **Header and navigation-control consistency**<br>Single circular controls, centred chevron, no stretching. | COMPLETE | Commits `678a70a`, `c6ddb7e`, `237d4ec`; Simulator-accepted. Remaining: Map place-context banner back circle is nested in a pill; Diary/Notebook screens parked. | Accepted in Simulator. | None, apart from the banner (optional). |
| P1-06 | **Back and swipe-back consistency**<br>Back arrow and edge swipe go to the same screen. | UNVERIFIED | Root-stack Place (`3109bfe`): both pop the same screen (router-state tests); Simulator transitions accepted. Edge swipe not verified on a physical device. | Swipe-back from Place returns to Search/Map/Trip with state intact on a device. | Device pass. |
| P1-07 | **Map tray animation**<br>Smooth expand/collapse without remounting the map. | COMPLETE | Commit `d01539a`; user-accepted in Simulator. | Accepted. | None. |
| P1-08 | **Tab-switch transitions**<br>Optional fade between tabs. | UNVERIFIED | Tab changes are instant; an app-wide fade was deliberately not added. | Product call. | Decide if wanted. |
| P1-09 | **iPad and Dynamic Type / VoiceOver**<br>Layouts hold at large sizes; tray content inert when hidden. | UNVERIFIED | `supportsTablet: true`; Saved cards use no fixed heights; tray content is hidden from accessibility when minimised; none verified on device. | Pass at the largest text size and with VoiceOver on iPhone (and iPad if supported). | Device pass. |

### P2: features

| ID | Item | Status | Evidence | Acceptance criteria | Next action |
|---|---|---|---|---|---|
| P2-01 | **Review mobile authentication model for saved content**<br>Align mobile with the web (sign-in required for favourites and Trips). | MISSING | `docs/product-decisions.md` defers this until after Notebook MVP; Saved content is already sign-in gated in the current beta. | Decision recorded. | Confirm whether still wanted. |
| P2-03 | **Account switching**<br>Post-release enhancement: let a user sign out and sign in as a different account. | MISSING | Moved from P0 by product decision. Today `signOut` is local-only and `WebBrowser.openAuthSessionAsync` (auth/provider.tsx ~line 264) is not ephemeral, so the WorkOS session persists. | After sign-out the next sign-in offers a choice of account; two accounts verified on a device. | Decide mechanism (Q1) when scheduled: hosted logout endpoint, ephemeral browser session, or forced login prompt. |
| P2-02 | **Items from the Tripideas App - Issues List**<br>Smaller features within mobile scope. | UNVERIFIED | The Issues List is unavailable (not in the repository or found by name), so P2 items cannot be enumerated. | Each item mapped to the register. | Provide the document. |

### P3: technical

| ID | Item | Status | Evidence | Acceptance criteria | Next action |
|---|---|---|---|---|---|
| P3-01 | **Shared Place-card cache**<br>Repeat opens of Trips, Favourites and Places are instant. | MISSING | No cache: Trip open = 1 Sanity request (74-93 ms measured) plus full 1+N API refresh; deliberately excluded from 2E. | Per-session cache keyed by Place. | Later batch. |
| P3-02 | **Hidden-feature providers call the API at sign-in**<br>No requests for disabled features. | MISSING | `NotebookProvider` and `DiaryProvider` mount at the root and call `/notebooks` and `/diaries` on every sign-in although `personalContentFeatures.notebooks/diaries` are false (measured 3.1-3.2 s each in parallel with real requests). | No requests while flags are off. | Small gating batch; touches provider mounting, not Diary features. |
| P3-03 | **In-flight request deduplication in the API client**<br>Identical GETs share one request. | MISSING | `lib/api-client.ts` has no dedupe or timeouts. | Dedupe for identical in-flight GETs. | Later. |
| P3-04 | **Context fan-out re-renders**<br>Fewer re-renders on provider updates. | UNVERIFIED | Place cards subscribe to saved and trips contexts; impact unmeasured. | Profile first. | Profile first. |
| P3-05 | **Expo package patch-version alignment**<br>Packages match the SDK. | UNVERIFIED | Metro warns: `expo-file-system@19.0.23` (expected ~19.0.24), `expo-updates@29.0.19` (expected ~29.0.20). | `expo install --check` clean. | Before the release build (needs approval). |
| P3-06 | **Cross-Trip concurrent edits can drop each other's local view**<br>Edits to two Trips at once both appear. | PARTIAL | Documented residual risk in `9f10dc3`; server state is correct and the next refresh repairs the view. | Both edits visible immediately. | Low priority. |
| P3-07 | **Lint warning and shipped console logging**<br>Clean lint; no debug logs in release. | PARTIAL | `trips/provider.tsx` missing `visibleTrips` dependency (existing); `console.log` in `app/auth.tsx` and `app/(tabs)/map.tsx`. | Zero warnings; logs dev-only. | Cleanup batch. |
| P3-08 | **Stale generated native project**<br>Native output matches `app.json`. | PARTIAL | `ios/` is ignored and lacks the location key. | Regenerated from config at the next build. | Part of the native rebuild. |

## 4. Explicit exclusions (OUT)

| ID | Item | Status | Evidence | Acceptance criteria | Next action |
|---|---|---|---|---|---|
| OUT-01 | **Accommodation**<br>Excluded from this release. | COMPLETE | No accommodation UI or queries found (searched `app`, `components`, `sanity`, `trips`, `saved`, `lib`). | Nothing user-visible. | None. |
| OUT-02 | **Accommodation filters**<br>Excluded. | COMPLETE | Map filters cover Regions, Activities and Saved only. | As above. | None. |
| OUT-03 | **Bookings**<br>Excluded. | COMPLETE | No booking code found. | As above. | None. |
| OUT-04 | **Cart**<br>Excluded. | COMPLETE | No cart or checkout code found. | As above. | None. |

Also not part of the release scope as currently configured (product decision Q5): **Notebooks and Diaries**, hidden by `personalContentFeatures` flags (both false). They are not in your OUT list, so they are recorded as parked rather than excluded.

## Batch log

| Batch | Scope | Status | Acceptance criteria |
|---|---|---|---|
| 2F | Welcome screen: Discover and Map entry buttons (P0-01); account switching moved to P2 (P0-02, P2-03) | Committed locally; accepted in the Simulator | Equal-weight buttons beneath the intro text; each opens its tab with a single `replace`; no welcome screen left in history; branding, copy and background unchanged; accessibility labels read correctly; no change to auth, Map, Discover, Saved or Trips |

## 5. Recommended implementation order

1. **Decisions first** (Section 6) and obtain the Issues List.
2. **Welcome screen** (P0-01): done (Batch 2F, Simulator-accepted); confirm on a device in the final pass.
3. **Profile and legal** (P0-10): Terms, version line, account deletion path once decided.
4. **Sign-out, sign-in and isolation verification** (P0-02) on a device. Account switching (P2-03) follows the release.
5. **Sharing model, then Shared with Me** (P0-04, P0-05): largest piece; needs approved read-only access to the API and web repositories and web-side universal-link work.
6. **Native rebuild** with the location usage string (P0-06, P3-08), then the **physical-device pass** for location, Search keyboard, swipe-back, Map smoothness, Personal Places isolation (P0-06..P0-09, P1-06, P1-09).
7. **Release configuration** (P0-13): verify EAS production environment, production API latency (P0-14), package alignment (P3-05), then TestFlight.
8. **P1 polish** (P1-01..P1-03) and **P3 optimisation** (P3-02 first: cheap and removes wasted startup calls).
9. **Final device acceptance and submission** (P0-12).

## 6. Questions requiring product decisions

1. **Account switching (now post-release, P2-03):** when scheduled, hosted logout endpoint (needs backend work), an ephemeral browser session (every sign-in shows the login page), or forcing a login prompt?
2. **Trip sharing model:** keep the unauthenticated public snapshot, or adopt the secure token model with revocation and participants? Should private Trip and Place notes ever be included in a shared link?
3. **Shared with Me scope:** which domain serves universal links, what happens on first open when signed out, and does a recipient "save" a Trip or only view it?
4. **Legal and deletion:** where do Terms of Use live, and what is the account-deletion mechanism (in-app request, API call, or web page)?
5. **Notebooks and Diaries:** confirm they stay hidden at launch, and whether their providers may be gated off so they stop calling the API.
6. **Platforms:** iPhone only, or iPad too (`supportsTablet` is currently true)? Minimum iOS version?
7. **Production services:** who owns the EAS production environment variables, and is the MapTiler key restricted/monitored?
8. **Performance bar:** what latency is acceptable for opening a Trip on the production API (integration API measured 1-3.3 s per call)?
9. **Issues List:** please supply the document so P2 can be completed.
