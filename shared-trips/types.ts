// Shared Trips (live collections): the shapes the app uses. They mirror the API contract documented in
// tripideas-api `src/app/trip-sharing/shared-trip-api.md` (capability `shared-trips-v1`); they carry no
// email address and no internal Trip link, because the API sends neither.

export type SharedTripAuthor = {
  displayName: string | null;
  id: string;
  /** The author owns the collection: their notes mirror the Trip's own notes. */
  isCollectionOwner: boolean;
};

export type SharedTripNote = {
  author: SharedTripAuthor;
  canDelete: boolean;
  canEdit: boolean;
  createdAt: string;
  id: string;
  mine: boolean;
  text: string;
  updatedAt: string;
};

export type SharedTripPlace = {
  /** The stable collection item id; collaborative Place notes attach to it. */
  itemId: string;
  notes: SharedTripNote[];
  placeId: string;
  position: number;
};

export type SharedTripPermissions = {
  canAddCollectionNote: boolean;
  canAddPlaceNote: boolean;
  canEditStructure: boolean;
  canInvite: boolean;
  canLeave: boolean;
  canSaveCopy: boolean;
};

export type SharedTripDetail = {
  collection: { createdAt: string; id: string; title: string; updatedAt: string };
  notes: SharedTripNote[];
  owner: { displayName: string | null; id: string };
  permissions: SharedTripPermissions;
  places: SharedTripPlace[];
  structure: { managedByTrip: boolean };
  viewer: { id: string; joinedAt: string | null; role: 'member' | 'owner' };
};

/** One row of "Shared With Me". */
export type SharedTripSummary = {
  id: string;
  joinedAt: string;
  managedByTrip: boolean;
  owner: { displayName: string | null; id: string };
  placeCount: number;
  title: string;
  updatedAt: string;
};

/**
 * The public preview of a published Trip (GET /collections/:id/preview): what someone sees before
 * joining. It carries the creator's own words only, never a participant's note.
 */
export type CollectionPreview = {
  /** The creator's public name; null when the account has none (never an email address). */
  creatorName: string | null;
  id: string;
  /** The creator's Place notes sit on the Places, in the creator's order. */
  places: { note: string | null; placeId: string }[];
  title: string;
  /** The creator's Trip-level note. */
  tripNote: string | null;
};

/** An owned Trip, with the collection it publishes once shared. */
export type OwnedTripSummary = {
  id: string;
  name: string;
  /** Null until the owner shares the Trip. */
  sharedCollectionId: string | null;
};

export type ShareTripResult = { collectionId: string; created: boolean; url: string };

export type JoinResult = { alreadyJoined: boolean };
