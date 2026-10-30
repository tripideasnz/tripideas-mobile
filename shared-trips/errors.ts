// What went wrong, in terms the Shared Trips screens can act on. Built from ApiError (status and code)
// and from non-API failures (a request that never completed is "offline").
//
// A generic 404 means the API build lacks the route (environment or capability failure); only a 404 with
// the domain code `collection_not_found` means the Trip itself is gone. They are never conflated.
import { ApiError } from '@/lib/api-client';

export type SharedTripsErrorKind =
  /** No usable answer from the network. Cached data stays valid. */
  | 'offline'
  /** The session is missing or expired and could not be refreshed: sign in again. */
  | 'session-expired'
  /** Signed in but not a participant: join first. */
  | 'not-joined'
  /** The collection does not exist (any more). */
  | 'not-found'
  /** This API build does not support Shared Trips. */
  | 'unsupported'
  /** The creator's Trip is the authority for structure. */
  | 'managed-by-trip'
  /** The server refused the request (4xx); retrying the same request cannot help. */
  | 'rejected'
  /** The server failed or sent something unreadable; trying again may help. */
  | 'server'
  /** The action is not allowed for this viewer (decided locally from the permissions). */
  | 'forbidden';

export type SharedTripsError = {
  /** The API's domain code when it sent one (for example personal_places_not_shareable). */
  code?: string;
  kind: SharedTripsErrorKind;
};

export function classifyError(error: unknown): SharedTripsError {
  if (!(error instanceof ApiError)) return { kind: 'offline' };
  const code = error.code;
  if (error.status === 401 || code === 'mobile_session_required') {
    return { code, kind: 'session-expired' };
  }
  if (error.status === 403 && code === 'not_joined') return { code, kind: 'not-joined' };
  if (error.status === 404) {
    return code === 'collection_not_found'
      ? { code, kind: 'not-found' }
      : { code, kind: 'unsupported' };
  }
  if (error.status === 409 && code === 'managed_by_trip') return { code, kind: 'managed-by-trip' };
  if (error.status === 408 || error.status === 429 || error.status >= 500) {
    return { code, kind: 'server' };
  }
  return { code, kind: 'rejected' };
}

export class SharedTripsFailure extends Error {
  constructor(readonly failure: SharedTripsError) {
    super(failure.kind);
    this.name = 'SharedTripsFailure';
  }
}
