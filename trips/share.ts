import { getTripImages } from '@/trips/images';
import type { MyTrip } from '@/trips/types';
import type { PlaceCardData } from '@/types/content';

type BuildTripShareMessageOptions = {
  shareUrl?: string;
  trip: MyTrip;
  places: PlaceCardData[];
};

type BuildTripShareCardDataOptions = {
  logoAlt?: string;
  logoUrl?: string;
  trip: MyTrip;
  places: PlaceCardData[];
};

export type TripShareCardData = {
  coverImageAlt?: string;
  coverImageUrl?: string;
  galleryImageUrls: string[];
  logoAlt?: string;
  logoUrl?: string;
  note?: string;
  placeCount: number;
  title: string;
};

function getShortNote(note: string) {
  const trimmedNote = note.trim();

  if (trimmedNote.length <= 180) {
    return trimmedNote;
  }

  return `${trimmedNote.slice(0, 177).trimEnd()}...`;
}

export function buildTripShareCardData({
  logoAlt,
  logoUrl,
  trip,
  places,
}: BuildTripShareCardDataOptions): TripShareCardData {
  const tripImages = getTripImages(trip, places);
  const heroImage = tripImages[0];
  const note = getShortNote(trip.note);

  return {
    coverImageAlt: heroImage?.alt,
    coverImageUrl: heroImage?.url,
    galleryImageUrls: tripImages.map((image) => image.url).slice(0, 4),
    logoAlt,
    logoUrl,
    note: note || undefined,
    placeCount: trip.places.length,
    title: trip.name,
  };
}

export function buildTripShareMessage({
  shareUrl,
  trip,
  places,
}: BuildTripShareMessageOptions) {
  const placesById = new Map(
    places
      .filter((place) => place._id)
      .map((place) => [place._id as string, place])
  );
  const lines = ['TripIdeas', trip.name];

  if (trip.note.trim()) {
    lines.push('', getShortNote(trip.note));
  }

  lines.push(
    '',
    `${trip.places.length} ${
      trip.places.length === 1 ? 'place' : 'places'
    }`
  );

  if (trip.places.length > 0) {
    lines.push('', 'Trip places');

    trip.places.forEach((tripPlace, index) => {
      const place = placesById.get(tripPlace.placeId);
      const placeTitle = place?.title?.trim();

      if (placeTitle) {
        lines.push(`${index + 1}. ${placeTitle}`);
      }

      if (tripPlace.note.trim()) {
        lines.push(`   ${tripPlace.note.trim()}`);
      }
    });
  }

  if (shareUrl) {
    lines.push('', `View this trip: ${shareUrl}`);
  } else {
    lines.push(
      '',
      'Shared from TripIdeas. Public trip links are not available yet.'
    );
  }

  return lines.join('\n');
}
