import type { MyTrip } from '@/trips/types';
import type { PlaceCardData } from '@/types/content';

export type TripImage = {
  alt: string;
  /** Stable image-cache identity (private photos); never derived from a signed URL. */
  cacheKey?: string;
  /** The photo could not be loaded: shown as a retry placeholder. */
  failed?: boolean;
  /** Private photo asset, used to report errors and retry. */
  photoAssetId?: string;
  url: string;
};

/** A Personal Place photo for a Trip: a bare URL, or a loaded/failed photo. */
export type PersonalTripPhoto =
  | string
  | {
      cacheKey?: string;
      failed?: boolean;
      photoAssetId?: string;
      url?: string | null;
    };

export function getTripImages(
  trip: MyTrip,
  places: PlaceCardData[],
  personalPhotoUrls: Record<string, PersonalTripPhoto> = {}
): TripImage[] {
  const placesById = new Map(
    places
      .filter((place) => place._id)
      .map((place) => [place._id as string, place])
  );

  if (trip.entries) {
    return trip.entries.flatMap((entry) => {
      if (entry.type === 'personalPlaceCard') {
        if (!('personalPlaceCard' in entry)) return [];
        const photo = personalPhotoUrls[entry.personalPlaceCard.id];
        if (!photo) return [];
        const ref = typeof photo === 'string' ? { url: photo } : photo;
        if (!ref.url && !ref.failed) return [];
        return [{
          alt: entry.personalPlaceCard.title ?? 'Personal Place photo',
          ...(ref.cacheKey ? { cacheKey: ref.cacheKey } : {}),
          ...(ref.failed ? { failed: true } : {}),
          ...(ref.photoAssetId ? { photoAssetId: ref.photoAssetId } : {}),
          url: ref.url ?? '',
        }];
      }
      const place = placesById.get(entry.editorialPlace.id);
      return place?.imageUrl ? [{
        alt: place.imageAlt ?? place.title ?? `${trip.name} trip image`,
        url: place.imageUrl,
      }] : [];
    });
  }
  return trip.places.flatMap((tripPlace) => {
    const place = placesById.get(tripPlace.placeId);

    if (!place?.imageUrl) {
      return [];
    }

    return [
      {
        alt: place.imageAlt ?? place.title ?? `${trip.name} trip image`,
        url: place.imageUrl,
      },
    ];
  });
}

export function getTripThumbnail(
  trip: MyTrip,
  places: PlaceCardData[]
): TripImage | undefined {
  return getTripImages(trip, places)[0];
}
