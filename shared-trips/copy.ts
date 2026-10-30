// Save a Copy of a live Shared Trip: an independent Trip owned by the recipient.
//
// This reuses the existing, supported Save workflow (trips/shared-trip-save.ts: persistent attempt id,
// capability check, retries, conflict handling) and the B1 import endpoint without changing either. The
// only code here adapts a Shared Trip into the snapshot shape that workflow already accepts.
//
// What is copied: title, the owner's Trip note, the Places in the owner's order and the OWNER's note on
// each Place. What is never copied: any other participant's note, the membership, the collection id or
// anything that would keep the copy connected to its source. The import endpoint accepts only those
// fields, so nothing else can travel even by mistake.
//
// Two sources are supported:
//  - a joined member's Shared Trip (the consolidated read already carries every note and its author);
//  - someone who has NOT joined, from the consolidated public preview (GET /collections/:id/preview),
//    which shows everyone's notes with their authors; only the creator's are copied. An incomplete
//    preview is refused as a whole: it never silently continues without the creator's notes.
import { SharedTripsFailure } from '@/shared-trips/errors';
import type { SharedTrip } from '@/trips/shared-trip';
import {
  saveSharedTrip,
  type SaveDependencies,
  type SaveOutcome,
} from '@/trips/shared-trip-save';
import type {
  CollectionPreview,
  PreviewNote,
  SharedTripDetail,
  SharedTripNote,
} from '@/shared-trips/types';

/** The Save workflow keys its persistent attempt by a source id; live Trips use their own namespace. */
export const liveCopyKey = (collectionId: string) => `live-${collectionId}`;

const ownerText = (notes: SharedTripNote[]) =>
  notes.find((note) => note.author.isCollectionOwner)?.text ?? '';

export function toSharedTripSnapshot(detail: SharedTripDetail): SharedTrip {
  return {
    note: ownerText(detail.notes),
    places: detail.places.map((place) => ({
      note: ownerText(place.notes),
      placeId: place.placeId,
      title: '',
    })),
    title: detail.collection.title,
  };
}

type SaveRequestBase = { mode: 'resume' | 'tap'; userId: string | null };

export function saveCopyFromSnapshot(
  dependencies: SaveDependencies,
  request: SaveRequestBase & { collectionId: string; trip: SharedTrip }
): Promise<SaveOutcome> {
  return saveSharedTrip(dependencies, {
    mode: request.mode,
    shareId: liveCopyKey(request.collectionId),
    trip: request.trip,
    userId: request.userId,
  });
}

export function saveCopyOfSharedTrip(
  dependencies: SaveDependencies,
  request: SaveRequestBase & { detail: SharedTripDetail }
): Promise<SaveOutcome> {
  return saveCopyFromSnapshot(dependencies, {
    collectionId: request.detail.collection.id,
    mode: request.mode,
    trip: toSharedTripSnapshot(request.detail),
    userId: request.userId,
  });
}

// ---- from the public preview -------------------------------------------------------------------
/** The creator's own words among everyone's: the only notes a copy takes. */
const creatorText = (notes: PreviewNote[]) =>
  notes.find((note) => note.author.isCollectionOwner)?.text ?? '';

/**
 * The copy source for someone who has not joined, from the consolidated preview: the creator's title,
 * Trip note, Places in order and the creator's note on each. The preview shows everyone's notes (they are
 * shared content), but a copy takes ONLY the creator's: no participant's note can reach it. Throws
 * SharedTripsFailure (never returns a partial Trip) if the preview is not complete enough to copy.
 */
export function toPreviewSnapshot(preview: CollectionPreview): SharedTrip {
  if (!preview.title.trim() || preview.places.some((place) => !place.placeId)) {
    throw new SharedTripsFailure({ code: 'incomplete_preview', kind: 'rejected' });
  }
  return {
    note: creatorText(preview.tripNotes),
    places: preview.places.map((place) => ({ note: creatorText(place.notes), placeId: place.placeId, title: '' })),
    title: preview.title,
  };
}
