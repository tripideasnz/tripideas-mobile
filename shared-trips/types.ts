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

/** The note-free public preview of a collection (what someone sees before joining). */
export type CollectionPreview = {
  createdAt: string;
  id: string;
  items: { id: string; placeId: string }[];
  name: string;
  ownerId: string;
  updatedAt: string;
};

/** An owned Trip, with the collection it publishes once shared. */
export type OwnedTripSummary = {
  id: string;
  name: string;
  /** Null until the owner shares the Trip. */
  sharedCollectionId: string | null;
};

/** A note as the public preview endpoints expose it (author id and display name only). */
export type PublicNote = { authorId: string; authorName: string | null; text: string };

export type ShareTripResult = { collectionId: string; created: boolean; url: string };

export type JoinResult = { alreadyJoined: boolean };
