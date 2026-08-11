# Trip synchronisation reconciliation audit

## Baseline

- Repository: `tripideas-mobile`
- Branch: `feature/notebook-text-mvp`
- SHA: `2dee83b265eb417589782f0f24bbb2eec4dc6330`
- Initial working tree: tracked files clean; existing untracked `audit/`
  preserved
- Audit type: focused, read-only code trace

## 1. Where a Trip is first created

There are two creation entry points:

1. `app/(tabs)/saved.tsx` calls `useMyTrips().createTrip(name)`.
2. `components/place-card-actions.tsx`, through
   `components/add-to-trip-modal.tsx`, calls
   `useMyTrips().createTripWithPlace(name, placeId)`.

Both implementations are in `trips/provider.tsx`.

`createTrip` constructs:

```ts
{
  id: `trip-${Date.now()}-${randomSuffix}`,
  name: trimmedName,
  note: '',
  places: [],
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp
}
```

`createTripWithPlace` creates the same object with one local
`{ addedAt, note: '', placeId }` record.

Both immediately call `persistUpdate`, which updates React state and
`trips/storage.ts#setMyTrips`. That writes the complete normalized list to
AsyncStorage key `tripideas.myTrips.v1`.

Creation does not inspect authentication and makes no API request. The same
path runs before and after sign-in.

## 2. Authoritative Trip model today

The authoritative editable mobile Trip model is AsyncStorage plus the in-memory
mirror in `MyTripsProvider`.

Evidence:

- `trips/provider.tsx` loads only `getMyTrips()` on mount.
- Every create, rename, delete, membership and note mutation runs through
  `persistUpdate` and `setMyTrips`.
- Failed persistence restores state from `getMyTrips()`.
- There is no Trip/Itinerary API client in the repository.
- `MyTripsProvider` does not consume `AuthProvider` or a user ID.
- Sanity supplies editorial place presentation after local `placeId` lookup;
  it does not store Trip membership, names or notes.

This is not currently an API cache, write queue or hybrid authority. It is
local authoritative storage. Sanity is a read-only presentation dependency for
the editorial places referenced by a Trip.

## 3. How web synchronisation currently works

The only code path connecting a mobile Trip to the web is explicit public
snapshot creation. It is publication/sharing, not editable Trip
synchronisation.

### Public snapshot path

1. The user chooses Share on `app/trips/[tripId].tsx`.
2. `buildPublicTripSnapshot` in `trips/public-sharing.ts` converts the current
   local `MyTrip` plus fetched Sanity place cards into a self-contained
   `PublicTripSnapshot`.
3. `createPublicTripShare` POSTs that snapshot as JSON to:
   - `EXPO_PUBLIC_TRIP_SHARE_API_URL`, when configured; otherwise
   - `https://www.tripideas.nz/api/trips/share`.
4. The submitted snapshot contains:
   - local `sourceTripId`;
   - title, note and timestamps;
   - place count;
   - each editorial `placeId`, note, title, optional slug, coordinates and
     image presentation;
   - optional cover image.
5. A successful response must contain a server-issued `shareId` and `url`.
6. The returned URL is passed directly to the native share sheet.

### Response, failure and conflict behaviour

- The response does not update `MyTrip`.
- Neither `shareId` nor URL is stored locally.
- There is no subsequent read, update, delete or reconciliation request.
- A 404/503 becomes `backend-unavailable`; other HTTP failures and malformed
  responses become `request-failed`.
- Network failures also become `request-failed`.
- The UI offers a local text-share fallback.
- There is no version, conflict or retry protocol.
- Repeating Share builds another current snapshot and calls the endpoint
  again; the mobile code does not identify or update an earlier share.

### Other paths

- `app/trips/[tripId]/shared.tsx` is a local, device-only preview. It reads the
  same `MyTripsProvider` and Sanity data; it is not the public web consumer.
- `Share.share` without a server URL exports text only.
- No `/itinerary`, Trip CRUD, collection or background synchronisation calls
  exist in the mobile Trip code.

## 4. Trip identifiers

Four identifiers are relevant:

| Identifier | Created by | Use | Persistence |
|---|---|---|---|
| `trip-*` local Trip ID | `trips/provider.tsx#createTripId` | Local lookup, route `/trips/[tripId]`, local preview, and `sourceTripId` in a public snapshot | Stored in `tripideas.myTrips.v1` |
| Editorial `placeId` | Sanity content | Local membership, note key, place fetch and public snapshot | Stored inside each local Trip |
| `shareId` | Web share endpoint | Validates the response and identifies the public share | Not stored by mobile |
| Public share URL | Web share endpoint | Native sharing/bookmark target | Not stored by mobile |

The local `trip-*` ID remains permanent for the editable on-device Trip. A
server ID never replaces it. No local/server mapping exists and no mapping is
stored.

`sourceTripId` is merely copied into the public snapshot. The mobile code does
not use it to read or update a server record.

## 5. What the web application consumes

The mobile code demonstrates only this web contract:

- endpoint: `POST /api/trips/share` on the configured/web host;
- request object: `PublicTripSnapshot`;
- source identifier: local `sourceTripId`;
- response: separate server `shareId` and public `url`;
- expected public URL family: `https://tripideas.nz/trip/{shareId}`.

Therefore the web-facing representation used by mobile is a denormalized,
read-only public snapshot, not an API `Itinerary`.

The mobile repository does not contain the web endpoint implementation, so it
cannot demonstrate:

- the persistence type/table behind that endpoint;
- whether repeated `sourceTripId` values are deduplicated;
- whether the returned URL is always derived from `shareId`;
- any server retention or expiry policy.

It does demonstrate that mobile has no web edit identifier and no update path.
The public URL uses the returned share identity, not the local Trip route ID.

## 6. Current cache architecture

For Trips, AsyncStorage is authoritative storage:

- key: `tripideas.myTrips.v1`;
- content: the entire normalized Trip list;
- updates: immediate whole-list replacement;
- failure rollback: reload the same AsyncStorage value;
- no dirty/synced marker;
- no operation queue;
- no server revision;
- no last-sync metadata.

It is not currently an offline cache because there is no online authoritative
Trip source. It is not a snapshot cache for web shares because `shareId`, URL
and uploaded snapshot state are not retained.

Sanity place cards are fetched afresh for display. Their results are component
state, not persisted as part of the Trip cache.

## 7. Authentication boundary

- Trips can be created, edited, deleted and shared before login.
- Sign-in does not alter, migrate, upload or re-owner Trips.
- The global storage key is not scoped by user or anonymous identity.
- The same local Trips remain visible after a user signs in.
- Sign-out clears auth state and the signed-in user's Notebook cache, but does
  not clear `tripideas.myTrips.v1`.
- A second user on the same installation sees the same local Trips.
- Another device cannot retrieve these editable Trips because no Trip
  synchronisation request exists.
- Public snapshot creation does not use `authenticatedApiFetch`; from this
  code it is not tied to the mobile bearer identity.

`docs/product-decisions.md` is consistent with the implementation: it records
mobile saved content as local-first while the web requires authentication.

## 8. Compatibility with the new Itinerary API

Yes. The authenticated Itinerary API can become the authoritative mobile Trip
model without breaking the existing public snapshot contract, but the current
local records require a one-time migration and ID mapping.

The concepts map narrowly:

| Local mobile field | API model |
|---|---|
| `MyTrip.name` | `Itinerary.name` |
| `MyTrip.note` | `Itinerary.description` |
| ordered `MyTrip.places[]` | ordered editorial `ItineraryEntry` records |
| `MyTripPlace.placeId` | editorial target ID |
| `MyTripPlace.note` | entry note |
| array position | `Itinerary.entryOrder` |

Required migration mechanics:

1. For each eligible local Trip, create one API Itinerary.
2. Persist the returned server Itinerary ID against the legacy local
   `trip-*` ID before creating entries.
3. Create one editorial entry per local place in array order, retaining notes.
4. Submit the exact returned entry-ID order.
5. Mark the legacy Trip migrated only after a server read verifies the complete
   name, description, entries, notes and order.
6. Retry idempotently after interruption using durable migration state; do not
   create a second Itinerary.
7. Replace local authority with the server ID and a user-scoped readable cache.
8. Retain the legacy ID mapping for diagnostics and any future share provenance
   lookup, but route/edit by the server ID.

The existing public snapshot builder can continue to publish the current
resolved Trip view. After migration, `sourceTripId` should use the stable server
Itinerary ID for new shares. Existing public snapshots and URLs do not need to
be rewritten because they use their own server-issued `shareId`.

## 9. Migration impact

### Locally stored Trips

They remain intact until each migration is verified. The current global key
must not simply become an authenticated cache: its contents have no proven
owner. A migration must bind them to a selected authenticated user, then store
the server-backed cache under a user-scoped key.

### Shared and web-visible Trips

Existing public snapshots are independent copies. Migration does not update
them, but it also does not invalidate them. Their future availability is a web
endpoint concern not represented in mobile.

### Bookmarked URLs

Existing bookmarks use returned public share URLs/share IDs. They do not use
the local `trip-*` route ID and therefore should remain unchanged.

### Identifiers

Local `trip-*` IDs cannot call the new API. A durable legacy-to-server mapping
is required during migration. Normal operation should use the server
Itinerary ID afterward.

### Offline data

Existing local Trips can remain readable during migration. After transition,
the app may keep a user-scoped readable snapshot for offline display, but
offline mutations require a new queue/conflict model and should be deferred.

### Transparency

The data transfer can be transparent after the user/ownership boundary is
resolved. Silently assigning the global device store to whichever account
signs in first is not safe when more than one person has used the installation.
The smallest safe product interaction is a one-time confirmation that the
device Trips should be imported into the currently authenticated account.

## 10. Recommendation

**Option B — the existing implementation requires a one-time migration from
local Trip IDs to API Itinerary IDs.**

Smallest safe migration:

1. Require an authenticated, confirmed user.
2. Detect nonempty `tripideas.myTrips.v1` and no completed migration marker for
   that user/device data set.
3. Ask once whether to import these device Trips into the current account.
4. Persist a user-scoped migration journal containing each legacy ID, server
   ID, phase and verification result.
5. Create/reconcile Itineraries and editorial entries as described above.
6. Verify each server projection before marking it complete.
7. Switch `MyTripsProvider` to server authority and a user-scoped read cache.
8. Retain the original local store until all selected Trips verify; archive or
   remove it only in a separately recoverable cleanup step.
9. Continue creating public snapshots from the resolved server-backed Trip
   view; do not modify existing share URLs.

This is a bounded authority transition, not a Trip redesign.

## Confirmed facts

- New mobile Trips are created locally with `trip-*` IDs.
- The complete editable Trip list is stored at `tripideas.myTrips.v1`.
- Trip mutations do not call an API and do not depend on authentication.
- Mobile has no Itinerary API client, server Trip ID or ID mapping.
- Sign-in and sign-out do not migrate or remove local Trips.
- Editable Trips do not synchronise across devices.
- The only web path POSTs a denormalized public snapshot to
  `/api/trips/share`.
- That endpoint returns a separate `shareId` and URL.
- Mobile does not store the share identity or update the uploaded snapshot.
- Existing public URLs are separate from local `/trips/[tripId]` IDs.

## Remaining unknowns

- Which authenticated account should own global device Trips when an
  installation has been used by multiple people.
- Whether the web share endpoint deduplicates repeated `sourceTripId` values.
- The web share snapshot's retention/expiry rules.
- Whether product policy requires importing all device Trips or allows
  selective import.

## Recommended implementation path

1. Approve the one-time account-assignment/import confirmation.
2. Add the durable user-scoped migration journal and idempotent import.
3. Verify names, notes, editorial entries and order against the API.
4. Convert the provider to authenticated API authority with a user-scoped
   readable cache.
5. Preserve public snapshot sharing and existing share URLs.
6. Only then begin mixed Personal Place Card rendering and attachment.
