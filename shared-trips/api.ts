// Typed clients for Shared Trips. Every call goes through the app's existing authenticated client
// (`authenticatedApiFetch`: the WorkOS bearer token, one refresh-and-retry on 401); there is no second
// authentication path. The note-free public preview is the one call that also works signed out.
//
// Existing endpoints are reused as they are: join and leave are the collection share/exit routes, notes
// are the collection comment routes, and Save a Copy is the B1 import (see copy.ts).
import { ApiError, apiFetch, authenticatedApiFetch } from '@/lib/api-client';
import { checkApiCapability, type ApiCapabilityStatus } from '@/lib/api-compatibility';
import { listTripSummaries } from '@/trips/api';
import {
  parseCollectionPreview,
  parseSharedTripDetail,
  parseSharedTripList,
} from '@/shared-trips/parse';
import type {
  CollectionPreview,
  JoinResult,
  OwnedTripSummary,
  ShareTripResult,
  SharedTripDetail,
  SharedTripSummary,
} from '@/shared-trips/types';

export const SHARED_TRIPS_CAPABILITY = 'shared-trips-v1';
/** The public preview route (GET /collections/:id/preview). */
export const SHARED_TRIP_PREVIEW_CAPABILITY = 'shared-trip-preview-v1';

export const checkSharedTripsCapability = (): Promise<ApiCapabilityStatus> =>
  checkApiCapability(SHARED_TRIPS_CAPABILITY);

const enc = encodeURIComponent;
const json = (body: unknown) => JSON.stringify(body);

/** The owner's Trips, each with the collection it publishes (null until shared). */
export async function listOwnedTrips(): Promise<OwnedTripSummary[]> {
  return (await listTripSummaries()).map((trip) => ({
    id: trip.id,
    name: trip.name,
    sharedCollectionId: trip.sharedCollectionId ?? null,
  }));
}

/** Shared With Me: collections the user has joined. */
export async function listSharedTrips(): Promise<SharedTripSummary[]> {
  return parseSharedTripList(await authenticatedApiFetch<unknown>('/shared-trips'));
}

/** One Shared Trip with its ordered Places and every note. Owner or joined member only. */
export async function getSharedTrip(collectionId: string): Promise<SharedTripDetail> {
  return parseSharedTripDetail(
    await authenticatedApiFetch<unknown>(`/shared-trips/${enc(collectionId)}`)
  );
}

/** The owner creates, or retrieves, the collection that publishes a Trip. No request body. */
export async function shareTrip(itineraryId: string): Promise<ShareTripResult> {
  const response = await authenticatedApiFetch<{
    collectionId?: unknown;
    created?: unknown;
    url?: unknown;
  }>(`/itinerary/${enc(itineraryId)}/share`, { method: 'POST' });
  if (
    typeof response?.collectionId !== 'string' ||
    typeof response.created !== 'boolean' ||
    typeof response.url !== 'string'
  ) {
    throw new ApiError(500, 'malformed_response');
  }
  return { collectionId: response.collectionId, created: response.created, url: response.url };
}

/** Joins as the signed-in user. Joining twice is harmless. */
export async function joinSharedTrip(collectionId: string): Promise<JoinResult> {
  const response = await authenticatedApiFetch<{ alreadyShared?: unknown } | undefined>(
    '/favourites-collection/share',
    { body: json({ collectionId }), method: 'POST' }
  );
  return { alreadyJoined: response?.alreadyShared === true };
}

/** Leaves the Trip. The server also removes the user's own notes on it. */
export async function leaveSharedTrip(collectionId: string): Promise<void> {
  await authenticatedApiFetch('/favourites-collection/exit', {
    body: json({ collectionId }),
    method: 'POST',
  });
}

type NoteWrite = { id: string };
function parseNoteWrite(response: unknown): NoteWrite {
  const id = (response as { id?: unknown } | undefined)?.id;
  if (typeof id !== 'string') throw new ApiError(500, 'malformed_response');
  return { id };
}

/** Creates or replaces the user's Trip-level note (the server keeps one per author). */
export async function saveCollectionNote(collectionId: string, text: string): Promise<NoteWrite> {
  return parseNoteWrite(
    await authenticatedApiFetch<unknown>('/collection-comments', {
      body: json({ collectionId, text }),
      method: 'POST',
    })
  );
}

export async function updateCollectionNote(noteId: string, text: string): Promise<void> {
  await authenticatedApiFetch(`/collection-comments/${enc(noteId)}`, {
    body: json({ text }),
    method: 'PATCH',
  });
}

export async function deleteCollectionNote(noteId: string): Promise<void> {
  await authenticatedApiFetch(`/collection-comments/${enc(noteId)}`, { method: 'DELETE' });
}

/** Creates or replaces the user's note on one Place of the Trip (by its stable item id). */
export async function savePlaceNote(itemId: string, text: string): Promise<NoteWrite> {
  return parseNoteWrite(
    await authenticatedApiFetch<unknown>('/collection-item-comments', {
      body: json({ collectionItemId: itemId, text }),
      method: 'POST',
    })
  );
}

export async function updatePlaceNote(noteId: string, text: string): Promise<void> {
  await authenticatedApiFetch(`/collection-item-comments/${enc(noteId)}`, {
    body: json({ text }),
    method: 'PATCH',
  });
}

export async function deletePlaceNote(noteId: string): Promise<void> {
  await authenticatedApiFetch(`/collection-item-comments/${enc(noteId)}`, { method: 'DELETE' });
}

/**
 * What anyone with the link may see before joining: the creator, the Places in order and the creator's
 * own notes, in one request and without a session. Participant notes are never part of it.
 */
export async function fetchCollectionPreview(collectionId: string): Promise<CollectionPreview> {
  return parseCollectionPreview(await apiFetch<unknown>(`/collections/${enc(collectionId)}/preview`));
}
