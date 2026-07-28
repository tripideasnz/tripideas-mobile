# Mobile photo upload transport

Status: development-only foundation
Target: staging Photo Upload API

This module transports a selected private image into an owner-scoped
`PhotoAsset`. It does not render Photo Blocks or attach assets to Notebooks.

## Runtime transport

The app uses the Expo SDK 54 `File` API for file metadata and bytes,
`expo-crypto` for SHA-256, and native `expo/fetch` with a `File` request body
for the signed PUT. This avoids relying on browser-style or debugger-mediated
React Native `Blob` behaviour. The selected file is copied into the app's
document directory before hashing so retries use stable bytes.

## State and persistence

The local state sequence is:

`SELECTED → VALIDATED → INTENT_CREATED → UPLOADING → PUT_COMPLETED → COMPLETING → UPLOADED`

Failures become either `RETRYABLE_ERROR` or `PERMANENT_ERROR`. Each user has a
separate AsyncStorage queue. A record stores the managed local URI, normalized
MIME type, size, checksum, stable `clientRequestId`, remote asset identity and
version, state, bounded retry metadata, and timestamps.

Tokens, credentials, bucket details, and signed URLs are never persisted.

## Retry and recovery

Authenticated intent and completion calls use the existing centralized mobile
bearer refresh and single replay. Retries preserve `clientRequestId`. A signed
URL exists only for the active PUT and is never reused after interruption.
Uploads known to have completed their PUT resume at completion; uncertain PUTs
request a fresh idempotent intent and upload authorization. Before every
resumed PUT or completion, size, MIME type, and SHA-256 are revalidated against
the managed file. Automatic retry loops are intentionally absent.

## Sign-out and privacy

Sign-out aborts active uploads for that internal user ID and clears in-memory
signed authorization by ending the request. Pending records remain partitioned
under that user's key and cannot be listed or resumed by another account.
Whether sign-out should eventually remove unsynced managed files is a deferred
product and cleanup-lifecycle decision.

## Verification surface

Development builds expose a small “Photo transport test” route from Saved.
It can select, start, retry, and inspect sanitized lifecycle state. It does not
show local URIs, checksums, signed URLs, tokens, or storage details, and is
redirected away in non-development builds.

For deterministic staging verification, a development-only action can abort
once immediately after a real intent is created and before its signed PUT. The
record must become retryable and then complete through the ordinary retry path.

## Deferred

Photo Blocks, image processing, thumbnails, workers, EXIF extraction, cleanup,
gallery UI, camera-first flows, public sharing, and production provisioning are
outside this milestone.

## Staging verification — 2026-07-28

- Native `expo/fetch` uploaded exact managed `File` bodies successfully.
- JPEG reached `UPLOADED / WAITING`.
- PNG, selected with the current asset representation to prevent conversion,
  reached `UPLOADED / WAITING`.
- A real intent followed by a deliberately aborted PUT persisted
  `RETRYABLE_ERROR`; one explicit retry reached `UPLOADED`.
- A `VALIDATED` record survived app termination and relaunched successfully.
- After signing into a second staging identity, the first identity's upload
  cards were absent. The simulator photo library remained device-wide, as
  expected.
- No production environment or resources were used.
