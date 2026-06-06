import type { MyTrip } from '@/trips/types';
import type { PlaceCardData } from '@/types/content';

const PUBLIC_TRIP_BASE_URL = 'https://tripideas.nz/trip';
const PUBLIC_TRIP_SHARE_API_URL =
  process.env.EXPO_PUBLIC_TRIP_SHARE_API_URL ??
  'https://www.tripideas.nz/api/trips/share';

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
      reason: 'backend-unavailable' | 'request-failed';
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
        imageAlt: place?.imageAlt,
        imageUrl: place?.imageUrl,
        note: tripPlace.note,
        placeId: tripPlace.placeId,
        slug: place?.slug?.current,
        subtitle: place?.subtitle,
        title: place?.title?.trim() || 'Untitled place',
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
  try {
    const response = await fetch(PUBLIC_TRIP_SHARE_API_URL, {
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
  } catch (error) {
    console.error(error);
    return { reason: 'request-failed', status: 'unavailable' };
  }
}
