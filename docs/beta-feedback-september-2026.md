# September 2026 mobile beta feedback — final consolidation

This is the authoritative report for the final September beta implementation. Superseded intermediate reports have been removed. The final consolidation makes no new product changes.

## Preflight and scope

- Repository and working directory: `/Users/douglas/projects/tripideas-mobile`.
- Remote: `origin`, `git@github.com:tripideasnz/tripideas-mobile.git`.
- Branch: `beta/mobile-mvp`.
- Baseline HEAD: `3961aad6fe425d3c40ef521623f9303c9510f068`.
- Starting consolidation status: 22 modified tracked files and 7 untracked files, nothing staged. All were September beta work.
- The seven starting untracked files were the Trip picker, three beta tests, and the original/pass-2/corrective reports. The final commit retains one accurate report and adds a portable test loader.
- Reviewed the complete diff from baseline, all untracked implementation/tests, and the existing route/provider/component dependencies. Mobile instructions, UI canon, and shared-contract discipline were read during the work.
- No backend, CMS content, database, dependencies, app/native/deployment configuration, or other repository changes are included. No deployment or TestFlight build is part of this consolidation.

## Final implemented behavior

| Area | Final state |
| --- | --- |
| Discover presentation | Original visible JSX, typography, dimensions, spacing, hierarchy, Māori names, region rows, and title accordion retained. Shared `MediaFrame` is unchanged from baseline. Tests compare the presentation source against the baseline after excluding only the tap target and shared-handler extraction; this is source equivalence, not an automated screenshot comparison. |
| Discover imagery/actions | Both islands reuse the existing article-image fallback in the CMS query. Image and title call the identical `handleIslandPress`, toggling the existing in-place expansion and invoking the existing open/scroll callback. The image target is transparent and absolute, with no layout wrapper. Images do not navigate. |
| Trip sharing and creation | Shared header controls restore Share and creation plus actions. Sharing retains its existing service, preview, native sheet, fallback, and Personal Place public-snapshot guard. Creation uses the existing provider, guards duplicate taps synchronously, displays progress within the check control's 44 × 44 footprint, and opens the created Trip. Failure restores an actionable form with the existing error. |
| In-Trip places | Favourites and Search TripIdeas use standard PlaceCards and normal hearts. Their Trip icons add directly to the current Trip or confirm removal through existing provider operations. Current-Trip membership drives the blue selected folder; pending work uses an icon spinner, guards duplicates, and preserves visible retryable errors. There is no place-added success text in this picker. Card taps close the sheet and use normal Place detail navigation. Both source controls are equal-width, aligned buttons. |
| Generic Add to Trip | Ordinary Place contexts retain the existing Trip-selection modal and its established success/Open Trip presentation. Added visible pending feedback, disabled actions, and synchronous duplicate guards preserve authoritative completion and error reporting. |
| Map filters | Saved and Region selections already apply immediately; their redundant Apply controls are removed, and X still closes them. Activity retains its multi-selection draft and Apply action. |
| Personal locator | Always requests current position when selected, retaining region/activity/Saved/query filters. It centres the camera, uses the existing red/white marker treatment, and reports denied/unavailable location. Existing viewport bounds continue to filter results after pan/zoom. Cancelling pending fits and removing the tray-height refit prevent automatic camera jumps that undo navigation. No personal-location filtering mode was introduced. |
| Search | One native input remains pinned above scrolling results in main and Trip search. The header/introductory content is in the same fixed top section. Browsing dismisses the keyboard; the existing query, results, and 300 ms debounce are retained. There is no manual focus ref, onPressIn focus callback, duplicate input, or focus state. Physical-device/TestFlight keyboard reopening remains to be verified. |
| Saved/Profile | Favourites, Trips, and Personal Places have concise explanations. Obsolete Notebook help copy is removed from Profile. Personal Places plus still invokes its existing creation provider and editor. |

Saved/Region Apply removal follows the user's explicit exception to the canon's general filter-sheet Apply pattern. The canon itself and Activity Apply were not changed.

## Complete audit findings

- **Header regression:** the installed native-stack 7.16.0 forwards `unstable_headerRightItems` as native toolbar props absent from installed react-native-screens 4.16.0. Reusing the existing React header controls avoids that unsupported path without replacing sharing or creation logic. The helper is used by Trip index/detail and Personal Places index, not Notebook/Diary screens.
- **Latency:** Trip mutation completion includes the write, refreshed summaries, authoritative entries, and owner-scoped cache persistence. Those multiple round trips remain intact. Pending feedback improves acknowledgement; no measured network-speed improvement is claimed.
- **Discover routes:** standalone island article and island-regions routes already existed at baseline and remain untouched. No invented image-navigation flow remains. No other legitimate route was removed.
- **Routing:** normal `/place/[slug]` navigation predates these changes and matches the route hierarchy. `/trips/[tripId]/map`, tab registration, root/Discover stacks, and route defaults are unchanged.
- **Native runtime:** main Map and Trip Map import MapLibre directly; Place detail reaches it through the map preview. Missing `MLRNCameraModule` can fail route module evaluation under Expo Go. No JavaScript fallback, router workaround, or dependency change was introduced for Expo Go. Verify these screens in the custom native app.
- **Location configuration:** `app.json` already contains the foreground usage description and expo-location plugin options. Earlier read-only Expo introspection confirmed the generated key. The existing ignored local `ios/tripideasmobile/Info.plist` lacked it; native output must be synchronized before a future local native build. No configuration or native files were edited, and no installed binary's plist was certified.
- **Other functionality:** Notebook/Diary code, Personal Place editor/provider, Trip API/provider, Activity filter, authentication/cache boundaries, and shared image rendering are unchanged. Profile's Notebook copy removal is intentional.
- **Cleanup:** no debug logging, production test hooks, obsolete image routing, speculative focus callbacks, or duplicate product handlers remain in the diff. Removed an unused IslandCard-export branch and duplicate Discover test invocation from the test harness. Tests still exercise actual component callbacks using controlled hooks/promises; they do not claim native rendering verification.

## Verification

All checks were run before committing:

- `npx tsc --noEmit`: passed, exit 0.
- `npm run lint`: passed, exit 0, no findings.
- `git diff --check`: passed, exit 0.
- Focused September suite: **7 test files passed, 0 failed**, exit 0.
- Full suite: **63 test files, 61 passed, 2 failed**, exit 1.

The two unchanged, previously baseline-confirmed failures are:

1. `components/ui/saved-refinement.test.js`: expects the older Diary `Enter dates in DD/MM/YYYY format, for example 05/09/2026` wording.
2. `saved/beta-stabilisation.test.js`: expects `Upload paused` in the Personal Place editor. The updated header/creation assertions pass before that unrelated assertion.

Neither failure was hidden or its assertion weakened.

The full suite still needs TS/TSX transpilation and alias/extensionless import resolution under the installed Node version. `scripts/test-loader.mjs` preserves the previously used loader approach with repository-relative paths and the existing TypeScript dependency. It changes no product configuration or dependencies.

```sh
node --loader ./scripts/test-loader.mjs --test components/beta-feedback.test.js components/beta-trip-actions.test.js components/discover-island.test.js components/add-to-trip-modal.test.js trips/index-create.test.js trips/ui-alignment.test.js saved/improvement-pass.test.js
node --loader ./scripts/test-loader.mjs --test $(rg --files -g '*.test.js')
```

Local run logs: `/tmp/tripideas-beta-final-focused.log` and `/tmp/tripideas-beta-final-suite.log` (not committed).

## Remaining manual checks

- Physical-device/TestFlight keyboard cycle: enter query → browse/dismiss → tap input → keyboard reopens, with query/results retained, in both main and Trip search.
- Native-app smoke checks for Map tab, normal Place detail, and Trip Map with MapLibre present. Expo Go cannot establish their runtime correctness.
- On the next authorized native build, verify synchronized foreground-location plist configuration; test denied/unavailable/granted GPS, active filters, red marker, and pan/zoom without camera reset.
- Final device checks for header controls, authoritative add/remove and retry, sheet-to-detail transitions, and share-sheet/public-link behavior using an authorized test Trip. Existing public Personal Place snapshot limitations remain.
- Visual confirmation on relevant device sizes, including Discover's unchanged presentation and identical image/title accordion behavior, equal-width picker controls, and stable creation progress.

No new device session or TestFlight build was performed during consolidation. This commit records the already-reviewed product decisions and the automated evidence above.

## Included files

- `app/(tabs)/(discover)/discover.tsx`
- `app/(tabs)/map.tsx`
- `app/(tabs)/profile.tsx`
- `app/(tabs)/saved.tsx`
- `app/(tabs)/search.tsx`
- `app/trips/[tripId].tsx`
- `app/trips/[tripId]/map.tsx`
- `app/trips/index.tsx`
- `components/add-place-to-trip-button.tsx`
- `components/add-to-trip-modal.tsx`
- `components/beta-feedback.test.js`
- `components/beta-trip-actions.test.js`
- `components/discover-island.test.js`
- `components/map/map-controls.tsx`
- `components/map/map-regions-sheet.tsx`
- `components/map/map-saved-sheet.tsx`
- `components/place-card-actions.tsx`
- `components/place-card.tsx`
- `components/place-search.tsx`
- `components/saved-module.tsx`
- `components/trip-index-card.tsx`
- `components/trip-place-picker.tsx`
- `components/ui/header-actions.tsx`
- `docs/beta-feedback-september-2026.md`
- `sanity/queries.ts`
- `saved/beta-stabilisation.test.js`
- `saved/improvement-pass.test.js`
- `scripts/test-loader.mjs`
