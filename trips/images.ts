import type { MyTrip } from '@/trips/types';
import type { PlaceCardData } from '@/types/content';

export type TripImage = {
  alt: string;
  url: string;
};

export function getTripImages(
  trip: MyTrip,
  places: PlaceCardData[]
): TripImage[] {
  const placesById = new Map(
    places
      .filter((place) => place._id)
      .map((place) => [place._id as string, place])
  );

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
