// Save a Copy of a live Shared Trip: an independent Trip owned by the recipient.
//
// This reuses the existing, supported Save workflow (trips/shared-trip-save.ts: persistent attempt id,
// capability check, retries, conflict handling) and the B1 import endpoint without changing either. The
// only new code adapts a Shared Trip into the snapshot shape that workflow already accepts.
//
// What is copied: title, the owner's Trip note, the Places in the owner's order and the OWNER's note on
// each Place. What is never copied: any other participant's note, the membership, the collection id or
// anything that would keep the copy connected to its source. The import endpoint accepts only those
// fields, so nothing else can travel even by mistake.
import type { SharedTrip } from '@/trips/shared-trip';
import {
  saveSharedTrip,
  type SaveDependencies,
  type SaveOutcome,
} from '@/trips/shared-trip-save';
import type { SharedTripDetail, SharedTripNote } from '@/shared-trips/types';

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

export function saveCopyOfSharedTrip(
  dependencies: SaveDependencies,
  request: { detail: SharedTripDetail; mode: 'resume' | 'tap'; userId: string | null }
): Promise<SaveOutcome> {
  return saveSharedTrip(dependencies, {
    mode: request.mode,
    shareId: liveCopyKey(request.detail.collection.id),
    trip: toSharedTripSnapshot(request.detail),
    userId: request.userId,
  });
}
