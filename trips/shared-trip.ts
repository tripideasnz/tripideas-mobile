// Receiving a shared Trip (B2): fetch the public snapshot and turn it into the B1 import request.
//
// Snapshots are Sanity `publicTrip` documents with private (dotted) IDs, so the app cannot query
// them. The web app serves a read-only JSON view at GET /api/trips/share/<shareId>.
/** 16 lowercase hex characters, as issued by the web share endpoint. */
export const SHARE_ID_PATTERN = /^[0-9a-f]{16}$/;

const SNAPSHOT_BASE_URL = (
  process.env.EXPO_PUBLIC_TRIP_SHARE_API_URL ??
  'https://www.tripideas.nz/api/trips/share'
).replace(/\/+$/, '');

export type SharedTripPlace = {
  coordinates?: { lat: number; lng: number };
  imageAlt?: string;
  imageUrl?: string;
  note: string;
  placeId: string;
  slug?: string;
  subtitle?: string;
  title: string;
};

export type SharedTrip = {
  coverImageUrl?: string;
  note: string;
  places: SharedTripPlace[];
  title: string;
};

export type SharedTripLoad =
  | { status: 'ok'; trip: SharedTrip }
  | { status: 'not-found' }
  | { status: 'unavailable' };

/** The B1 POST /itinerary/import body. */
export type ImportTripRequest = {
  description: string;
  entries: { note: string; placeId: string }[];
  id: string;
  name: string;
};

export function normalizeShareId(
  value: string | string[] | undefined
): string | null {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim();
  return candidate && SHARE_ID_PATTERN.test(candidate) ? candidate : null;
}

export function buildSharedTripSnapshotUrl(shareId: string): string {
  return `${SNAPSHOT_BASE_URL}/${encodeURIComponent(shareId)}`;
}

const optionalString = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

function parsePlace(value: unknown): SharedTripPlace | null {
  if (!value || typeof value !== 'object') return null;
  const place = value as Record<string, unknown>;
  if (typeof place.placeId !== 'string' || place.placeId.length === 0) return null;
  if (typeof place.title !== 'string') return null;
  if (place.note !== undefined && place.note !== null && typeof place.note !== 'string') {
    return null;
  }
  const coordinates = place.coordinates as Record<string, unknown> | undefined;
  return {
    coordinates:
      coordinates &&
      typeof coordinates.lat === 'number' &&
      typeof coordinates.lng === 'number'
        ? { lat: coordinates.lat, lng: coordinates.lng }
        : undefined,
    imageAlt: optionalString(place.imageAlt),
    imageUrl: optionalString(place.imageUrl),
    note: typeof place.note === 'string' ? place.note : '',
    placeId: place.placeId,
    slug: optionalString(place.slug),
    subtitle: optionalString(place.subtitle),
    title: place.title,
  };
}

/** Strict: a snapshot with any malformed Place is treated as unusable rather than trimmed. */
export function parseSharedTrip(value: unknown): SharedTrip | null {
  if (!value || typeof value !== 'object') return null;
  const trip = value as Record<string, unknown>;
  if (typeof trip.title !== 'string' || trip.title.trim().length === 0) return null;
  if (trip.note !== undefined && trip.note !== null && typeof trip.note !== 'string') {
    return null;
  }
  if (!Array.isArray(trip.places)) return null;
  const places: SharedTripPlace[] = [];
  for (const raw of trip.places) {
    const place = parsePlace(raw);
    if (!place) return null;
    places.push(place);
  }
  return {
    coverImageUrl: optionalString(trip.coverImageUrl),
    note: typeof trip.note === 'string' ? trip.note : '',
    places,
    title: trip.title,
  };
}

export async function fetchSharedTrip(
  shareId: string,
  fetcher: typeof fetch = fetch
): Promise<SharedTripLoad> {
  if (!SHARE_ID_PATTERN.test(shareId)) return { status: 'not-found' };
  let response: Response;
  try {
    response = await fetcher(buildSharedTripSnapshotUrl(shareId), {
      headers: { Accept: 'application/json' },
    });
  } catch {
    return { status: 'unavailable' };
  }
  if (response.status === 404) return { status: 'not-found' };
  if (!response.ok) return { status: 'unavailable' };
  try {
    const trip = parseSharedTrip(await response.json());
    return trip ? { status: 'ok', trip } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

/**
 * Title, Trip note, editorial Place IDs, Place notes and order are copied; nothing else
 * from the snapshot (titles, images, coordinates) is sent or trusted by the server.
 * The same snapshot and attempt ID always produce the same body, which is what lets
 * the server treat a retry as the same Save.
 */
export function buildImportRequest(
  attemptId: string,
  trip: SharedTrip
): ImportTripRequest {
  return {
    description: trip.note,
    entries: trip.places.map((place) => ({
      note: place.note,
      placeId: place.placeId,
    })),
    id: attemptId,
    name: trip.title,
  };
}
