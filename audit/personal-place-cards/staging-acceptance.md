# Personal Place Cards — authenticated staging acceptance

Date: 2026-08-03

Mobile baseline: `cc01d8ba2f85dd2e0c4dad8a676e984f79164b79`

Staging API: `babc288facd7c4e3eb077c1ac16c232d19be7c0a`

## Acceptance results

| Scenario | Result | Observation |
| --- | --- | --- |
| Personal Place Card editing | PASS | Title and body persisted and refreshed authoritatively. |
| Photo upload and attachment | PASS | Main photo uploaded and attached. Signed-image refresh can be slow. |
| Restart recovery | PASS | Title, body, confirmed location, main photo and readiness survived a full Simulator restart. |
| Readiness transitions | PASS | Completed card became Trip-ready; removing required content while attached was rejected. |
| Confirmed location | PASS | Confirmed coordinates and map persisted. Empty coordinate inputs no longer project as `0,0`. |
| Trip attachment | PASS | Ready Personal Place Card attached to an existing Trip. |
| Duplicate attachment rejection | PASS | The same canonical card could not be attached twice to one Trip. |
| Mixed Trip rendering | PASS | Editorial and Personal Place entries rendered in canonical order. |
| Trip map | PASS | Confirmed Personal Place location appeared on the Trip map. |
| Cover image | PASS | Mixed Trip cover image rendered correctly. |
| Entry notes | PASS | Personal Place entry note persisted after closing and reopening the Trip. |
| Attached-card edit guard | PASS | Safe text edits remained allowed; removal of required content was rejected with clear detach guidance. |
| Deletion guard | PASS | Attached card displays detach guidance instead of an unusable Delete action; API guard remains in place. |
| Offline readable cache | PASS | Cached card and mixed Trip remained readable; mutation failed clearly and was not presented as saved; online refresh recovered. |
| Account isolation | PASS | A second dedicated staging identity could not see or open the first identity's card. |
| Editorial-only public sharing | PASS | Native share sheet opened with a usable public link. |
| Mixed Trip public-share blocking | PASS | Public sharing was blocked when a Personal Place entry was present. |

## Defects and resolutions

### Owner detail and mutation routes returned 404

- Classification: API.
- Root cause: trailing-slash-compatible routes manually extracted identifiers by pathname offsets, producing an empty card ID or `media` instead of the router's `cardId`.
- Resolution: API commit `babc288facd7c4e3eb077c1ac16c232d19be7c0a` uses validated named route parameters consistently.
- Result: owner detail, update, location, media attachment and second-owner isolation passed on staging.

### Empty coordinates projected as a valid `0,0` location

- Classification: mobile.
- Root cause: `Number('')` evaluates to zero, so empty latitude and longitude fields passed numeric range validation.
- Resolution: parse only non-empty paired coordinate values before map rendering or location confirmation.
- Regression: `personal-place-cards/location.test.js`.

### Canonical card edits remained stale in Trip detail

- Classification: mobile.
- Root cause: Trip detail rendered the provider snapshot captured before the card edit and did not refresh mixed entries when the route regained focus.
- Resolution: refresh authoritative Trip projections on every Trip-detail focus using Expo Router's focus lifecycle.
- Regression: repeated Trip API projection verifies an updated canonical Personal Place Card replaces the cached projection.

### Attached-card guard message suggested an unavailable action

- Classification: mobile.
- Root cause: the generic readiness repair message said to add a main photo after the attempted removal had correctly rolled back, while the existing main photo kept the Add action hidden.
- Resolution: attached-card rejection now explains that the card must be detached before required details or photos can be removed.
- Regression: Personal Place Card error-contract assertion.

### Attached card still displayed a Delete action

- Classification: mobile.
- Root cause: the editor knew the active attachment count but always rendered the destructive confirmation.
- Resolution: attached cards now show detach guidance and no Delete action; unattached cards retain the destructive confirmation.

## Remaining limitations

- Signed main-photo display can refresh slowly after attachment, but the authoritative attachment succeeds and appears without data loss.
- Personal Place Card photos have no processing/thumbnails in this stage; this does not block Stage 2 acceptance.

## Final status

All authenticated Stage 2 Personal Place Card acceptance scenarios passed against staging. Production was not used.
