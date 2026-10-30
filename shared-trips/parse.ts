// Strict parsing of the Shared Trip responses. A response missing a field the app depends on is
// `malformed_response` (never a half-filled Trip); fields the app does not know are ignored.
import { ApiError } from '@/lib/api-client';
import type {
  CollectionPreview,
  PreviewNote,
  ShareLink,
  SharedTripAuthor,
  SharedTripDetail,
  SharedTripNote,
  SharedTripPermissions,
  SharedTripPlace,
  SharedTripSummary,
} from '@/shared-trips/types';

const bad = (): never => {
  throw new ApiError(500, 'malformed_response');
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : bad();
}
const str = (value: unknown): string => (typeof value === 'string' ? value : bad());
const nullableStr = (value: unknown): string | null =>
  value === null ? null : typeof value === 'string' ? value : bad();
const bool = (value: unknown): boolean => (typeof value === 'boolean' ? value : bad());
const int = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : bad();
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : bad());

function parseAuthor(value: unknown): SharedTripAuthor {
  const v = record(value);
  return {
    displayName: nullableStr(v.displayName),
    id: str(v.id),
    isCollectionOwner: bool(v.isCollectionOwner),
  };
}

export function parseNote(value: unknown): SharedTripNote {
  const v = record(value);
  return {
    author: parseAuthor(v.author),
    canDelete: bool(v.canDelete),
    canEdit: bool(v.canEdit),
    createdAt: str(v.createdAt),
    id: str(v.id),
    mine: bool(v.mine),
    text: str(v.text),
    updatedAt: str(v.updatedAt),
  };
}

function parsePlace(value: unknown): SharedTripPlace {
  const v = record(value);
  return {
    itemId: str(v.itemId),
    notes: list(v.notes).map(parseNote),
    placeId: str(v.placeId),
    position: int(v.position),
  };
}

function parsePermissions(value: unknown): SharedTripPermissions {
  const v = record(value);
  return {
    canAddCollectionNote: bool(v.canAddCollectionNote),
    canAddPlaceNote: bool(v.canAddPlaceNote),
    canEditStructure: bool(v.canEditStructure),
    canInvite: bool(v.canInvite),
    canLeave: bool(v.canLeave),
    canSaveCopy: bool(v.canSaveCopy),
  };
}

const person = (value: unknown) => {
  const v = record(value);
  return { displayName: nullableStr(v.displayName), id: str(v.id) };
};

export function parseSharedTripDetail(value: unknown): SharedTripDetail {
  const v = record(value);
  const collection = record(v.collection);
  const viewer = record(v.viewer);
  const role = str(viewer.role);
  if (role !== 'owner' && role !== 'member') bad();
  const places = list(v.places).map(parsePlace);
  // The creator's order is the response order; positions must agree with it.
  places.forEach((place, index) => {
    if (place.position !== index) bad();
  });
  return {
    collection: {
      createdAt: str(collection.createdAt),
      id: str(collection.id),
      title: str(collection.title),
      updatedAt: str(collection.updatedAt),
    },
    notes: list(v.notes).map(parseNote),
    owner: person(v.owner),
    permissions: parsePermissions(v.permissions),
    places,
    sharing: parseSharing(v.sharing),
    structure: { managedByTrip: bool(record(v.structure).managedByTrip) },
    viewer: {
      id: str(viewer.id),
      joinedAt: nullableStr(viewer.joinedAt),
      role: role as 'member' | 'owner',
    },
  };
}

export function parseSharedTripSummary(value: unknown): SharedTripSummary {
  const v = record(value);
  return {
    id: str(v.id),
    joinedAt: str(v.joinedAt),
    managedByTrip: bool(v.managedByTrip),
    owner: person(v.owner),
    placeCount: int(v.placeCount),
    title: str(v.title),
    updatedAt: str(v.updatedAt),
  };
}

export function parseSharedTripList(value: unknown): SharedTripSummary[] {
  return list(record(value).sharedTrips).map(parseSharedTripSummary);
}

function parseSharing(value: unknown) {
  const v = record(value);
  return { active: bool(v.active), canReshare: bool(v.canReshare), canStop: bool(v.canStop) };
}

function parsePreviewNote(value: unknown): PreviewNote {
  const v = record(value);
  const author = record(v.author);
  return {
    author: { displayName: nullableStr(author.displayName), isCollectionOwner: bool(author.isCollectionOwner) },
    text: str(v.text),
    updatedAt: str(v.updatedAt),
  };
}

/**
 * The preview is all or nothing: a missing field, an out-of-order Place or a Place without an id means
 * the response is `malformed_response`, so a copy is never made from a half-read Trip.
 */
export function parseCollectionPreview(value: unknown): CollectionPreview {
  const v = record(value);
  const collection = record(v.collection);
  const sharing = record(v.sharing);
  if (sharing.status !== 'shared' || sharing.canSaveCopy !== true) bad();
  const places = list(v.places).map((item, index) => {
    const place = record(item);
    if (int(place.position) !== index) bad(); // contiguous, in the creator's order
    const placeId = str(place.placeId);
    if (!placeId) bad();
    return { notes: list(place.notes).map(parsePreviewNote), placeId };
  });
  const title = str(collection.title);
  if (!title.trim()) bad();
  return {
    creatorName: nullableStr(record(v.creator).displayName),
    id: str(collection.id),
    places,
    title,
    tripNotes: list(v.tripNotes).map(parsePreviewNote),
  };
}

/** The share link response: `{ active: true, url }`. */
export function parseShareLink(value: unknown): ShareLink {
  const v = record(value);
  if (v.active !== true) bad();
  const url = str(v.url);
  if (!url) bad();
  return { url };
}
