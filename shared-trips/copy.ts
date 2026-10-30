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
//  - someone who has NOT joined, from the public preview. The preview contract has no notes, so the
//    creator's notes are read from the existing public note endpoints. If any of those reads fails the
//    copy is not made: it never silently continues without the creator's notes.
import { classifyError, SharedTripsFailure } from '@/shared-trips/errors';
import type { SharedTrip } from '@/trips/shared-trip';
import {
  saveSharedTrip,
  type SaveDependencies,
  type SaveOutcome,
} from '@/trips/shared-trip-save';
import type {
  CollectionPreview,
  PublicNote,
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
export type PublicNoteReaders = {
  fetchPlaceNotes: (itemId: string) => Promise<PublicNote[]>;
  fetchTripNotes: (collectionId: string) => Promise<PublicNote[]>;
};

const CONCURRENCY = 6;
const fromOwner = (notes: PublicNote[], ownerId: string) =>
  notes.find((note) => note.authorId === ownerId)?.text ?? '';

/**
 * Builds the copy source for someone who has not joined. Reads the creator's Trip note and the
 * creator's note on every Place; throws SharedTripsFailure (never returns a partial Trip) if any
 * read fails.
 */
export async function loadPreviewCopySource(
  preview: CollectionPreview,
  readers: PublicNoteReaders
): Promise<SharedTrip> {
  try {
    const tripNote = fromOwner(await readers.fetchTripNotes(preview.id), preview.ownerId);
    const placeNotes: string[] = new Array(preview.items.length).fill('');
    let next = 0;
    const worker = async () => {
      while (next < preview.items.length) {
        const index = next;
        next += 1;
        placeNotes[index] = fromOwner(
          await readers.fetchPlaceNotes(preview.items[index].id),
          preview.ownerId
        );
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, preview.items.length) }, worker));
    return {
      note: tripNote,
      places: preview.items.map((item, index) => ({
        note: placeNotes[index],
        placeId: item.placeId,
        title: '',
      })),
      title: preview.name,
    };
  } catch (error) {
    throw error instanceof SharedTripsFailure ? error : new SharedTripsFailure(classifyError(error));
  }
}

/** The creator's display name when the public Trip notes happen to carry it (only if they wrote one). */
export const creatorNameFromPublicNotes = (notes: PublicNote[], ownerId: string): string | null =>
  notes.find((note) => note.authorId === ownerId)?.authorName ?? null;
