// What the Shared Trips screens decide, as plain functions: which Trips go in which list, whether a
// screen shows current or saved content, which actions the server's permissions allow, how the preview
// reacts to sign-in and membership, and the wording of confirmations and errors. The screens only draw
// these results, which keeps the rules testable without rendering.
import type {
  DetailAccess,
  DetailEntry,
  Resource,
} from '@/shared-trips/store';
import { classifyError, type SharedTripsError } from '@/shared-trips/errors';
import type {
  CollectionPreview,
  OwnedTripSummary,
  SharedTripDetail,
  PreviewNote,
  SharedTripNote,
  SharedTripSummary,
} from '@/shared-trips/types';

// ---- people -----------------------------------------------------------------------------------
/** The API does not always know a name (the account may not have one): never invent one. */
export const UNNAMED_TRAVELLER = 'a TripIdeas traveller';

export const ownerLabel = (owner: { displayName: string | null } | null | undefined) =>
  owner?.displayName?.trim() || UNNAMED_TRAVELLER;

export function authorLabel(note: SharedTripNote): string {
  if (note.mine) return 'You';
  const name = note.author.displayName?.trim();
  if (note.author.isCollectionOwner) return name ? `${name} (creator)` : 'Creator';
  return name || 'Another traveller';
}

/** Who wrote a note on the public preview (there is no "You": the visitor may not be signed in). */
export function previewAuthorLabel(note: PreviewNote): string {
  const name = note.author.displayName?.trim();
  if (note.author.isCollectionOwner) return name ? `${name} (creator)` : 'Creator';
  return name || 'Another traveller';
}

/** The viewer's own note, and everyone else's in the server's order. */
export function splitNotes(notes: SharedTripNote[]) {
  return {
    mine: notes.find((note) => note.mine) ?? null,
    others: notes.filter((note) => !note.mine),
  };
}

// ---- the Trips index: My Trips and Shared With Me ----------------------------------------------
export type SharedTripRow = {
  accessibilityLabel: string;
  id: string;
  placeCount: number;
  subtitle: string;
  title: string;
};

const placesText = (count: number) => `${count} ${count === 1 ? 'place' : 'places'}`;

/** Rows for Shared With Me. Anything the viewer owns is never listed here, whatever the source. */
export function sharedTripRows(list: SharedTripSummary[], viewerId: string | null): SharedTripRow[] {
  return list
    .filter((trip) => trip.owner.id !== viewerId)
    .map((trip) => ({
      accessibilityLabel: `Open ${trip.title}, shared by ${ownerLabel(trip.owner)}`,
      id: trip.id,
      placeCount: trip.placeCount,
      subtitle: `By ${ownerLabel(trip.owner)} · ${placesText(trip.placeCount)}`,
      title: trip.title,
    }));
}

/** Tells each owned Trip which collection (if any) publishes it, without duplicating the Trip. */
export function markSharedTrips<T extends { id: string }>(
  trips: T[],
  owned: OwnedTripSummary[] | null
): (T & { sharedCollectionId: string | null })[] {
  const byId = new Map((owned ?? []).map((trip) => [trip.id, trip.sharedCollectionId]));
  return trips.map((trip) => ({ ...trip, sharedCollectionId: byId.get(trip.id) ?? null }));
}

export type TripsView = 'mine' | 'shared';

export function emptySharedMessage(resource: Pick<Resource<unknown>, 'error' | 'status'>): string {
  if (resource.status === 'loading' || resource.status === 'idle') return 'Loading Shared Trips…';
  if (resource.error) return errorMessage(resource.error, 'load your Shared Trips');
  return 'No Shared Trips yet. When someone shares a Trip with you and you join it, it appears here.';
}

// ---- cached versus current ----------------------------------------------------------------------
export type Freshness =
  | { kind: 'cached'; message: string }
  | { kind: 'current'; message: null }
  | { kind: 'refresh-failed'; message: string };

export const formatWhen = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });

/**
 * Says whether what is on screen is the server's current answer. A saved copy (opened offline, or
 * not yet refreshed) and a refresh that failed are both labelled; neither is ever shown as current.
 */
export function freshness(
  resource: Pick<Resource<unknown>, 'data' | 'error' | 'loadedAt' | 'refreshing' | 'source'>,
  when: (ms: number) => string = formatWhen
): Freshness {
  if (!resource.data || resource.loadedAt === null) return { kind: 'current', message: null };
  const at = when(resource.loadedAt);
  if (resource.source === 'cache') {
    if (resource.refreshing) return { kind: 'cached', message: `Showing the copy saved ${at}. Refreshing…` };
    return {
      kind: 'cached',
      message:
        resource.error?.kind === 'offline'
          ? `You're offline. Showing the copy saved ${at}.`
          : resource.error?.kind === 'session-expired'
            ? `Sign in again to refresh. Showing the copy saved ${at}.`
            : `Showing the copy saved ${at}. Pull down to refresh.`,
    };
  }
  if (resource.error) {
    return {
      kind: 'refresh-failed',
      message:
        resource.error.kind === 'session-expired'
          ? `Sign in again to refresh. Showing the update from ${at}.`
          : `Couldn't refresh. Showing the update from ${at}.`,
    };
  }
  return { kind: 'current', message: null };
}

// ---- the joined Shared Trip ---------------------------------------------------------------------
export type DetailViewState =
  | { kind: 'error'; message: string }
  | { kind: 'gone' }
  | { kind: 'loading' }
  | { kind: 'not-joined' }
  | { kind: 'ready' }
  | { kind: 'sign-in' };

export function detailViewState(entry: DetailEntry | undefined): DetailViewState {
  if (entry?.access === 'not-joined') return { kind: 'not-joined' };
  if (entry?.access === 'gone') return { kind: 'gone' };
  if (entry?.data) return { kind: 'ready' };
  if (!entry || entry.status === 'idle' || entry.status === 'loading') return { kind: 'loading' };
  if (entry.error?.kind === 'session-expired') return { kind: 'sign-in' };
  return { kind: 'error', message: errorMessage(entry.error, 'open this Trip') };
}

/**
 * The actions this viewer is offered, straight from the server's permissions. The creator controls
 * structure (name, Places, order) in My Trips, so this screen has no structure controls at all;
 * `structure` only reports whether the server says the viewer could edit it.
 */
export function detailControls(detail: SharedTripDetail) {
  const { permissions, viewer } = detail;
  return {
    canLeave: permissions.canLeave && viewer.role === 'member',
    // Anyone on an active Shared Trip may pass the link on; only the creator may stop sharing.
    canReshare: detail.sharing.canReshare,
    canSaveCopy: permissions.canSaveCopy,
    canStopSharing: detail.sharing.canStop,
    canWritePlaceNotes: permissions.canAddPlaceNote,
    canWriteTripNote: permissions.canAddCollectionNote,
    isCreator: viewer.role === 'owner',
    structure: permissions.canEditStructure,
  };
}

export function membershipStatus(detail: SharedTripDetail, when: (iso: string) => string = (iso) => formatWhen(Date.parse(iso))) {
  if (detail.viewer.role === 'owner') return 'You created this Trip';
  return detail.viewer.joinedAt ? `You joined ${when(detail.viewer.joinedAt)}` : 'You are a member';
}

/** What the sharing state means to this viewer, when the link is off. */
export function sharingCaption(detail: SharedTripDetail): string | null {
  if (detail.sharing.active) return null;
  return detail.viewer.role === 'owner'
    ? 'Sharing is off. People who already joined keep their access. Share the Trip from My Trips to make a new link.'
    : `${ownerLabel(detail.owner)} has stopped sharing this Trip. You keep your access and your notes.`;
}

/** Shown before leaving. It must name the consequence for the leaver's own notes. */
export function leaveConfirmation(title: string) {
  return {
    cancelLabel: 'Cancel',
    confirmLabel: 'Leave Trip',
    message:
      `You will lose access to "${title}" and the notes shared in it.\n\n` +
      'Your own notes on this Trip will be deleted and cannot be restored, even if you rejoin. ' +
      "Other people's notes and the creator's Trip are not affected.",
    title: 'Leave this Trip?',
  };
}

export const deleteNoteConfirmation = (what: string) => ({
  cancelLabel: 'Cancel',
  confirmLabel: 'Delete note',
  message: `Your note on ${what} will be deleted for everyone on this Trip.`,
  title: 'Delete your note?',
});

// ---- the preview (before joining) ---------------------------------------------------------------
export type PreviewLoad =
  | 'loading'
  | { preview: CollectionPreview; status: 'ok' }
  | { status: 'not-found' }
  /** This API build has no preview route (a generic 404): never "the Trip was deleted". */
  | { status: 'unsupported' }
  | { status: 'unavailable' };

export type PreviewState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'open-shared' }
  | { kind: 'preview'; signInHint: string | null }
  | { kind: 'unavailable' }
  | { kind: 'unsupported' };

/** How a failed preview request is reported. A generic 404 is a missing capability, not a missing Trip. */
export function previewLoadFailure(error: unknown): Exclude<PreviewLoad, 'loading' | { status: 'ok' }> {
  const { kind, code } = classifyError(error);
  if (kind === 'not-found' || code === 'invalid_collection_id') return { status: 'not-found' };
  if (kind === 'unsupported') return { status: 'unsupported' };
  return { status: 'unavailable' };
}

/**
 * The preview reacts to who is looking: the creator and anyone who has joined go straight to the live
 * Trip (the server decides: `access` is "granted" for both); everyone else sees the preview, signed in
 * or not, with both actions available. While a signed-in visitor's access is still being checked the
 * screen waits rather than offering Join Trip to someone who already belongs.
 */
export function previewState(input: {
  access: DetailAccess | undefined;
  /** The visitor's own Trip read is running. */
  accessPending?: boolean;
  load: PreviewLoad;
  userId: string | null;
}): PreviewState {
  if (input.userId && input.access === 'granted') return { kind: 'open-shared' };
  if (input.load === 'loading') return { kind: 'loading' };
  if (input.load.status === 'not-found') return { kind: 'not-found' };
  if (input.load.status === 'unsupported') return { kind: 'unsupported' };
  if (input.load.status === 'unavailable') return { kind: 'unavailable' };
  if (input.userId && (input.access === undefined || (input.access === 'unknown' && input.accessPending))) {
    return { kind: 'loading' };
  }
  return {
    kind: 'preview',
    signInHint: input.userId ? null : 'Sign in to join this Trip or save your own copy.',
  };
}

/** The two choices are different things; the words say so. */
export const PREVIEW_ACTIONS = {
  copy: {
    explanation:
      'Make your own Trip from the creator\'s Places and notes. It stays yours: it will not change when they edit theirs, and your changes will not reach them.',
    label: 'Save a Copy',
  },
  join: {
    explanation: "Follow the creator's Trip as they update it and add your own notes. Everyone who joins can read each other's notes.",
    label: 'Join Trip',
  },
} as const;

// ---- sharing from My Trips -----------------------------------------------------------------------
export const SHARE_CHOICES = {
  copy: {
    label: 'Share a copy',
    message: 'People who open it get their own Trip, separate from yours.',
  },
  stop: {
    label: 'Stop sharing live Trip',
  },
  live: (alreadyShared: boolean) => ({
    label: alreadyShared ? 'Live Trip link' : 'Share live Trip',
    message: alreadyShared
      ? 'This Trip is already shared live. Anyone with the link can join it and add notes; they cannot change your Places.'
      : 'People who join see your Places as you update them and can add their own notes. They cannot change your Places.',
  }),
} as const;

/**
 * Whether "Share live Trip" just switched sharing on. The server's `created` only says the Trip's shared copy was
 * made now (the first time ever); sharing again after "Stop sharing" issues a new link on the existing copy, so it
 * also counts when sharing was off at the moment the person chose to share.
 */
export const isNewLiveShare = (created: boolean, wasSharing: boolean): boolean => created || !wasSharing;

/**
 * The dialog shown with the link after "Share live Trip". Sharing switched on just now says so; asking for the
 * link of a Trip that was already shared says it already is. (The same text used to be shown for both.)
 */
export function liveShareConfirmation(created: boolean, url: string): { message: string; title: string } {
  return created
    ? {
        message: `This Trip is now shared live. Anyone with the link can join it and add notes; they cannot change your Places.\n\n${url}`,
        title: 'Trip shared',
      }
    : {
        message: `${SHARE_CHOICES.live(true).message}\n\n${url}`,
        title: SHARE_CHOICES.live(true).label,
      };
}

export const liveShareMessage = (title: string, url: string) =>
  `Join my Trip "${title}" on TripIdeas: ${url}`;

/** A member (or the creator) passing on someone's Trip: the creator stays the owner. */
export const reshareMessage = (title: string, url: string) =>
  `Have a look at the Trip "${title}" on TripIdeas: ${url}`;

/** Shown before stopping. It must say what stays and what stops. */
export function stopSharingConfirmation(title: string) {
  return {
    cancelLabel: 'Cancel',
    confirmLabel: 'Stop sharing',
    message:
      `The current link to "${title}" will stop working for new people.\n\n` +
      'People who already joined keep their access and their notes. You can share the Trip again later; ' +
      'that makes a new link.',
    title: 'Stop sharing this Trip?',
  };
}

// ---- messages -----------------------------------------------------------------------------------
export function errorMessage(error: SharedTripsError | null | undefined, doing: string): string {
  switch (error?.kind) {
    case 'offline':
      return `Can't reach TripIdeas to ${doing}. Check your connection and try again.`;
    case 'session-expired':
      return 'Your session has ended. Sign in again to continue.';
    case 'unsupported':
      return 'This version of TripIdeas is not ready for Shared Trips yet. Please try again later.';
    case 'not-joined':
      return "You haven't joined this Trip.";
    case 'not-found':
      return 'This Trip is no longer available.';
    case 'server':
      return `Something went wrong on our side while trying to ${doing}. Please try again.`;
    default:
      return `Could not ${doing}.`;
  }
}

export function shareErrorMessage(error: SharedTripsError): string {
  if (error.code === 'personal_places_not_shareable') {
    return "Trips with Personal Places can't be shared live yet. Remove the Personal Places, or share a copy instead.";
  }
  return errorMessage(error, 'share this Trip');
}

export function membershipErrorMessage(action: 'joining' | 'leaving', error: SharedTripsError): string {
  if (action === 'joining' && error.kind === 'not-found') {
    return 'This link is no longer active. Ask the person who shared it for a new link.';
  }
  if (action === 'joining' && error.kind === 'rejected') {
    return 'This Trip could not be joined. The link may be out of date, or it may be your own Trip.';
  }
  return errorMessage(error, action === 'joining' ? 'join this Trip' : 'leave this Trip');
}

/** Passing a link on, or stopping sharing. */
export function linkErrorMessage(error: SharedTripsError, doing: 'reshare' | 'stop'): string {
  switch (error.kind) {
    case 'sharing-off':
      return 'Sharing is turned off for this Trip. Only the creator can turn it on again.';
    case 'owner-only':
      return 'Only the creator can start or stop sharing this Trip.';
    case 'not-joined':
    case 'not-found':
      return 'This Trip is no longer available to you.';
    default:
      return errorMessage(error, doing === 'reshare' ? 'get the link' : 'stop sharing');
  }
}

export function noteErrorMessage(error: SharedTripsError): string {
  switch (error.kind) {
    case 'forbidden':
      return 'You can only change your own notes.';
    case 'not-joined':
      return "You're no longer part of this Trip, so your note was not saved.";
    case 'not-found':
      return 'This Trip is no longer available.';
    case 'rejected':
      return "This note couldn't be saved. The Trip may have changed; it has been refreshed.";
    default:
      return errorMessage(error, 'save your note');
  }
}
