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
  parseShareLink,
  parseSharedTripDetail,
  parseSharedTripList,
} from '@/shared-trips/parse';
import type {
  CollectionPreview,
  JoinResult,
  OwnedTripSummary,
  ShareLink,
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
    sharingActive: trip.sharingActive === true,
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

/**
 * Joins as the signed-in user. The link's token proves the person was given the link; someone who is
 * already a member needs none. Joining twice is harmless.
 */
export async function joinSharedTrip(collectionId: string, token?: string | null): Promise<JoinResult> {
  const response = await authenticatedApiFetch<{ alreadyShared?: unknown } | undefined>(
    '/favourites-collection/share',
    { body: json(token ? { collectionId, shareKey: token } : { collectionId }), method: 'POST' }
  );
  return { alreadyJoined: response?.alreadyShared === true };
}

/** Re-displays the Trip's EXISTING link so a member or the creator can pass it on. Never turns sharing on. */
export async function getShareLink(collectionId: string): Promise<ShareLink> {
  return parseShareLink(
    await authenticatedApiFetch<unknown>(`/favourites-collection/${enc(collectionId)}/share-link`, { method: 'POST' })
  );
}

/** Creator only: the old link stops working for new people; members, notes and Places stay. */
export async function stopSharingTrip(collectionId: string): Promise<void> {
  await authenticatedApiFetch(`/favourites-collection/${enc(collectionId)}/share-link`, { method: 'DELETE' });
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
 * What anyone with the link may see before joining: the creator, the Places in order and every note
 * with its author, in one request and without a session. The link's token is required.
 */
export async function fetchCollectionPreview(collectionId: string, token: string | null): Promise<CollectionPreview> {
  const query = token ? `?k=${enc(token)}` : '';
  return parseCollectionPreview(await apiFetch<unknown>(`/collections/${enc(collectionId)}/preview${query}`));
}
