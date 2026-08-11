# Targeted mobile reuse audit — Personal Place Cards

## 1. Baseline and repository status

- Repository: `tripideas-mobile`
- Branch: `feature/notebook-text-mvp`
- Audited SHA: `2dee83b265eb417589782f0f24bbb2eec4dc6330`
- Backend reference: `tripideas-api`
  `d87c7239e91770a14ceeec5fecdd66a92bf0e2e7`
- Audit scope: read-only, file-level reuse assessment
- Initial working tree: clean; branch one commit ahead of origin

## 2. Executive conclusion

The visual and photo foundations are suitable for focused reuse, but the
current Trip Idea data boundary is not yet compatible with Milestone 2.2.
Mobile `MyTrip` records are local-only `AsyncStorage` documents with
client-generated `trip-*` IDs. They do not call the authenticated Itinerary API
and have no server `ItineraryEntry` IDs or `entryOrder`. Consequently the app
cannot call `GET /itinerary/:itineraryId/entries`, attach a Personal Place Card,
PATCH a note by entry ID, or detach an entry for its current trips.

This is one concrete prerequisite, not a reason to redesign the feature:
replace the local-only Trip provider boundary with an authenticated server
Trip Idea adapter, with an explicit decision for existing on-device trips.
Once that boundary is resolved, the current card shell, note controls, map
primitives, authenticated API client, photo picker and durable upload engine
can be reused with small adapters.

There is no Personal Place Card API client or create/edit UI in the mobile
repository today.

## 3. Reuse matrix

| Category | Existing file/module | Recommendation |
|---|---|---|
| Reuse unchanged | `lib/api-client.ts` — `authenticatedApiFetch`, `ApiError` | Use for all Trip Idea and Personal Place Card requests, including the existing refresh/retry and safe error codes. |
| Reuse unchanged | `photo-uploads/picker.ts` — `pickPhotoForUpload` | Use for main and body photo selection. |
| Reuse unchanged | `photo-uploads/engine.ts`, `state-machine.ts`, `validation.ts`, `errors.ts` | Reuse validation, checksum, intent, PUT, completion, retry and safe failure classification without a second uploader. |
| Reuse unchanged | `photo-uploads/native.ts`, `service.ts`, `storage.ts`, `types.ts` | Reuse managed files, per-user queue, stable request ID, restart-safe state and active-upload cancellation. |
| Reuse unchanged | `components/ui/card-surface.tsx`, `media-frame.tsx`, `app-text-input.tsx`, `app-button.tsx`, `status-text.tsx`, `loading-view.tsx` | Retain the established visual and form primitives. |
| Reuse unchanged | `components/place-map-preview.tsx` | Suitable for displaying one confirmed Personal Place Card location. |
| Generalise minimally | `components/place-card.tsx` — `PlaceCard` | Extract/generalise its visual shell. Keep editorial navigation, Sanity slug, favourite and add-to-trip actions in an editorial adapter. |
| Generalise minimally | `app/trips/[tripId].tsx` | Discriminate the ordered mixed-entry union here (or in a small entry renderer), while retaining its note, remove-confirmation, loading, empty and error patterns. |
| Generalise minimally | `app/trips/[tripId]/map.tsx` | Adapt mixed entries into a common marker view model instead of fetching every marker from Sanity. |
| Generalise minimally | `components/add-to-trip-modal.tsx` | Its existing-trip/create-trip selection shell is reusable after changing `placeId`-specific props and duplicate checks to a discriminated target. |
| Generalise minimally | `components/place-card-actions.tsx` | Keep editorial actions; route Trip attachment through the server-backed provider. Do not make Personal Place Cards favourites. |
| Generalise minimally | `trips/images.ts` and Saved Trip rows in `app/(tabs)/saved.tsx` | Select cover images and counts from mixed entry view models rather than editorial `placeId` arrays. |
| New implementation required | `trips/api.ts` | Authenticated Trip list/create/update/delete, mixed-entry read, attach, note-only PATCH, detach and ordering requests. |
| New implementation required | `trips/dto.ts` (or equivalent single parser module) | Runtime parsing and the single source for the mixed discriminated union and unavailable placeholder. |
| New implementation required | `personal-place-cards/api.ts`, `types.ts` | Canonical card CRUD/media contracts, readiness, version conflicts and attachment-safe errors. |
| New implementation required | Personal Place Card list/editor route(s) | Minimal select/create/edit flow for title, body, location, main photo and ordered body photos. |
| New implementation required | Thin Personal Place Card photo orchestration module | Map completed `PhotoAsset.id` values into versioned card media mutations; retain pending context for restart recovery. |
| Defer | Offline Trip/Card mutations | Initial milestone should cache readable server projections only; do not queue edits or attachments offline. |
| Defer | Public sharing changes | Current snapshot sharing is editorial/local and is outside this milestone. |
| Defer | Map redesign, routing, Notebook conversion | Neither is needed for mixed private Trip Idea entries. |

## 4. Existing Trip Idea flow

### Current persistence and provider

- `trips/types.ts` defines `MyTripPlace` as
  `{ addedAt, note, placeId }`; there is no entry ID or discriminator.
- `trips/storage.ts` stores all trips under the global
  `tripideas.myTrips.v1` key. It is not user-scoped.
- `trips/provider.tsx` is the sole mutation layer. It creates `trip-*` IDs,
  reads and writes only `AsyncStorage`, prevents all editorial duplicates
  locally, and exposes no refresh/error/conflict state.
- There is currently no Trip Idea API module.

### Detail rendering

`app/trips/[tripId].tsx`:

- obtains a local trip synchronously from `useMyTrips`;
- derives a `placeId[]`;
- fetches editorial presentation from Sanity through
  `sanity/place-cards.ts#fetchPlaceCardsByIds`;
- renders `PlaceCard` in the order returned by Sanity lookup, not explicitly by
  a server `entryOrder`;
- keys notes and removal by `placeId`;
- saves notes locally through `updatePlaceNote`;
- removes locally through `removePlaceFromTrip`;
- displays loading, missing-trip, place-fetch error and empty states;
- performs no optimistic server mutation, version check or server cache.

There is no reorder UI or reorder provider action. Current array order is
insertion order. The new server endpoint supplies explicit `order`, and the
renderer should preserve that order without re-sorting through Sanity results.

### Minimum mixed-entry change

1. Fetch `GET /itinerary/:itineraryId/entries` through the new Trip API.
2. Parse once into an exhaustive union:
   `editorialPlace | personalPlaceCard | unavailable personalPlaceCard`.
3. Batch-fetch Sanity cards only for editorial IDs, then merge them back by
   entry ID/order.
4. Render each entry through a small discriminated adapter using a shared card
   shell.
5. Key notes, PATCH and DELETE by `entry.id`, never by target ID.
6. Render unavailable entries in place with their stable order and safe
   message; exclude them from map markers and images.

The retained legacy `GET /itinerary/entries` is not the correct source for this
screen because it is global, flat and editorial-only.

## 5. Existing place-card reuse

`components/place-card.tsx#PlaceCard` is the closest canonical full-width
presentation. It already composes:

- `CardSurface`;
- `MediaFrame`;
- title, heading and preview text;
- an optional distance label;
- editorial actions.

Its shell is reusable, but its input and interaction are editorial-specific:

- `PlaceCardData` comes from Sanity;
- `_id`, `slug.current`, `imageUrl` and editorial text fallback fields are
  assumed;
- pressing the card navigates to `/place/[slug]`;
- `PlaceCardActions` assumes favourites and an editorial `placeId`.

Prefer a shared presentation value/visual shell plus two adapters:

- editorial adapter: existing Sanity fallbacks, slug navigation and actions;
- personal adapter: canonical title/body/main-photo presentation and Personal
  Place Card edit/open action.

A broad discriminated prop directly inside every editorial branch would make
`PlaceCard` harder to maintain. A thin adapter feeding a common shell keeps the
visual reuse while preserving source-specific behaviour.

`components/map/map-place-tile.tsx` is a second, compact editorial card. It
duplicates some image/title/action presentation and should consume the same
shared shell/view model where practical rather than becoming another Personal
Place Card implementation.

## 6. Photo workflow reuse

The provider-neutral photo transport is already separated from Notebook and
can be reused unchanged:

- selection: `photo-uploads/picker.ts`;
- MIME/size validation: `validation.ts`;
- durable managed copy: `native.ts#copyPhotoToManagedFile`;
- SHA-256 checksum: `native.ts#checksumNativePhotoFile`;
- intent/completion API: `api.ts`;
- signed direct PUT: `native.ts#putNativePhotoFile`;
- lifecycle and idempotent retry: `engine.ts` and `state-machine.ts`;
- user-scoped queue: `storage.ts`;
- orchestration/cancellation: `service.ts`;
- safe errors: `errors.ts`.

`notebook-photo-blocks/service.ts` demonstrates the correct thin orchestration
pattern: prepare upload, persist pending destination context, finish or resume
the upload, then attach the resulting `PhotoAsset.id` with a stable client
request ID. Personal Place Cards need the same pattern with card ID, intended
media role/position and expected card version instead of Notebook/page/block
fields.

Do not reuse `notebook-photo-blocks/storage.ts` directly because its record is
Notebook-specific. Add a small user-scoped Personal Place Card pending-media
store. Reuse the underlying photo queue and transport unchanged.

Sign-out currently cancels active uploads in `auth/provider.tsx`, but durable
managed files and queue records remain user-isolated for retry. The Personal
Place Card pending store must follow the same user-keyed rule. No signed URL,
access token or storage metadata should be persisted.

For display, existing Notebook `authorizePhotoRead` and preview handling show
the signed-read pattern, but a canonical Personal Place Card client should own
its approved photo-read call rather than importing a Notebook API function.

## 7. API and type changes

### Existing client

`lib/api-client.ts` already supplies:

- bearer injection;
- one refresh/retry on 401;
- session invalidation after a repeated 401;
- JSON and empty-body handling;
- safe `ApiError(status, code)`.

### Required narrow modules

Create one Trip API/parser boundary rather than spreading DTO copies:

- Trip summary/detail contracts;
- mixed entry union;
- ordered response parser;
- editorial target create;
- Personal Place Card target create;
- note-only PATCH;
- entry DELETE;
- exact ordering update.

Create one Personal Place Card API/parser boundary for:

- list/read/create/update/delete;
- media attach/remove/reorder;
- readiness and `expectedVersion`;
- `personal_place_card_conflict`;
- `personal_place_card_attached`;
- `personal_place_card_attached_invalid`;
- attachment readiness and duplicate errors.

The view-model adapter should convert backend `location.latitude/longitude` to
the existing mobile `{ lat, lng }` marker shape without changing the canonical
DTO. Preserve unavailable placeholders rather than filtering them.

Notebook `classifyNotebookError` and provider mutation queues are useful
patterns, but their error codes and document semantics should not be imported
into the new domains. Implement equally small Trip/Card classifiers using
`ApiError`.

## 8. Map and location reuse

`app/trips/[tripId]/map.tsx` currently assumes all entries are editorial:

- it obtains `placeId[]` from local `MyTrip`;
- resolves every place through Sanity;
- narrows `PlaceCardData` with `hasValidCoordinates`;
- uses `MapLibreMap`, `Camera` and `Marker`;
- fits bounds and reports entries without coordinates.

The MapLibre view, camera fitting and marker interaction can remain. Add a
mixed-entry marker adapter producing:

```ts
{
  entryId: string;
  latitude: number;
  longitude: number;
  title: string;
  source: 'editorialPlace' | 'personalPlaceCard';
}
```

Editorial coordinates continue to come from Sanity. Personal coordinates come
from the canonical card `location` only when confirmed. Unavailable entries,
unconfirmed/missing locations and malformed coordinates produce no marker and
increment the existing unavailable count.

`components/place-map-preview.tsx` can display an individual confirmed
location. No existing UI selects or confirms a Personal Place Card location.
A minimal coordinate confirmation/editor control is genuinely new; it should
reuse the current map styling and numeric validation, not redesign the map.

## 9. Minimum new UI

Required:

1. Personal Place Card chooser/list for attaching an existing ready card.
2. Minimal create/edit screen using `AppTextInput`, `AppButton`,
   `CardSurface`, `MediaFrame` and existing status/loading components.
3. Main-photo selection plus ordered body-photo rows using the existing photo
   picker/transport and simple move/remove controls.
4. Minimal confirmed-location control.
5. Mixed Trip entry adapter and unavailable placeholder.

The Notebook editor provides the closest patterns for multiline editing,
version conflicts, serialized mutations and authoritative reload. Its
page/block UI is not a suitable card editor and should not be copied wholesale.
`PlacePhotoGrid` is an editorial read-only gallery and is more functionality
than the required create/edit media list.

Backend readiness should be shown from canonical `readinessIssues`; the client
should not independently decide whether a card is attachable. Duplicate,
readiness and conflict errors should result in a refresh of canonical card and
Trip entries.

## 10. Exact files likely to change

Existing files:

- `app/_layout.tsx` — register new Personal Place Card route(s) if needed.
- `app/(tabs)/saved.tsx` — server Trip summaries/counts and mixed cover images.
- `app/trips/[tripId].tsx` — load/render ordered mixed entries and entry-ID
  notes/removal.
- `app/trips/[tripId]/map.tsx` — mixed marker adapter.
- `components/place-card.tsx` — extract/generalise its presentation shell.
- `components/map/map-place-tile.tsx` — consume the shared compact shell where
  applicable.
- `components/place-card-actions.tsx` — server-backed editorial attachment.
- `components/add-to-trip-modal.tsx` — discriminated target and server trips.
- `trips/provider.tsx`, `trips/types.ts`, `trips/storage.ts` — replace the
  local-only authority; retain cache only after the migration decision.
- `trips/images.ts` — mixed cover-image selection.
- `auth/provider.tsx` — clear/cancel any new user-scoped pending-card work.

Likely new files:

- `trips/api.ts`
- `trips/dto.ts`
- `trips/errors.ts`
- `personal-place-cards/api.ts`
- `personal-place-cards/types.ts`
- `personal-place-cards/provider.tsx`
- `personal-place-cards/photo-service.ts`
- `personal-place-cards/storage.ts`
- minimal Personal Place Card list/editor route and focused tests

Keep the authoritative DTO parsers in one module per domain. Do not duplicate
the mixed union in screens, provider and cache.

## 11. Material risks or blockers

### Blocker: local Trip authority versus server Itinerary authority

The current mobile Trip IDs and records do not exist in the API database.
Calling the mixed endpoint with a local `trip-*` ID returns not found. Existing
notes, place membership and insertion order also exist only on device.

Before Personal Place Card integration, approve one narrow transition:

- **migrate/recreate local trips on the authenticated API**, preserving name,
  note, editorial entries, entry order and entry notes; or
- **start server Trips as a separate clean authenticated set**, explicitly
  retaining or retiring legacy local trips.

This cannot be safely guessed during implementation because it determines
whether existing user content is uploaded, duplicated, retained locally or
removed. It is the only material blocker.

Additional implementation risks after that decision:

- the current renderer keys state by target `placeId`; mixed entries must use
  `entry.id`;
- Sanity fetch results may omit editorial places, so merging must preserve the
  backend entry and order rather than silently dropping structure;
- the current Trip map and cover-image helpers assume every entry is a Sanity
  place;
- current Trip storage is global, not per-user, and must not become a cache for
  authenticated private cards without user scoping;
- current public snapshot sharing must not include private Personal Place
  Cards in this milestone.

## 12. Recommended implementation sequence

1. Approve the local-to-server Trip transition policy above.
2. Add centralized Trip DTO parsing/API functions and tests.
3. Convert `MyTripsProvider` to authenticated server authority with a
   user-scoped readable cache only.
4. Move detail notes, removal and ordering to server entry IDs; preserve the
   legacy editorial visual result.
5. Generalise the `PlaceCard` visual shell and introduce the exhaustive mixed
   entry adapter/unavailable placeholder.
6. Adapt Trip images and map markers to the mixed view model.
7. Add the Personal Place Card API/provider and minimal chooser/editor.
8. Add the thin pending-media orchestration over the unchanged photo transport.
9. Attach ready cards, handle duplicate/readiness/version errors, and refresh
   canonical Trip/Card state.
10. Verify editorial regression, user isolation, restart recovery, unavailable
    placeholders, mixed ordering, notes, removal and maps.

## Required conclusion

**B. Resolve one blocker first.**

Approve how existing device-local `MyTrip` content transitions to the
authenticated server `Itinerary` model. After that single boundary decision,
proceed with the file-level sequence above; no further broad audit is needed.
