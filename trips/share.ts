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
}: BuildTripShareMessageOptions) {
  const lines = ['TripIdeas.nz', trip.name];

  if (trip.note.trim()) {
    lines.push('', getShortNote(trip.note));
  }

  if (shareUrl) {
    lines.push('', shareUrl);
  } else {
    lines.push('', 'Public trip link unavailable.');
  }

  return lines.join('\n');
}
