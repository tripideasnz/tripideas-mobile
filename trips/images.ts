import type { MyTrip } from '@/trips/types';
import type { PlaceCardData } from '@/types/content';

export type TripImage = {
  alt: string;
  cacheKey?: string;
  url: string;
};

export function getTripImages(
  trip: MyTrip,
  places: PlaceCardData[],
  personalPhotoUrls: Record<string, string> = {}
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
        const url = personalPhotoUrls[entry.personalPlaceCard.id];
        return url ? [{
          alt: entry.personalPlaceCard.title ?? 'Personal Place photo',
          url,
        }] : [];
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
