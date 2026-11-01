import { requireHttpUrlEnv } from '@/config/required-env';
import type { MyTrip } from '@/trips/types';
import type { PlaceCardData } from '@/types/content';

// www is the canonical host: the apex redirects to it, and Universal Links are associated with it.
const PUBLIC_TRIP_BASE_URL = 'https://www.tripideas.nz/trip';
// The production API: the one value public Trip links are allowed to be created for. The configured
// API URL is compared with it; it is never a default for a missing one. It is a pattern, not the URL
// as one string, on purpose: scripts/verify-bundle-endpoints.js proves a production build was given
// EXPO_PUBLIC_API_URL by finding that exact URL in the bundle, which must therefore come only from
// the configuration (config/required-env.test.js guards this).
const PRODUCTION_API_URL = /^https:\/\/api\.tripideas\.nz$/i;

// Required, and read only once the gate above has opened: there is no default.
const publicTripShareApiUrl = () =>
  requireHttpUrlEnv('EXPO_PUBLIC_TRIP_SHARE_API_URL', process.env.EXPO_PUBLIC_TRIP_SHARE_API_URL);

// Public Trip links write permanent documents to the production Sanity dataset. Only builds
// that talk to the production API may create them; internal and integration builds fall back
// to text-only sharing. A missing or blank API URL never enables them: only the exact production
// URL does.
export function isPublicTripSharingEnabled(
  apiUrl: string | undefined = process.env.EXPO_PUBLIC_API_URL
): boolean {
  if (!apiUrl?.trim()) return false;
  return PRODUCTION_API_URL.test(apiUrl.trim().replace(/\/+$/, ''));
}

export type PublicTripPlaceSnapshot = {
  coordinates?: {
    lat: number;
    lng: number;
  };
  imageAlt?: string;
  imageUrl?: string;
  note: string;
  placeId: string;
  slug?: string;
  subtitle?: string;
  title: string;
};

export type PublicTripSnapshot = {
  coverImageUrl?: string;
  createdAt: string;
  note: string;
  placeCount: number;
  places: PublicTripPlaceSnapshot[];
  sourceTripId: string;
  title: string;
  updatedAt: string;
};

export type PublicTripOpenGraphData = {
  description: string;
  image?: string;
  title: string;
};

export type CreatePublicTripShareResult =
  | {
      shareId: string;
      status: 'created';
      url: string;
    }
  | {
      reason: 'backend-unavailable' | 'disabled' | 'request-failed';
      status: 'unavailable';
    };

export function buildPublicTripUrl(shareId: string) {
  const normalizedShareId = shareId.trim();

  if (!normalizedShareId) {
    throw new Error('A server-issued share ID is required.');
  }

  return `${PUBLIC_TRIP_BASE_URL}/${encodeURIComponent(normalizedShareId)}`;
}

export function buildPublicTripSnapshot({
  coverImageUrl,
  places,
  trip,
}: {
  coverImageUrl?: string;
  places: PlaceCardData[];
  trip: MyTrip;
}): PublicTripSnapshot {
  const placesById = new Map(
    places
      .filter((place) => place._id)
      .map((place) => [place._id as string, place])
  );

  return {
    coverImageUrl,
    createdAt: trip.createdAt,
    note: trip.note,
    placeCount: trip.places.length,
    places: trip.places.map((tripPlace) => {
      const place = placesById.get(tripPlace.placeId);
      const lat = place?.coordinates?.lat;
      const lng = place?.coordinates?.lng;
      const coordinates =
        typeof lat === 'number' && typeof lng === 'number'
          ? { lat, lng }
          : undefined;

      return {
        coordinates,
        imageAlt:
          typeof place?.imageAlt === 'string' ? place.imageAlt : undefined,
        imageUrl: place?.imageUrl,
        note: tripPlace.note,
        placeId: tripPlace.placeId,
        slug: place?.slug?.current,
        subtitle:
          typeof place?.subtitle === 'string' ? place.subtitle : undefined,
        title: place?.title?.trim() ?? '',
      };
    }),
    sourceTripId: trip.id,
    title: trip.name,
    updatedAt: trip.updatedAt,
  };
}

export function buildPublicTripOpenGraphData(
  snapshot: PublicTripSnapshot
): PublicTripOpenGraphData {
  return {
    description: `${snapshot.placeCount} ${
      snapshot.placeCount === 1 ? 'place' : 'places'
    } • Created with TripIdeas`,
    image: snapshot.coverImageUrl,
    title: snapshot.title,
  };
}

export async function createPublicTripShare(
  snapshot: PublicTripSnapshot
): Promise<CreatePublicTripShareResult> {
  if (!isPublicTripSharingEnabled()) {
    return { reason: 'disabled', status: 'unavailable' };
  }
  // Outside the try: a configuration error must surface, not be reported as a network failure.
  const shareApiUrl = publicTripShareApiUrl();
  try {
    const response = await fetch(shareApiUrl, {
      body: JSON.stringify(snapshot),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    if (!response.ok) {
      return {
        reason:
          response.status === 404 || response.status === 503
            ? 'backend-unavailable'
            : 'request-failed',
        status: 'unavailable',
      };
    }

    const data: unknown = await response.json();

    if (
      !data ||
      typeof data !== 'object' ||
      !('shareId' in data) ||
      !('url' in data) ||
      typeof data.shareId !== 'string' ||
      typeof data.url !== 'string'
    ) {
      return { reason: 'request-failed', status: 'unavailable' };
    }

    return {
      shareId: data.shareId,
      status: 'created',
      url: data.url,
    };
  } catch {
    return { reason: 'request-failed', status: 'unavailable' };
  }
}
