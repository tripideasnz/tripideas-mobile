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
  /** The share link: anyone may reshare an active one; only the creator may stop it. */
  sharing: { active: boolean; canReshare: boolean; canStop: boolean };
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

/** A note on the public preview: shared content, with its author's public name only. */
export type PreviewNote = {
  author: { displayName: string | null; isCollectionOwner: boolean };
  text: string;
  updatedAt: string;
};

/**
 * The public preview of a Shared Trip (GET /collections/:id/preview?k=): what anyone with the link sees
 * before joining. Every note is shared content, so every note is here with its author.
 */
export type CollectionPreview = {
  /** The creator's public name; null when the account has none (never an email address). */
  creatorName: string | null;
  id: string;
  /** In the creator's order; each Place carries everyone's notes on it. */
  places: { notes: PreviewNote[]; placeId: string }[];
  title: string;
  /** Trip-level notes from everyone. */
  tripNotes: PreviewNote[];
};

/** An owned Trip, with the collection it publishes once shared. */
export type OwnedTripSummary = {
  id: string;
  name: string;
  /** Null until the owner shares the Trip; kept after Stop Sharing (its participants and notes stay). */
  sharedCollectionId: string | null;
  /** The share link is on right now. */
  sharingActive: boolean;
};

export type ShareTripResult = { collectionId: string; created: boolean; url: string };

export type JoinResult = { alreadyJoined: boolean };

/** The Trip's current share link, built by the server. */
export type ShareLink = { url: string };
